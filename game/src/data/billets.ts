// v3.4 병과 · 세부 보직 · 부대 종류. 모두 공개된 일반 직책명 · 부대 종류만 쓴다 (번호 · 고유 명칭 · 위치 · 편제 숫자 없음).
// 예전 보직 id는 그대로 살려서 진행 중인 판이 깨지지 않게 한다 (platoon = 보병 소대장 등).
import type { Assignment, BilletKind, Branch, Rank, StatKey } from '../engine/types';

export type Corps = '보병' | '포병' | '기갑' | '공병' | '정보통신' | '정보' | '군수' | '인사' | '재정';
export const CORPS: Corps[] = ['보병', '포병', '기갑', '공병', '정보통신', '정보', '군수', '인사', '재정'];
export const CORPS_BRANCH: Record<Corps, Branch> = { 보병: '전투', 포병: '전투', 기갑: '전투', 공병: '전투', 정보통신: '기술', 정보: '기술', 군수: '기술', 인사: '행정', 재정: '행정' };
export const CORPS_DESC: Record<Corps, string> = {
  보병: '지휘의 정석 · 소대장부터 사단장까지', 포병: '화력 · 작전·전술과 전문성', 기갑: '기계화 부대 · 작전·전술',
  공병: '건설 · 지휘력과 전문성', 정보통신: '통신망 · 전문성', 정보: '정보 분석 · 전문성과 작전',
  군수: '보급 · 행정력과 지휘', 인사: '사람 관리 · 행정력과 처세', 재정: '예산 · 행정력과 전문성',
};
/** 옛 저장(병과 없음): 계열에서 정한다 */
export const DEFAULT_CORPS: Record<Branch, Corps> = { 전투: '보병', 기술: '정보통신', 행정: '인사' };
const FIGHT: Corps[] = ['보병', '포병', '기갑', '공병'];
const TECH: Corps[] = ['정보통신', '정보', '군수'];
const ADMIN: Corps[] = ['인사', '재정'];
const ALL: Corps[] = [...FIGHT, ...TECH, ...ADMIN];

// ── 부대 종류 (공개된 일반 분류) ──
export type UnitType = '전방' | '후방' | '기계화' | '동원' | '군단직할' | '군수지원' | '교육기관' | '정책부서' | '해외파병';
export interface UnitTypeDef {
  name: string; desc: string;
  /** 성장 배율, 업무 평정 가감, 업무 흔들림 배율, 나쁜 일 · 좋은 일 배율, 해마다 붙는 능력치 */
  growth: number; work: number; swing: number; bad: number; good: number; stats?: Partial<Record<StatKey, number>>;
  /** 진로 색깔 묶음 */
  path: '야전' | '지원' | '교육' | '정책' | '파병';
}
export const UNIT_TYPES: Record<UnitType, UnitTypeDef> = {
  전방: { name: '전방 보병사단', desc: '성장 +8%, 나쁜 일 ×1.15', growth: 1.08, work: 0, swing: 1, bad: 1.15, good: 1, path: '야전' },
  후방: { name: '후방 보병사단', desc: '평정이 안정적이에요 (흔들림 −30%)', growth: 1, work: 0, swing: 0.7, bad: 1, good: 1, path: '야전' },
  기계화: { name: '기계화사단', desc: '성장 +5%, 나쁜 일 ×1.05', growth: 1.05, work: 0, swing: 1, bad: 1.05, good: 1, path: '야전' },
  동원: { name: '동원사단', desc: '업무 평정 −2, 좋은 일 ×1.2', growth: 1, work: -2, swing: 1, bad: 1, good: 1.2, path: '야전' },
  군단직할: { name: '군단 직할부대', desc: '성장 +4%', growth: 1.04, work: 0, swing: 1, bad: 1, good: 1, path: '야전' },
  군수지원: { name: '군수 · 지원부대', desc: '평정이 조금 안정적이에요 (흔들림 −15%)', growth: 1, work: 0, swing: 0.85, bad: 1, good: 1, path: '지원' },
  교육기관: { name: '교육기관', desc: '업무 평정 +1, 흔들림 −20%', growth: 1, work: 1, swing: 0.8, bad: 1, good: 1, path: '교육' },
  정책부서: { name: '정책부서 (육군본부 · 합참 · 국방부)', desc: '업무 평정 −1 (경쟁 치열), 좋은 일 ×1.1', growth: 1, work: -1, swing: 1, bad: 1, good: 1.1, path: '정책' },
  해외파병: { name: '해외 파병 (평화유지 활동)', desc: '좋은 일 ×1.25, 명예 점수 +10', growth: 1, work: 0, swing: 1, bad: 1, good: 1.25, path: '파병' },
};
const FIELD: UnitType[] = ['전방', '후방', '기계화', '동원'];

// 경험 태그 (인사 가점): config.ts의 T와 같은 묶음
const TAGS: Record<BilletKind, string[]> = { 지휘: ['부대관리', '위기대응'], 요직: ['기획', '조정'], 참모: ['기획', '조정'], 교육: ['교육', '소통'] };

export interface BilletOpt { corps?: Corps[]; fit?: Corps[]; units?: UnitType[]; wantTags?: string[] }
const B = (id: string, name: string, ranks: Rank[], kind: BilletKind, grows: [StatKey, StatKey], prestige: number, o: BilletOpt = {}): Assignment =>
  ({ id, name, ranks, kind, grows, prestige, wantTags: o.wantTags ?? TAGS[kind], corps: o.corps, fit: o.fit ?? o.corps ?? [], units: o.units ?? FIELD });
const LT: Rank[] = ['소위', '중위'];

export const BILLETS: Assignment[] = [
  // ── 소위 · 중위 ──
  B('platoon', '보병 소대장', LT, '지휘', ['command', 'tactics'], 60, { corps: ['보병'] }),
  B('art_platoon', '포병 전포대장', LT, '지휘', ['tactics', 'expertise'], 60, { corps: ['포병'], units: ['전방', '군단직할'] }),
  B('tank_platoon', '전차 소대장', LT, '지휘', ['tactics', 'expertise'], 60, { corps: ['기갑'], units: ['기계화', '전방'] }),
  B('eng_platoon', '공병 소대장', LT, '지휘', ['command', 'expertise'], 60, { corps: ['공병'], units: ['전방', '군단직할'] }),
  B('sig_platoon', '통신 소대장', LT, '지휘', ['expertise', 'command'], 60, { corps: ['정보통신'], units: ['군단직할', '후방'] }),
  B('sup_platoon', '보급 소대장', LT, '지휘', ['admin', 'command'], 60, { corps: ['군수'], units: ['군수지원', '후방'] }),
  B('s2_lt', '대대 정보장교', LT, '참모', ['expertise', 'tactics'], 58, { fit: ['정보'] }),
  B('s1_lt', '대대 인사장교', LT, '참모', ['admin', 'social'], 58, { fit: ['인사'] }),
  B('s4_lt', '대대 군수장교', LT, '참모', ['admin', 'expertise'], 58, { fit: ['군수'] }),
  B('fin_lt', '재정장교', LT, '참모', ['admin', 'expertise'], 58, { corps: ['재정'], units: ['후방', '군수지원'] }),
  B('adjutant', '부관', LT, '참모', ['admin', 'social'], 56, { fit: ['인사', '재정'], units: ['후방'] }),

  // ── 대위 ──
  B('company', '보병 중대장', ['대위'], '지휘', ['command', 'expertise'], 75, { corps: ['보병'] }),
  B('battery', '포대장', ['대위'], '지휘', ['tactics', 'expertise'], 75, { corps: ['포병'], units: ['전방', '군단직할'] }),
  B('tank_company', '전차 중대장', ['대위'], '지휘', ['command', 'expertise'], 75, { corps: ['기갑'], units: ['기계화', '전방'] }),
  B('eng_company', '공병 중대장', ['대위'], '지휘', ['command', 'expertise'], 75, { corps: ['공병'], units: ['전방', '군단직할'] }),
  B('sig_company', '통신 중대장', ['대위'], '지휘', ['command', 'tactics'], 75, { corps: ['정보통신'], units: ['군단직할', '후방'] }),
  B('int_company', '정보 중대장', ['대위'], '지휘', ['expertise', 'tactics'], 75, { corps: ['정보'], units: ['군단직할', '전방'] }),
  B('sup_company', '보급 중대장', ['대위'], '지휘', ['admin', 'command'], 75, { corps: ['군수'], units: ['군수지원'] }),
  B('hq_company', '본부 근무중대장', ['대위'], '지휘', ['admin', 'command'], 72, { corps: ADMIN, units: ['후방', '군단직할'] }),
  B('bn_staff', '대대 작전장교', ['대위'], '참모', ['tactics', 'admin'], 60, { fit: FIGHT }),
  B('div_hr', '사단 인사장교', ['대위'], '참모', ['admin', 'social'], 62, { fit: ['인사'], units: FIELD }),
  B('div_fin', '사단 재정장교', ['대위'], '참모', ['admin', 'expertise'], 62, { corps: ['재정'] }),
  B('political', '정훈장교', ['대위'], '참모', ['social', 'admin'], 58, { fit: ADMIN }),
  B('branch_inst', '병과학교 교관', ['대위'], '교육', ['expertise', 'social'], 60, { fit: TECH, units: ['교육기관'] }),
  B('pko_c', '평화유지 파견 장교', ['대위'], '참모', ['social', 'expertise'], 68, { units: ['해외파병'] }),

  // ── 소령 ──
  B('ind_company', '독립중대장', ['소령'], '지휘', ['command', 'tactics'], 75, { fit: FIGHT, units: ['군단직할', '전방'] }),
  B('div_staff_m', '사단 참모부 장교', ['소령'], '요직', ['admin', 'expertise'], 75, { fit: ALL }),
  B('bn_ops', '대대 작전과장', ['소령'], '참모', ['tactics', 'admin'], 65, { fit: FIGHT }),
  B('deputy_bn', '부대대장', ['소령'], '참모', ['command', 'admin'], 65, { fit: FIGHT }),
  B('reg_staff', '연대 참모', ['소령'], '참모', ['admin', 'expertise'], 63, { fit: ALL }),
  B('inst_m', '병과학교 교관', ['소령'], '교육', ['expertise', 'social'], 65, { fit: TECH, units: ['교육기관'] }),
  B('pko_m', '평화유지 파견 참모', ['소령'], '참모', ['social', 'admin'], 72, { units: ['해외파병'] }),

  // ── 중령 ──
  B('battalion', '보병 대대장', ['중령'], '지휘', ['command', 'expertise'], 80, { corps: ['보병'] }),
  B('art_bn', '포병 대대장', ['중령'], '지휘', ['command', 'tactics'], 80, { corps: ['포병'], units: ['군단직할', '전방'] }),
  B('tank_bn', '전차 대대장', ['중령'], '지휘', ['command', 'tactics'], 80, { corps: ['기갑'], units: ['기계화'] }),
  B('eng_bn', '공병 대대장', ['중령'], '지휘', ['command', 'expertise'], 80, { corps: ['공병'], units: ['군단직할'] }),
  B('sig_bn', '통신 대대장', ['중령'], '지휘', ['expertise', 'command'], 80, { corps: ['정보통신'], units: ['군단직할'] }),
  B('int_bn', '정보 대대장', ['중령'], '지휘', ['tactics', 'command'], 80, { corps: ['정보'], units: ['군단직할'] }),
  B('sup_bn', '군수지원 대대장', ['중령'], '지휘', ['admin', 'command'], 80, { corps: ['군수'], units: ['군수지원'] }),
  B('hq_bn', '근무지원 대대장', ['중령'], '지휘', ['admin', 'expertise'], 78, { corps: ADMIN, units: ['후방', '군단직할'] }),
  B('corps_staff', '군단 참모', ['중령'], '요직', ['admin', 'social'], 80, { fit: [...FIGHT, ...ADMIN], units: ['군단직할'] }),
  B('army_hq_l', '육군본부 장교', ['중령'], '요직', ['admin', 'expertise'], 80, { fit: [...ADMIN, '군수'], units: ['정책부서'] }),
  B('div_staff_l', '사단 참모', ['중령'], '참모', ['admin', 'expertise'], 70, { fit: ALL }),
  B('inspector', '감찰참모', ['중령'], '참모', ['admin', 'social'], 68, { fit: ADMIN }),
  B('inst_l', '합동군사대학 교수', ['중령'], '교육', ['expertise', 'social'], 70, { fit: TECH, units: ['교육기관'] }),

  // ── 대령 ──
  B('regiment', '보병 연대장', ['대령'], '지휘', ['command', 'admin'], 85, { corps: ['보병'] }),
  B('art_bde', '포병 여단장', ['대령'], '지휘', ['tactics', 'command'], 85, { corps: ['포병'], units: ['군단직할'] }),
  B('arm_bde', '기갑 여단장', ['대령'], '지휘', ['tactics', 'admin'], 85, { corps: ['기갑'], units: ['기계화'] }),
  B('eng_bde', '공병 여단장', ['대령'], '지휘', ['command', 'admin'], 85, { corps: ['공병'], units: ['군단직할'] }),
  B('sig_grp', '통신 단장', ['대령'], '지휘', ['command', 'admin'], 85, { corps: ['정보통신'], units: ['군단직할'] }),
  B('int_grp', '정보 단장', ['대령'], '지휘', ['command', 'admin'], 85, { corps: ['정보'], units: ['군단직할'] }),
  B('sup_grp', '군수지원 단장', ['대령'], '지휘', ['admin', 'command'], 85, { corps: ['군수'], units: ['군수지원'] }),
  B('spt_grp', '근무지원 단장', ['대령'], '지휘', ['admin', 'social'], 83, { corps: ADMIN, units: ['후방'] }),
  B('hq_chief', '육군본부 과장', ['대령'], '요직', ['admin', 'expertise'], 85, { fit: ADMIN, units: ['정책부서'] }),
  B('jcs_chief', '합참 과장', ['대령'], '요직', ['tactics', 'admin'], 85, { fit: FIGHT, units: ['정책부서'] }),
  B('mnd_chief', '국방부 과장', ['대령'], '요직', ['admin', 'social'], 85, { fit: ['정보통신', '정보', '군수'], units: ['정책부서'] }),
  B('div_cos', '사단 참모장', ['대령'], '참모', ['admin', 'social'], 80, { fit: FIGHT }),
  B('inst_head', '교육기관 처장', ['대령'], '교육', ['expertise', 'admin'], 75, { fit: TECH, units: ['교육기관'] }),

  // ── 장성 (병과 공통) ──
  B('deputy_div', '부사단장', ['준장'], '지휘', ['command', 'admin'], 85, { fit: FIGHT }),
  B('brigade', '여단장', ['준장'], '지휘', ['command', 'tactics'], 85, { fit: FIGHT, units: ['기계화', '군단직할'] }),
  B('hq_director', '육군본부 처장', ['준장'], '요직', ['admin', 'social'], 85, { fit: [...ADMIN, '정보'], units: ['정책부서'] }),
  B('inst_vice', '병과학교장', ['준장'], '교육', ['expertise', 'social'], 80, { fit: TECH, units: ['교육기관'] }),
  B('division', '사단장', ['소장'], '지휘', ['command', 'tactics'], 90, { fit: FIGHT }),
  B('hq_dcs', '육군본부 참모부장', ['소장'], '요직', ['admin', 'social'], 90, { fit: [...ADMIN, '정보'], units: ['정책부서'] }),
  B('jcs_dir', '합참 부장', ['소장'], '요직', ['tactics', 'admin'], 90, { fit: FIGHT, units: ['정책부서'] }),
  B('corps_cos', '군단 참모장', ['소장'], '참모', ['admin', 'tactics'], 85, { fit: [...TECH, ...ADMIN], units: ['군단직할'] }),
  B('inst_chief', '교육기관장', ['소장'], '교육', ['expertise', 'command'], 85, { fit: TECH, units: ['교육기관'] }),
  B('corps', '군단장', ['중장'], '지휘', ['command', 'social'], 92, { fit: FIGHT, units: ['군단직할'] }),
  B('hq_vcs', '육군본부 참모차장', ['중장'], '요직', ['admin', 'social'], 92, { fit: [...ADMIN, '정보'], units: ['정책부서'] }),
  B('jcs_head', '합참 본부장', ['중장'], '요직', ['tactics', 'admin'], 92, { fit: FIGHT, units: ['정책부서'] }),
  B('cmd_deputy', '사령부 부사령관', ['중장'], '참모', ['command', 'admin'], 88, { fit: [...TECH, ...ADMIN], units: ['군단직할'] }),
  B('academy', '교육기관 총장', ['중장'], '교육', ['expertise', 'social'], 88, { fit: TECH, units: ['교육기관'] }),
  B('commander', '사령관', ['대장'], '지휘', ['command', 'social'], 95, { fit: FIGHT, units: ['군단직할'] }),
  B('chief', '참모총장', ['대장'], '요직', ['social', 'admin'], 98, { units: ['정책부서'] }),
  B('jcs_chair', '합참의장', ['대장'], '요직', ['tactics', 'social'], 98, { units: ['정책부서'] }),
];

/** 이 사람이 갈 수 있는 보직인가 (병과 제한) */
export const billetOpen = (a: Assignment, corps: Corps) => !a.corps || a.corps.includes(corps);
/** 병과 궁합 (성장 +20%) */
export const billetFits = (a: Assignment, corps: Corps) => !!a.fit?.includes(corps);
/** 임관 첫 보직 */
export const FIRST_BILLET: Record<Corps, string> = { 보병: 'platoon', 포병: 'art_platoon', 기갑: 'tank_platoon', 공병: 'eng_platoon', 정보통신: 'sig_platoon', 정보: 's2_lt', 군수: 'sup_platoon', 인사: 's1_lt', 재정: 'fin_lt' };
/** 필수 보직 묶음 (계급별, 병과 무관하게 이 중 하나) */
export const REQUIRED_IDS: Partial<Record<Rank, string[]>> = {
  대위: ['company', 'battery', 'tank_company', 'eng_company', 'sig_company', 'int_company', 'sup_company', 'hq_company'],
  중령: ['battalion', 'art_bn', 'tank_bn', 'eng_bn', 'sig_bn', 'int_bn', 'sup_bn', 'hq_bn'],
  대령: ['regiment', 'art_bde', 'arm_bde', 'eng_bde', 'sig_grp', 'int_grp', 'sup_grp', 'spt_grp', 'hq_chief', 'jcs_chief', 'mnd_chief'],
};
/** 정원 1자리 (희귀) */
export const FIXED_ONE = ['chief', 'jcs_chair', 'pko_c', 'pko_m'];
/** 병과 (옛 저장은 계열에서) */
export const corpsOfO = (o: { corps?: Corps; branch: Branch }): Corps => o.corps ?? DEFAULT_CORPS[o.branch];
