// 마케팅 팀 데이터 분석관용: 오늘의 기수 · 대항전 공개 기록에서 홍보에 쓸 사실을 뽑아 marketing/out/<날짜>/facts.json 으로 저장.
// 실행 (game 폴더에서): npx tsx ../marketing/scripts/facts.mts [YYYY-MM-DD]
// 서버에는 앱이 화면마다 하는 것과 같은 가벼운 조회만 한다 (그날 · 그 주로 좁힌 조회, count는 limit=1).
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHOICE_BY_ID } from '../../game/src/data/choices';
import { cleanNick } from '../../game/src/data/banned';
import { DIFFICULTY, fixedPotential } from '../../game/src/engine/candidates';
import { deskText } from '../../game/src/engine/choice';
import { weekOf } from '../../game/src/engine/contest';
import { SUPABASE_KEY, SUPABASE_URL, today } from '../../game/src/net/api';
declare const process: { argv: string[] };

const day = process.argv[2] ?? today();
const H = { apikey: SUPABASE_KEY };
async function get<T>(q: string): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${q}`);
  return r.json() as Promise<T>;
}
async function count(q: string): Promise<number> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/runs?select=id&${q}&limit=1`, { headers: { ...H, Prefer: 'count=exact' } });
  if (!r.ok) throw new Error(`${r.status} count ${q}`);
  return Number(r.headers.get('content-range')?.split('/')[1] ?? 0) || 0;
}
const addDay = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

const base = `mode=eq.daily&day=eq.${day}`;
const [n, generals, threeStar, fourStar] = await Promise.all([count(base), count(`${base}&rank_index=gte.6`), count(`${base}&rank_index=gte.8`), count(`${base}&rank_index=eq.9`)]);
type Run = { nickname: string; final_rank: string; honor: number | null; best_billet: string | null; years: number; origin: string };
const top = await get<Run[]>(`runs?select=nickname,final_rank,honor,best_billet,years,origin&${base}&order=rank_index.desc,honor.desc.nullslast,years.asc,created_at.asc&limit=3`);

// 결재 선택 비율: 가장 갈린 결재 (두 번째로 많이 고른 선택지 비율이 가장 높은 것, 30명 이상)
type Stat = { def_id: string; option_key: string; n: number; ok: number };
const stats = await get<Stat[]>(`daily_choice_stats?day=eq.${day}&select=def_id,option_key,n,ok`).catch((e) => { console.error(String(e)); return [] as Stat[]; });
const byDef = new Map<string, Stat[]>();
for (const s of stats) byDef.set(s.def_id, [...(byDef.get(s.def_id) ?? []), s]);
const choices = [...byDef.entries()].map(([id, xs]) => {
  const def = CHOICE_BY_ID[id];
  // 선택 비율만 쓴다 (뷰의 ok 칸은 성공률로 쓰기에 확실하지 않아서 뺌)
  const total = xs.reduce((a, x) => a + x.n, 0);
  const keys = [...new Set(xs.map((x) => x.option_key))];
  const opts = keys.map((k) => {
    const n = xs.filter((x) => x.option_key === k).reduce((a, x) => a + x.n, 0);
    return { key: k, label: def?.options.find((o) => o.key === k)?.label ?? k, pct: Math.round((n / total) * 100) };
  }).sort((a, b) => b.pct - a.pct);
  return { id, title: def ? deskText(id, 0).title : id, total, options: opts, split: opts[1]?.pct ?? 0 };
}).filter((c) => c.total >= 30).sort((a, b) => b.split - a.split);

// 대항전 (이번 주 순위 · 지난주 1~3위)
const week = weekOf(day), last = weekOf(addDay(week, -1));
type Board = { name: string; no: number | null; n: number; score: number };
const [thisWeek, lastWeek] = await Promise.all([
  get<Board[]>(`contest_results?week=eq.${week}&select=name,no,n,score&order=score.desc&limit=3`).catch(() => []),
  get<Board[]>(`contest_results?week=eq.${last}&select=name,no,n,score&order=score.desc&limit=3`).catch(() => []),
]);

const tomorrow = addDay(day, 1);
const fp = fixedPotential(day), fpT = fixedPotential(tomorrow);
const facts = {
  day, generatedAt: new Date().toISOString(),
  daily: {
    difficulty: fp ? DIFFICULTY[fp] : null, participants: n, generals, threeStarPlus: threeStar, fourStar,
    generalPct: n ? Math.round((generals / n) * 1000) / 10 : 0,
    top: top.map((r, i) => ({ place: i + 1, name: cleanNick(r.nickname), rank: r.final_rank, honor: r.honor ?? 0, billet: r.best_billet, years: r.years, origin: r.origin })),
  },
  mostSplitChoice: choices[0] ?? null,
  otherChoices: choices.slice(1, 4),
  contest: { week, top: thisWeek, lastWeek: { week: last, top: lastWeek } },
  tomorrow: { day: tomorrow, difficulty: fpT ? DIFFICULTY[fpT] : null },
  link: 'https://malttuk.com/',
};
const out = `../marketing/out/${day}`;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/facts.json`, JSON.stringify(facts, null, 2));
console.log(`${out}/facts.json · 참가 ${n} · 장군 ${generals} · 대장 ${fourStar} · 가장 갈린 결재: ${choices[0]?.title ?? '-'}`);
