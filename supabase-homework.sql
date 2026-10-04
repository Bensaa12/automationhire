-- Jarvis Academy: Homework Help with parent-unlocked answers (added 2026-10-04).
-- Run once in Supabase -> SQL Editor, AFTER supabase-academy.sql. Safe to re-run.
-- Like the other Academy tables, RLS is on with NO public policies: only the server
-- (service role) can read or write, so answers can never be fetched from the browser.
-- Photos of homework are never stored: only the question text Jarvis read from them.

-- One upload (photo pages, a PDF or typed text) = one homework.
create table if not exists academy_homework (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references auth.users(id) on delete cascade,
  subject     text not null default 'General',
  topic       text,
  title       text,
  level       text not null default 'secondary',
  assessment  boolean not null default false,   -- looked like a test: Jarvis teaches but never solves
  source      text not null default 'photo' check (source in ('photo','pdf','text')),
  created_at  timestamptz not null default now()
);
create index if not exists academy_homework_student_month on academy_homework (student_id, created_at desc);

-- Each question Jarvis read from the homework. `answer` is hidden until a parent unlocks it.
create table if not exists academy_hw_items (
  id              uuid primary key default gen_random_uuid(),
  homework_id     uuid not null references academy_homework(id) on delete cascade,
  student_id      uuid not null references auth.users(id) on delete cascade,
  idx             integer not null,
  question        text not null,
  context         text,                         -- what a diagram/table showed, for later lessons
  answer          text,                         -- worked solution; null for assessments
  lesson          text,                         -- cached explanation of the method
  attempt         text,                         -- the student's own latest answer
  attempt_result  text check (attempt_result in ('correct','partial','incorrect')),
  attempts        integer not null default 0,
  unlocked_at     timestamptz,
  unlocked_by     uuid references auth.users(id) on delete set null,
  unlock_method   text check (unlock_method in ('pin','remote','parent-all')),
  attempted_before_unlock boolean,
  created_at      timestamptz not null default now()
);
create index if not exists academy_hw_items_homework on academy_hw_items (homework_id, idx);
create index if not exists academy_hw_items_student on academy_hw_items (student_id, created_at desc);

-- A student's request for a parent to unlock one answer.
create table if not exists academy_hw_requests (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references academy_hw_items(id) on delete cascade,
  student_id  uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','approved','declined')),
  note        text,                             -- parent's optional "not yet" message
  decided_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists academy_hw_requests_student on academy_hw_requests (student_id, status);
create unique index if not exists academy_hw_requests_one_pending on academy_hw_requests (item_id) where status = 'pending';

-- Parent unlock PIN (scrypt hash) with a lockout after repeated wrong tries.
alter table academy_profiles add column if not exists parent_pin_hash   text;
alter table academy_profiles add column if not exists pin_fail_count    integer not null default 0;
alter table academy_profiles add column if not exists pin_locked_until  timestamptz;

alter table academy_homework    enable row level security;
alter table academy_hw_items    enable row level security;
alter table academy_hw_requests enable row level security;
-- (no policies on purpose: service role bypasses RLS, everyone else gets nothing)
