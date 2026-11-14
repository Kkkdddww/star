if ((process as any).env.TERM_OFF) (globalThis as any).__TERM_OFF = true;
if ((process as any).env.VM_ADD) (globalThis as any).__VM_ADD = Number((process as any).env.VM_ADD);
import { CHOICE_BY_ID } from '../src/data/choices';
import { optionOdds, rewardTier } from '../src/engine/choice';
import { advanceYear, decide, newGame, setPolicy, submitWishes } from '../src/engine/game';
import { assignmentsFor, isRequired, lacksRequired, wishScore } from '../src/engine/personnel';
import type { Potential } from '../src/engine/types';
declare const process: { argv: string[] };
const N = Number(process.argv[2] ?? 300);
const cnt: Record<string, number> = {};
let total = 0;
for (const pot of ['S', 'A'] as Potential[]) for (let i = 0; i < N; i++) {
  let s = newGame({ name: '봇', origin: '학군', branch: '전투', path: '지휘관형', potential: pot, seed: i * 7 + (pot === 'S' ? 1 : 2), schoolPct: 50, bonus: {} });
  let g = 0;
  while (!s.ended && g++ < 60) {
    if (s.personnelDue) { const me = s.me; const pri = (a: { id: string; kind: string }) => (lacksRequired(me) && isRequired(me, a.id) ? 3 : a.kind === '지휘' || a.kind === '요직' ? 1 : 0); const o = assignmentsFor(me.rank).sort((a, b) => pri(b) - pri(a) || wishScore(me, b) - wishScore(me, a)); s = submitWishes(s, [o[0].id, o[1].id]); continue; }
    if (s.policyDue) { s = setPolicy(s, '장병 우선'); continue; }
    for (let k = 0; s.desk && k < s.desk.items.length; k++) { const def = CHOICE_BY_ID[s.desk.items[k].defId]; const ev = (o: (typeof def.options)[number]) => { const pp = optionOdds(s.me, o).p; return pp / 100 * Math.round(o.success.eval * (o.success.eval > 0 ? rewardTier(pp, o.sure).mult : 1)) + (1 - pp / 100) * o.fail.eval - (o.style === '편법' ? 2 : 0); }; s = decide(s, k, [...def.options].sort((a, b) => ev(b) - ev(a))[0].key); }
    const lows = (['command', 'tactics', 'admin', 'expertise', 'social', 'fitness'] as const).slice().sort((a, b) => s.me.stats[a] - s.me.stats[b]);
    s = advanceYear(s, [lows[0], lows[1]]).next;
  }
  const r = s.me.rank; cnt[`${pot} ${r}`] = (cnt[`${pot} ${r}`] ?? 0) + 1; total++;
}
const hi=(p:string)=>(cnt[`${p} 중장`]??0)+(cnt[`${p} 대장`]??0); console.log('3+ S',hi('S')/N,'A',hi('A')/N,'| 4 S',(cnt['S 대장']??0)/N,'A',(cnt['A 대장']??0)/N, '| 가중 3+', ((.1*hi('S')+.25*hi('A'))/N*100).toFixed(2)+'%', '4', ((.1*(cnt['S 대장']??0)+.25*(cnt['A 대장']??0))/N*100).toFixed(2)+'%');
console.log(Object.entries(cnt).filter(([k]) => /장$/.test(k)).sort().map(([k, v]) => `${k}: ${v}/${N} (${(v / N * 100).toFixed(1)}%)`).join('\n'));
