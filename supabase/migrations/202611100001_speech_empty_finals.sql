-- Keep empty provider finals as immutable sequence evidence; never score silence.
-- No transcript/report backfill. Run in one reviewed transaction with history.
set lock_timeout='5s';
alter table samvaad.speech_turns drop constraint speech_turns_text_check;
alter table samvaad.speech_turns add constraint speech_turns_text_check
 check(char_length(text)<=20000 and (actor='student' or char_length(text)>=1)) not valid;
alter table samvaad.speech_turns validate constraint speech_turns_text_check;

create or replace function samvaad.speech_event(p_run uuid,p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r samvaad.speech_runs; existing samvaad.speech_turns; result bigint; idx integer;
 turns jsonb; raw text;
begin
 select * into r from samvaad.speech_runs where id=p_run for update;
 if not found or r.state not in ('active','draining') then raise exception 'SESSION_NOT_ACTIVE'; end if;
 perform 1 from samvaad.sessions where id=r.session_id and status='in_progress' for update;
 if not found then raise exception 'SESSION_NOT_ACTIVE'; end if;
 if now()>r.deadline+interval '25 seconds' then raise exception 'SESSION_EXPIRED'; end if;
 if p_action='heartbeat' then
   update samvaad.speech_runs set heartbeat_at=now() where id=r.id;
 elsif p_action='ready' then
   if r.provider_request_id is not null or nullif(p_data->>'requestId','') is null then raise exception 'VALIDATION_ERROR'; end if;
   update samvaad.speech_runs set provider_request_id=p_data->>'requestId' where id=r.id;
 elsif p_action='student' then
   idx:=(p_data->>'index')::integer;
   if r.provider_request_id is null or p_data->>'segmentId' is distinct from r.provider_request_id||'-seg-'||idx or nullif(p_data->>'utteranceId','') is null then raise exception 'VALIDATION_ERROR'; end if;
   select * into existing from samvaad.speech_turns where run_id=r.id and segment_index=idx;
   if found then
     if existing.text is distinct from p_data->>'text' or existing.provider_segment_id is distinct from p_data->>'segmentId' or existing.utterance_id is distinct from p_data->>'utteranceId' then raise exception 'EVIDENCE_CONFLICT'; end if;
     return jsonb_build_object('id',existing.id);
   end if;
   if idx<>r.last_segment+1 or idx>2000 or (select coalesce(sum(char_length(text)),0) from samvaad.speech_turns where run_id=r.id)+char_length(p_data->>'text')>120000 then raise exception 'VALIDATION_ERROR'; end if;
   insert into samvaad.speech_turns(run_id,actor,text,provider_segment_id,segment_index,utterance_id,delivery)
   values(r.id,'student',p_data->>'text',p_data->>'segmentId',idx,p_data->>'utteranceId','provider-final') returning id into result;
   update samvaad.speech_runs set last_segment=idx,heartbeat_at=now() where id=r.id;
   return jsonb_build_object('id',result);
 elsif p_action='assistant' then
   if r.state<>'active' or now()>=r.deadline or p_data->>'actor' not in ('coach','moderator','peer_a','peer_b') then raise exception 'VALIDATION_ERROR'; end if;
   if (select count(*) from samvaad.speech_turns where run_id=r.id and actor<>'student')>=18 then raise exception 'CAPACITY_LIMIT'; end if;
   insert into samvaad.speech_turns(run_id,actor,text,delivery) values(r.id,p_data->>'actor',p_data->>'text','generated') returning id into result;
   return jsonb_build_object('id',result);
 elsif p_action='delivery' then
   if p_data->>'state' is null or p_data->>'state' not in ('sent','interrupted') then raise exception 'VALIDATION_ERROR'; end if;
   select * into existing from samvaad.speech_turns where id=(p_data->>'id')::bigint and run_id=r.id and actor<>'student';
   if not found then raise exception 'VALIDATION_ERROR'; end if;
   if existing.delivery=p_data->>'state' then return '{}'::jsonb; end if;
   if existing.delivery<>'generated' then raise exception 'EVIDENCE_CONFLICT'; end if;
   update samvaad.speech_turns set delivery=p_data->>'state' where id=(p_data->>'id')::bigint and run_id=r.id and actor<>'student' and delivery='generated';
   if not found then raise exception 'VALIDATION_ERROR'; end if;
 elsif p_action='drain' then
   update samvaad.speech_runs set state='draining',heartbeat_at=now() where id=r.id;
 elsif p_action='complete' then
   if r.state<>'draining' or r.provider_request_id is null or (p_data->>'segments')::integer is distinct from r.last_segment or r.last_segment<1 or p_data->>'reason' not in ('manual','deadline') then raise exception 'VALIDATION_ERROR'; end if;
   -- Silence finals preserve provider sequence, but are not spoken evidence.
   if not exists(select 1 from samvaad.speech_turns where run_id=r.id and actor='student' and text !~ '^[[:space:]]*$') then raise exception 'EVIDENCE_EMPTY'; end if;
   select jsonb_agg(jsonb_build_object('speaker',case when actor='student' then 'user' else 'assistant' end,'actor',actor,'text',text,'delivery',delivery) order by id),
     string_agg((case when actor='student' then 'user' else 'assistant' end)||': '||text,E'\n' order by id)
     into turns,raw from samvaad.speech_turns where run_id=r.id and ((actor='student' and text !~ '^[[:space:]]*$') or delivery='sent');
   update samvaad.speech_runs set state='complete',completeness='known-utterances-drained-v1',terminal_reason=p_data->>'reason',heartbeat_at=now() where id=r.id;
   update samvaad.sessions set transcript=jsonb_build_object('raw',raw,'parsed',true,'turns',turns),status='processing',next_poll_at=now(),updated_at=now() where id=r.session_id;
 elsif p_action='fail' then
   update samvaad.speech_runs set state='failed',completeness='incomplete',terminal_reason='provider',heartbeat_at=now() where id=r.id;
   update samvaad.sessions set status='failed',error_code='VOICE_FAILED',error_message='The verified voice stream could not be completed.',next_poll_at=null,updated_at=now() where id=r.session_id;
 else raise exception 'VALIDATION_ERROR'; end if;
 return '{}'::jsonb;
end;
$$;

revoke all on function samvaad.speech_event(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function samvaad.speech_event(uuid,text,jsonb) to service_role;
reset lock_timeout;
