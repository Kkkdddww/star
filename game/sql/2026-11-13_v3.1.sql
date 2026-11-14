-- 말뚝 v3.1 · 우리 기수 + 한마디 (v3.0 SQL을 먼저 돌린 뒤, 이것도 한 번만 Run)

-- ── 우리 기수 ──
create table if not exists cohorts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 2 and 16),
  seed bigint not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null default now() + interval '7 days',
  max_members int not null default 30
);
alter table cohorts enable row level security;
drop policy if exists "cohorts read" on cohorts;
create policy "cohorts read" on cohorts for select using (true);
drop policy if exists "cohorts insert own" on cohorts;
create policy "cohorts insert own" on cohorts for insert with check (auth.uid() = created_by and closes_at <= now() + interval '8 days' and max_members <= 30);
grant select, insert on cohorts to anon, authenticated;

alter table runs add column if not exists cohort_id uuid references cohorts(id) on delete set null;
create unique index if not exists runs_cohort_once on runs (user_id, cohort_id) where mode = 'cohort';
create index if not exists runs_cohort on runs (cohort_id) where mode = 'cohort';

-- ── 개발자한테 한마디 ──
create table if not exists guestbook (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  nickname text not null check (char_length(nickname) between 2 and 12),
  body text not null check (char_length(body) between 2 and 100),
  reply text,
  hidden boolean not null default false,
  reports int not null default 0,
  created_at timestamptz not null default now()
);
alter table guestbook enable row level security;
drop policy if exists "gb read" on guestbook;
create policy "gb read" on guestbook for select using (not hidden);
drop policy if exists "gb insert own" on guestbook;
create policy "gb insert own" on guestbook for insert with check (auth.uid() = user_id and reply is null and hidden = false and reports = 0);
grant select, insert on guestbook to anon, authenticated;

-- 1분에 1개
create or replace function gb_rate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from guestbook where user_id = new.user_id and created_at > now() - interval '60 seconds') then
    raise exception 'guestbook_rate';
  end if;
  return new;
end $$;
drop trigger if exists gb_rate on guestbook;
create trigger gb_rate before insert on guestbook for each row execute function gb_rate();

-- 신고 3번이면 자동 숨김 (한 사람당 한 번)
create table if not exists guestbook_reports (
  gid bigint references guestbook(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  primary key (gid, user_id)
);
alter table guestbook_reports enable row level security;
drop policy if exists "gbr insert own" on guestbook_reports;
create policy "gbr insert own" on guestbook_reports for insert with check (auth.uid() = user_id);
grant insert on guestbook_reports to anon, authenticated;

create or replace function gb_report_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update guestbook set reports = reports + 1, hidden = (reports + 1 >= 3) where id = new.gid;
  return new;
end $$;
drop trigger if exists gb_report on guestbook_reports;
create trigger gb_report after insert on guestbook_reports for each row execute function gb_report_count();
