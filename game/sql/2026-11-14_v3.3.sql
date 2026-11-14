-- 말뚝 v3.3 · 기수 대항전 (Supabase > SQL Editor에 붙여넣고 Run, 한 번만)
-- v3.0 · v3.1 · v3.2 SQL을 먼저 돌린 뒤 실행. 여러 번 돌려도 안전하게 썼어요.

-- ── 1. 대항전 기수 (계속 가는 팀) ──
alter table cohorts add column if not exists kind text not null default 'friendly';
alter table cohorts add column if not exists no int;                 -- 기수 번호 (대항전 기수만, 만든 순서)
alter table cohorts add column if not exists ribbon int[];           -- 기수 약장 [바탕, 모양, 줄무늬 색]
alter table cohorts add column if not exists motto text;             -- 구호 한 줄
alter table cohorts add column if not exists public boolean not null default false;
alter table cohorts drop constraint if exists cohorts_kind_ok;
alter table cohorts add constraint cohorts_kind_ok check (kind in ('friendly', 'contest'));
alter table cohorts drop constraint if exists cohorts_motto_len;
alter table cohorts add constraint cohorts_motto_len check (motto is null or char_length(motto) <= 20);
alter table cohorts drop constraint if exists cohorts_ribbon_ok;
alter table cohorts add constraint cohorts_ribbon_ok check (ribbon is null or (array_length(ribbon, 1) = 3 and ribbon[1] between 0 and 7 and ribbon[2] between 0 and 5 and ribbon[3] between 0 and 4));
alter table cohorts drop constraint if exists cohorts_name_staff;
alter table cohorts add constraint cohorts_name_staff check (
  replace(name, ' ', '') !~* '(개발자|운영자|운영진|운영팀|관리자|인사과장|admin)'
) not valid;

create sequence if not exists cohort_no_seq;
create unique index if not exists cohorts_no on cohorts (no) where no is not null;

-- 대항전 기수: 번호 자동, 마감 없음(먼 미래), 정원 30
create or replace function cohort_contest_defaults() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'contest' then
    new.no := nextval('cohort_no_seq');
    new.closes_at := '2999-12-31'::timestamptz;
    new.max_members := 30;
  end if;
  return new;
end $$;
drop trigger if exists cohort_contest_defaults on cohorts;
create trigger cohort_contest_defaults before insert on cohorts for each row execute function cohort_contest_defaults();

drop policy if exists "cohorts insert own" on cohorts;
create policy "cohorts insert own" on cohorts for insert with check (
  auth.uid() = created_by and max_members <= 30 and (kind = 'contest' or closes_at <= now() + interval '8 days')
);
-- 기수장은 이름 · 구호 · 약장 · 공개 여부만 고칠 수 있어요
drop policy if exists "cohorts update own" on cohorts;
create policy "cohorts update own" on cohorts for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
revoke update on cohorts from anon, authenticated;
grant update (name, motto, ribbon, public) on cohorts to authenticated;

-- ── 2. 기수원 (한 사람 최대 3곳) ──
create table if not exists members (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  seq int,                                   -- 동기 번호 (들어온 순서)
  joined_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);
alter table members enable row level security;
drop policy if exists "members read" on members;
create policy "members read" on members for select using (true);
drop policy if exists "members join own" on members;
create policy "members join own" on members for insert with check (auth.uid() = user_id);
drop policy if exists "members leave own" on members;
create policy "members leave own" on members for delete using (auth.uid() = user_id);
grant select on members to anon, authenticated;
grant insert (cohort_id), delete on members to authenticated;
create index if not exists members_user on members (user_id);

create or replace function members_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare k text; cap int;
begin
  select kind, max_members into k, cap from cohorts where id = new.cohort_id;
  if k is distinct from 'contest' then raise exception '대항전 기수가 아니에요'; end if;
  if (select count(*) from members where user_id = new.user_id) >= 3 then raise exception '기수는 3곳까지 들어갈 수 있어요'; end if;
  if (select count(*) from members where cohort_id = new.cohort_id) >= cap then raise exception '정원이 다 찼어요'; end if;
  new.seq := coalesce((select max(seq) from members where cohort_id = new.cohort_id), 0) + 1;
  new.joined_at := now();
  return new;
end $$;
drop trigger if exists members_rules on members;
create trigger members_rules before insert on members for each row execute function members_rules();

-- 기수를 만든 사람은 자동으로 1번 동기
create or replace function cohort_creator_joins() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'contest' then insert into members (cohort_id, user_id) values (new.id, new.created_by); end if;
  return new;
end $$;
drop trigger if exists cohort_creator_joins on cohorts;
create trigger cohort_creator_joins after insert on cohorts for each row execute function cohort_creator_joins();

-- 대표 기수 (랭킹 닉네임 옆 약장)
alter table profiles add column if not exists main_cohort uuid references cohorts(id) on delete set null;

-- ── 3. 대항전 판: 한 사람 한 주 한 판 ──
alter table runs add column if not exists week date;   -- 그 주 월요일 (한국 시간)
create unique index if not exists runs_contest_once on runs (user_id, week) where mode = 'contest';
create index if not exists runs_contest_week on runs (week) where mode = 'contest';

-- ── 4. 주간 순위: 기수에 들어온 뒤 끝낸 판만, 상위 3명 평균 + 4번째부터 1명당 +5 (최대 +50) ──
create or replace view contest_board with (security_invoker = true) as
with s as (
  select m.cohort_id, r.week, r.user_id, r.rank_index * 100 + coalesce(r.honor, 0) as pts
  from runs r join members m on m.user_id = r.user_id and m.joined_at <= r.created_at
  where r.mode = 'contest' and r.week is not null
), ranked as (
  select s.*, row_number() over (partition by cohort_id, week order by pts desc) as rn from s
)
select k.cohort_id, k.week, count(*)::int as n,
       (round(avg(k.pts) filter (where k.rn <= 3)) + least(50, greatest(0, count(*) - 3) * 5))::int as score,
       c.name, c.no, c.ribbon, c.code
from ranked k join cohorts c on c.id = k.cohort_id
group by k.cohort_id, k.week, c.name, c.no, c.ribbon, c.code;
grant select on contest_board to anon, authenticated;

-- 주별 순위 (전역자 2명 이상인 기수만)
create or replace view contest_results with (security_invoker = true) as
select b.*, rank() over (partition by b.week order by b.score desc)::int as place
from contest_board b where b.n >= 2;
grant select on contest_results to anon, authenticated;

-- 기수 성적 요약 (끝난 주만): 약장 위 별 · 금테
create or replace view team_honors with (security_invoker = true) as
select cohort_id,
       count(*)::int as weeks,
       count(*) filter (where place <= 3)::int as podiums,
       count(*) filter (where place = 1)::int as wins
from contest_results
where week < date_trunc('week', now() at time zone 'Asia/Seoul')::date
group by cohort_id;
grant select on team_honors to anon, authenticated;

-- ═══════════ 5. 인사기록카드 · 호봉 · 고정 닉네임 ═══════════

-- 군번: 가입 순서 번호 (기존 프로필은 만든 순서대로 채움)
create sequence if not exists profile_serial_seq;
alter table profiles add column if not exists serial bigint;
alter table profiles add column if not exists nick_changed_at timestamptz;
do $$ begin
  if exists (select 1 from profiles where serial is null) then
    with o as (select id, row_number() over (order by created_at, id) as rn from profiles where serial is null)
    update profiles p set serial = (select coalesce(max(serial), 0) from profiles) + o.rn from o where p.id = o.id;
    perform setval('profile_serial_seq', (select max(serial) from profiles));
  end if;
end $$;
alter table profiles alter column serial set default nextval('profile_serial_seq');

-- 닉네임 규칙: 새로 정하거나 바꿀 때만 겹침 금지 (띄어쓰기 · 대소문자 무시), 바꾸기는 7일에 한 번
create or replace function nick_rules() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.nickname is not distinct from old.nickname then return new; end if;
  -- 업로드 때 쓰는 upsert는 먼저 INSERT로 들어와요: 이미 같은 이름으로 있는 내 프로필이면 통과 (예전부터 겹치던 이름 포함)
  if tg_op = 'INSERT' and exists (select 1 from profiles where id = new.id and nickname = new.nickname) then return new; end if;
  if exists (select 1 from profiles where id <> new.id and lower(replace(nickname, ' ', '')) = lower(replace(new.nickname, ' ', ''))) then
    raise exception 'nick_taken';
  end if;
  if tg_op = 'UPDATE' then
    if old.nick_changed_at is not null and old.nick_changed_at > now() - interval '7 days' then raise exception 'nick_wait'; end if;
    new.nick_changed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists nick_rules on profiles;
create trigger nick_rules before insert or update of nickname on profiles for each row execute function nick_rules();
create index if not exists profiles_nick_norm on profiles (lower(replace(nickname, ' ', '')));
create index if not exists runs_user on runs (user_id, created_at desc);

-- 경험치 · 기록 요약 (판 기록에서 계산 → 앱에서 마음대로 올릴 수 없음)
-- 판 끝내기 10 + 도달 계급(소위 10 ~ 대장 55), 오늘의 기수 +30, 대항전 +20, 자유 플레이는 하루 5판까지만
create or replace view profile_stats with (security_invoker = true) as
with r as (
  select user_id, mode, rank_index,
         (created_at at time zone 'Asia/Seoul')::date as d,
         row_number() over (partition by user_id, mode, (created_at at time zone 'Asia/Seoul')::date order by created_at) as nth
  from runs
)
select user_id,
       count(*)::int as runs,
       count(*) filter (where rank_index >= 6)::int as generals,
       count(*) filter (where rank_index = 9)::int as fourstars,
       max(rank_index)::int as best_rank,
       max(rank_index) filter (where mode = 'free')::int as best_free,
       count(*) filter (where mode = 'daily')::int as daily_days,
       count(*) filter (where mode = 'contest')::int as contest_weeks,
       sum(case when mode = 'free' and nth > 5 then 0
                else 20 + 5 * rank_index + case mode when 'daily' then 30 when 'contest' then 20 else 0 end end)::int as xp
from r group by user_id;
grant select on profile_stats to anon, authenticated;

-- 오늘의 기수 날마다 순위 (인사기록카드 "오늘의 기수 최고")
create or replace view daily_places with (security_invoker = true) as
select user_id, day,
       rank() over (partition by day order by rank_index desc, honor desc nulls last, years asc, created_at asc)::int as place,
       count(*) over (partition by day)::int as total
from runs where mode = 'daily';
grant select on daily_places to anon, authenticated;

-- 계정 삭제 (설정 화면): 내 기록 · 프로필 · 기수 소속을 지우고 로그인 계정도 지움
create or replace function delete_me() returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from members where user_id = me;
  delete from runs where user_id = me;
  delete from guestbook where user_id = me;
  delete from profiles where id = me;
  delete from auth.users where id = me;
end $$;
revoke all on function delete_me() from public, anon;
grant execute on function delete_me() to authenticated;
