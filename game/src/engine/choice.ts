// 선택 이벤트: 확률 계산, 결재함 구성, 결과 적용. 플레이어와 동기 NPC가 같은 규칙을 쓴다.
import { CHOICES, CHOICE_BY_ID } from '../data/choices';
import { ASSIGNMENTS, ODDS, PERSONALITY, PITY, RANK_BASELINE, REWARD_TIERS, RISK_MAX } from '../data/config';
import { addStats } from './growth';
import { BOSSES, bossStyleBonus } from './term';
import type { Rng } from './rng';
import { STAT_LABEL, type ChoiceDef, type ChoiceOption, type DeskItem, type DeskResult, type Officer, type OddsPart, type Outcome, type Rank, type RankGroup } from './types';

export function rankGroup(rank: Rank): RankGroup {
  if (['소위', '중위', '대위'].includes(rank)) return '위관';
  if (['소령', '중령', '대령'].includes(rank)) return '영관';
  return '장성';
}

const billetKindOf = (id: string) => ASSIGNMENTS.find((a) => a.id === id)!.kind;

/** 성공 확률과 그 구성 (카드에 그대로 보여준다) */
export function optionOdds(o: Officer, opt: ChoiceOption): { p: number; parts: OddsPart[] } {
  if (opt.sure) return { p: 100, parts: [] };
  const parts: OddsPart[] = [{ label: '기본', value: opt.base }];
  const statDiff = o.stats[opt.stat] - RANK_BASELINE[o.rank];
  parts.push({ label: `내 ${STAT_LABEL[opt.stat]} ${o.stats[opt.stat]} (${o.rank} 평균 ${RANK_BASELINE[o.rank]})`, value: Math.round(statDiff) });
  const owned = (opt.tags ?? []).filter((t) => o.tags.includes(t)).slice(0, ODDS.tagMax);
  for (const t of owned) parts.push({ label: `#${t}`, value: ODDS.tag });
  if (opt.edu && o.eduDone > 0) parts.push({ label: '군사교육', value: ODDS.edu });
  if (opt.billet && o.billets.some((b) => billetKindOf(b) === opt.billet)) parts.push({ label: `${opt.billet} 경험`, value: ODDS.billet });
  const bb = bossStyleBonus(o, opt.style);
  if (bb && o.term) parts.push({ label: BOSSES[o.term.boss].name, value: bb });
  const raw = parts.reduce((s, x) => s + x.value, 0);
  return { p: Math.max(ODDS.min, Math.min(ODDS.max, raw)), parts };
}

function eligible(def: ChoiceDef, o: Officer): boolean {
  if (def.chainOnly || def.major) return false;
  if (def.when.ranks && !def.when.ranks.includes(o.rank)) return false;
  if (def.when.groups && !def.when.groups.includes(rankGroup(o.rank))) return false;
  if (def.when.kinds && !def.when.kinds.includes(billetKindOf(o.assignmentId))) return false;
  return true;
}

function majorFits(def: ChoiceDef, o: Officer): boolean {
  if (!def.major) return false;
  if (def.when.groups && !def.when.groups.includes(rankGroup(o.rank))) return false;
  if (def.when.kinds && !def.when.kinds.includes(billetKindOf(o.assignmentId))) return false;
  return true;
}

/** 올해 결재함 2건. 연쇄 이벤트가 있으면 상반기, 중대 사건은 7월에 */
export function buildDesk(o: Officer, year: number, isMajorYear: boolean, rng: Rng): DeskItem[] {
  const picked: string[] = [];
  const chain = o.chains.find((c) => c.year === year);
  if (chain) picked.push(chain.id);
  let major: string | null = null;
  if (isMajorYear) {
    const ms = CHOICES.filter((d) => majorFits(d, o) && o.eventLog[d.id] === undefined);
    if (ms.length) major = rng.pick(ms).id;
  }
  const need = 2 - picked.length - (major ? 1 : 0);
  // 안 본 이벤트 우선, 그다음 오래전에 본 것 순. 같은 해엔 유형이 겹치지 않게
  const last = (d: ChoiceDef) => o.eventLog[d.id] ?? -999;
  const pool = CHOICES.filter((d) => eligible(d, o) && !picked.includes(d.id) && year - last(d) > 2);
  const all = pool.length >= need ? pool : CHOICES.filter((d) => eligible(d, o) && !picked.includes(d.id));
  for (let i = 0; i < need && all.length; i++) {
    const types = picked.map((id) => CHOICE_BY_ID[id].type);
    const diff = all.filter((d) => !types.includes(d.type));
    const cands = (diff.length ? diff : all).sort((a, b) => last(a) - last(b) || rng.next() - 0.5);
    const oldest = last(cands[0]);
    const top = cands.filter((d) => last(d) === oldest || last(d) < -900);
    const d = rng.pick(top.length >= 2 ? top : cands.slice(0, 3));
    picked.push(d.id);
    all.splice(all.indexOf(d), 1);
  }
  if (major) picked.push(major);
  return picked.slice(0, 2).map((defId, i) => {
    const def = CHOICE_BY_ID[defId];
    const n = def.variants?.length ?? 0;
    const v = n && o.eventLog[defId] !== undefined ? 1 + (year % n) : 0;
    return { defId, slot: i as 0 | 1, v };
  });
}

/** 상황 문구 (같은 이벤트가 다시 나오면 다른 상황으로) */
export function deskText(defId: string, v = 0): { title: string; body: string } {
  const def = CHOICE_BY_ID[defId];
  const alt = v > 0 ? def.variants?.[v - 1] : undefined;
  return alt ?? { title: def.title, body: def.body };
}

/** 표시 확률에 따른 성공 보상 배율 */
export function rewardTier(p: number, sure = false): { mult: number; label: string } {
  if (sure) return { mult: 1, label: '' };
  const t = REWARD_TIERS.find((x) => p <= x.max)!;
  return { mult: t.mult, label: t.label };
}

/** 성공 결과에 배율 적용 (좋은 변화만 키운다) */
export function scaledOutcome(out: Outcome, mult: number): Outcome {
  if (mult === 1) return out;
  const sc = (v: number, m: number) => (v > 0 ? Math.max(1, Math.round(v * m)) : v);
  // 능력치는 배율의 절반만 (능력치가 오르면 이후 확률이 연쇄적으로 올라서)
  const sm = 1 + (mult - 1) / 2;
  const stats = out.stats ? Object.fromEntries(Object.entries(out.stats).map(([k, v]) => [k, sc(v!, sm)])) as Outcome['stats'] : undefined;
  return { ...out, eval: sc(out.eval, mult), stats };
}

/** 현재 숨은 연속 실패 보정 %p */
export const pityBonus = (o: Officer) => Math.min(PITY.max, (o.log.failStreak ?? 0) * PITY.step);

/** 선택 결과를 굴리고 장교에게 바로 적용한다 */
export function resolveChoice(o: Officer, defId: string, key: string, year: number, rng: Rng, v = 0): DeskResult {
  const def = CHOICE_BY_ID[defId];
  const opt = def.options.find((x) => x.key === key) ?? def.options[0];
  const { p, parts } = optionOdds(o, opt);
  const tier = rewardTier(p, opt.sure);
  const pity = opt.sure ? 0 : pityBonus(o);
  const roll = rng.next() * 100;
  const guard = !opt.sure && p >= PITY.guardOdds && (o.log.failStreak ?? 0) >= PITY.guardStreak;
  const success = opt.sure ? true : guard || roll < p + pity;
  if (!opt.sure) {
    o.log.failStreak = success ? 0 : (o.log.failStreak ?? 0) + 1;
    o.log.luckExp = (o.log.luckExp ?? 0) + p / 100;
    o.log.luckVar = (o.log.luckVar ?? 0) + (p / 100) * (1 - p / 100);
    o.log.luckHit = (o.log.luckHit ?? 0) + (success ? 1 : 0);
  }
  const outcome = success ? scaledOutcome(opt.success, tier.mult) : opt.fail;
  addStats(o, outcome.stats);
  if (outcome.gainTag && !o.tags.includes(outcome.gainTag)) o.tags.push(outcome.gainTag);
  if (outcome.risk) o.hidden.risk = Math.max(0, Math.min(RISK_MAX, o.hidden.risk + outcome.risk));
  if (outcome.chain) o.chains.push({ id: outcome.chain, year: year + 2 });
  if (outcome.award === '표창') o.log.awards.push({ group: rankGroup(o.rank) });
  if (outcome.award === '큰 표창') o.log.majorAwards += 1;
  if (outcome.fitnessTop) o.log.fitnessTop += 1;
  if (def.major) {
    o.log.incidents += 1;
    if (opt.style === '원칙') { o.log.principled += 1; o.log.hardWay = true; }
  }
  o.eventLog[defId] = year;
  return { defId, optionKey: opt.key, style: opt.style, label: opt.label, odds: opt.sure ? 100 : p, success, outcome, title: deskText(defId, v).title, major: !!def.major, mult: success ? tier.mult : 1, pity, parts };
}

/** NPC: 성격에 맞는 성향의 선택지를 고른다 */
export function npcPick(o: Officer, defId: string, rng: Rng): string {
  const def = CHOICE_BY_ID[defId];
  const prefs = PERSONALITY[o.personality].styles;
  const liked = def.options.filter((x) => prefs.includes(x.style));
  return rng.pick(liked.length && rng.next() < 0.75 ? liked : def.options).key;
}
