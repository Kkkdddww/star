// 약장(게임 전용 이름)·칭호 판정. 판을 넘어 쌓이는 도감은 UI가 저장한다.
// 이름은 실제 훈장·포장과 겹치지 않게 지었다. 출시 전 상훈 목록과 한 번 더 대조할 것.
import { ASSIGNMENTS, RANKS } from '../data/config';
import type { GameState, Rank } from './types';

export interface RibbonDef { id: string; name: string; cond: string; design: number; prec: number; tiers?: string[] }
/** prec: 클수록 격이 높아 약장 줄의 위쪽에 달린다 */
export const RIBBONS: RibbonDef[] = [
  { id: 'cheongun', name: '청운장', cond: '전역할 때 계급에 따라 1~5급', design: 1, prec: 95, tiers: ['5급', '4급', '3급', '2급', '1급'] },
  { id: 'yeongye', name: '영예장', cond: '큰 표창을 받기', design: 3, prec: 90 },
  { id: 'seongjwa', name: '성좌장', cond: '장성으로 진급', design: 12, prec: 88 },
  { id: 'gongjeok', name: '공적장', cond: '표창을 받기 (위관 동·영관 은·장성 금)', design: 0, prec: 80, tiers: ['동', '은', '금'] },
  { id: 'jeongdo', name: '정도장', cond: '중대 사건을 모두 원칙대로 처리', design: 10, prec: 78 },
  { id: 'jungchu', name: '중추장', cond: '대령으로 진급', design: 13, prec: 75 },
  { id: 'seonbong', name: '선봉장', cond: '동기 중 처음으로 진급', design: 14, prec: 72 },
  { id: 'boru', name: '보루장', cond: '지휘 보직 5년 연속 무사고', design: 2, prec: 70 },
  { id: 'gyemyeong', name: '계명장', cond: '학교나 군사교육 수석', design: 7, prec: 68 },
  { id: 'takwol', name: '탁월장', cond: "평정 '탁월' 3회 (5회 은·8회 금)", design: 15, prec: 66, tiers: ['동', '은', '금'] },
  { id: 'gyeolsil', name: '결실장', cond: '2년 전 결재가 열매를 맺기', design: 16, prec: 62 },
  { id: 'bulgul', name: '불굴장', cond: '3차 심사에서 진급', design: 6, prec: 60 },
  { id: 'matsu', name: '맞수장', cond: '라이벌보다 높은 계급으로 전역', design: 11, prec: 58 },
  { id: 'junggyeon', name: '중견장', cond: '소령으로 진급', design: 17, prec: 55 },
  { id: 'dajae', name: '다재장', cond: '경험 태그 4개 이상', design: 18, prec: 50 },
  { id: 'gyeongnyun', name: '경륜장', cond: '요직에서 근무', design: 19, prec: 48 },
  { id: 'tongsol', name: '통솔장', cond: '지휘 보직에서 근무', design: 20, prec: 46 },
  { id: 'bojwa', name: '보좌장', cond: '참모 보직에서 근무', design: 21, prec: 44 },
  { id: 'sado', name: '사도장', cond: '교육 보직에서 근무', design: 22, prec: 42 },
  { id: 'ganggeon', name: '강건장', cond: '체력검정 특급 5회', design: 9, prec: 40 },
  { id: 'choseok', name: '초석장', cond: '10·20·30년 근속', design: 5, prec: 36, tiers: ['동', '은', '금'] },
  { id: 'doyak', name: '도약장', cond: '대위로 진급', design: 23, prec: 32 },
  { id: 'yeonma', name: '연마장', cond: '군사교육 수료', design: 8, prec: 28 },
  { id: 'sinnyeom', name: '신념장', cond: '장기복무 장교가 되기', design: 4, prec: 24 },
  { id: 'imgwan', name: '임관장', cond: '소위로 임관', design: 24, prec: 10 },
];

export interface Earned { id: string; name: string; tier?: string; tierIndex: number; design: number }

const ri = (r: Rank) => RANKS.indexOf(r);

/** 지금까지 받은 약장. 격이 낮은 것부터 (약장 줄은 위쪽에 격 높은 것이 오게 그린다) */
export function earnedRibbons(s: GameState): Earned[] {
  const me = s.me;
  const final = !!s.ended;
  const years = s.history.length;
  const out: Earned[] = [];
  const add = (id: string, tierIndex = 0) => {
    const d = RIBBONS.find((r) => r.id === id)!;
    out.push({ id, name: d.name, tier: d.tiers?.[tierIndex], tierIndex, design: d.design });
  };
  const rank = ri(me.rank);
  const kinds = new Set(me.billets.map((b) => ASSIGNMENTS.find((a) => a.id === b)!.kind));
  const su = s.history.filter((h) => h.grade === '탁월').length;
  const chainWin = s.history.some((h) => h.events.some((e) => e.kind === 'choice' && ['rules_spread', 'system_spread', 'welfare_model', 'textbook'].some((c) => e.id === `choice:${c}`) && e.tone === 'good'));

  add('imgwan');
  if (me.longService === 'passed' || (me.longService === 'exempt' && rank >= 2)) add('sinnyeom');
  if (me.eduDone > 0) add('yeonma');
  if (rank >= 2) add('doyak');
  if (years >= 10) add('choseok', years >= 30 ? 2 : years >= 20 ? 1 : 0);
  if (me.log.fitnessTop >= 5) add('ganggeon');
  if (kinds.has('교육')) add('sado');
  if (kinds.has('참모')) add('bojwa');
  if (kinds.has('지휘')) add('tongsol');
  if (kinds.has('요직')) add('gyeongnyun');
  if (me.tags.length >= 4) add('dajae');
  if (rank >= 3) add('junggyeon');
  if (final) {
    const rival = s.cohort.find((o) => o.id === s.rivalId);
    if (rival && rank > ri(rival.rank)) add('matsu');
  }
  if (me.log.thirdTry) add('bulgul');
  if (chainWin) add('gyeolsil');
  if (su >= 3) add('takwol', su >= 8 ? 2 : su >= 5 ? 1 : 0);
  if (me.log.eduTop > 0 || me.schoolPct <= 1) add('gyemyeong');
  if (me.log.cleanCommandBest >= 5) add('boru');
  if (me.log.firstInCohort.length) add('seonbong');
  if (rank >= 5) add('jungchu');
  if (me.log.incidents > 0 && me.log.principled === me.log.incidents) add('jeongdo');
  if (me.log.awards.length) {
    const g = me.log.awards.some((a) => a.group === '장성') ? 2 : me.log.awards.some((a) => a.group === '영관') ? 1 : 0;
    add('gongjeok', g);
  }
  if (rank >= 6) add('seongjwa');
  if (me.log.majorAwards > 0) add('yeongye');
  if (final) add('cheongun', rank >= 8 ? 4 : rank >= 6 ? 3 : rank >= 4 ? 2 : rank >= 2 ? 1 : 0);
  const prec = (id: string) => RIBBONS.find((r) => r.id === id)!.prec;
  return out.sort((a, b) => prec(a.id) - prec(b.id));
}

export interface TitleDef { id: string; name: string; cond: string }
export const TITLES: TitleDef[] = [
  { id: 'top_grad', name: '수석 졸업', cond: '학교를 수석으로 졸업' },
  { id: 'honor_grad', name: '우등 졸업', cond: '졸업 석차 상위 10%' },
  { id: 'hard_way', name: '알고도 간 길', cond: '손해를 알면서도 원칙을 택함' },
  { id: 'chief', name: '최고 책임자', cond: '참모총장 취임' },
  { id: 'apex', name: '야전의 정점', cond: '사령관 취임' },
  { id: 'first', name: '선두주자', cond: '동기 중 처음으로 진급' },
  { id: 'field', name: '야전통', cond: '지휘 보직 4곳 이상' },
  { id: 'policy', name: '정책통', cond: '요직 3곳 이상' },
  { id: 'clean', name: '흠잡을 데 없는', cond: '마음에 걸리는 일 없이 평정 탁월 5회 이상' },
  { id: 'star', name: '별을 단 사람', cond: '장성 진급' },
  { id: 'straight', name: '정공법', cond: '후보 다시 뽑기 없이 장성 진급' },
];

export function earnedTitles(s: GameState): string[] {
  const me = s.me;
  const kinds = me.billets.map((b) => ASSIGNMENTS.find((a) => a.id === b)!.kind);
  const su = s.history.filter((h) => h.grade === '탁월').length;
  const t: string[] = [];
  if (me.schoolPct <= 1) t.push('top_grad');
  else if (me.schoolPct <= 10) t.push('honor_grad');
  if (me.log.hardWay) t.push('hard_way');
  if (me.billets.includes('chief')) t.push('chief');
  if (me.billets.includes('commander')) t.push('apex');
  if (me.log.firstInCohort.length) t.push('first');
  if (kinds.filter((k) => k === '지휘').length >= 4) t.push('field');
  if (kinds.filter((k) => k === '요직').length >= 3) t.push('policy');
  if (me.hidden.risk === 0 && su >= 5) t.push('clean');
  if (ri(me.rank) >= ri('준장')) t.push('star');
  if (ri(me.rank) >= ri('준장') && s.creation && s.creation.rerolls === 0) t.push('straight');
  return t;
}
export const titleName = (id: string) => TITLES.find((t) => t.id === id)?.name ?? id;

/** 명예 점수: 오늘의 기수에서 같은 계급끼리 순위를 가른다 (약장·칭호·평정·표창·무사고·원칙 − 마음에 걸리는 일) */
export function honorScore(g: GameState): { total: number; parts: { label: string; v: number }[] } {
  const me = g.me;
  const rib = earnedRibbons(g);
  const parts = [
    { label: '약장', v: rib.length * 10 + rib.reduce((s, e) => s + e.tierIndex * 5, 0) },
    { label: '칭호', v: earnedTitles(g).length * 15 },
    { label: "평정 '탁월'", v: g.history.filter((h) => h.grade === '탁월').length * 3 },
    { label: '표창', v: me.log.awards.length * 3 + me.log.majorAwards * 8 },
    { label: '무사고 지휘', v: me.log.cleanCommandBest * 2 },
    { label: '원칙을 지킨 중대 사건', v: me.log.principled * 4 },
    { label: '마음에 걸리는 일', v: -me.hidden.risk * 5 },
  ];
  return { total: Math.max(0, parts.reduce((s, x) => s + x.v, 0)), parts: parts.filter((x) => x.v) };
}
