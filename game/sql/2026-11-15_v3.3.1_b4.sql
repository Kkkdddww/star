-- 말뚝 v3.3.1 ②-4 · 지금까지 기록으로 호봉 채우기 (4/4) · ①을 먼저 Run한 뒤에
-- 한 번에 1/4씩만 계산해서 시간 초과를 피해요. 2-1 → 2-2 → 2-3 → 2-4 순서로 하나씩 Run
-- ('개발자' 같은 쓸 수 없는 닉네임은 건너뛰어요. 새 닉네임을 정하면 그때부터 쌓여요)
with r as (
  select user_id, mode, rank_index,
         row_number() over (partition by user_id, mode, (created_at at time zone 'Asia/Seoul')::date order by created_at) as nth
  from runs where left(user_id::text, 1) in ('c','d','e','f')
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
from s where s.user_id = p.id
  and replace(p.nickname, ' ', '') !~* '(개발자|운영자|운영진|운영팀|관리자|인사과장|동우캉|admin|(^|[^a-z])gm($|[^a-z]))';
