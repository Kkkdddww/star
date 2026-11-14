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
