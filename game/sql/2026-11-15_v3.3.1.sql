-- 말뚝 v3.3.1 · 대항전 팀 점수 규칙 변경 (Supabase > SQL Editor에 붙여넣고 Run, 한 번만)
-- 팀 점수 = 이번 주 전역한 기수원 전원 평균 + 전역자 10명마다 +5 (10명 +5, 20명 +10, 30명 +15)
-- 칸 이름 · 순서는 그대로라 contest_results · team_honors 뷰는 손대지 않아도 따라 바뀌어요
create or replace view contest_board with (security_invoker = true) as
with s as (
  select m.cohort_id, r.week, r.user_id, r.rank_index * 100 + coalesce(r.honor, 0) as pts
  from runs r join members m on m.user_id = r.user_id and m.joined_at <= r.created_at
  where r.mode = 'contest' and r.week is not null
)
select k.cohort_id, k.week, count(*)::int as n,
       (round(avg(k.pts)) + (count(*) / 10) * 5)::int as score,
       c.name, c.no, c.ribbon, c.code
from s k join cohorts c on c.id = k.cohort_id
group by k.cohort_id, k.week, c.name, c.no, c.ribbon, c.code;
grant select on contest_board to anon, authenticated;

-- ═══════════ 무거운 조회 줄이기 ═══════════
-- 호봉 · 판 수 · 장군 횟수를 매번 판 기록 전체에서 계산하지 않고, 판을 올릴 때마다 프로필에 더해서 저장해요.
-- (처음 한 번만 지금까지 기록으로 채워요. 사람이 적은 시간에 Run하면 좋아요)

alter table profiles add column if not exists xp int not null default 0;
alter table profiles add column if not exists runs_n int not null default 0;
alter table profiles add column if not exists generals int not null default 0;
alter table profiles add column if not exists fourstars int not null default 0;
alter table profiles add column if not exists best_rank int;
alter table profiles add column if not exists best_free int;
alter table profiles add column if not exists daily_days int not null default 0;
alter table profiles add column if not exists contest_weeks int not null default 0;

-- 처음 한 번 채우기 (예전부터 '개발자' 같은 이름을 쓰던 프로필 때문에 닉네임 규칙을 잠깐 빼고 다시 넣어요)
alter table profiles drop constraint if exists nick_no_staff;
with r as (
  select user_id, mode, rank_index,
         row_number() over (partition by user_id, mode, (created_at at time zone 'Asia/Seoul')::date order by created_at) as nth
  from runs
), s as (
  select user_id,
         count(*)::int as runs_n,
         count(*) filter (where rank_index >= 6)::int as generals,
         count(*) filter (where rank_index = 9)::int as fourstars,
         max(rank_index)::int as best_rank,
         (max(rank_index) filter (where mode = 'free'))::int as best_free,
         count(*) filter (where mode = 'daily')::int as daily_days,
         count(*) filter (where mode = 'contest')::int as contest_weeks,
         sum(case when mode = 'free' and nth > 5 then 0
                  else 20 + 5 * rank_index + case mode when 'daily' then 30 when 'contest' then 20 else 0 end end)::int as xp
  from r group by user_id
)
update profiles p set xp = s.xp, runs_n = s.runs_n, generals = s.generals, fourstars = s.fourstars,
  best_rank = s.best_rank, best_free = s.best_free, daily_days = s.daily_days, contest_weeks = s.contest_weeks
from s where s.user_id = p.id;
alter table profiles add constraint nick_no_staff check (
  replace(nickname, ' ', '') !~* '(개발자|운영자|운영진|운영팀|관리자|인사과장|동우캉|admin|(^|[^a-z])gm($|[^a-z]))'
) not valid;

-- 판을 올릴 때마다 프로필에 더하기 (자유 플레이 경험치는 하루 5판까지)
create or replace function runs_to_profile() returns trigger language plpgsql security definer set search_path = public as $$
declare d date := (new.created_at at time zone 'Asia/Seoul')::date; nfree int := 0; gain int;
begin
  if new.mode = 'free' then
    select count(*) into nfree from runs
    where user_id = new.user_id and mode = 'free' and id <> new.id
      and created_at >= (d::timestamp at time zone 'Asia/Seoul');
  end if;
  gain := case when new.mode = 'free' and nfree >= 5 then 0
               else 20 + 5 * new.rank_index + case new.mode when 'daily' then 30 when 'contest' then 20 else 0 end end;
  update profiles set
    xp = xp + gain, runs_n = runs_n + 1,
    generals = generals + (new.rank_index >= 6)::int, fourstars = fourstars + (new.rank_index = 9)::int,
    best_rank = greatest(coalesce(best_rank, -1), new.rank_index),
    best_free = case when new.mode = 'free' then greatest(coalesce(best_free, -1), new.rank_index) else best_free end,
    daily_days = daily_days + (new.mode = 'daily')::int, contest_weeks = contest_weeks + (new.mode = 'contest')::int
  where id = new.user_id;
  return null;
end $$;
drop trigger if exists runs_to_profile on runs;
create trigger runs_to_profile after insert on runs for each row execute function runs_to_profile();

-- 앱이 읽는 이름(profile_stats)은 그대로, 이제는 저장된 칸을 바로 읽어서 가벼워요
create or replace view profile_stats with (security_invoker = true) as
select id as user_id, runs_n as runs, generals, fourstars, best_rank, best_free, daily_days, contest_weeks, xp from profiles;
grant select on profile_stats to anon, authenticated;

-- 인사기록카드 "오늘의 기수 최고": 그 사람이 한 날만, 인덱스로 세기 (전체 순위 계산 안 함)
create or replace function daily_best(uid uuid) returns table(day date, place int, total int) language sql stable set search_path = public as $$
  select r.day,
         (select count(*) + 1 from runs b where b.mode = 'daily' and b.day = r.day
            and (b.rank_index > r.rank_index
              or (b.rank_index = r.rank_index and coalesce(b.honor, -1) > coalesce(r.honor, -1))
              or (b.rank_index = r.rank_index and coalesce(b.honor, -1) = coalesce(r.honor, -1) and b.years < r.years)))::int as place,
         (select count(*) from runs t where t.mode = 'daily' and t.day = r.day)::int as total
  from runs r where r.user_id = uid and r.mode = 'daily'
  order by 2 asc, 1 desc limit 1
$$;
grant execute on function daily_best(uuid) to anon, authenticated;
