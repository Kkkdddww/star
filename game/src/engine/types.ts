// 게임 상태 정의 (v2). 엔진의 모든 함수는 이 타입들만 주고받는다.

export const STAT_KEYS = ['command', 'tactics', 'admin', 'expertise', 'fitness', 'social'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const STAT_LABEL: Record<StatKey, string> = {
  command: '지휘력',
  tactics: '작전·전술',
  admin: '행정력',
  expertise: '전문성',
  fitness: '체력',
  social: '처세',
};

export type Rank = '소위' | '중위' | '대위' | '소령' | '중령' | '대령' | '준장' | '소장' | '중장' | '대장';
export type RankGroup = '위관' | '영관' | '장성';
export type Branch = '전투' | '기술' | '행정';
export type Path = '지휘관형' | '참모형' | '균형형';
export type Potential = 'S' | 'A' | 'B' | 'C';
export type Origin = '육사' | '학군' | '학사' | '3사';
export type Grade = '탁월' | '우수' | '보통' | '미흡';
export type BilletKind = '지휘' | '요직' | '참모' | '교육';
export type Personality = '야전파' | '엘리트' | '처세가' | '성실파' | '자유인' | '대기만성';
export type Policy = '성과 우선' | '장병 우선' | '안전 우선';
export type Style = '원칙' | '소통' | '도전' | '편법';
export type SchoolFocus = '학업' | '체력' | '리더십' | '동기';
/** 부대 상황 카드 */
export type UnitTrait = '훈련' | '신설' | '정예' | '침체' | '평가';
/** 상관 유형 */
export type BossType = '꼼꼼' | '성과' | '방임' | '온화';
/** 한 보직 임기 (위관·영관) */
export interface Term {
  unit: UnitTrait; boss: BossType; start: number; years: number;
  /** 임기 중 평정 우수 이상 / 탁월 / 업무 우수 / 나쁜 일 횟수 */
  good: number; top: number; work: number; bad: number;
  /** 목표 판정 결과 */
  done?: boolean;
}

export interface Assignment {
  id: string;
  name: string;
  ranks: Rank[];
  kind: BilletKind;
  /** 이 보직에서 성장 포인트 절반이 가는 능력치 2개 */
  grows: [StatKey, StatKey];
  /** 보직 점수 (표시·최고 보직 판정용) */
  prestige: number;
  /** 인사 배정 때 가산되는 경험 태그 */
  wantTags: string[];
}

export type LongService = 'exempt' | 'pending' | 'retry' | 'passed';

export interface Officer {
  id: string;
  name: string;
  origin: Origin;
  branch: Branch;
  path: Path;
  personality: Personality;
  rank: Rank;
  yearsInRank: number;
  age: number;
  stats: Stats;
  /** 플레이어에게 보이지 않는 값 */
  hidden: { potential: Potential; risk: number };
  assignmentId: string;
  yearsInAssignment: number;
  active: boolean;
  exitReason?: string;
  evals: number[];
  evalsInRank: number[];
  /** 현재 계급의 경력: 핵심(지휘·요직) 경험, 보조 보직 id들 */
  rankLog: { core: boolean; support: string[] };
  /** 지금까지 맡은 보직 id (순서대로, 중복 없음) */
  billets: string[];
  /** 경험 태그 (중복 없음) */
  tags: string[];
  longService: LongService;
  eduScore: number;
  /** 수료한 군사교육 수 (확률 보정용) */
  eduDone: number;
  reviewFails: number;
  awakenings: number;
  eventLog: Record<string, number>;
  /** 연쇄 이벤트: 정해진 해에 나옴 */
  chains: { id: string; year: number }[];
  /** 학교 졸업 석차 (상위 %) */
  schoolPct: number;
  /** 커리어 기록 (약장·칭호 판정) */
  log: OfficerLog;
  policy?: Policy;
  term?: Term;
}

export interface OfficerLog {
  awards: { group: RankGroup }[];
  majorAwards: number;
  fitnessTop: number;
  eduTop: number;
  /** 지휘 보직에서 사고 없이 보낸 연속 연수 / 최고 기록 */
  cleanCommand: number;
  cleanCommandBest: number;
  incidents: number;
  principled: number;
  hardWay: boolean;
  thirdTry: boolean;
  firstInCohort: Rank[];
  bestEval: number;
  suStreak: number;
  suStreakBest: number;
  /** 연속 실패 수 (보정용) */
  failStreak?: number;
  /** 운 지수: 확률 판정 기대 성공 합 / 실제 성공 / 분산 합 */
  luckExp?: number;
  luckHit?: number;
  luckVar?: number;
}

// ── 선택 이벤트 ──
export interface OddsPart { label: string; value: number }
export interface Outcome {
  text: string;
  eval: number;
  stats?: Partial<Stats>;
  gainTag?: string;
  risk?: number;
  chain?: string;
  award?: '표창' | '큰 표창';
  fitnessTop?: boolean;
}
export interface ChoiceOption {
  key: string;
  label: string;
  style: Style;
  desc: string;
  stat: StatKey;
  base: number;
  /** 있으면 +8씩 (최대 2개) */
  tags?: string[];
  /** 이 유형 보직을 해본 적 있으면 +5 */
  billet?: BilletKind;
  /** 군사교육을 1번 이상 마쳤으면 +5 */
  edu?: boolean;
  /** 확률 없이 반드시 성공 (원칙형 일부) */
  sure?: boolean;
  success: Outcome;
  fail: Outcome;
}
export type EventType = '부대' | '업무' | '사람' | '자기';
export interface ChoiceDef {
  id: string;
  type: EventType;
  title: string;
  body: string;
  when: { groups?: RankGroup[]; kinds?: BilletKind[]; ranks?: Rank[] };
  options: ChoiceOption[];
  /** 같은 이벤트가 다시 나올 때 쓰는 다른 상황 문구 */
  variants?: { title: string; body: string }[];
  major?: boolean;
  chainOnly?: boolean;
}
export interface DeskItem {
  defId: string;
  /** 0: 상반기(결재함), 1: 하반기(7월) */
  slot: 0 | 1;
  /** 상황 문구 번호 (0 = 기본) */
  v?: number;
}
export interface DeskResult {
  defId: string;
  optionKey: string;
  style: Style;
  label: string;
  odds: number;
  success: boolean;
  outcome: Outcome;
  title: string;
  major: boolean;
  /** 성공 보상 배율 (확률이 낮을수록 큼) */
  mult?: number;
  /** 이번 판정에 숨어서 더해진 연속 실패 보정 %p */
  pity?: number;
  /** 확률 근거 (실패 이유 설명용) */
  parts?: OddsPart[];
}

export interface YearEvent {
  id: string;
  kind: 'work' | 'bad' | 'good' | 'milestone' | 'choice';
  title: string;
  detail: string;
  tag: string;
  evalEffect: number;
  tone: 'good' | 'bad' | 'neutral';
  ends?: boolean;
  edu?: number;
  longService?: LongService;
  statBonus?: Partial<Stats>;
}

export interface PromotionResult {
  from: Rank;
  to: Rank;
  attempt: number;
  tries: number;
  selected: boolean;
  score: number;
  cut: number | null;
  candidates: number;
  selectedCount: number;
  /** 함께 심사받은 다른 기수 인원 */
  others: number;
  breakdown: { eval: number; career: number; edu: number; combat: number; balance: number };
  weakest: { label: string; why: string };
  peers: { name: string; origin: Origin; selected: boolean; score: number; rival: boolean }[];
}

export interface YearReport {
  year: number;
  age: number;
  rank: Rank;
  assignment: string;
  assignmentId: string;
  growthPoints: number;
  deltas: Partial<Stats>;
  overallBefore: number;
  overallAfter: number;
  events: YearEvent[];
  evalScore: number;
  grade: Grade;
  comment: string;
  promotion?: PromotionResult;
  promotedTo?: Rank;
  branchFit: boolean;
  cohortNews: string[];
  records: string[];
  notes: string[];
}

export interface PersonnelResult {
  year: number;
  rank: Rank;
  from: string | null;
  wishes: [string, string];
  got: string;
  wishRank: 1 | 2 | 0;
  myScore: number;
  /** 배정 보직의 정원과 지원자 수 */
  quota: number | null;
  applicants: number;
  note: string;
  unit?: UnitTrait;
  boss?: BossType;
}

export interface GameState {
  year: number;
  seed: number;
  me: Officer;
  cohort: Officer[];
  rivalId: string;
  history: YearReport[];
  /** 올해 결재할 선택 이벤트 2건과 결과 */
  desk: { items: DeskItem[]; results: (DeskResult | null)[] } | null;
  /** 보직 교체 시기: 희망 조사를 기다리는 중 */
  personnelDue: boolean;
  /** 장성 보직 취임: 지휘 방침을 기다리는 중 */
  policyDue: boolean;
  personnel: PersonnelResult[];
  /** 커리어 중 중대 사건이 나올 복무 연차들 */
  majorYears: number[];
  ended?: { year: number; reason: string; finalRank: Rank };
  /** 캐릭터 생성 때 다시 뽑기 수 / 잠재력 범위 봤는지 */
  creation?: { rerolls: number; viewed: boolean };
  /** 오늘의 기수: 날짜(KST). 세상 시드는 seed, 판정 주사위는 rollSeed */
  mode?: 'daily' | 'cohort';
  day?: string;
  /** 우리 기수 (친구들과 만든 기수) */
  group?: { id: string; code: string; name: string };
  rollSeed?: number;
}
