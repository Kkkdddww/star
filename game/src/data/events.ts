// '올해 있었던 일' 콘텐츠. 이벤트를 늘릴 땐 이 파일만 고치면 된다.
// 확률: 나쁜 일 = base + (50 - 능력치)%, 좋은 일 = base + (능력치 - 50)%, 3%~60% 제한
//
// ── 군사보안 기준 (콘텐츠 추가 시 지킬 것) ──
// 넣지 않는다: 실제 부대명·부대번호·주둔지·지역, 무기·장비 이름과 제원, 작전계획·경계 방식,
//             훈련 일정·장소, 암구호·통신 절차, 실제 인물. 사고는 일반적인 생활·안전 사고 수준까지만.
// 써도 된다:  계급, 일반 보직명(소대장·대대장 등), 공개된 표창 이름, 일반 행정·복지·교육 업무.
import type { RankGroup, StatKey } from '../engine/types';

export interface EventVariant {
  title: string;
  detail: string;
  /** 지정하면 그 계급 그룹에서만 이 문구가 나온다 */
  group?: RankGroup;
}

export interface EventDef {
  id: string;
  slot: 'bad' | 'good';
  /** 지휘 = 지휘 보직, 참모 = 지휘가 아닌 보직(요직·참모·교육) */
  when: { kind?: '지휘' | '참모'; rankGroups?: RankGroup[] };
  stat: StatKey;
  base: number; // 0~1
  evalEffect: number;
  tag: string; // 오른쪽에 붙는 짧은 결과
  /** 이 사건으로 바로 오르는 능력치 */
  statBonus?: Partial<Record<StatKey, number>>;
  variants: EventVariant[];
}

export const EVENTS: EventDef[] = [
  // ───────── 나쁜 일 ─────────
  {
    id: 'discipline', slot: 'bad', when: { kind: '지휘', rankGroups: ['위관'] }, stat: 'command', base: 0.2, evalEffect: -3, tag: '경고',
    variants: [
      { title: '소대원 휴가 복귀 지연', detail: '인원 관리 소홀로 구두 경고' },
      { title: '병사 휴대폰 사용 규정 위반', detail: '생활지도 미흡 지적' },
      { title: '병사 간 갈등 신고 접수', detail: '병영 생활 관리 소홀 지적' },
      { title: '근무 교대 시간 미준수', detail: '근무 감독 소홀로 경고' },
    ],
  },
  {
    id: 'complaint', slot: 'bad', when: { kind: '지휘', rankGroups: ['영관', '장성'] }, stat: 'command', base: 0.12, evalEffect: -4, tag: '민원',
    variants: [
      { title: '장병 고충 처리 지연', detail: '부모님 민원 접수, 상급부대 확인' },
      { title: '부대 내 갑질 신고 접수', detail: '지휘 감독 책임으로 주의' },
      { title: '휴가 통제 관련 민원', detail: '부대 운영 방식 개선 지시' },
    ],
  },
  {
    id: 'safety', slot: 'bad', when: { kind: '지휘' }, stat: 'tactics', base: 0.08, evalEffect: -8, tag: '징계',
    variants: [
      { title: '훈련 중 안전수칙 위반', detail: '경상자 발생, 지휘 책임으로 견책' },
      { title: '행군 중 온열 손상자 발생', detail: '휴식 통제 미흡으로 견책' },
      { title: '부대 차량 접촉 사고', detail: '운행 통제 소홀로 견책' },
      { title: '체육활동 중 부상자 발생', detail: '안전 관리 미흡으로 견책' },
    ],
  },
  {
    id: 'report_late', slot: 'bad', when: { kind: '참모' }, stat: 'admin', base: 0.2, evalEffect: -3, tag: '지적',
    variants: [
      { title: '보고서 제출 기한 초과', detail: '상급부대 보고 지연' },
      { title: '업무계획서 반려', detail: '내용 보완 후 재보고 지시' },
      { title: '회의 자료 오류', detail: '수치 오류로 지휘관 질책' },
    ],
  },
  {
    id: 'audit', slot: 'bad', when: { kind: '참모', rankGroups: ['영관', '장성'] }, stat: 'admin', base: 0.12, evalEffect: -5, tag: '지적',
    variants: [
      { title: '회계 감사 지적', detail: '예산 집행 증빙 서류 미비' },
      { title: '물품 관리 실태 점검 지적', detail: '장부와 실물 수량 불일치' },
      { title: '개인정보 관리 점검 지적', detail: '문서 보관 규정 미준수' },
    ],
  },
  {
    id: 'fitness_fail', slot: 'bad', when: {}, stat: 'fitness', base: 0.15, evalEffect: -4, tag: '불합격',
    variants: [
      { title: '체력검정 불합격', detail: '3km 달리기 기준 미달' },
      { title: '체력검정 불합격', detail: '팔굽혀펴기 기준 미달' },
      { title: '체력검정 불합격', detail: '윗몸일으키기 기준 미달' },
    ],
  },
  {
    id: 'conflict', slot: 'bad', when: {}, stat: 'social', base: 0.15, evalEffect: -3, tag: '마찰',
    variants: [
      { title: '상관과의 마찰', detail: '회의 중 공개적인 의견 충돌' },
      { title: '동료와의 갈등', detail: '업무 분담 문제로 언쟁' },
      { title: '부하의 불만 제기', detail: '소통 방식에 대한 건의 접수' },
    ],
  },

  // ───────── 좋은 일 ─────────
  {
    id: 'award', slot: 'good', when: {}, stat: 'command', base: 0.12, evalEffect: 3, tag: '표창', statBonus: { command: 1 },
    variants: [
      { title: '대대장 표창', detail: '교육훈련 유공', group: '위관' },
      { title: '연대장 표창', detail: '부대 안전관리 유공', group: '위관' },
      { title: '연대장 표창', detail: '병영문화 개선 유공', group: '위관' },
      { title: '사단장 표창', detail: '교육훈련 유공', group: '영관' },
      { title: '군단장 표창', detail: '부대 운영 유공', group: '영관' },
      { title: '사단장 표창', detail: '장병 복지 증진 유공', group: '영관' },
      { title: '참모총장 표창', detail: '부대 발전 유공', group: '장성' },
    ],
  },
  {
    id: 'award_major', slot: 'good', when: { rankGroups: ['영관', '장성'] }, stat: 'social', base: 0.03, evalEffect: 6, tag: '큰 표창', statBonus: { command: 1, social: 2 },
    variants: [
      { title: '국방부장관 표창', detail: '국방 업무 발전 유공', group: '영관' },
      { title: '참모총장 표창', detail: '군 정책 개선 유공', group: '영관' },
      { title: '대통령 표창', detail: '국가 안보 발전 유공', group: '장성' },
    ],
  },
  {
    id: 'staff_merit', slot: 'good', when: { kind: '참모' }, stat: 'expertise', base: 0.12, evalEffect: 3, tag: '유공', statBonus: { expertise: 1, admin: 1 },
    variants: [
      { title: '생활관 개선안 채택', detail: '상급부대에서 전 부대 확대 시행' },
      { title: '행정 서식 간소화', detail: '간부 업무 시간 단축 효과 인정' },
      { title: '장병 복지 제도 개선 제안', detail: '휴가 제도 개선안 채택' },
      { title: '부대 예산 절감 방안', detail: '운영비 절감 우수 사례 선정' },
      { title: '간부 교육 교재 개발', detail: '교육기관 교재로 채택' },
      { title: '보고 체계 전산화', detail: '업무 효율화 우수 사례 선정' },
    ],
  },
  {
    id: 'no_accident', slot: 'good', when: { kind: '지휘' }, stat: 'tactics', base: 0.1, evalEffect: 2, tag: '무사고', statBonus: { tactics: 1 },
    variants: [
      { title: '1년 무사고 부대 인증', detail: '안전관리 우수 부대 선정' },
      { title: '안전 점검 최우수', detail: '상급부대 안전 점검 만점' },
    ],
  },
  {
    id: 'good_culture', slot: 'good', when: { kind: '지휘' }, stat: 'social', base: 0.08, evalEffect: 2, tag: '선정', statBonus: { social: 1 },
    variants: [
      { title: '병영문화 우수 부대 선정', detail: '장병 만족도 조사 최상위' },
      { title: '모범 부대 선정', detail: '부대 생활 우수 사례로 소개' },
    ],
  },
  {
    id: 'fitness_top', slot: 'good', when: {}, stat: 'fitness', base: 0.1, evalEffect: 2, tag: '특급', statBonus: { fitness: 1 },
    variants: [{ title: '체력검정 특급', detail: '전 종목 특급 달성' }],
  },
  {
    id: 'noticed', slot: 'good', when: {}, stat: 'social', base: 0.1, evalEffect: 3, tag: '추천', statBonus: { social: 1 },
    variants: [
      { title: '상관의 눈에 띔', detail: '지휘관 회의에서 직접 칭찬' },
      { title: '우수 간부 추천', detail: '상급부대 인재 명단에 이름이 오름' },
    ],
  },
];

/** 보직별 ① 업무 성과 문구 */
export const WORK_TITLE: Record<string, string> = {
  platoon: '소대 전투력 측정',
  company: '중대 전투력 측정',
  bn_staff: '대대 교육훈련 계획',
  branch_inst: '병과학교 강의 평가',
  ind_company: '독립중대 전투력 측정',
  div_staff_m: '사단 연간 업무계획',
  bn_ops: '대대 연간 훈련계획',
  deputy_bn: '대대 교육훈련 지원',
  inst_m: '교육기관 강의 평가',
  battalion: '대대 전술훈련 평가',
  corps_staff: '군단 정책 보고',
  div_staff_l: '사단 업무 성과 평가',
  inst_l: '교육기관 과정 운영',
  regiment: '연대 종합 전투력 측정',
  hq_chief: '본부 핵심 과제',
  div_cos: '사단 참모 업무 조정',
  inst_head: '교육기관 교육과정 개편',
  deputy_div: '사단 부대 운영 점검',
  brigade: '여단 종합 전투력 측정',
  hq_director: '본부 정책 과제',
  inst_vice: '교육기관 운영 평가',
  division: '사단 종합 전투력 측정',
  hq_dcs: '본부 중기 정책 과제',
  corps_cos: '군단 참모 업무 평가',
  inst_chief: '교육기관 종합 평가',
  corps: '군단 종합 훈련 평가',
  hq_vcs: '본부 정책 총괄',
  cmd_deputy: '사령부 운영 점검',
  academy: '교육기관 발전 과제',
  commander: '사령부 연간 성과 평가',
  chief: '군 정책 연간 평가',
};
