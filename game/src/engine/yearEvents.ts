// '올해 있었던 일': ① 업무 성과 ② 결재 2건 ③ 정해진 일(교육·장기복무) ④ 우연한 일 1건 ⑤ 감사(숨은 리스크)
import { EVENTS, WORK_TITLE, type EventDef } from '../data/events';
import { ASSIGNMENTS, LONG_SERVICE, POLICY, RANK_BASELINE, RISK_AUDIT } from '../data/config';
import { rankGroup } from './choice';
import type { Rng } from './rng';
import type { DeskResult, Grade, Officer, YearEvent } from './types';
import { termEventMult, termWork } from './term';

const EVENT_COOLDOWN = 2;
const P_MIN = 0.03, P_MAX = 0.6;

export function eventChance(ev: EventDef, me: Officer): number {
  const s = me.stats[ev.stat];
  let raw = ev.slot === 'bad' ? ev.base + (50 - s) / 100 : ev.base + (s - 50) / 100;
  if (me.policy) raw *= ev.slot === 'bad' ? POLICY[me.policy].badMult : POLICY[me.policy].goodMult;
  raw *= termEventMult(me, ev.slot);
  return Math.min(P_MAX, Math.max(P_MIN, raw));
}

/** ① 업무 성과: 60 + (보직 능력치 2개 평균 − 계급 기준) ± 10 (+ 지휘 방침) */
export function rollWork(me: Officer, rng: Rng): YearEvent {
  const a = ASSIGNMENTS.find((x) => x.id === me.assignmentId)!;
  const avg = (me.stats[a.grows[0]] + me.stats[a.grows[1]]) / 2;
  const score = termWork(me, 60 + (avg - RANK_BASELINE[me.rank]) + (me.policy ? POLICY[me.policy].eval : 0), rng);
  const grade = score >= 70 ? '우수' : score >= 50 ? '보통' : '미흡';
  let detail: string;
  if (a.kind === '지휘') {
    const n = rng.int(4, 9);
    const pos = Math.max(0, Math.min(1, (85 - score) / 50));
    const k = Math.max(1, Math.min(n, 1 + Math.round(pos * (n - 1))));
    detail = `평가 대상 ${n}개 부대 중 ${k}위`;
  } else {
    detail = grade === '우수' ? rng.pick(['상급부대 우수 사례로 전파', '지휘관 보고 원안 통과']) : grade === '보통' ? rng.pick(['일부 수정 후 승인', '무난하게 승인']) : rng.pick(['보완 후 재보고 지시', '상급부대 검토에서 반려']);
  }
  return { id: 'work', kind: 'work', title: WORK_TITLE[a.id] ?? a.name, detail, tag: grade, evalEffect: score, tone: grade === '우수' ? 'good' : grade === '미흡' ? 'bad' : 'neutral' };
}

/** ④ 우연한 일: 나쁜 일·좋은 일 후보 중 1건 */
function pickChance(me: Officer, year: number, rng: Rng): YearEvent | null {
  const a = ASSIGNMENTS.find((x) => x.id === me.assignmentId)!;
  const kind = a.kind === '지휘' ? '지휘' : '참모';
  const group = rankGroup(me.rank);
  const passed = EVENTS.filter((ev) => {
    if (ev.when.kind && ev.when.kind !== kind) return false;
    if (ev.when.rankGroups && !ev.when.rankGroups.includes(group)) return false;
    if (!ev.variants.some((v) => !v.group || v.group === group)) return false;
    const last = me.eventLog[ev.id];
    if (last !== undefined && year - last <= EVENT_COOLDOWN) return false;
    return rng.next() < eventChance(ev, me);
  });
  if (!passed.length) return null;
  const ev = rng.pick(passed);
  const v = rng.pick(ev.variants.filter((x) => !x.group || x.group === group));
  return { id: ev.id, kind: ev.slot, title: v.title, detail: v.detail, tag: ev.tag, evalEffect: ev.evalEffect, tone: ev.slot, statBonus: ev.statBonus };
}

/** ③ 정해진 일 */
function milestones(me: Officer, rng: Rng): YearEvent[] {
  const out: YearEvent[] = [];
  const firstTry = me.longService === 'pending' && me.rank === '중위' && me.yearsInRank === 1;
  const secondTry = me.longService === 'retry';
  if (firstTry || secondTry) {
    const avg = me.evals.length ? me.evals.reduce((a, b) => a + b, 0) / me.evals.length : 50;
    const pass = avg + rng.int(-5, 5) >= LONG_SERVICE.cut;
    const attempt = secondTry ? 2 : 1;
    const lastTry = attempt >= LONG_SERVICE.tries;
    out.push({
      id: 'long_service', kind: 'milestone', title: `장기복무 선발 (${attempt}차)`,
      detail: pass ? '장기복무 장교로 선발됐어요' : lastTry ? '장기복무에 선발되지 못해 전역' : '탈락 · 1년 복무 연장 후 재도전',
      tag: pass ? '합격' : lastTry ? '탈락' : '보류', evalEffect: 0, tone: pass ? 'good' : 'bad',
      ends: !pass && lastTry, longService: pass ? 'passed' : 'retry',
    });
  }
  const course = me.rank === '대위' && me.yearsInRank === 0 ? '대위 보수교육' : me.rank === '소령' && me.yearsInRank === 0 ? '상급 지휘참모과정' : null;
  if (course) {
    const s = me.stats.expertise - RANK_BASELINE[me.rank] + 60 + rng.int(-10, 10);
    const size = rng.int(36, 64);
    const pct = Math.max(1, Math.min(99, Math.round(50 - (s - 60) * 3.3)));
    const place = Math.max(1, Math.ceil((pct / 100) * size));
    const [tag, eff, tone] = place === 1 ? ['수석', 4, 'good'] as const : pct <= 10 ? ['우등', 3, 'good'] as const : pct >= 80 ? ['하위', -2, 'bad'] as const : ['수료', 0, 'neutral'] as const;
    out.push({
      id: 'education', kind: 'milestone', title: `${course} 수료`,
      detail: `${size}명 중 ${place}등 (상위 ${pct}%)`, tag, evalEffect: eff, tone,
      edu: Math.round(40 + (100 - pct) * 0.6),
      statBonus: pct <= 10 ? { expertise: 2 } : undefined,
    });
  }
  return out;
}

/** ⑤ 숨은 리스크가 2단계 이상이면 감사가 나올 수 있다 (행정 처분까지만) */
function riskAudit(me: Officer, rng: Rng): YearEvent | null {
  const r = me.hidden.risk;
  if (rng.next() >= (RISK_AUDIT[r] ?? 0)) return null;
  const [title, detail, tag, eff] =
    r >= 5 ? ['감찰 조사', '지난 처리 과정 전반에 대해 조사를 받았어요', '조사', -14] as const
    : r >= 4 ? ['감사 지적', '예전 처리 건이 드러나 견책을 받았어요', '견책', -10] as const
    : ['감사 지적', '예전 처리 건에 대해 경고를 받았어요', '경고', -5] as const;
  return { id: 'risk_audit', kind: 'bad', title, detail, tag, evalEffect: eff, tone: 'bad' };
}

export function deskToEvents(desk: DeskResult[]): YearEvent[] {
  return desk.map((d) => ({
    id: `choice:${d.defId}`, kind: 'choice', title: d.title, detail: d.outcome.text,
    tag: d.odds >= 100 ? '처리' : d.success ? '성공' : '실패', evalEffect: d.outcome.eval, tone: d.success && d.outcome.eval >= 0 ? (d.outcome.eval > 0 ? 'good' : 'neutral') : 'bad',
  }));
}

export function buildYearEvents(me: Officer, year: number, desk: DeskResult[], rng: Rng): YearEvent[] {
  const list: YearEvent[] = [rollWork(me, rng), ...deskToEvents(desk), ...milestones(me, rng)];
  const audit = riskAudit(me, rng);
  if (audit) list.push(audit);
  else if (list.length < 5) {
    const c = pickChance(me, year, rng);
    if (c) list.push(c);
  }
  return list;
}

/** 평정 점수 = 업무 성과 + 사건·결재 영향, 30~100 */
export function evalScore(events: YearEvent[]): number {
  return Math.max(30, Math.min(100, events.reduce((sum, e) => sum + e.evalEffect, 0)));
}

export function gradeOf(score: number): Grade {
  return score >= 75 ? '탁월' : score >= 60 ? '우수' : score >= 45 ? '보통' : '미흡';
}

export function bossComment(events: YearEvent[]): string {
  const work = events[0];
  const others = events.slice(1).filter((e) => e.kind !== 'milestone');
  const worst = others.filter((e) => e.tone === 'bad').sort((a, b) => a.evalEffect - b.evalEffect)[0];
  const best = others.filter((e) => e.tone === 'good').sort((a, b) => b.evalEffect - a.evalEffect)[0];
  const head = work.tag === '우수' ? '업무 성과는 훌륭했지만' : work.tag === '보통' ? '업무는 무난했지만' : '업무 성과가 아쉬웠고';
  if (worst) return work.tag === '미흡' ? `업무 성과가 부족했고, '${worst.title}' 건까지 겹쳤음.` : `${head}, '${worst.title}' 건은 아쉬웠음.`;
  if (best) return work.tag === '미흡' ? `업무 성과는 아쉬웠으나, '${best.title}' 건은 인상적이었음.` : `${work.tag === '우수' ? '업무 성과도 훌륭했고' : '업무도 무난했고'}, '${best.title}' 건이 돋보였음.`;
  return work.tag === '우수' ? '맡은 일을 아주 잘 해냈음.' : work.tag === '보통' ? '큰 문제 없이 한 해를 보냈음.' : '전반적으로 보완이 필요함.';
}
