-- Additive mode metadata. Existing scores keep their original group-discussion rubric.
-- Apply during a maintenance window: ALTER TABLE briefly takes an exclusive lock.
set lock_timeout = '5s';
alter table samvaad.sessions
  add column mode text not null default 'group_discussion'
    check (mode in ('interview','viva','debate','group_discussion','presentation')),
  add column rubric_version text not null default 'gd-legacy-v1'
    check (rubric_version in ('gd-legacy-v1','interview-v1','viva-v1','debate-v1','presentation-v1')),
  add constraint session_mode_rubric check (rubric_version = case when mode='group_discussion' then 'gd-legacy-v1' else mode||'-v1' end);

create function samvaad.create_session_v2(
  p_user uuid,p_topic uuid,p_difficulty samvaad.difficulty_level,p_duration integer,
  p_key uuid,p_limit integer,p_max_duration integer,p_mode text
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing samvaad.sessions; result uuid;
begin
  if p_mode is null or p_mode not in ('interview','viva','debate','group_discussion','presentation') then
    raise exception 'VALIDATION_ERROR';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select * into existing from samvaad.sessions where user_id=p_user and creation_key=p_key;
  if found and existing.mode<>p_mode then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  result := samvaad.create_session(p_user,p_topic,p_difficulty,p_duration,p_key,p_limit,p_max_duration);
  -- Legacy function validates all inputs, enforces quota and replays identical requests.
  if existing.id is null then
    update samvaad.sessions set mode=p_mode,
      rubric_version=case when p_mode='group_discussion' then 'gd-legacy-v1' else p_mode||'-v1' end
      where id=result;
  end if;
  return result;
end;
$$;
revoke all on function samvaad.create_session_v2(uuid,uuid,samvaad.difficulty_level,integer,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function samvaad.create_session_v2(uuid,uuid,samvaad.difficulty_level,integer,uuid,integer,integer,text) to service_role;

alter function samvaad.reserve_voice(uuid,uuid,text,integer) rename to reserve_voice_v1;
create function samvaad.reserve_voice(p_user uuid,p_session uuid,p_agent text,p_minutes integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb;
begin
  context := samvaad.reserve_voice_v1(p_user,p_session,p_agent,p_minutes);
  return context || (select jsonb_build_object('mode',mode,'rubricVersion',rubric_version)
    from samvaad.sessions where id=p_session and user_id=p_user);
end;
$$;
alter function samvaad.claim_work(uuid,uuid) rename to claim_work_v1;
create function samvaad.claim_work(p_session uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb;
begin
  context := samvaad.claim_work_v1(p_session,p_token);
  if context is null then return null; end if;
  return context || (select jsonb_build_object('mode',s.mode,'rubricVersion',s.rubric_version,'topic',t.title)
    from samvaad.sessions s join samvaad.topics t on t.id=s.topic_id where s.id=p_session);
end;
$$;
revoke all on function samvaad.reserve_voice(uuid,uuid,text,integer),samvaad.claim_work(uuid,uuid) from public,anon,authenticated;
grant execute on function samvaad.reserve_voice(uuid,uuid,text,integer),samvaad.claim_work(uuid,uuid) to service_role;
reset lock_timeout;

create function samvaad.practice_quota(p_user uuid,p_limit integer) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('limit',p_limit,'remaining',greatest(0,p_limit-count(*)),
    'resetsAt',(date_trunc('day',now() at time zone 'UTC')+interval '1 day') at time zone 'UTC')
  from samvaad.sessions where user_id=p_user
    and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
$$;
alter function samvaad.history_stats(uuid) rename to history_stats_v1;
create function samvaad.history_stats(p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  with latest as (
    select mode,topic_id,rubric_version,difficulty,planned_duration_seconds
    from samvaad.sessions where user_id=p_user and status='completed'
    order by completed_at desc,id desc limit 1
  ), compatible as (
    select s.* from samvaad.sessions s join latest l using(mode,topic_id,rubric_version,difficulty,planned_duration_seconds)
    where s.user_id=p_user and s.status='completed'
  ), recent as (
    select * from compatible order by completed_at desc,id desc limit 20
  )
  select samvaad.history_stats_v1(p_user) || jsonb_build_object('trend','[]'::jsonb,'comparison',
    case when (select count(*) from compatible)<2 then null else (
      select jsonb_build_object('mode',l.mode,'topicId',l.topic_id,'rubricVersion',l.rubric_version,
        'count',(select count(*) from compatible),
        'baselineScore',(select overall_score from compatible order by completed_at,id limit 1),
        'latestScore',(select overall_score from compatible order by completed_at desc,id desc limit 1),
        'bestScore',(select max(overall_score) from compatible),
        'trend',(select jsonb_agg(jsonb_build_object('id',id,'score',overall_score,'completedAt',completed_at) order by completed_at,id) from recent)
      ) from latest l
    ) end);
$$;
revoke all on function samvaad.practice_quota(uuid,integer),samvaad.history_stats(uuid) from public,anon,authenticated;
grant execute on function samvaad.practice_quota(uuid,integer),samvaad.history_stats(uuid) to service_role;
