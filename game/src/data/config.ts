// 밸런스 숫자는 전부 여기에. 게임용 가상 값이며 실제 군 규정이 아니다.
// 보직은 공개적으로 알려진 일반 직책명만 쓴다 (실제 부대명·번호·위치·편제 세부는 넣지 않음).
import type { Assignment, BilletKind, Branch, Origin, Path, Personality, Policy, Potential, Rank, SchoolFocus, StatKey, Stats, Style } from '../engine/types';

export const RANKS: Rank[] = ['소위', '중위', '대위', '소령', '중령', '대령', '준장', '소장', '중장', '대장'];

export const MIN_YEARS: Partial<Record<Rank, number>> = {
  소위: 1, 중위: 2, 대위: 6, 소령: 5, 중령: 5, 대령: 4, 준장: 2, 소장: 2, 중장: 2,
};
export const AUTO_PROMOTE: Rank[] = ['소위', '중위'];

export type PromoWeights = { eval: number; career: number; edu: number; combat: number; balance: number };
export const PROMOTION: Partial<Record<Rank, { cumulative: number; tries: number; weights: PromoWeights }>> = {
  대위: { cumulative: 0.7, tries: 3, weights: { eval: 0.45, career: 0.2, edu: 0.1, combat: 0.1, balance: 0.15 } },
  소령: { cumulative: 0.6, tries: 3, weights: { eval: 0.45, career: 0.25, edu: 0.15, combat: 0, balance: 0.15 } },
  중령: { cumulative: 0.5, tries: 3, weights: { eval: 0.45, career: 0.25, edu: 0.15, combat: 0, balance: 0.15 } },
  대령: { cumulative: 0.35, tries: 4, weights: { eval: 0.4, career: 0.35, edu: 0.1, combat: 0, balance: 0.15 } },
  준장: { cumulative: 0.45, tries: 2, weights: { eval: 0.4, career: 0.35, edu: 0.1, combat: 0, balance: 0.15 } },
  소장: { cumulative: 0.4, tries: 2, weights: { eval: 0.4, career: 0.35, edu: 0.1, combat: 0, balance: 0.15 } },
  중장: { cumulative: 0.3, tries: 2, weights: { eval: 0.4, career: 0.35, edu: 0.1, combat: 0, balance: 0.15 } },
};

/** 필수 보직: 이 계급에서 다음 계급 심사를 받으려면 반드시 거쳐야 하는 보직 (하나라도) */
export const REQUIRED_BILLET: Partial<Record<Rank, { ids: string[]; label: string; forceAt: number | null }>> = {
  대위: { ids: ['company'], label: '중대장', forceAt: 4 },
  중령: { ids: ['battalion'], label: '대대장', forceAt: null },
  대령: { ids: ['regiment', 'hq_chief'], label: '연대장 또는 본부 과장', forceAt: null },
};
/** 인사에서 필수 보직을 아직 안 한 사람이 그 보직을 지원하면 받는 가점 */
export const REQUIRED_WISH_BONUS = 10;
/** 능력치가 이 값 이상이면 기본 성장이 절반만 붙는다 */
export const SOFT_CAP = 80;

export function yearlyRate(rank: Rank): number {
  const p = PROMOTION[rank];
  if (!p) return 0;
  return 1 - Math.pow(1 - p.cumulative, 1 / p.tries);
}

/** 경력 점수 = 55 + 핵심(지휘·요직) 25 + 보조 보직 10×n(최대 2) + 출신 보정 */
export const CAREER = { base: 55, core: 25, support: 10, supportMax: 2 };

export const GENERAL_TERM = 3;
export const REVIEW_NOISE = 3;

/** 성장 C안: 잠재력별 기본 성장(나이 적용), 종합 능력치 상한. 이벤트 보상은 나이와 무관 */
export const POTENTIAL: Record<Potential, { min: number; max: number; cap: number; label: string }> = {
  S: { min: 11, max: 13, cap: 90, label: '타고난 지휘관감. 어느 자리에서든 빠르게 큽니다' },
  A: { min: 9, max: 11, cap: 87, label: '꾸준히 성장할 재목. 기회를 잡으면 멀리 갑니다' },
  B: { min: 8, max: 10, cap: 84, label: '성실한 평균형. 경험이 쌓일수록 단단해집니다' },
  C: { min: 7, max: 9, cap: 81, label: '늦게 피는 꽃. 계기를 만나면 달라질 수 있습니다' },
};
export function ageFactor(age: number): number {
  if (age < 30) return 1.0;
  if (age < 40) return 0.7;
  return 0.4;
}
export const BRANCH_FIT_MULT = 1.2;
export const AWAKEN_CHANCE: Record<Potential, number> = { C: 0.45, B: 0.3, A: 0.15, S: 0 };
export const AWAKEN_MAX = 2;
export const AWAKEN_AGE_LIMIT = 45;
export const FITNESS_DECLINE_AGE = 35;
export const STAT_MAX = 99;
export const ASSIGNMENT_TERM = 2;
export const START_AGE = 23;

/** 선택 이벤트 확률 = 기본 + (능력치 − 계급 기준)% + 태그 8(최대 2개) + 교육 5 + 보직 경험 5, 10~95% */
export const ODDS = { tag: 8, tagMax: 2, edu: 5, billet: 5, min: 10, max: 95 };

/** 하이리스크 하이리턴: 표시 확률이 낮을수록 성공 보상(평정·능력치 상승)에 배율 */
export const REWARD_TIERS: { max: number; mult: number; label: string }[] = [
  { max: 35, mult: 1.6, label: '대박' },
  { max: 50, mult: 1.3, label: '도전' },
  { max: 70, mult: 1, label: '' },
  { max: 100, mult: 0.8, label: '안정' },
];
/** 연속 실패 보정: 실패할 때마다 다음 판정에 +step%p (최대 max), 표시 60% 이상은 3연속 실패 없음 */
export const PITY = { step: 5, max: 15, guardOdds: 60, guardStreak: 2 };

/** 숨은 리스크: 단계별 연간 감사 확률 */
export const RISK_AUDIT: Record<number, number> = { 0: 0, 1: 0, 2: 0.08, 3: 0.14, 4: 0.22, 5: 0.32 };
export const RISK_MAX = 5;

export const ORIGIN: Record<Origin, { stats: Partial<Stats>; longServiceExempt: boolean; careerBonus: number; note: string; weight: number }> = {
  육사: { stats: { tactics: 5, expertise: 5 }, longServiceExempt: true, careerBonus: 3, note: '처음부터 장기복무, 경력 +3', weight: 0.15 },
  학군: { stats: { admin: 5, social: 5 }, longServiceExempt: false, careerBonus: 0, note: '행정력·처세 +5', weight: 0.5 },
  학사: { stats: { expertise: 10 }, longServiceExempt: false, careerBonus: 0, note: '전문성 +10', weight: 0.15 },
  '3사': { stats: { command: 5, fitness: 5 }, longServiceExempt: false, careerBonus: 0, note: '지휘력·체력 +5', weight: 0.2 },
};
export const ORIGIN_SCHOOL: Record<Origin, { school: string; years: string; letter: string }> = {
  육사: { school: '사관학교', years: '4년', letter: '사관생도로 4년을 보내게 됩니다' },
  학군: { school: '대학 학군단', years: '2년', letter: '대학 생활과 군사훈련을 함께 합니다' },
  학사: { school: '학사장교 과정', years: '수개월', letter: '대학 졸업 후 짧고 굵게 훈련합니다' },
  '3사': { school: '3사관학교', years: '2년', letter: '현장형 장교로 길러집니다' },
};

export const LONG_SERVICE = { cut: 55, tries: 2 };
export const START_STATS: Stats = { command: 40, tactics: 40, admin: 40, expertise: 40, fitness: 45, social: 35 };
export const BRANCH_BONUS: Record<Branch, Partial<Stats>> = {
  전투: { command: 5, fitness: 5 },
  기술: { expertise: 10 },
  행정: { admin: 10 },
};
export const PATH_WEIGHTS: Record<Path, Record<StatKey, number>> = {
  지휘관형: { command: 0.3, tactics: 0.25, admin: 0.1, expertise: 0.1, fitness: 0.15, social: 0.1 },
  참모형: { command: 0.1, tactics: 0.1, admin: 0.3, expertise: 0.25, fitness: 0.05, social: 0.2 },
  균형형: { command: 1 / 6, tactics: 1 / 6, admin: 1 / 6, expertise: 1 / 6, fitness: 1 / 6, social: 1 / 6 },
};

// ── 학교 프롤로그 ──
export const SCHOOL_FOCUS: Record<SchoolFocus, { stats: Partial<Stats>; desc: string }> = {
  학업: { stats: { expertise: 3, admin: 2 }, desc: '전문성·행정력' },
  체력: { stats: { fitness: 4, command: 1 }, desc: '체력·지휘력' },
  리더십: { stats: { command: 3, tactics: 2 }, desc: '지휘력·작전' },
  동기: { stats: { social: 4, admin: 1 }, desc: '처세·라이벌 관계' },
};

// ── 보직표 ──
const T = { cmd: ['부대관리', '위기대응'], key: ['기획', '조정'], staff: ['기획', '조정'], edu: ['교육', '소통'] };
const B = (id: string, name: string, ranks: Rank[], kind: BilletKind, grows: [StatKey, StatKey], prestige: number): Assignment =>
  ({ id, name, ranks, kind, grows, prestige, wantTags: kind === '지휘' ? T.cmd : kind === '요직' ? T.key : kind === '교육' ? T.edu : T.staff });

export const ASSIGNMENTS: Assignment[] = [
  B('platoon', '소대장', ['소위', '중위'], '지휘', ['command', 'tactics'], 60),
  B('company', '중대장', ['대위'], '지휘', ['command', 'tactics'], 75),
  B('bn_staff', '대대 참모', ['대위'], '참모', ['admin', 'expertise'], 60),
  B('branch_inst', '병과학교 교관', ['대위'], '교육', ['expertise', 'social'], 60),
  B('ind_company', '독립중대장', ['소령'], '지휘', ['command', 'tactics'], 75),
  B('div_staff_m', '사단 참모', ['소령'], '요직', ['admin', 'expertise'], 75),
  B('bn_ops', '대대 작전과장', ['소령'], '참모', ['tactics', 'admin'], 65),
  B('deputy_bn', '부대대장', ['소령'], '참모', ['command', 'admin'], 65),
  B('inst_m', '교육기관 교관', ['소령'], '교육', ['expertise', 'social'], 65),
  B('battalion', '대대장', ['중령'], '지휘', ['command', 'tactics'], 80),
  B('corps_staff', '군단 참모', ['중령'], '요직', ['admin', 'social'], 80),
  B('div_staff_l', '사단 참모', ['중령'], '참모', ['admin', 'expertise'], 70),
  B('inst_l', '교육기관 교관', ['중령'], '교육', ['expertise', 'social'], 70),
  B('regiment', '연대장', ['대령'], '지휘', ['command', 'admin'], 85),
  B('hq_chief', '본부 과장', ['대령'], '요직', ['admin', 'expertise'], 85),
  B('div_cos', '사단 참모장', ['대령'], '참모', ['admin', 'social'], 80),
  B('inst_head', '교육기관 처장', ['대령'], '교육', ['expertise', 'admin'], 75),
  B('deputy_div', '부사단장', ['준장'], '지휘', ['command', 'admin'], 85),
  B('brigade', '여단장', ['준장'], '지휘', ['command', 'tactics'], 85),
  B('hq_director', '본부 처장', ['준장'], '요직', ['admin', 'social'], 85),
  B('inst_vice', '교육기관 부장', ['준장'], '교육', ['expertise', 'social'], 80),
  B('division', '사단장', ['소장'], '지휘', ['command', 'tactics'], 90),
  B('hq_dcs', '본부 참모부장', ['소장'], '요직', ['admin', 'social'], 90),
  B('corps_cos', '군단 참모장', ['소장'], '참모', ['admin', 'tactics'], 85),
  B('inst_chief', '교육기관장', ['소장'], '교육', ['expertise', 'command'], 85),
  B('corps', '군단장', ['중장'], '지휘', ['command', 'social'], 92),
  B('hq_vcs', '본부 참모차장', ['중장'], '요직', ['admin', 'social'], 92),
  B('cmd_deputy', '사령부 부사령관', ['중장'], '참모', ['command', 'admin'], 88),
  B('academy', '교육기관 총장', ['중장'], '교육', ['expertise', 'social'], 88),
  B('commander', '사령관', ['대장'], '지휘', ['command', 'social'], 95),
  B('chief', '참모총장', ['대장'], '요직', ['social', 'admin'], 98),
];

/** 인사 정원: 지원자 수 대비 비율. null = 정원 제한 없음 */
export const QUOTA: Record<BilletKind, number | null> = { 지휘: 0.35, 요직: 0.25, 참모: null, 교육: null };
export const FIXED_QUOTA: Record<string, number | null> = { chief: 1, commander: null, platoon: null };
/** 장성 인사에 함께 경쟁하는 가상의 선후배 기수 인원 */
export const VIRTUAL_SENIORS = 6;
export const WISH_WEIGHTS = { eval: 0.6, stat: 0.3, social: 0.1, tag: 5, tagMax: 2, risk: 3 };

export const POLICY: Record<Policy, { desc: string; eval: number; badMult: number; goodMult: number; social: number }> = {
  '성과 우선': { desc: '업무 평정 +4, 나쁜 사건 확률 ×1.4', eval: 4, badMult: 1.4, goodMult: 1, social: 0 },
  '장병 우선': { desc: '처세 +1/년, 좋은 사건 확률 ×1.3', eval: 0, badMult: 1, goodMult: 1.3, social: 1 },
  '안전 우선': { desc: '나쁜 사건 확률 ×0.6, 업무 평정 −2', eval: -2, badMult: 0.6, goodMult: 1, social: 0 },
};

// ── 동기 ──
export const COHORT_SIZE = 30;
export const NPC_POTENTIAL: [Potential, number][] = [['S', 0.1], ['A', 0.25], ['B', 0.4], ['C', 0.25]];
export const NPC_BRANCH: [Branch, number][] = [['전투', 0.5], ['기술', 0.25], ['행정', 0.25]];
export const NPC_PATH: [Path, number][] = [['지휘관형', 0.4], ['참모형', 0.3], ['균형형', 0.3]];
export const PERSONALITY: Record<Personality, { styles: Style[]; wish: [BilletKind, BilletKind]; focus: [StatKey, StatKey]; line: string }> = {
  야전파: { styles: ['도전', '원칙'], wish: ['지휘', '참모'], focus: ['command', 'fitness'], line: '현장이 체질인 동기' },
  엘리트: { styles: ['도전', '소통'], wish: ['요직', '지휘'], focus: ['expertise', 'admin'], line: '늘 한발 앞서가는 동기' },
  처세가: { styles: ['소통', '편법'], wish: ['요직', '참모'], focus: ['social', 'admin'], line: '모두와 잘 지내는 동기' },
  성실파: { styles: ['원칙', '소통'], wish: ['참모', '지휘'], focus: ['admin', 'tactics'], line: '묵묵히 제 몫을 하는 동기' },
  자유인: { styles: ['소통', '도전', '편법'], wish: ['교육', '참모'], focus: ['social', 'expertise'], line: '어디로 튈지 모르는 동기' },
  대기만성: { styles: ['원칙', '도전'], wish: ['지휘', '교육'], focus: ['command', 'expertise'], line: '늦게 빛을 보는 동기' },
};
export const PERSONALITIES = Object.keys(PERSONALITY) as Personality[];

export const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
export const GIVEN_NAMES = [
  '민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준우', '준서', '건우', '현우', '우진', '선우',
  '연우', '유준', '정우', '승우', '승현', '시윤', '준혁', '은우', '지환', '승민', '지훈', '유찬', '민재', '현준', '태윤',
];

/** 계급별 '보통 장교'의 능력치. 업무 점수·선택 확률은 이 기준 대비로 매긴다 */
export const RANK_BASELINE: Record<Rank, number> = {
  소위: 45, 중위: 50, 대위: 58, 소령: 65, 중령: 71, 대령: 76, 준장: 80, 소장: 83, 중장: 86, 대장: 88,
};

export function rankIndex(r: Rank) { return RANKS.indexOf(r); }
