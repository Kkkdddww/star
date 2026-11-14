// v3.2 밸런스 목표 확인: 잠재력 구성 × 봇 실력별 계급 비율 (대령+ · 준장+ · 중장+ · 대장)
// 실행: npx tsx sim/targets.ts [판 수] [잠재력: mix|S|A|B|C] [봇: best,mid,rand]
// 봇은 사람보다 약함(v3.1 실제 기록: 준장+ 사람 9~12% vs best 봇 2.7%). 절대값보다 변경 전후 비교에 쓴다. NOTES.md v3.2
if ((process as any).env.VM_ADD) (globalThis as any).__VM_ADD = Number((process as any).env.VM_ADD);
import { CHOICE_BY_ID } from '../src/data/choices';
import { RANKS } from '../src/data/config';
import { POT_ROLL } from '../src/engine/candidates';
import { optionOdds, rewardTier } from '../src/engine/choice';
import { advanceYear, decide, newGame, setPolicy, submitWishes } from '../src/engine/game';
import { assignmentsFor, isRequired, lacksRequired, wishScore } from '../src/engine/personnel';
import type { Branch, Path, Potential } from '../src/engine/types';
declare const process: { argv: string[]; env: Record<string, string> };

const N = Number(process.argv[2] ?? 1000);
const POT = process.argv[3] ?? 'mix';
const BOTS = (process.argv[4] ?? 'best,mid,rand').split(',');
const BRANCH: Branch[] = ['전투', '기술', '행정'];
const PATH: Path[] = ['지휘관형', '참모형', '균형형'];

function play(i: number, bot: string) {
  let x = (i * 2654435761 + 97) >>> 0;
  const R = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const smart = () => bot === 'best' || (bot === 'mid' && R() < 0.5);
  const pot: Potential = POT === 'mix' ? POT_ROLL(R()) : (POT as Potential);
  let s = newGame({ name: '봇', origin: '학군', branch: BRANCH[i % 3], path: PATH[Math.floor(i / 3) % 3], potential: pot, seed: 5000 + i, schoolPct: 20 + Math.floor(R() * 60), bonus: {} });
  let g = 0;
  while (!s.ended && g++ < 60) {
    if (s.personnelDue) {
      const me = s.me;
      const pri = (a: { id: string; kind: string }) => (lacksRequired(me) && isRequired(me, a.id) ? 3 : a.kind === '지휘' || a.kind === '요직' ? 1 : 0);
      const sm = smart();
      const o = assignmentsFor(me.rank).sort((a, b) => sm ? pri(b) - pri(a) || wishScore(me, b) - wishScore(me, a) : R() - 0.5);
      s = submitWishes(s, [o[0].id, o[1].id]); continue;
    }
    if (s.policyDue) { s = setPolicy(s, '장병 우선'); continue; }
    for (let k = 0; s.desk && k < s.desk.items.length; k++) {
      const def = CHOICE_BY_ID[s.desk.items[k].defId];
      const ev = (o: (typeof def.options)[number]) => { const pp = optionOdds(s.me, o).p; return pp / 100 * Math.round(o.success.eval * (o.success.eval > 0 ? rewardTier(pp, o.sure).mult : 1)) + (1 - pp / 100) * o.fail.eval - (o.style === '편법' ? 2 : 0); };
      const pick = smart() ? [...def.options].sort((a, b) => ev(b) - ev(a))[0] : def.options[Math.floor(R() * def.options.length)];
      s = decide(s, k, pick.key);
    }
    const lows = (['command', 'tactics', 'admin', 'expertise', 'social', 'fitness'] as const).slice().sort((a, b) => s.me.stats[a] - s.me.stats[b]);
    s = advanceYear(s, smart() ? [lows[0], lows[1]] : ['command', 'admin']).next;
  }
  return RANKS.indexOf(s.me.rank);
}

for (const bot of BOTS) {
  const c = Array(10).fill(0);
  for (let i = 0; i < N; i++) c[play(i, bot)]++;
  const ge = (r: number) => (c.slice(r).reduce((a, b) => a + b, 0) / N * 100);
  console.log(`${POT} ${bot.padEnd(4)} n=${N} | 대령+ ${ge(5).toFixed(1)}% 준장+ ${ge(6).toFixed(1)}% 중장+ ${ge(8).toFixed(2)}% 대장 ${ge(9).toFixed(2)}%`);
}
