// 인사: 보직 교체 대상자가 1·2지망을 내고, 점수 순으로 정원 안에서 배정한다.
// 점수 = 최근 평정 ×0.6 + 보직 능력치 평균 ×0.3 + 처세 ×0.1 + 경험 태그 5점씩(최대 2) − 숨은 리스크(2단계부터)
import { ASSIGNMENT_TERM, ASSIGNMENTS, FIXED_QUOTA, PERSONALITY, QUOTA, RANKS, REQUIRED_BILLET, REQUIRED_WISH_BONUS, SOFT_CAP, VIRTUAL_SENIORS, WISH_WEIGHTS } from '../data/config';
import type { Rng } from './rng';
import type { Assignment, Officer, PersonnelResult, Rank } from './types';
import { billetOpen, DEFAULT_CORPS, type Corps, type UnitType } from '../data/billets';
import { keyRng, termOff, rollBoss, startTerm, UNIT_KEYS, unitCard, UNITS } from './term';

/** 이 계급의 보직. corps를 주면 그 병과가 갈 수 있는 것만 (v3.4) */
export const assignmentsFor = (rank: Rank, corps?: Corps) => ASSIGNMENTS.filter((a) => a.ranks.includes(rank) && (!corps || billetOpen(a, corps)));
/** 병과 (옛 저장은 계열에서) */
export const corpsOf = (o: Officer): Corps => o.corps ?? DEFAULT_CORPS[o.branch];
export const openFor = (o: Officer) => assignmentsFor(o.rank, corpsOf(o));
/** 이 자리의 부대 종류: 후보가 하나면 그것, 여럿이면 세상 시드로 (나와 동기가 다름) */
export function utypeOf(seed: number, year: number, a: Assignment, who: string): UnitType {
  const us = (a.units ?? ['후방']) as UnitType[];
  return us.length === 1 ? us[0] : keyRng(seed, year, a.id, who, 'ut').pick(us);
}
export const asg = (id: string) => ASSIGNMENTS.find((a) => a.id === id)!;
export const isGeneral = (rank: Rank) => RANKS.indexOf(rank) >= RANKS.indexOf('준장');

export function needsReassign(o: Officer): boolean {
  return o.active && o.yearsInAssignment >= ASSIGNMENT_TERM;
}

/** 이 계급의 필수 보직을 아직 안 했는가 */
export function lacksRequired(o: Officer): boolean {
  const req = REQUIRED_BILLET[o.rank];
  return !!req && !req.ids.some((id) => o.billets.includes(id));
}
export const isRequired = (o: Officer, id: string) => !!REQUIRED_BILLET[o.rank]?.ids.includes(id);
/** 필수 보직 강제 배정 시기인가 (중대장: 대위 4년차 인사) */
export function mustAssign(o: Officer): boolean {
  const req = REQUIRED_BILLET[o.rank];
  return !!req && req.forceAt !== null && lacksRequired(o) && o.yearsInRank >= req.forceAt;
}
void SOFT_CAP;

export function wishScore(o: Officer, a: Assignment): number {
  const recent = o.evals.slice(-3);
  const ev = recent.length ? recent.reduce((x, y) => x + y, 0) / recent.length : 55;
  const stat = (o.stats[a.grows[0]] + o.stats[a.grows[1]]) / 2;
  const tags = Math.min(WISH_WEIGHTS.tagMax, a.wantTags.filter((t) => o.tags.includes(t)).length);
  const risk = o.hidden.risk >= 2 ? o.hidden.risk * WISH_WEIGHTS.risk : 0;
  const req = lacksRequired(o) && isRequired(o, a.id) ? REQUIRED_WISH_BONUS : 0;
  return Math.round((ev * WISH_WEIGHTS.eval + stat * WISH_WEIGHTS.stat + o.stats.social * WISH_WEIGHTS.social + tags * WISH_WEIGHTS.tag + req - risk) * 10) / 10;
}

/** v3.4 정원 묶음: 병과 전용 자리(보병 중대장 · 포대장 · 통신 중대장 …)는 같은 계급 · 같은 종류끼리 한 묶음으로 정원을 나눠 쓴다
 *  (병과마다 따로 세면 지원자 1~2명이라 정원이 0이나 1로 튀어서 병과 사이 차이가 너무 커짐) */
export const poolKey = (a: Assignment) => (a.corps ? `pool:${a.kind}:${a.ranks[0]}` : a.id);
/** 정원: null이면 제한 없음 */
export function quotaOf(a: Assignment, applicants: number, card?: keyof typeof UNITS): number | null {
  if (a.id in FIXED_QUOTA) return FIXED_QUOTA[a.id];
  const r = QUOTA[a.kind];
  if (r === null) return null;
  const q = card ? UNITS[card].quota : undefined;
  if (q === 'open') return null;
  const sameKind = new Set(assignmentsFor(a.ranks[0]).filter((x) => x.kind === a.kind).map(poolKey)).size || 1;
  const n = Math.max(1, Math.round((r / sameKind) * applicants));
  return q === 'tight' ? Math.max(1, Math.round(n * 0.6)) : n;
}

export function quotaLabel(a: Assignment, card?: keyof typeof UNITS): string {
  if (a.id in FIXED_QUOTA && FIXED_QUOTA[a.id] === 1) return '단 1자리';
  const r = a.id in FIXED_QUOTA ? null : QUOTA[a.kind];
  if (r === null || (card && UNITS[card].quota === 'open')) return '정원 넉넉';
  if (card && UNITS[card].quota === 'tight') return '정원 매우 적음';
  return r <= 0.25 ? '정원 매우 적음' : '정원 적음';
}

export function npcWishes(o: Officer, rng: Rng): [string, string] {
  const opts = openFor(o).filter((a) => a.id !== o.assignmentId);
  const all = opts.length ? opts : openFor(o);
  const [k1, k2] = PERSONALITY[o.personality].wish;
  const byKind = (k: string) => all.filter((a) => a.kind === k);
  const req = lacksRequired(o) ? all.filter((a) => isRequired(o, a.id)) : [];
  const first = req.length && rng.next() < 0.85 ? rng.pick(req) : rng.pick(byKind(k1).length ? byKind(k1) : all);
  const rest = all.filter((a) => a.id !== first.id);
  const second = rest.length ? rng.pick(byKind(k2).filter((a) => a.id !== first.id).length ? byKind(k2).filter((a) => a.id !== first.id) : rest) : first;
  return [first.id, second.id];
}

interface Cand { o: Officer | null; wishes: [string, string]; score: number }

/** 한 번의 정기 인사. 대상자 전원의 보직을 바꾸고, 플레이어 결과를 돌려준다 */
/** NPC 희망은 세상 시드로 정해져서 희망 조사 화면에서 미리 보여줄 수 있다 */
export const npcWishesFor = (o: Officer, seed: number, year: number) => npcWishes(o, keyRng(seed, year, o.id, 'wish'));
const cardOf = (seed: number, year: number, id: string, rank: Rank) => (isGeneral(rank) || termOff() ? undefined : unitCard(seed, year, id));

export function runPersonnel(everyone: Officer[], myWishes: [string, string] | null, year: number, rng: Rng, seed = 0): PersonnelResult | null {
  let mine: PersonnelResult | null = null;
  const due = everyone.filter(needsReassign);
  const ranks = [...new Set(due.map((o) => o.rank))];
  for (const rank of ranks) {
    const billets = assignmentsFor(rank);
    const group = due.filter((o) => o.rank === rank);
    if (billets.length <= 1) {
      for (const o of group) place(o, billets[0]?.id ?? o.assignmentId, year, rng, seed);
      continue;
    }
    const cands: Cand[] = group.map((o) => {
      const wishes = o.id === 'me' && myWishes ? myWishes : npcWishesFor(o, seed, year);
      return { o, wishes, score: wishScore(o, asg(wishes[0])) };
    });
    // 장성: 가상의 선후배 기수도 같은 자리를 노린다
    if (isGeneral(rank)) {
      const limited = billets.filter((b) => quotaOf(b, 10) !== null);
      for (let i = 0; i < VIRTUAL_SENIORS; i++) {
        const w1 = rng.pick(limited.length ? limited : billets).id;
        const w2 = rng.pick(billets.filter((b) => b.id !== w1)).id;
        cands.push({ o: null, wishes: [w1, w2], score: 66 + rng.int(-8, 10) });
      }
    }
    const total = cands.length;
    const left = new Map(billets.map((b) => [poolKey(b), quotaOf(b, total, cardOf(seed, year, b.id, rank))]));
    const applicants = new Map(billets.map((b) => [b.id, cands.filter((c) => c.wishes[0] === b.id).length]));
    cands.sort((a, b) => b.score - a.score || rng.next() - 0.5);
    for (const c of cands) {
      let got: string | null = null;
      let wishRank: 0 | 1 | 2 = 0;
      if (c.o && mustAssign(c.o)) {
        const forced = openFor(c.o).find((b) => isRequired(c.o!, b.id)) ?? billets.find((b) => isRequired(c.o!, b.id))!;
        got = forced.id;
        wishRank = c.wishes[0] === got ? 1 : c.wishes[1] === got ? 2 : 0;
        if (c.o.id === 'me') mine = { year, rank, from: c.o.assignmentId, wishes: c.wishes, got, wishRank, myScore: wishScore(c.o, forced), quota: null, applicants: applicants.get(got) ?? 0, note: `필수 보직(${forced.name})을 아직 안 해서 인사과가 우선 배정했어요` };
        place(c.o, got, year, rng, seed);
        if (c.o.id === 'me' && mine) Object.assign(mine, { unit: c.o.term?.unit, boss: c.o.term?.boss });
        continue;
      }
      for (const [i, w] of c.wishes.entries()) {
        const q = left.get(poolKey(asg(w)));
        if (q === null || (q !== undefined && q > 0)) { got = w; wishRank = (i + 1) as 1 | 2; break; }
      }
      if (!got) {
        const mine2 = c.o ? billets.filter((b) => billetOpen(b, corpsOf(c.o!))) : billets;
        const open = mine2.filter((b) => left.get(poolKey(b)) === null);
        const pool = open.length ? open : mine2;
        const self = c.o;
        got = (self ? pool.sort((x, y) => wishScore(self, y) - wishScore(self, x))[0] : rng.pick(pool)).id;
      }
      const q = left.get(poolKey(asg(got)));
      if (q !== null && q !== undefined) left.set(poolKey(asg(got)), q - 1);
      if (!c.o) continue;
      if (c.o.id === 'me') {
        const a = asg(got);
        mine = {
          year, rank, from: c.o.assignmentId, wishes: c.wishes, got, wishRank, myScore: wishScore(c.o, a),
          quota: quotaOf(a, total, cardOf(seed, year, got, rank)), applicants: applicants.get(got) ?? 0,
          note: wishRank === 1 ? '1지망으로 배정됐어요' : wishRank === 2 ? '1지망 정원이 차서 2지망으로 배정됐어요' : '1·2지망 정원이 모두 차서 다른 보직으로 배정됐어요',
        };
      }
      place(c.o, got, year, rng, seed);
      if (c.o.id === 'me' && mine) Object.assign(mine, { unit: c.o.term?.unit, boss: c.o.term?.boss });
    }
  }
  return mine;
}

/** 보직에 앉히고 새 임기를 시작한다. 내 부대는 카드대로, 동기는 무작위 */
export function place(o: Officer, id: string, year: number, rng: Rng, seed: number) {
  o.assignmentId = id;
  o.yearsInAssignment = 0;
  if (!o.billets.includes(id)) o.billets.push(id);
  o.utype = utypeOf(seed, year, asg(id), o.id);
  const unit = o.id === 'me' ? unitCard(seed, year, id) : rng.pick(UNIT_KEYS);
  startTerm(o, unit, rollBoss(unit, rng), year);
}

export interface WishInfo { utype: UnitType; id: string; card?: keyof typeof UNITS; quota: number | null; rivals: number; ahead: number; chance: '안정' | '경합' | '어려움' | null }
/** 희망 조사 미리보기: 자리별 부대 카드, 정원, 1지망으로 올 동기 수, 그중 나보다 점수가 높은 사람 */
export function wishPreview(me: Officer, cohort: Officer[], year: number, seed: number): WishInfo[] {
  const rank = me.rank;
  const billets = openFor(me);
  const group = cohort.filter((o) => needsReassign(o) && o.rank === rank);
  const wishes = group.map((o) => ({ o, w: npcWishesFor(o, seed, year)[0] }));
  return billets.map((b) => {
    const total = group.length + 1 + (isGeneral(rank) ? VIRTUAL_SENIORS : 0);
    const card = cardOf(seed, year, b.id, rank);
    const quota = quotaOf(b, total, card);
    const mine = wishScore(me, b);
    const rivals = wishes.filter((x) => poolKey(asg(x.w)) === poolKey(b));
    const ahead = rivals.filter((x) => wishScore(x.o, b) > mine).length;
    const chance = quota === null || isGeneral(rank) ? null : ahead < quota * 0.6 ? '안정' : ahead < quota ? '경합' : '어려움';
    return { id: b.id, card, quota, rivals: rivals.length, ahead, chance, utype: utypeOf(seed, year, b, 'me') };
  });
}
