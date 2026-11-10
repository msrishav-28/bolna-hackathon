-- Additive direct-Speech execution/evidence path. Existing reports remain unchanged.
-- Apply in one transaction after reviewing locks and migration history.
set lock_timeout = '5s';
alter table samvaad.sessions drop constraint sessions_rubric_version_check,
  drop constraint session_mode_rubric;
alter table samvaad.sessions add constraint sessions_rubric_version_check check
  (rubric_version in ('gd-legacy-v1','gd-ensemble-v1','interview-v1','viva-v1','debate-v1','presentation-v1')),
  add constraint session_mode_rubric check
  ((mode='group_discussion' and rubric_version in ('gd-legacy-v1','gd-ensemble-v1'))
   or (mode<>'group_discussion' and rubric_version=mode||'-v1'));

create table samvaad.speech_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references samvaad.sessions(id) on delete cascade,
  grant_hash text not null unique check (grant_hash ~ '^[a-f0-9]{64}$'),
  grant_expires_at timestamptz not null,
  consumed_at timestamptz,
  state text not null default 'reserved' check(state in ('reserved','active','draining','complete','failed')),
  started_at timestamptz,
  deadline timestamptz,
  heartbeat_at timestamptz not null default now(),
  provider_request_id text check(char_length(provider_request_id) between 1 and 200),
  policy_version text not null default 'speech-v1' check(policy_version='speech-v1'),
  last_segment integer not null default 0 check(last_segment>=0),
  completeness text check(completeness in ('known-utterances-drained-v1','incomplete')),
  terminal_reason text check(terminal_reason in ('manual','deadline','disconnect','provider','timeout')),
  created_at timestamptz not null default now(),
  check((consumed_at is null and started_at is null and deadline is null) or
        (consumed_at is not null and started_at is not null and deadline>started_at))
);
create table samvaad.speech_turns (
  id bigint generated always as identity primary key,
  run_id uuid not null references samvaad.speech_runs(id) on delete cascade,
  actor text not null check(actor in ('student','coach','moderator','peer_a','peer_b')),
  text text not null check(char_length(text) between 1 and 20000),
  provider_segment_id text,
  segment_index integer,
  utterance_id text,
  delivery text not null check(delivery in ('provider-final','generated','sent','interrupted')),
  created_at timestamptz not null default now(),
  unique(run_id,segment_index),
  unique(run_id,provider_segment_id),
  check((actor='student' and delivery='provider-final' and segment_index>0
    and provider_segment_id is not null and utterance_id is not null) or
    (actor<>'student' and delivery<>'provider-final' and segment_index is null
    and provider_segment_id is null and utterance_id is null))
);
create index speech_turns_run_order on samvaad.speech_turns(run_id,id);
alter table samvaad.speech_runs enable row level security;
alter table samvaad.speech_turns enable row level security;
-- Evidence is private. Reports expose only the finalized owned snapshot.
revoke all on samvaad.speech_runs,samvaad.speech_turns from public,anon,authenticated;
grant select,insert,update,delete on samvaad.speech_runs,samvaad.speech_turns to service_role;
grant usage,select on sequence samvaad.speech_turns_id_seq to service_role;

create function samvaad.protect_speech_turn() returns trigger language plpgsql set search_path='' as $$
begin
 if old.actor='student' or new.run_id is distinct from old.run_id or new.actor is distinct from old.actor
   or new.text is distinct from old.text or new.provider_segment_id is distinct from old.provider_segment_id
   or new.segment_index is distinct from old.segment_index or new.utterance_id is distinct from old.utterance_id
   or new.id is distinct from old.id or new.created_at is distinct from old.created_at then raise exception 'EVIDENCE_IMMUTABLE'; end if;
 return new;
end;
$$;
create trigger speech_turn_immutable before update on samvaad.speech_turns for each row execute function samvaad.protect_speech_turn();

create function samvaad.create_speech_session(
 p_user uuid,p_topic uuid,p_difficulty samvaad.difficulty_level,p_duration integer,
 p_key uuid,p_limit integer,p_max_duration integer,p_mode text
) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 result:=samvaad.create_session_v2(p_user,p_topic,p_difficulty,p_duration,p_key,p_limit,p_max_duration,p_mode);
 update samvaad.sessions set rubric_version='gd-ensemble-v1'
 where id=result and mode='group_discussion' and status='created';
 return result;
end;
$$;

create function samvaad.reserve_speech(p_user uuid,p_session uuid,p_hash text,p_minutes integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s samvaad.sessions; r samvaad.speech_runs;
begin
 perform pg_advisory_xact_lock(hashtextextended('samvaad-voice-budget',0));
 select * into s from samvaad.sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;
 if s.status<>'created' then raise exception 'SESSION_NOT_ACTIVE'; end if;
 if s.created_at<now()-interval '30 minutes' then raise exception 'SESSION_EXPIRED'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_minutes is null or p_minutes not between 1 and 10000 then raise exception 'VALIDATION_ERROR'; end if;
 if exists(select 1 from samvaad.sessions where user_id=p_user and id<>p_session and status in ('awaiting_voice','in_progress') and processing_deadline>now()) then raise exception 'SESSION_ALREADY_ACTIVE'; end if;
 if coalesce((select sum(planned_duration_seconds) from samvaad.sessions where voice_reserved_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),0)+s.planned_duration_seconds>p_minutes*60 then raise exception 'CAPACITY_LIMIT'; end if;
 insert into samvaad.speech_runs(session_id,grant_hash,grant_expires_at) values(s.id,p_hash,now()+interval '60 seconds') returning * into r;
 update samvaad.sessions set status='awaiting_voice',voice_reserved_at=now(),
 rubric_version=case when mode='group_discussion' then 'gd-ensemble-v1' else rubric_version end,
 processing_deadline=now()+interval '10 minutes',next_poll_at=now()+interval '65 seconds',updated_at=now() where id=s.id;
 return jsonb_build_object('runId',r.id,'expiresAt',r.grant_expires_at);
end;
$$;

create function samvaad.consume_speech_grant(p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r samvaad.speech_runs; s samvaad.sessions;
begin
 select * into r from samvaad.speech_runs where grant_hash=p_hash for update;
 if not found or r.state<>'reserved' or r.consumed_at is not null or r.grant_expires_at<=now() then raise exception 'SESSION_NOT_ACTIVE'; end if;
 select * into s from samvaad.sessions where id=r.session_id for update;
 if s.status<>'awaiting_voice' then raise exception 'SESSION_NOT_ACTIVE'; end if;
 update samvaad.speech_runs set state='active',consumed_at=now(),started_at=now(),deadline=now()+make_interval(secs=>s.planned_duration_seconds),heartbeat_at=now() where id=r.id;
 update samvaad.sessions set status='in_progress',started_at=now(),next_poll_at=now()+interval '30 seconds',updated_at=now() where id=s.id;
 return jsonb_build_object('runId',r.id,'sessionId',s.id,'durationSeconds',s.planned_duration_seconds,
 'mode',s.mode,'difficulty',s.difficulty,'topic',(select title from samvaad.topics where id=s.topic_id),
 'startedAt',now(),'deadline',now()+make_interval(secs=>s.planned_duration_seconds));
end;
$$;

create function samvaad.speech_event(p_run uuid,p_action text,p_data jsonb default '{}'::jsonb)
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
   if p_data->>'state' not in ('sent','interrupted') then raise exception 'VALIDATION_ERROR'; end if;
   update samvaad.speech_turns set delivery=p_data->>'state' where id=(p_data->>'id')::bigint and run_id=r.id and actor<>'student' and delivery='generated';
   if not found then raise exception 'VALIDATION_ERROR'; end if;
 elsif p_action='drain' then
   update samvaad.speech_runs set state='draining',heartbeat_at=now() where id=r.id;
 elsif p_action='complete' then
   if r.state<>'draining' or r.provider_request_id is null or (p_data->>'segments')::integer is distinct from r.last_segment or r.last_segment<1 or p_data->>'reason' not in ('manual','deadline') then raise exception 'VALIDATION_ERROR'; end if;
   select jsonb_agg(jsonb_build_object('speaker',case when actor='student' then 'user' else 'assistant' end,'actor',actor,'text',text,'delivery',delivery) order by id),
     string_agg((case when actor='student' then 'user' else 'assistant' end)||': '||text,E'\n' order by id)
     into turns,raw from samvaad.speech_turns where run_id=r.id and (actor='student' or delivery='sent');
   update samvaad.speech_runs set state='complete',completeness='known-utterances-drained-v1',terminal_reason=p_data->>'reason',heartbeat_at=now() where id=r.id;
   update samvaad.sessions set transcript=jsonb_build_object('raw',raw,'parsed',true,'turns',turns),status='processing',next_poll_at=now(),updated_at=now() where id=r.session_id;
 elsif p_action='fail' then
   update samvaad.speech_runs set state='failed',completeness='incomplete',terminal_reason='provider',heartbeat_at=now() where id=r.id;
   update samvaad.sessions set status='failed',error_code='VOICE_FAILED',error_message='The verified voice stream could not be completed.',next_poll_at=null,updated_at=now() where id=r.session_id;
 else raise exception 'VALIDATION_ERROR'; end if;
 return '{}'::jsonb;
end;
$$;

create function samvaad.claim_speech_work(p_session uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s samvaad.sessions; r samvaad.speech_runs;
begin
 select * into s from samvaad.sessions where id=p_session for update;
 if not found or s.status not in ('awaiting_voice','in_progress','processing') or s.work_until>now() or s.next_poll_at>now() then return null; end if;
 select * into r from samvaad.speech_runs where session_id=s.id;
 if not found then return null; end if;
 if s.processing_deadline<=now() or (r.state='reserved' and r.grant_expires_at<=now()) or (r.state in ('active','draining') and (r.heartbeat_at<now()-interval '45 seconds' or now()>r.deadline+interval '25 seconds')) then
   update samvaad.sessions set status='failed',error_code='VOICE_FAILED',error_message='The voice connection expired before evidence was complete.',next_poll_at=null,work_token=null,work_until=null,updated_at=now() where id=s.id;
   return null;
 end if;
 if r.state<>'complete' or r.completeness<>'known-utterances-drained-v1' or s.transcript is null then
   update samvaad.sessions set next_poll_at=now()+interval '15 seconds' where id=s.id;
   return null;
 end if;
 update samvaad.sessions set work_token=p_token,work_until=now()+interval '90 seconds' where id=s.id;
 return jsonb_build_object('id',s.id,'transcript',s.transcript,'scoreAttempts',s.score_attempts,'mode',s.mode,'topic',(select title from samvaad.topics where id=s.topic_id));
end;
$$;
create function samvaad.request_speech_completion(p_user uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from samvaad.sessions where id=p_session and user_id=p_user) then raise exception 'SESSION_NOT_FOUND'; end if;
 if exists(select 1 from samvaad.sessions where id=p_session and status='created') then raise exception 'SESSION_NOT_READY'; end if;
 -- Browser cannot finalize evidence, invent a transcript or change a live run's status.
 update samvaad.sessions set next_poll_at=now() where id=p_session and user_id=p_user and status='processing';
end;
$$;
revoke all on function samvaad.create_speech_session(uuid,uuid,samvaad.difficulty_level,integer,uuid,integer,integer,text),samvaad.reserve_speech(uuid,uuid,text,integer),samvaad.consume_speech_grant(text),samvaad.speech_event(uuid,text,jsonb),samvaad.claim_speech_work(uuid,uuid),samvaad.request_speech_completion(uuid,uuid) from public,anon,authenticated;
grant execute on function samvaad.create_speech_session(uuid,uuid,samvaad.difficulty_level,integer,uuid,integer,integer,text),samvaad.reserve_speech(uuid,uuid,text,integer),samvaad.consume_speech_grant(text),samvaad.speech_event(uuid,text,jsonb),samvaad.claim_speech_work(uuid,uuid),samvaad.request_speech_completion(uuid,uuid) to service_role;
reset lock_timeout;
