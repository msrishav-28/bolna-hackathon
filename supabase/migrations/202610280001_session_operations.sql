-- Server-only operations. Per-owner serialization makes quota and retry checks atomic.
create function samvaad.create_session(
  p_user uuid, p_topic uuid, p_difficulty samvaad.difficulty_level,
  p_duration integer, p_key uuid, p_limit integer, p_max_duration integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare existing samvaad.sessions; result uuid;
begin
  if p_user is null or p_topic is null or p_key is null or p_limit is null or p_limit not between 1 and 100
    or p_max_duration is null or p_max_duration not in (180,300)
    or p_duration is null or p_duration not in (180,300) or p_duration > p_max_duration
    or p_difficulty is null then
    raise exception 'VALIDATION_ERROR';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into existing from samvaad.sessions where user_id=p_user and creation_key=p_key;
  if found then
    if existing.topic_id <> p_topic or existing.difficulty <> p_difficulty
      or existing.planned_duration_seconds <> p_duration then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return existing.id;
  end if;
  if not exists(select 1 from samvaad.topics where id=p_topic and is_active) then
    raise exception 'VALIDATION_ERROR';
  end if;
  if (select count(*) from samvaad.sessions where user_id=p_user
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= p_limit then
    raise exception 'RATE_LIMITED';
  end if;
  insert into samvaad.profiles(id) values(p_user) on conflict(id) do nothing;
  insert into samvaad.sessions(user_id,topic_id,difficulty,planned_duration_seconds,creation_key)
    values(p_user,p_topic,p_difficulty,p_duration,p_key) returning id into result;
  return result;
end;
$$;
revoke all on function samvaad.create_session(uuid,uuid,samvaad.difficulty_level,integer,uuid,integer,integer) from public, anon, authenticated;
grant execute on function samvaad.create_session(uuid,uuid,samvaad.difficulty_level,integer,uuid,integer,integer) to service_role;

create function samvaad.history_stats(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'completed', count(*), 'averageScore', avg(overall_score),
    'focus', (select f.dimension::text from samvaad.session_feedback f
      join samvaad.sessions s on s.id=f.session_id
      where s.user_id=p_user and s.status='completed'
      group by f.dimension order by avg(f.score), f.dimension limit 1),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'score',t.overall_score,
      'completedAt',t.completed_at) order by t.completed_at,t.id) from
      (select id,overall_score,completed_at from samvaad.sessions
       where user_id=p_user and status='completed' and completed_at is not null
       order by completed_at desc,id desc limit 20) t), '[]'::jsonb)
  ) from samvaad.sessions where user_id=p_user and status='completed';
$$;
revoke all on function samvaad.history_stats(uuid) from public, anon, authenticated;
grant execute on function samvaad.history_stats(uuid) to service_role;
