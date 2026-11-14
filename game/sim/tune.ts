// v3.3.4 진급 비율 맞추기: 계급별 도달 수와 조건부 비율(준장→중장+, 중장→대장)
// 실행: npx tsx sim/tune.ts [판 수] [잠재력 mix|S|A|B|C] [봇 best|mid|rand]  (VM_ADD=… 로 다른 기수 평균 비교)
if ((process as any).env.VM) (globalThis as any).__VM = JSON.parse((process as any).env.VM);
if ((process as any).env.VM_ADD) (globalThis as any).__VM_ADD = Number((process as any).env.VM_ADD);
import { CHOICE_BY_ID } from '../src/data/choices';
import { RANKS } from '../src/data/config';
import { POT_ROLL } from '../src/engine/candidates';
import { optionOdds, rewardTier } from '../src/engine/choice';
import { advanceYear, decide, newGame, setPolicy, submitWishes } from '../src/engine/game';
import { assignmentsFor, isRequired, lacksRequired, wishScore } from '../src/engine/personnel';
import type { Branch, Path, Potential } from '../src/engine/types';
declare const process: { argv: string[]; env: Record<string, string> };
const N = Number(process.argv[2] ?? 1000), POT = process.argv[3] ?? 'mix', BOT = process.argv[4] ?? 'best', OFF = Number(process.env.OFF ?? 0);
const BR: Branch[] = ['전투', '기술', '행정'], PA: Path[] = ['지휘관형', '참모형', '균형형'];
const c = Array(10).fill(0);
for (let j = 0; j < N; j++) {
  const i = j + OFF;
  let x = (i * 2654435761 + 97) >>> 0; const R = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const smart = () => BOT === 'best' || (BOT === 'mid' && R() < 0.5);
  const pot: Potential = POT === 'mix' ? POT_ROLL(R()) : (POT as Potential);
  let s = newGame({ name: '봇', origin: '학군', branch: BR[i % 3], path: PA[Math.floor(i / 3) % 3], potential: pot, seed: 5000 + i, schoolPct: 20 + Math.floor(R() * 60), bonus: {} });
  let g = 0;
  while (!s.ended && g++ < 60) {
    if (s.personnelDue) { const me = s.me; const pri = (a: any) => (lacksRequired(me) && isRequired(me, a.id) ? 3 : a.kind === '지휘' || a.kind === '요직' ? 1 : 0); const sm = smart();
      const o = assignmentsFor(me.rank).sort((a, b) => sm ? pri(b) - pri(a) || wishScore(me, b) - wishScore(me, a) : R() - 0.5); s = submitWishes(s, [o[0].id, o[1].id]); continue; }
    if (s.policyDue) { s = setPolicy(s, '장병 우선'); continue; }
    for (let k = 0; s.desk && k < s.desk.items.length; k++) { const def = CHOICE_BY_ID[s.desk.items[k].defId];
      const ev = (o: any) => { const pp = optionOdds(s.me, o).p; return pp / 100 * Math.round(o.success.eval * (o.success.eval > 0 ? rewardTier(pp, o.sure).mult : 1)) + (1 - pp / 100) * o.fail.eval - (o.style === '편법' ? 2 : 0); };
      s = decide(s, k, (smart() ? [...def.options].sort((a, b) => ev(b) - ev(a))[0] : def.options[Math.floor(R() * def.options.length)]).key); }
    const lows = (['command', 'tactics', 'admin', 'expertise', 'social', 'fitness'] as const).slice().sort((a, b) => s.me.stats[a] - s.me.stats[b]);
    s = advanceYear(s, smart() ? [lows[0], lows[1]] : ['command', 'admin']).next;
  }
  c[RANKS.indexOf(s.me.rank)]++;
}
console.log(JSON.stringify({ POT, BOT, N, c }));
