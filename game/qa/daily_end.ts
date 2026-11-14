// QA용: 끝난 오늘의 기수 저장(2026-11-21, 업로드 완료)을 만들어 qa/daily_end.json에 쓴다. 실행: npx tsx qa/daily_end.ts
import { writeFileSync } from 'node:fs';
import { CHOICE_BY_ID } from '../src/data/choices';
import { advanceYear, decide, newGame, setPolicy, submitWishes } from '../src/engine/game';
import { assignmentsFor } from '../src/engine/personnel';
let s = newGame({ name: '테스트', origin: '학군', branch: '전투', path: '지휘관형', potential: 'S', seed: 77, schoolPct: 30, bonus: {}, world: { mode: 'daily', day: '2026-11-21', rollSeed: 5 } });
for (let g = 0; !s.ended && g < 60; g++) {
  if (s.personnelDue) { const o = assignmentsFor(s.me.rank); s = submitWishes(s, [o[0].id, o[1].id]); continue; }
  if (s.policyDue) { s = setPolicy(s, '장병 우선'); continue; }
  for (let k = 0; s.desk && k < s.desk.items.length; k++) s = decide(s, k, CHOICE_BY_ID[s.desk.items[k].defId].options[0].key);
  s = advanceYear(s, ['command', 'admin']).next;
}
writeFileSync('qa/daily_end.json', JSON.stringify({ game: s, focus: ['command', 'admin'], potentialSeen: 'S', metaApplied: true, log: [], runId: 'run1' }));
console.log('ended', s.ended, s.me.rank);
