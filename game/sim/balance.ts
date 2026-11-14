// 밸런스 확인: 봇 4종 × 잠재력 4종으로 커리어를 끝까지 돌린다.
// 실행: npx tsx sim/balance.ts [판 수]
import { CHOICE_BY_ID } from '../src/data/choices';
import { RANKS } from '../src/data/config';
import { optionOdds, rewardTier } from '../src/engine/choice';
import { advanceYear, decide, newGame, setPolicy, submitWishes } from '../src/engine/game';
import { earnedRibbons } from '../src/engine/meta';
import { assignmentsFor, isRequired, lacksRequired, wishScore } from '../src/engine/personnel';
import type { GameState, Potential, Style } from '../src/engine/types';

declare const process: { argv: string[] };
const N = Number(process.argv[2] ?? 500);
type Bot = '원칙' | '도전' | '편법' | '기대값' | '한우물';

function pick(s: GameState, slot: number, bot: Bot): string {
  const def = CHOICE_BY_ID[s.desk!.items[slot].defId];
  if (bot === '기대값' || bot === '한우물') {
    const ev = (o: (typeof def.options)[number]) => { const pp = optionOdds(s.me, o).p; const p = pp / 100; return p * Math.round(o.success.eval * (o.success.eval > 0 ? rewardTier(pp, o.sure).mult : 1)) + (1 - p) * o.fail.eval - (o.style === '편법' ? 2 : 0); };
    return [...def.options].sort((a, b) => ev(b) - ev(a))[0].key;
  }
  const want: Style = bot;
  return (def.options.find((o) => o.style === want) ?? def.options[0]).key;
}

function play(pot: Potential, bot: Bot, seed: number) {
  let s = newGame({ name: '봇', origin: '학군', branch: '전투', path: '지휘관형', potential: pot, seed, schoolPct: 50, bonus: {} });
  let guard = 0;
  while (!s.ended && guard++ < 60) {
    if (s.personnelDue) {
      const me = s.me;
      const pri = (a: { id: string; kind: string }) => bot === '한우물'
        ? (a.kind === '요직' ? 2 : a.kind === '참모' ? 1 : 0)
        : (lacksRequired(me) && isRequired(me, a.id) ? 3 : a.kind === '지휘' || a.kind === '요직' ? 1 : 0);
      const opts = assignmentsFor(me.rank).sort((a, b) => pri(b) - pri(a) || wishScore(me, b) - wishScore(me, a));
      s = submitWishes(s, [opts[0].id, opts[1].id]);
      continue;
    }
    if (s.policyDue) { s = setPolicy(s, '장병 우선'); continue; }
    for (let i = 0; s.desk && i < s.desk.items.length; i++) s = decide(s, i, pick(s, i, bot));
    const lows = (['command', 'tactics', 'admin', 'expertise', 'social', 'fitness'] as const).slice().sort((a, b) => s.me.stats[a] - s.me.stats[b]);
    s = advanceYear(s, bot === '한우물' ? ['admin', 'expertise'] : [lows[0], lows[1]]).next;
  }
  return s;
}

const bots: Bot[] = (process.argv[3]?.split(',') as Bot[]) ?? ['원칙', '도전', '편법', '기대값', '한우물'];
console.log(`각 ${N}판. 최종 계급 분포(%)\n`);
console.log('잠재력 봇     | ' + ['중위↓', '대위', '소령', '중령', '대령', '장성'].map((x) => x.padStart(5)).join(' ') + ' | 평균연수 감사/판 약장/판');
const W: Record<Potential, number> = { S: 0.1, A: 0.25, B: 0.4, C: 0.25 };
const gen: Record<string, number> = {};
for (const pot of ['S', 'A', 'B', 'C'] as Potential[]) {
  for (const bot of bots) {
    const dist = [0, 0, 0, 0, 0, 0];
    let years = 0, audits = 0, ribbons = 0;
    for (let i = 0; i < N; i++) {
      const s = play(pot, bot, i * 7 + 3);
      const r = RANKS.indexOf(s.me.rank);
      dist[r <= 1 ? 0 : r >= 6 ? 5 : r - 1]++;
      years += s.history.length;
      audits += s.history.flatMap((h) => h.events).filter((e) => e.id === 'risk_audit').length;
      ribbons += earnedRibbons(s).length;
    }
    gen[bot] = (gen[bot] ?? 0) + W[pot] * dist[5] / N;
    console.log(`${pot}      ${bot.padEnd(4)} | ` + dist.map((d) => (Math.round((d / N) * 1000) / 10).toFixed(1).padStart(5)).join(' ') + ` | ${(years / N).toFixed(1).padStart(6)} ${(audits / N).toFixed(2).padStart(6)} ${(ribbons / N).toFixed(1).padStart(6)}`);
  }
}
console.log('\n플레이어 잠재력 분포로 가중한 장성 비율:', Object.entries(gen).map(([b, v]) => `${b} ${(v * 100).toFixed(1)}%`).join(' · '));
