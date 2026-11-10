-- Start practice after provider readiness rather than during connection warmup.
set lock_timeout='5s';
create function samvaad.start_speech(p_run uuid,p_request text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r samvaad.speech_runs; s samvaad.sessions; end_at timestamptz;
begin
 select * into r from samvaad.speech_runs where id=p_run for update;
 if not found or r.state<>'active' or r.provider_request_id is not null
   or r.consumed_at is null or r.consumed_at<now()-interval '30 seconds' then raise exception 'SESSION_NOT_ACTIVE'; end if;
 if p_request is null or char_length(p_request) not between 1 and 200 then raise exception 'VALIDATION_ERROR'; end if;
 select * into s from samvaad.sessions where id=r.session_id for update;
 if s.status<>'in_progress' then raise exception 'SESSION_NOT_ACTIVE'; end if;
 end_at:=now()+make_interval(secs=>s.planned_duration_seconds);
 update samvaad.speech_runs set provider_request_id=p_request,started_at=now(),deadline=end_at,heartbeat_at=now() where id=r.id;
 update samvaad.sessions set started_at=now(),processing_deadline=end_at+interval '5 minutes',next_poll_at=now()+interval '30 seconds',updated_at=now() where id=s.id;
 return jsonb_build_object('startedAt',now(),'deadline',end_at);
end;
$$;
revoke all on function samvaad.start_speech(uuid,text) from public,anon,authenticated;
grant execute on function samvaad.start_speech(uuid,text) to service_role;
reset lock_timeout;
