-- 말뚝 v3.3.3 · 대항전 팀 점수 규칙 (Supabase > SQL Editor에 붙여넣고 Run, 몇 초)
-- 팀 점수 = 상위 10명 평균 (10명이 안 되면 빈자리는 300점) + 11번째 전역자부터 1명당 +2 (최대 +40)
-- 칸 이름 · 순서는 그대로라 contest_results · team_honors 뷰는 손대지 않아도 따라 바뀌어요
create or replace view contest_board with (security_invoker = true) as
with s as (
  select m.cohort_id, r.week, r.user_id, r.rank_index * 100 + coalesce(r.honor, 0) as pts
  from runs r join members m on m.user_id = r.user_id and m.joined_at <= r.created_at
  where r.mode = 'contest' and r.week is not null
), ranked as (
  select s.*, row_number() over (partition by cohort_id, week order by pts desc) as rn from s
)
select k.cohort_id, k.week, count(*)::int as n,
       (round((coalesce(sum(k.pts) filter (where k.rn <= 10), 0) + greatest(0, 10 - count(*)) * 300) / 10.0)
        + least(40, greatest(0, count(*) - 10) * 2))::int as score,
       c.name, c.no, c.ribbon, c.code
from ranked k join cohorts c on c.id = k.cohort_id
group by k.cohort_id, k.week, c.name, c.no, c.ribbon, c.code;
grant select on contest_board to anon, authenticated;
