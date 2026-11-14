import { CHOICE_BY_ID } from '../src/data/choices';
import { optionOdds, rewardTier } from '../src/engine/choice';
import { advanceYear, decide, newGame, setPolicy, submitWishes } from '../src/engine/game';
import { assignmentsFor, isRequired, lacksRequired, wishScore } from '../src/engine/personnel';
import { RANKS } from '../src/data/config';
import type { Potential } from '../src/engine/types';
declare const process: { argv: string[]; env: Record<string, string> };
import { POTENTIAL, AWAKEN_CHANCE } from '../src/data/config';
if (process.env.TUNE === 'B') {
  Object.assign(POTENTIAL.S, { min: 11, max: 13, cap: 90 });
  Object.assign(POTENTIAL.A, { min: 9, max: 11, cap: 87 });
  Object.assign(POTENTIAL.B, { min: 8, max: 10, cap: 84 });
  Object.assign(POTENTIAL.C, { min: 7, max: 9, cap: 81 });
  Object.assign(AWAKEN_CHANCE, { C: 0.45, B: 0.3, A: 0.15, S: 0 });
}
const N = Number(process.argv[2] ?? 150); const strat = process.argv[3] ?? 'best';
const out: string[] = [];
for (const pot of ['S', 'A', 'B', 'C'] as Potential[]) {
  let gen = 0, rsum = 0, col = 0;
  for (let i = 0; i < N; i++) {
    let s = newGame({ name: '봇', origin: '학군', branch: '전투', path: '지휘관형', potential: pot, seed: 1000 + i, schoolPct: 50, bonus: {} });
    let rnd = (i * 9301 + 49297) % 233280; const R = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
    let g = 0;
    while (!s.ended && g++ < 60) {
      if (s.personnelDue) { const me = s.me; const pri = (a: { id: string; kind: string }) => (lacksRequired(me) && isRequired(me, a.id) ? 3 : a.kind === '지휘' || a.kind === '요직' ? 1 : 0); const o = assignmentsFor(me.rank).sort((a, b) => strat === 'rand' ? R() - 0.5 : pri(b) - pri(a) || wishScore(me, b) - wishScore(me, a)); s = submitWishes(s, [o[0].id, o[1].id]); continue; }
      if (s.policyDue) { s = setPolicy(s, '장병 우선'); continue; }
      for (let k = 0; s.desk && k < s.desk.items.length; k++) {
        const def = CHOICE_BY_ID[s.desk.items[k].defId];
        const ev = (o: (typeof def.options)[number]) => { const pp = optionOdds(s.me, o).p; return pp / 100 * Math.round(o.success.eval * (o.success.eval > 0 ? rewardTier(pp, o.sure).mult : 1)) + (1 - pp / 100) * o.fail.eval; };
        const opts = [...def.options].sort((a, b) => ev(b) - ev(a));
        const pick = strat === 'best' ? opts[0] : strat === 'worst' ? opts[opts.length - 1] : opts[Math.floor(R() * opts.length)];
        s = decide(s, k, pick.key);
      }
      const lows = (['command', 'tactics', 'admin', 'expertise', 'social', 'fitness'] as const).slice().sort((a, b) => s.me.stats[a] - s.me.stats[b]);
      s = advanceYear(s, strat === 'rand' ? ['command', 'admin'] : [lows[0], lows[1]]).next;
    }
    const ri = RANKS.indexOf(s.me.rank); rsum += ri; if (ri >= RANKS.indexOf('준장')) gen++; if (ri >= RANKS.indexOf('대령')) col++;
  }
  out.push(`${strat} ${pot}: 평균계급 ${(rsum / N).toFixed(2)} 대령+ ${(col / N * 100).toFixed(1)}% 준장+ ${(gen / N * 100).toFixed(1)}%`);
}
console.log(out.join('\n'));
