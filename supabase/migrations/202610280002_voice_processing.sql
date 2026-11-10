alter table samvaad.sessions
  add column voice_reserved_at timestamptz,
  add column processing_deadline timestamptz,
  add column next_poll_at timestamptz,
  add column work_token uuid,
  add column work_until timestamptz,
  add column score_attempts integer not null default 0 check(score_attempts between 0 and 2),
  add column error_code text;

create index sessions_due_work on samvaad.sessions(next_poll_at)
  where status in ('awaiting_voice','in_progress','processing');

create function samvaad.reserve_voice(p_user uuid,p_session uuid,p_agent text,p_minutes integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s samvaad.sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended('samvaad-voice-budget',0));
  select * into s from samvaad.sessions where id=p_session and user_id=p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if s.status <> 'created' then raise exception 'SESSION_NOT_ACTIVE'; end if;
  if s.created_at < now()-interval '30 minutes' then raise exception 'SESSION_EXPIRED'; end if;
  if p_agent is null or length(p_agent) not between 1 and 200 or p_minutes is null or p_minutes not between 1 and 10000 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if exists(select 1 from samvaad.sessions where user_id=p_user and id<>p_session
    and status in ('awaiting_voice','in_progress') and processing_deadline>now()) then
    raise exception 'SESSION_ALREADY_ACTIVE';
  end if;
  if coalesce((select sum(planned_duration_seconds) from samvaad.sessions
    where voice_reserved_at >= date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),0)
    +s.planned_duration_seconds > p_minutes*60 then raise exception 'CAPACITY_LIMIT'; end if;
  update samvaad.sessions set status='awaiting_voice',voice_agent_id=p_agent,
    voice_reserved_at=now(),processing_deadline=now()+interval '20 minutes',
    next_poll_at=now()+interval '30 seconds',updated_at=now() where id=s.id;
  return jsonb_build_object('topic',(select title from samvaad.topics where id=s.topic_id),
    'difficulty',s.difficulty,'durationSeconds',s.planned_duration_seconds);
end;
$$;

create function samvaad.finish_mint(p_user uuid,p_session uuid,p_run text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_run is null or length(p_run) not between 1 and 200 then raise exception 'VALIDATION_ERROR'; end if;
  update samvaad.sessions set voice_run_id=p_run,voice_execution_id=p_run,updated_at=now()
    where id=p_session and user_id=p_user and status='awaiting_voice' and voice_run_id is null;
  return found;
end;
$$;

create function samvaad.fail_mint(p_user uuid,p_session uuid)
returns void language sql security definer set search_path='' as $$
  update samvaad.sessions set status='failed',error_code='VOICE_START_FAILED',
    error_message='The voice connection could not start. Please start a new round.',
    next_poll_at=null,updated_at=now()
    where id=p_session and user_id=p_user and status='awaiting_voice' and voice_run_id is null;
$$;

create function samvaad.request_completion(p_user uuid,p_session uuid)
returns void language plpgsql security definer set search_path='' as $$
declare s samvaad.sessions;
begin
  select * into s from samvaad.sessions where id=p_session and user_id=p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if s.status in ('completed','failed','expired') then return; end if;
  if s.status='created' or s.voice_execution_id is null then raise exception 'SESSION_NOT_READY'; end if;
  update samvaad.sessions set status='processing',next_poll_at=least(coalesce(next_poll_at,now()),now()),
    updated_at=now() where id=s.id;
end;
$$;

create function samvaad.claim_work(p_session uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s samvaad.sessions;
begin
  select * into s from samvaad.sessions where id=p_session for update;
  if not found or s.status not in ('awaiting_voice','in_progress','processing') then return null; end if;
  if s.work_until>now() then return null; end if;
  if s.processing_deadline<=now() then
    update samvaad.sessions set status='expired',error_code='SESSION_EXPIRED',
      error_message='This round timed out. Please start a new round.',next_poll_at=null,
      work_token=null,work_until=null,updated_at=now() where id=s.id;
    return null;
  end if;
  if s.next_poll_at>now() then return null; end if;
  if s.voice_execution_id is null then
    if s.voice_reserved_at < now()-interval '2 minutes' then
      update samvaad.sessions set status='failed',error_code='VOICE_START_FAILED',
        error_message='The connection could not be confirmed. Please start a new round.',
        next_poll_at=null,updated_at=now() where id=s.id;
    end if;
    return null;
  end if;
  update samvaad.sessions set work_token=p_token,work_until=now()+interval '90 seconds'
    where id=s.id;
  return jsonb_build_object('id',s.id,'agentId',s.voice_agent_id,'executionId',s.voice_execution_id,
    'status',s.status,'transcript',s.transcript,'scoreAttempts',s.score_attempts);
end;
$$;

create function samvaad.advance_work(p_session uuid,p_token uuid,p_action text,p_data jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare s samvaad.sessions; item jsonb;
begin
  select * into s from samvaad.sessions where id=p_session for update;
  if not found or s.work_token is distinct from p_token or s.work_until<=now()
    or s.status not in ('awaiting_voice','in_progress','processing') then return false; end if;
  if p_action='wait' then
    update samvaad.sessions set status=case when p_data->>'active'='true' and status<>'processing'
      then 'in_progress'::samvaad.session_status else status end,
      started_at=case when p_data->>'active'='true' then coalesce(started_at,now()) else started_at end,
      next_poll_at=now()+interval '15 seconds',work_token=null,work_until=null,updated_at=now() where id=s.id;
  elsif p_action='transcript' then
    if jsonb_typeof(p_data->'transcript') is distinct from 'object' then raise exception 'VALIDATION_ERROR'; end if;
    update samvaad.sessions set transcript=p_data->'transcript',status='processing',updated_at=now() where id=s.id;
  elsif p_action='score_attempt' then
    if s.transcript is null or s.score_attempts>=2 then return false; end if;
    update samvaad.sessions set score_attempts=score_attempts+1,updated_at=now() where id=s.id;
  elsif p_action='retry' then
    update samvaad.sessions set next_poll_at=now()+interval '15 seconds',work_token=null,work_until=null,
      updated_at=now() where id=s.id;
  elsif p_action='fail' then
    if p_data->>'code' not in ('VOICE_FAILED','TRANSCRIPT_UNAVAILABLE','SCORING_FAILED','EXECUTION_MISMATCH')
      or p_data->>'code' is null then raise exception 'VALIDATION_ERROR'; end if;
    update samvaad.sessions set status='failed',error_code=p_data->>'code',
      error_message='This round could not be completed. Please start a new round.',next_poll_at=null,
      work_token=null,work_until=null,updated_at=now() where id=s.id;
  elsif p_action='complete' then
    if s.transcript is null or s.score_attempts<1 or jsonb_typeof(p_data->'dimensions') is distinct from 'array'
      or jsonb_array_length(p_data->'dimensions')<>8 or jsonb_typeof(p_data->'practiceActions') is distinct from 'array'
      or jsonb_array_length(p_data->'practiceActions')<>3 then raise exception 'VALIDATION_ERROR'; end if;
    for item in select value from jsonb_array_elements(p_data->'dimensions') loop
      insert into samvaad.session_feedback(session_id,dimension,score,reason,evidence_quote)
      values(s.id,(item->>'dimension')::samvaad.score_dimension,(item->>'score')::integer,
        item->>'reason',item->>'evidenceQuote');
    end loop;
    update samvaad.sessions set status='completed',overall_score=(
      select round(avg(f.score)/5*100)::integer from samvaad.session_feedback f where f.session_id=s.id),
      dimension_scores=p_data->'dimensions',strongest_moment=p_data->'strongestMoment',
      weakest_moment=p_data->'weakestMoment',practice_actions=p_data->'practiceActions',completed_at=now(),
      error_code=null,error_message=null,next_poll_at=null,work_token=null,work_until=null,updated_at=now() where id=s.id;
  else raise exception 'VALIDATION_ERROR'; end if;
  return true;
end;
$$;

create function samvaad.receive_event(p_execution text,p_agent text,p_status text,p_dedupe text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s samvaad.sessions;
begin
  select * into s from samvaad.sessions where voice_execution_id=p_execution and voice_agent_id=p_agent for update;
  if not found then return null; end if;
  insert into samvaad.session_events(session_id,event_type,dedupe_key,payload)
    values(s.id,'voice_status',p_dedupe,jsonb_build_object('id',p_execution,'agent_id',p_agent,'status',p_status))
    on conflict(session_id,dedupe_key) do nothing;
  if s.status in ('awaiting_voice','in_progress','processing') then
    update samvaad.sessions set next_poll_at=least(coalesce(next_poll_at,now()),now()) where id=s.id;
  end if;
  return s.id;
end;
$$;

-- Functions accepting owner IDs must never be callable by browser roles.
revoke all on function samvaad.reserve_voice(uuid,uuid,text,integer),
  samvaad.finish_mint(uuid,uuid,text),samvaad.fail_mint(uuid,uuid),
  samvaad.request_completion(uuid,uuid),samvaad.claim_work(uuid,uuid),
  samvaad.advance_work(uuid,uuid,text,jsonb),samvaad.receive_event(text,text,text,text)
  from public,anon,authenticated;
grant execute on function samvaad.reserve_voice(uuid,uuid,text,integer),
  samvaad.finish_mint(uuid,uuid,text),samvaad.fail_mint(uuid,uuid),
  samvaad.request_completion(uuid,uuid),samvaad.claim_work(uuid,uuid),
  samvaad.advance_work(uuid,uuid,text,jsonb),samvaad.receive_event(text,text,text,text)
  to service_role;
