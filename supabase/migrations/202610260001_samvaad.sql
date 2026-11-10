create schema if not exists samvaad;

create type samvaad.session_status as enum (
  'created',
  'awaiting_voice',
  'in_progress',
  'processing',
  'completed',
  'failed',
  'expired'
);

create type samvaad.difficulty_level as enum (
  'gentle',
  'standard',
  'intense'
);

create type samvaad.score_dimension as enum (
  'clarity',
  'structure',
  'relevance',
  'evidence',
  'counterargument_handling',
  'conciseness',
  'composure',
  'closing'
);

create table samvaad.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Student' check (char_length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table samvaad.topics (
  id uuid primary key default gen_random_uuid(),
  title text not null unique check (char_length(trim(title)) between 10 and 240),
  category text not null check (category in ('Education', 'Career', 'Society', 'Policy', 'Technology')),
  description text not null check (char_length(trim(description)) between 20 and 500),
  sort_order integer not null unique check (sort_order between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table samvaad.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references samvaad.profiles(id) on delete cascade,
  topic_id uuid not null references samvaad.topics(id) on delete restrict,
  difficulty samvaad.difficulty_level not null,
  language text not null default 'en' check (language = 'en'),
  planned_duration_seconds integer not null check (planned_duration_seconds in (180, 300)),
  status samvaad.session_status not null default 'created',
  creation_key uuid not null,
  voice_agent_id text,
  voice_run_id text,
  voice_execution_id text,
  transcript jsonb check (transcript is null or jsonb_typeof(transcript) = 'object'),
  overall_score integer check (overall_score is null or overall_score between 1 and 100),
  dimension_scores jsonb check (dimension_scores is null or jsonb_typeof(dimension_scores) = 'array'),
  strongest_moment jsonb check (strongest_moment is null or jsonb_typeof(strongest_moment) = 'object'),
  weakest_moment jsonb check (weakest_moment is null or jsonb_typeof(weakest_moment) = 'object'),
  practice_actions jsonb check (practice_actions is null or jsonb_typeof(practice_actions) = 'array'),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, creation_key)
);

create table samvaad.session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references samvaad.sessions(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, dedupe_key)
);

create table samvaad.session_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references samvaad.sessions(id) on delete cascade,
  dimension samvaad.score_dimension not null,
  score integer not null check (score between 1 and 5),
  reason text not null check (char_length(trim(reason)) between 20 and 500),
  evidence_quote text check (evidence_quote is null or char_length(evidence_quote) <= 500),
  created_at timestamptz not null default now(),
  unique (session_id, dimension)
);

create index sessions_user_created on samvaad.sessions(user_id, created_at desc);
create index sessions_status on samvaad.sessions(status);
create unique index sessions_voice_run on samvaad.sessions(voice_run_id) where voice_run_id is not null;
create unique index sessions_voice_execution on samvaad.sessions(voice_execution_id) where voice_execution_id is not null;
create index session_events_session_created on samvaad.session_events(session_id, created_at);
create index session_feedback_session on samvaad.session_feedback(session_id);

insert into samvaad.topics (title, category, description, sort_order) values
  ('Should colleges allow AI tools for assignments?', 'Education', 'Where is the line between using AI as a tool and letting it do the work?', 1),
  ('Is remote work better for early career growth?', 'Career', 'Does remote work build skills, or delay the feedback that early careers need?', 2),
  ('Should social media have age verification?', 'Society', 'Would age checks protect teenagers, or create new privacy and access problems?', 3),
  ('Are internships better than classroom learning?', 'Education', 'Which setting teaches you faster: a classroom or a real workplace?', 4),
  ('Should India prioritize AI skills in every degree?', 'Policy', 'Should every degree include AI skills, or only the courses that need them?', 5)
on conflict (title) do update set
  category = excluded.category,
  description = excluded.description,
  sort_order = excluded.sort_order;

alter table samvaad.profiles enable row level security;
alter table samvaad.topics enable row level security;
alter table samvaad.sessions enable row level security;
alter table samvaad.session_events enable row level security;
alter table samvaad.session_feedback enable row level security;

create policy profiles_select_own on samvaad.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on samvaad.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy topics_select_active on samvaad.topics
  for select to anon, authenticated using (is_active);

create policy sessions_select_own on samvaad.sessions
  for select to authenticated using (user_id = auth.uid());

create policy session_events_select_own on samvaad.session_events
  for select to authenticated using (
    exists (
      select 1 from samvaad.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy session_feedback_select_own on samvaad.session_feedback
  for select to authenticated using (
    exists (
      select 1 from samvaad.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

revoke all on schema samvaad from public;
revoke all on all tables in schema samvaad from anon, authenticated;
grant usage on schema samvaad to anon, authenticated, service_role;
grant select on samvaad.topics to anon, authenticated;
grant select, update on samvaad.profiles to authenticated;
grant select on samvaad.sessions, samvaad.session_events, samvaad.session_feedback to authenticated;
grant all on all tables in schema samvaad to service_role;
grant usage, select on all sequences in schema samvaad to service_role;
