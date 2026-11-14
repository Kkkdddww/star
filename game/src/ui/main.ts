// 화면 (v2): 흰 바탕 + 국방색 포인트, 군 행정 문서를 모티프로 한 UI.
// 학교 프롤로그 → 임관 → (결재함 → 1년 → 근무평정 통지서 → 진급·인사) 반복 → 전역 카드
import { CHOICE_BY_ID } from '../data/choices';
import { ORIGIN, ORIGIN_SCHOOL, PERSONALITY, POLICY, POTENTIAL, PROMOTION, RANKS, SCHOOL_FOCUS } from '../data/config';
import { WORK_TITLE } from '../data/events';
import { deskText, optionOdds, pityBonus, rewardTier, scaledOutcome } from '../engine/choice';
import { advanceYear, careerYear, decide, newGame, retire, rivalOf, setPolicy, submitWishes, upcoming } from '../engine/game';
import { branchFits, overall } from '../engine/growth';
import { earnedRibbons, earnedTitles, honorScore, RIBBONS, TITLES, titleName, type Earned } from '../engine/meta';
import { initAnalytics, track } from '../net/analytics';
import { hobongOf, runXp } from '../engine/hobong';
import { CONTEST_FROM, CONTEST_POT, contestOpen, MAX_TEAMS, weekNo, weekOf } from '../engine/contest';
import { baseStats, fixedPotential, makeCandidates, DIFFICULTY, potentialRange, type Candidate } from '../engine/candidates';
import { asg, assignmentsFor, isRequired, lacksRequired, quotaLabel, wishPreview, wishScore } from '../engine/personnel';
import { BOSSES, goalOf, keyRng, UNITS } from '../engine/term';
import { RANK_BASELINE, REQUIRED_BILLET } from '../data/config';
import { careerScore, promotionBreakdown, weakestStats } from '../engine/promotion';
import { graduate, rollOrigin, SCHOOL_MOMENTS, type Graduation } from '../engine/school';
import { eul, eunNeun, hasJong, iga, ro } from '../engine/text';
import { STAT_KEYS, STAT_LABEL, type Branch, type DeskResult, type Outcome, type GameState, type Origin, type Path, type Policy, type Potential, type Rank, type SchoolFocus, type StatKey, type Stats, type YearReport } from '../engine/types';
import { insignia } from './insignia';
import { ribbonRack, ribbonSvg } from './ribbon';
import { prepareCard, saveCardImage, shareCardImage } from './cardImage';
import { medalSvg, metalOf } from './medal';
import { adSlot, initRewarded, mountAds, rewardedOn, showRewarded } from './ads';
import { NOTICES, applySettings, footer, hasNewNotice, reduceMotion, setReduceMotion, settingsState } from './site';
import { guestPreview, gs, cohortCached, cohortOpen, inviteData, rememberCohort } from './group';
import { cardHtml, dailyResult, invalidate, invalidateDaily, lastCard, load, rk, routeOf, rowHtml, saveNickname, setRerender, viewRoute, type CardData } from './social';
import { loginState } from './login';
import { forgetPeople, contestAfter, contestDoc, contestTileSub, cs, myTeamsNow, mineL } from './contest';
import { randomRibbon, teamRibbon } from './teamRibbon';
import { AlreadyError, myStatsCached, unstash, consumeAuthReturn, deleteAccount, linkProvider, loginInfo, logout, myId, signInProvider, statsOf, type Provider, createCohort, createTeam, dailyCount, dailyRanking, getCohort, getProfile, joinTeam, leaveTeam, memberCounts, nicknameProblem, publicTeams, reportGuest, saveProfile, saveRun, seasonRanking, setMainTeam, textProblem, today, updateTeam, writeGuest, type RunRow } from '../net/api';

// ───────── 저장 ─────────
interface Save { game: GameState; focus: [StatKey, StatKey]; potentialSeen: string | null; metaApplied: boolean; log?: unknown[]; runId?: string | null; tpSeen?: string[]; tpLast?: number }
interface Meta { cleared: boolean; ribbons: Record<string, number[]>; titles: string[]; equipped: string | null; runs: number; bestRank?: number }
const KEY = 'sowi-to-star-v2';
const META_KEY = 'sowi-to-star-meta-v2';
function read<T>(k: string): T | null { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; } }
function write(k: string, v: unknown) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } }
let save: Save | null = read<Save>(KEY);
{ const OLD: Record<string, string> = { 수: '탁월', 우: '우수', 미: '보통', 양: '미흡' };
  for (const h of (save?.game?.history ?? []) as { grade: string }[]) if (OLD[h.grade]) h.grade = OLD[h.grade]; }
if (save && !save.game?.me?.log) save = null; // 이전 버전 저장은 버린다
const meta: Meta = { cleared: false, ribbons: {}, titles: [], equipped: null, runs: 0, ...(read<Meta>(META_KEY) ?? {}) };
// 저장 칸 두 개: 자유 플레이 / 오늘의 기수 (서로 덮어쓰지 않는다)
type Slot = 'free' | 'daily' | 'cohort' | 'contest';
const SLOT_KEY: Record<Slot, string> = { free: KEY, daily: 'malttuk-daily-v1', cohort: 'malttuk-cohort-v1', contest: 'malttuk-contest-v1' };
let slot: Slot = 'free';
const persist = () => write(SLOT_KEY[slot], save);
const peek = (sl: Slot): Save | null => (sl === slot ? save : read<Save>(SLOT_KEY[sl]));
function useSlot(sl: Slot) {
  if (slot === sl) return;
  persist();
  slot = sl;
  save = read<Save>(SLOT_KEY[sl]);
  ui.upload = { nick: '', msg: '', busy: false, loaded: false, fails: 0, fixed: null };
  ui.report = null; ui.queue = []; ui.tab = 'home';
}
const isDaily = (g: GameState | null | undefined) => g?.mode === 'daily';
const isGroup = (g: GameState | null | undefined) => g?.mode === 'cohort';
const isContest = (g: GameState | null | undefined) => g?.mode === 'contest';
/** 한 사람 한 판인 모드 (다시 시작 · 다시 뽑기 없음) */
const isFixed = (g: GameState | null | undefined) => isDaily(g) || isGroup(g) || isContest(g);
/** 이번 주 대항전 판 상태 */
function contestState(): { st: 'none' | 'playing' | 'ended' | 'uploaded'; save: Save | null } {
  const d = peek('contest');
  const g = d?.game;
  if (!g) return { st: 'none', save: null };
  if (!g.ended) return { st: 'playing', save: d };
  if (g.week !== weekOf(today())) return { st: 'none', save: d };
  return { st: d.runId ? 'uploaded' : 'ended', save: d };
}
/** 우리 기수 진행 상태 */
function groupState(): { st: 'none' | 'playing' | 'ended' | 'uploaded'; save: Save | null } {
  const d = peek('cohort');
  const g = d?.game;
  if (!g) return { st: 'none', save: null };
  return { st: !g.ended ? 'playing' : d.runId ? 'uploaded' : 'ended', save: d };
}
const dayLabel = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
/** 오늘의 기수 상태 */
function dailyState(): { st: 'none' | 'playing' | 'ended' | 'uploaded'; save: Save | null } {
  const d = peek('daily');
  const g = d?.game;
  if (!g) return { st: 'none', save: null };
  if (!g.ended) return { st: 'playing', save: d };
  if (g.day !== today()) return { st: 'none', save: d };
  return { st: d.runId ? 'uploaded' : 'ended', save: d };
}
const persistMeta = () => write(META_KEY, meta);

// ───────── 상태 ─────────
type Screen = 'medal' | 'lobby' | 'p-intro' | 'p-cands' | 'p-envelope' | 'p-focus' | 'p-school' | 'p-grad' | 'p-commission'
  | 'home' | 'desk' | 'progress' | 'result' | 'promotion' | 'promo-ceremony' | 'wish' | 'order' | 'policy' | 'assign-ceremony' | 'ending';
type Tab = 'home' | 'record' | 'cohort' | 'dex';
type Sheet = null | 'focus' | 'retire' | 'reset' | 'ad' | 'title';

interface Prologue {
  name: string; origin: Origin; potential: Potential; seed: number;
  focus: SchoolFocus[]; branch: Branch; open: boolean; chosen: boolean;
  grad: Graduation | null;
  /** 후보 3명 · 고른 후보 · 다시 뽑기 사용 수 · 잠재력 범위(본 경우) */
  cands: Candidate[]; pick: number | null; rerolls: number; viewed: boolean; ranges: string[] | null;
  spread: Partial<Stats>; range: string | null;
  /** 오늘의 기수 날짜 */
  daily?: string;
  /** 우리 기수 */
  group?: { id: string; code: string; name: string; seed: number; day?: string };
  /** v3.3 대항전: 그 주 월요일 */
  week?: string;
  /** v3.2 기수 판: 후보 3명 모두 같은 잠재력 (평일 A · 토 S · 일 B) */
  fixedPot?: Potential | null;
}
const REROLL_MAX = 2;

const ui = {
  screen: 'lobby' as Screen,
  lobbyTab: null as 'd' | 'c' | 'f' | null,
  tab: 'home' as Tab,
  sheet: null as Sheet,
  draftFocus: [] as StatKey[],
  report: null as YearReport | null,
  queue: [] as Screen[],
  assignFrom: null as string | null,
  firstPost: false,
  desk: { slot: 0, pick: null as string | null, back: 'home' as 'home' | 'progress' },
  month: 1,
  wish: [] as string[],
  orderOpen: false,
  policy: null as Policy | null,
  ad: { kind: 'eval' as 'eval' | 'reroll', left: 0 },
  pro: null as Prologue | null,
  newRibbons: [] as string[],
  upload: { nick: '', msg: '', busy: false, loaded: false, fails: 0, fixed: null as string | null },
  adBusy: false,
  medals: [] as Earned[],
  tp: null as { key: string; rec: [StatKey, StatKey] } | null,
  medalIdx: 0,
  route: routeOf(location.hash),
};

// ───────── 유틸 ─────────
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const signed = (n: number) => (n > 0 ? `<span class="up">+${n}</span>` : n < 0 ? `<span class="down">${n}</span>` : '<span class="faint">±0</span>');
const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const rankCount = (r: Rank) => RANKS.indexOf(r);

const ICON: Record<string, string> = {
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  up: '<path d="M4 16l6-6 4 4 6-7"/><path d="M15 7h5v5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
  swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c3 0 5 2.2 5 5"/>',
  ribbon: '<rect x="4" y="5" width="16" height="6" rx="1"/><rect x="4" y="13" width="7" height="6" rx="1"/><rect x="13" y="13" width="7" height="6" rx="1"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
};
const icon = (name: string, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

function currentTitle(): string | null {
  return meta.equipped && meta.titles.includes(meta.equipped) ? titleName(meta.equipped) : null;
}
function docNo(g: GameState, suffix: string) { return `제${g.year}-${String(careerYear(g)).padStart(2, '0')}${suffix}호`; }

// ═════════ 학교 프롤로그 ═════════
function newPrologue(daily?: string, group?: Prologue['group'], week?: string): Prologue {
  const r = daily ? keyRng('malttuk-daily', daily) : group ? keyRng('malttuk-cohort', group.seed) : week ? keyRng('malttuk-contest', week) : null;
  const rand = r ? () => r.next() : Math.random;
  const cands = makeCandidates(rand);
  const fixedPot = daily ? fixedPotential(daily) : group?.day ? fixedPotential(group.day) : week ? CONTEST_POT : null;
  if (fixedPot) for (const c of cands) c.potential = fixedPot;
  return { name: '', origin: '학군', potential: 'B', seed: 0, focus: [], branch: '전투', open: false, chosen: false, grad: null,
    cands, pick: null, rerolls: 0, viewed: false, ranges: null, spread: {}, range: null, daily, group, week, fixedPot };
}
const fixedWorld = (p: Prologue) => !!(p.daily || p.group || p.week);

function viewCands(): string {
  const p = ui.pro!;
  const left = REROLL_MAX - p.rerolls;
  const card = (c: Candidate, i: number) => {
    const on = p.pick === i;
    const st = baseStats(c);
    const sorted = [...STAT_KEYS].sort((x, y) => st[y] - st[x]);
    const hi = sorted.slice(0, 2), lo = sorted[5];
    const range = p.ranges?.[i];
    return `<button class="cand ${on ? 'on' : ''}" data-act="p-cand" data-v="${i}">
      <div class="r"><span class="chip">${ORIGIN_SCHOOL[c.origin].school}</span><b>후보 ${i + 1}</b>${p.fixedPot ? `<span class="pot op">잠재력 ${p.fixedPot}</span>` : `<span class="pot ${range ? (range.endsWith('S') ? 'hot' : 'op') : ''}">${range ?? '잠재력 ?'}</span>`}</div>
      <p class="nick">"${c.nick}"</p>
      <p class="str">${STAT_LABEL[hi[0]]}, ${STAT_LABEL[hi[1]]}${hasJong(STAT_LABEL[hi[1]]) ? '이' : '가'} 높고, ${STAT_LABEL[lo]}${hasJong(STAT_LABEL[lo]) ? '이' : '가'} 가장 낮아요</p>
      ${on ? `<div class="cbars">${STAT_KEYS.map((k) => `<span class="${hi.includes(k) ? 'hi' : ''}">${STAT_LABEL[k]}</span><i><u style="width:${st[k]}%"></u></i><em>${st[k]}</em>`).join('')}</div>
      <p class="trait">${ORIGIN_SCHOOL[c.origin].school} · ${ORIGIN_SCHOOL[c.origin].letter} · ${ORIGIN[c.origin].note}</p>` : ''}
    </button>`;
  };
  return `
  <div class="page">
    <header class="top"><button class="iconbtn" style="margin:0 0 0 -8px" data-act="p-back-intro" aria-label="뒤로">${icon('back', 20)}</button></header>
    <div class="pad tight" style="padding-bottom:170px">
    <p class="kicker">${p.daily ? `오늘의 기수 · ${dayLabel(p.daily)}` : p.group ? `우리 기수 · ${esc(p.group.name)}` : p.week ? `기수 대항전 · 제${weekNo(p.week)}주` : '지원서'} · ${esc(p.name.trim() || '지원자')}</p>
    <h1 class="h1">어떤 장교로<br>시작할까요?</h1>
    <p class="sub">${p.daily ? '오늘 입대한 모두에게 똑같은 세 후보예요. 다시 뽑기는 없어요.' : p.group ? '이 기수 동기 모두에게 똑같은 세 후보예요. 다시 뽑기는 없어요.' : p.week ? '이번 주 대항전에 나서는 모두에게 똑같은 세 후보예요. 한 판이 들어간 기수 모두의 점수가 돼요.' : '세 후보는 능력치 총합이 같아요. 출신과 분포만 달라요.'} ${p.fixedPot ? `난이도 ${DIFFICULTY[p.fixedPot]} · 세 후보 모두 잠재력 ${p.fixedPot}예요. 선택으로 겨뤄요.` : '잠재력은 졸업할 때 교관 평가서로 확인할 수 있어요.'}</p>
    ${p.cands.map(card).join('')}
    ${fixedWorld(p) ? '' : `<div class="ctools one">
      <button class="ctool" data-act="p-reroll" ${left > 0 ? '' : 'disabled'}><b>${icon('swap', 16)} 후보 다시 뽑기</b><span class="${left > 0 ? 'free' : ''}">${ui.adBusy ? '광고 불러오는 중…' : left > 0 ? `${rewardedOn() ? '광고 보고' : '무료'} · ${left}회 남음` : '이번 판 다 썼어요'}</span></button>
    </div>
    ${rewardedOn() ? '<p class="faint" style="text-align:center;margin-top:8px">짧은 광고를 끝까지 보면 새 후보 3명이 나와요. 광고가 없으면 그냥 다시 뽑아 드려요</p>' : ''}`}
  </div>
  <div class="bar"><button class="btn" data-act="p-cand-go" ${p.pick === null ? 'disabled' : ''}>${p.pick === null ? '후보를 골라 주세요' : `후보 ${p.pick + 1}로 지원하기`}</button></div></div>`;
}

function viewIntro(): string {
  const p = ui.pro!;
  return `
  <div class="page">
    <header class="top"><button class="iconbtn" style="margin:0 0 0 -8px" data-act="go-lobby" aria-label="로비로">${icon('back', 20)}</button></header>
    <div class="pad tight">
    <p class="kicker">입학 원서</p>
    <h1 class="h1">이름을<br>알려 주세요</h1>
    <p class="sub">임관 신고부터 전역 카드까지 이 이름으로 불려요.</p>
    <label class="lbl" for="nm">이름</label>
    <input id="nm" class="inp" maxlength="8" placeholder="실명 대신 닉네임을 추천해요" value="${esc(p.name)}" autocomplete="off">
  </div>
  <div class="bar"><button class="btn" data-act="p-apply">입학 원서 내기</button></div></div>`;
}

// ═════════ 로비 ═════════
const STEPS: [string, number][] = [['임관', 0], ['대위', 2], ['영관', 3], ['대령', 5], ['별', 6]];
function bestLine(i: number): string {
  if (i < 0) return '아직 임관 전이에요';
  if (i <= 1) return '첫 계급장을 달았어요';
  if (i === 2) return '대위 계급장을 달았어요';
  if (i === 3) return '첫 무궁화를 달았어요';
  if (i === 4) return '두 번째 무궁화를 달았어요';
  if (i === 5) return '무궁화 셋, 대령까지 올라갔어요';
  return `별 ${i - 5}개를 달았어요`;
}

/** 로비 아래 버튼: 진행 중인 판이 있을 때만 "이어서 하기" */
function lobbyPrimary(): { act: string; label: string } | null {
  const d = dailyState(), c = groupState(), k = contestState();
  const free = peek('free')?.game;
  if (d.st === 'playing') return { act: 'daily-go', label: `이어서 하기 · 오늘의 기수 · ${d.save!.game.me.rank}` };
  if (k.st === 'playing') return { act: 'contest-go', label: `이어서 하기 · 대항전 · ${k.save!.game.me.rank}` };
  if (c.st === 'playing') return { act: 'grp-continue', label: `이어서 하기 · ${c.save!.game.group!.name}` };
  if (free && !free.ended) return { act: 'continue', label: `이어서 하기 · ${free.me.rank} ${esc(free.me.name)} · ${free.year}년` };
  if (d.st === 'ended') return { act: 'daily-go', label: '오늘의 기수 결과 올리기' };
  if (k.st === 'ended') return { act: 'contest-go', label: '대항전 결과 올리기' };
  if (c.st === 'ended') return { act: 'grp-continue', label: '우리 기수 결과 올리기' };
  return null;
}

type LobbyTab = 'd' | 'c' | 'f';
const TAB_KEY = 'malttuk-lobby-tab';
/** 처음 열 탭: 진행 중인 모드 → 오늘의 기수를 안 했으면 오늘의 기수 → 마지막으로 본 탭 */
function lobbyTab(): LobbyTab {
  if (ui.lobbyTab) return ui.lobbyTab;
  const d = dailyState(), k = contestState();
  const free = peek('free')?.game;
  let t: LobbyTab;
  if (d.st === 'playing' || d.st === 'ended') t = 'd';
  else if (k.st === 'playing' || k.st === 'ended') t = 'c';
  else if (free && !free.ended) t = 'f';
  else if (d.st === 'none') t = 'd';
  else { let saved: string | null = null; try { saved = localStorage.getItem(TAB_KEY); } catch { /* 무시 */ } t = saved === 'f' || saved === 'd' ? saved : 'c'; }
  ui.lobbyTab = t;
  return t;
}

/** 로그인 권유 한 줄 (연결 전에만): 로비 · 전역 화면 */
function loginRow(): string {
  if (loginInfo().linked) return '';
  return `<a class="loginrow" href="#/login"><span class="tx"><b>로그인하고 기록 지키기</b>기기를 바꿔도 호봉 · 기수 · 기록이 이어져요</span><span class="go">구글 · 카카오</span></a>`;
}

/** 로비 맨 위: 내 카드 한 줄 (v3.3 인사기록카드 입구) */
function meCard(best: number): string {
  // 서버 기록이 있으면 최고 계급은 서버 기준
  const prof = load('profile', getProfile);
  const p = prof.state === 'ok' ? prof.data : null;
  const needNick = prof.state === 'ok' && !p && loginInfo().linked;
  const name = p?.nickname ?? (needNick ? '닉네임 정하기 ›' : ui.upload.nick.trim() || '닉네임 없음');
  const mine = myTeamsNow();
  const main = mine?.find((t) => t.cohort_id === p?.main_cohort) ?? mine?.[0];
  const me = myId();
  const st = me && p ? load(`person:stats:${me}`, () => myStatsCached(me).catch(() => null)) : null;
  const hb = st?.state === 'ok' && st.data ? hobongOf(st.data.xp) : null;
  const runs = st?.state === 'ok' && st.data ? st.data.runs : meta.runs ?? 0;
  if (st?.state === 'ok' && st.data) best = Math.max(best, st.data.best_rank);
  const lv = hb ?? { level: 1, into: 0, need: 200 };
  return `<a class="pf" href="${needNick ? '#/login' : '#/p/me'}"><span class="pfrow">${insignia(best < 0 ? '소위' : RANKS[best], 26, false)}<span class="g"><b>${esc(name)}</b>${main ? `<span class="ttag">${teamRibbon(main.cohorts.ribbon, 22, null)}</span>` : ''}<span class="s">${best < 0 ? '아직 임관 전' : `최고 ${RANKS[best]}`} · ${runs}판${main ? ` · ${main.cohorts.no ?? '-'}기 ${esc(main.cohorts.name)}` : ''}</span></span>
    <span class="hbx"><b>${lv.level}<small>호봉</small></b><span>${hb ? `다음까지 ${lv.need - lv.into}` : '첫 판을 올리면 시작'}</span></span></span>
    <span class="xpbar"><i style="width:${Math.round((lv.into / lv.need) * 100)}%"></i></span></a>`;
}

const lrow = (r: RunRow, i: number) => rowHtml(r, i + 1);
function dailyDoc(): string {
  const d = dailyState();
  const day = today();
  const fp = fixedPotential(day);
  const st = load(`rank:daily:${day}:3`, () => dailyRanking(day, 3));
  const cnt = load(`count:${day}`, () => dailyCount(day));
  const n = cnt.state === 'ok' ? cnt.data : null;
  const list = st.state === 'ok' ? (st.data.length ? st.data.slice(0, 3).map(lrow).join('') : '<p class="sub" style="padding:8px 0">오늘 전역한 사람이 아직 없어요. 첫 번째가 되어 보세요!</p>') : st.state === 'error' ? '<p class="sub">순위를 불러오지 못했어요</p>' : '<p class="sub">불러오는 중이에요…</p>';
  const dg = d.save?.game;
  const btn = d.st === 'playing' ? `이어서 하기 · ${dg!.me.rank}` : d.st === 'ended' ? '결과 올리기' : d.st === 'uploaded' ? `오늘 기록 보기 · ${dg!.me.rank}` : '오늘의 기수로 입대하기';
  return `<section class="doc lcard"><div class="hd">
    <div class="dn">일일 명령 · 제${day.slice(0, 4)}-${day.slice(5, 7)}${day.slice(8, 10)}호 · 오늘 24시 마감</div>
    <div class="tt">오늘의 기수<em>${fp ? `난이도 ${DIFFICULTY[fp]}` : '같은 출발선'}</em></div>
    <p class="ds">하루 한 판 · 모두 같은 후보로 출발 · 평일 보통 · 토 쉬움 · 일 어려움</p>
  </div><div class="bd">
    <div class="lk"><span>오늘 순위${n !== null ? ` · ${n}명 전역` : ''}</span><a data-act="route-daily">전체 ›</a></div>
    ${list}
    <button class="btn ${d.st === 'uploaded' ? 'line' : ''}" data-act="daily-go">${btn}</button>
    ${d.st === 'uploaded' ? '<p class="faint" style="text-align:center;margin-top:8px">내일 0시에 새 기수가 열려요</p>' : ''}
  </div></section>`;
}
function freeDoc(live: GameState | null): string {
  const st = load('rank:season2:3', () => seasonRanking(2, null, 3));
  const list = st.state === 'ok' ? (st.data.length ? st.data.slice(0, 3).map(lrow).join('') : '<p class="sub" style="padding:8px 0">시즌 2 기록이 아직 없어요.</p>') : st.state === 'error' ? '<p class="sub">순위를 불러오지 못했어요</p>' : '<p class="sub">불러오는 중이에요…</p>';
  return `<section class="doc lcard"><div class="hd">
    <div class="dn">자유 훈련 · 기록 무제한</div>
    <div class="tt">자유 플레이<em>시즌 2</em></div>
    <p class="ds">몇 판이든 · 후보 다시 뽑기 2회 · 약장 모으기</p>
  </div><div class="bd">
    <div class="lk"><span>명예의 전당 · 시즌 2</span><a data-act="route-rank">전체 ›</a></div>
    ${list}
    <button class="btn line" data-act="${live ? 'continue' : 'start-new'}">${live ? `이어서 하기 · ${live.me.rank} ${esc(live.me.name)}` : '새 인생 시작'}</button>
    <p class="lmore"><a data-act="route-gallery">커리어 갤러리</a><a data-act="route-mine">나의 기록</a></p>
  </div></section>`;
}

function viewLobby(): string {
  const free = peek('free')?.game ?? null;
  const live = free && !free.ended ? free : null;
  const best = Math.max(meta.bestRank ?? -1, live ? rankCount(live.me.rank) : -1);
  const d = dailyState(), k = contestState();
  const tab = lobbyTab();
  const day = today();
  const fp = fixedPotential(day);
  const cnt = load(`count:${day}`, () => dailyCount(day));
  const dg = d.save?.game;
  const dSub = d.st === 'playing' ? `<span class="todo">진행 중</span> · ${dg!.me.rank}` : d.st === 'ended' ? '<span class="todo">결과 올리기</span>' : d.st === 'uploaded' ? `완료 · ${dg!.me.rank}` : `<span class="todo">${fp ? DIFFICULTY[fp] : '오늘'}</span>${cnt.state === 'ok' ? ` · ${cnt.data}명` : ''}`;
  const kg = k.save?.game;
  const cSub = k.st === 'playing' ? `<span class="todo">진행 중</span> · ${kg!.me.rank}` : k.st === 'ended' ? '<span class="todo">결과 올리기</span>' : contestTileSub();
  const fSub = live ? `<span class="todo">진행 중</span> · ${live.me.rank}` : '명예의 전당';
  const tile = (t: LobbyTab, ic: string, kind: string, name: string, sub: string) => `<button class="tile ${tab === t ? 'on' : ''}" data-act="lobby-tab" data-v="${t}"><span class="ic">${icon(ic, 13)} ${kind}</span><b>${name}</b><span class="s">${sub}</span></button>`;
  const play = k.st === 'playing' ? { act: 'contest-go', label: `이어서 하기 · ${kg!.me.rank}` } : k.st === 'ended' ? { act: 'contest-go', label: '결과 올리기' } : k.st === 'uploaded' ? { act: 'contest-go', label: '이번 주 기록 보기' } : { act: 'contest-go', label: '이번 주 출전' };
  const primary = lobbyPrimary();
  return `
  <div class="page">
    <header class="top lobbyhd"><span class="t">말뚝</span><span class="sp"></span>
      <a class="iconbtn" href="#/notice" aria-label="공지">${icon('bell', 20)}${hasNewNotice() ? '<i class="dot"></i>' : ''}</a>
      <button class="iconbtn" data-act="route-rank" aria-label="랭킹">${icon('trophy', 20)}</button>
      <a class="iconbtn" href="#/settings" aria-label="설정">${icon('gear', 20)}</a></header>
    ${guestPreview()}
    <main class="stack" style="padding-bottom:${primary ? 120 : 32}px">
      ${meCard(best)}
      ${loginRow()}
      <div class="tiles">
        ${tile('d', 'calendar', '매일', '오늘의 기수', dSub)}
        ${tile('c', 'people', '매주', '대항전', cSub)}
        ${tile('f', 'swap', '언제나', '자유 플레이', fSub)}
      </div>
      ${tab === 'd' ? dailyDoc() : tab === 'c' ? contestDoc(play) : freeDoc(live)}
      ${hasNewNotice() ? `<a class="newnote" href="#/notice"><span class="nb">NEW</span><span><b>패치노트 v${NOTICES[0].id}</b><span>${NOTICES[0].title}</span></span>${icon('chev')}</a>` : ''}
      <div style="margin:12px 12px 0">${adSlot('lobby')}</div>
      <div style="margin:0 12px">${footer()}</div>
    </main>
    ${primary ? `<div class="bar"><button class="btn" data-act="${primary.act}">${primary.label}</button></div>` : ''}
    ${sheet(free)}
  </div>`;
}

function viewEnvelope(): string {
  const p = ui.pro!;
  const sc = ORIGIN_SCHOOL[p.origin];
  const choose = false;
  return `
  <div class="page"><div class="pad">
    <p class="kicker">합격 통지</p>
    <h1 class="h1">${p.open ? `<span class="olive">${sc.school}</span>에<br>합격했어요` : choose ? '어느 학교로<br>갈까요?' : '합격 통지서가<br>도착했어요'}</h1>
    ${choose ? `
      <div class="pick">${(Object.keys(ORIGIN) as Origin[]).map((o) => `<button class="pk ${p.origin === o && p.chosen ? 'on' : ''}" data-act="p-origin" data-v="${o}"><b>${ORIGIN_SCHOOL[o].school}</b><span>${ORIGIN[o].note}</span></button>`).join('')}</div>
      <p class="faint">첫 판을 마쳐서 학교를 직접 고를 수 있어요</p>` : `
      <div class="notice ${p.open ? 'open' : ''}" data-act="p-open" role="button" aria-label="통지서 확인">
        ${p.open ? '<div class="stamp pop"><b>합격</b></div>' : ''}
        <p class="to">${esc(p.name || '지원자')} 귀하</p>
        <p class="nt">합격 통지서</p>
        <div class="slot">${p.open ? `<p class="school">${sc.school}</p><span>${sc.letter}</span>` : '<b>눌러서 확인하기</b><span>어느 학교에 붙었을까요?</span>'}</div>
      </div>
      ${p.open ? `<div class="doc" style="margin:0"><div class="bd">
        <div class="kv"><span>출신</span><b>${p.origin}</b></div>
        <div class="kv"><span>교육 기간</span><b>${sc.years}</b></div>
        <div class="kv"><span>출신 특성</span><b>${ORIGIN[p.origin].note}</b></div>
      </div></div>` : ''}`}
  </div>
  <div class="bar"><button class="btn" data-act="p-enter" ${p.open || (choose && p.chosen) ? '' : 'disabled'}>${p.open || (choose && p.chosen) ? '입학하기' : choose ? '학교를 골라 주세요' : '통지서를 확인해 주세요'}</button></div></div>`;
}

function viewFocus(): string {
  const p = ui.pro!;
  const ok = p.focus.length === 2;
  return `
  <div class="page"><div class="pad">
    <p class="kicker">${ORIGIN_SCHOOL[p.origin].school} · 생도 시절</p>
    <h1 class="h1">무엇에 가장<br>힘을 쏟을까요?</h1>
    <p class="sub">2개를 골라 주세요. 졸업 석차와 첫 능력치가 달라져요.</p>
    <div class="pick" style="margin-top:14px">${(Object.keys(SCHOOL_FOCUS) as SchoolFocus[]).map((f) => `<button class="pk ${p.focus.includes(f) ? 'on' : ''}" data-act="p-focus" data-v="${f}"><b>${f}</b><span>${SCHOOL_FOCUS[f].desc}</span></button>`).join('')}</div>
    <p class="lbl">희망 병과</p>
    <div class="pick three">${(['전투', '기술', '행정'] as Branch[]).map((b) => `<button class="pk ${p.branch === b ? 'on' : ''}" data-act="p-branch" data-v="${b}"><b>${b}</b><span>${b === '전투' ? '지휘 보직과 궁합' : b === '기술' ? '전문성 보직과 궁합' : '행정력 보직과 궁합'}</span></button>`).join('')}</div>
    <p class="faint">석차가 낮으면 희망 병과가 안 될 수도 있어요</p>
  </div>
  <div class="bar"><button class="btn" data-act="p-study" ${ok ? '' : 'disabled'}>${ok ? '생도 생활 시작' : `${2 - p.focus.length}개 더 골라 주세요`}</button></div></div>`;
}

function viewSchool(): string {
  const p = ui.pro!;
  return `
  <div class="page"><div class="pad" style="padding-top:60px">
    <p class="kicker">${ORIGIN_SCHOOL[p.origin].school}</p>
    <h1 class="h1" id="smsg">${SCHOOL_MOMENTS[p.origin][0]}</h1>
    <div class="gauge"><div id="sbar"></div></div>
    <p class="sub" id="sstep">${p.focus.join(' · ')}에 힘쓰는 중</p>
  </div>
  <div class="bar"><button class="btn quiet" data-act="p-skip">건너뛰기</button></div></div>`;
}

function prologueGraduate() {
  const p = ui.pro!;
  p.grad = graduate({ focus: [p.focus[0], p.focus[1]], branchWish: p.branch, potential: p.potential, seed: p.seed });
}

function viewGrad(): string {
  const p = ui.pro!;
  const g = p.grad!;
  const bonus = STAT_KEYS.filter((k) => g.bonus[k]).map((k) => `<span class="chip ${g.bonus[k]! < 0 ? 'red' : ''}">${STAT_LABEL[k]} ${sgn(g.bonus[k]!)}</span>`).join('');
  const rivalName = previewRivalName();
  return `
  <div class="page"><div class="pad tight">
    <div class="paper">
      <div class="phead"><div><p class="title">졸업 성적표</p>
      <p class="no">${ORIGIN_SCHOOL[p.origin].school} · ${esc(p.name)}</p></div><div class="stamp ${g.pct <= 10 ? 'olive' : ''} pop"><b>${g.pct <= 1 ? '수석' : g.pct <= 10 ? '우등' : '졸업'}</b><i>2027</i></div></div>
      <div class="meta">
        <div class="kv"><span>졸업 석차</span><b>상위 ${g.pct}%</b></div>
        <div class="kv"><span>평가</span><b>${g.label}</b></div>
        <div class="kv"><span>병과 배정</span><b>${g.branch}${g.branchGranted ? ' <span class="chip">희망 반영</span>' : ' <span class="chip amber">희망과 다름</span>'}</b></div>
      </div>
      <p class="faint">생도 시절에 오른 능력치</p>
      <div class="chips" style="margin-top:6px">${bonus}</div>
      ${g.title ? `<div class="record">${icon('star', 16)} 칭호 '${g.title}'을 얻었어요</div>` : ''}
    </div>
    <p class="sec">라이벌</p>
    <div class="rival"><div class="vs">VS</div><div><b>${esc(rivalName.name)}</b><p class="sub small">${rivalName.line} · 석차가 가장 비슷했던 동기예요</p></div></div>
    <p class="sec">교관 평가서</p>
    ${p.fixedPot ? `<div class="doc" style="margin:0"><div class="bd"><div class="kv"><span>잠재력</span><b class="olive">${p.fixedPot}등급</b></div><p class="faint" style="margin-top:8px">난이도 ${DIFFICULTY[p.fixedPot]} · 이번 기수 동기는 모두 잠재력 ${p.fixedPot}예요. 순위는 선택으로 갈려요.</p></div></div>`
      : p.range ? `<div class="doc" style="margin:0"><div class="bd"><div class="kv"><span>잠재력 범위</span><b class="olive">${p.range}</b></div><p class="faint" style="margin-top:8px">범위는 진짜 등급을 반드시 포함해요. 범위를 봐도 잠재력은 바뀌지 않아요.</p></div></div>`
      : `<button class="row" data-act="p-view"><div class="mark gray">${icon('file')}</div><div class="g"><b>교관 평가서 열어 보기</b><span>${ui.adBusy ? '광고 불러오는 중…' : `잠재력 범위를 확인해요 · ${rewardedOn() ? '광고 보고' : '무료'} 1회`}</span></div>${icon('chev')}</button>`}
  </div>
  <div class="bar"><button class="btn" data-act="p-commission">임관하기</button></div></div>`;
}

function previewRivalName(): { name: string; line: string } {
  const g = startGame(true);
  const r = rivalOf(g);
  return { name: `${r.name} (${r.origin})`, line: PERSONALITY[r.personality].line };
}

function pathFromFocus(f: SchoolFocus[]): Path {
  const field = f.filter((x) => x === '리더십' || x === '체력').length;
  return field === 2 ? '지휘관형' : field === 0 ? '참모형' : '균형형';
}

function startGame(preview = false): GameState {
  const p = ui.pro!;
  const g = p.grad!;
  const name = p.name.trim() || '김OO';
  const bonus: Partial<Stats> = { ...g.bonus };
  for (const [k, v] of Object.entries(p.spread)) bonus[k as StatKey] = (bonus[k as StatKey] ?? 0) + v!;
  return newGame({ name, origin: p.origin, branch: g.branch, path: pathFromFocus(p.focus), potential: p.potential, seed: p.seed, schoolPct: g.pct, bonus, year: preview ? 2027 : undefined, creation: { rerolls: p.rerolls, viewed: p.viewed }, world: fixedWorld(p) ? { mode: p.daily ? 'daily' : p.week ? 'contest' : 'cohort', day: p.daily, week: p.week, group: p.group ? { id: p.group.id, code: p.group.code, name: p.group.name } : undefined, rollSeed: preview ? 1 : Math.floor(Math.random() * 1e9) } : undefined });
}

function viewCommission(): string {
  const g = save!.game;
  const me = g.me;
  const speech = `충성! 신고합니다. 소위 ${me.name}${hasJong(me.name) ? '은' : '는'} ${g.year}년 3월 1일부로 소위 임관을 명받았기에 이에 신고합니다. 충성!`;
  return `
  <div class="page"><div class="pad center">
    <p class="kicker">${g.year}년 3월 · 임관식</p>
    <div class="stage"><div class="glow"></div><div class="new">${insignia('소위', 104)}</div></div>
    <h1 class="h1 rise d1">대한민국 육군<br><span class="olive">소위</span> ${esc(me.name)}</h1>
    <div class="speech rise d2"><p class="faint">임관 신고</p><p>${esc(speech)}</p></div>
    <p class="flavor rise d3">${me.origin} 출신 · ${me.branch} 병과 · 졸업 석차 상위 ${me.schoolPct}%</p>
  </div>
  <div class="bar"><button class="btn" data-act="p-done">첫 부대로</button></div></div>`;
}

// ═════════ 본편 ═════════
function serviceCard(g: GameState): string {
  const me = g.me;
  const a = asg(me.assignmentId);
  const t = currentTitle();
  const rib = earnedRibbons(g);
  const su = g.history.filter((h) => h.grade === '탁월').length;
  const active = g.cohort.filter((o) => o.active).length + 1;
  const pos = [me, ...g.cohort].filter((o) => o.active).sort((x, y) => rankCount(y.rank) - rankCount(x.rank) || overall(y.stats, y.path) - overall(x.stats, x.path)).indexOf(me) + 1;
  return `
  <section class="doc">
    <div class="hd"><span>복무 카드</span><em>${me.origin} · ${me.branch} · 복무 ${careerYear(g)}년차</em></div>
    <div class="bd">
      <div class="svc">
        <div class="badge">${insignia(me.rank, 78)}</div>
        <div class="who">
          ${isDaily(g) ? `<span class="chip amber">오늘의 기수 · ${dayLabel(g.day!)}</span> ` : isGroup(g) ? `<span class="chip amber">우리 기수 · ${esc(g.group!.name)}</span> ` : isContest(g) ? `<span class="chip amber">대항전 · 제${weekNo(g.week!)}주</span> ` : ''}${t ? `<span class="chip on">${esc(t)}</span>` : ''}
          <p class="nm">${me.rank} ${esc(me.name)}</p>
          <p class="sub">${a.name} <span class="chip gray">${a.kind}</span></p>
          <p class="faint" style="margin-top:4px">${me.age}세 · 종합 능력치 ${overall(me.stats, me.path)}</p>
        </div>
      </div>
      <div class="rackrow">${rib.length ? ribbonRack(rib, 30) : '<span class="faint">아직 단 약장이 없어요</span>'}</div>
      <div class="nums">
        <div><p class="faint">평정 '탁월'</p><b>${su}회</b></div>
        <div><p class="faint">동기 중</p><b>${pos}위</b></div>
        <div><p class="faint">현역 동기</p><b>${active}명</b></div>
      </div>
    </div>
  </section>`;
}

function deskBlock(g: GameState): string {
  if (!g.desk) return '';
  const r0 = g.desk.results[0];
  const it0 = g.desk.items[0];
  const def0 = CHOICE_BY_ID[it0.defId];
  const t0 = deskText(it0.defId, it0.v);
  const body = r0
    ? `<div class="done"><div class="mark ${r0.success ? '' : 'red'}">${icon('pen')}</div><div class="g"><b>${r0.title}</b><span>${r0.label} · ${r0.success ? '성공' : '실패'} · ${esc(r0.outcome.text)}</span></div></div>`
    : `<button class="pending" data-act="open-desk" data-v="0"><div class="g"><span class="chip">${def0.type}</span><b>${t0.title}</b></div>${icon('chev')}</button>`;
  return `
  <section class="doc">
    <div class="hd"><span>결재함</span><em>${r0 ? '처리 완료' : '대기 1건'}</em></div>
    <div class="bd">${body}<p class="faint" style="margin-top:10px">${g.desk.items.length > 1 ? '7월에 결재가 한 건 더 올라와요' : ''}</p></div>
  </section>`;
}

// ── 터닝포인트: 집중 육성을 바꿀 때를 알려 준다 ──
interface TurningPoint { key: string; title: string; body: string; rec: [StatKey, StatKey] }
function turningPoint(g: GameState): TurningPoint | null {
  if (!g.desk || g.history.length === 0) return null;
  const me = g.me;
  const a = asg(me.assignmentId);
  const focus = save!.focus;
  const seen = save!.tpSeen ?? [];
  const gap = (k: StatKey) => me.stats[k] - RANK_BASELINE[me.rank];
  const lows = [...STAT_KEYS].sort((x, y) => gap(x) - gap(y));
  const offBillet = lows.filter((k) => !a.grows.includes(k));
  const recFor = (first?: StatKey): [StatKey, StatKey] => {
    const pool = offBillet.filter((k) => k !== first);
    return first ? [first, pool[0]] : [pool[0], pool[1]];
  };
  const cands: TurningPoint[] = [];
  if (me.yearsInRank === 0 && me.rank !== '소위') cands.push({ key: `promo:${me.rank}`, title: `${me.rank} 진급, 군 생활의 터닝포인트`, body: `계급이 오르면 심사 기준도 달라져요. 가장 약한 ${STAT_LABEL[lows[0]]}부터 채우면 역량 균형 점수가 올라요.`, rec: recFor() });
  if (me.yearsInAssignment === 0 && isRequired(me, a.id)) cands.push({ key: `post:${g.year}:${a.id}`, title: `새 보직 ${a.name}, 집중 육성을 바꿀 때예요`, body: `${STAT_LABEL[a.grows[0]]}·${STAT_LABEL[a.grows[1]]}는 보직에서 저절로 자라요. 집중 육성은 부족한 쪽에 두면 고르게 커요.`, rec: recFor() });
  if (me.age >= 35 && !focus.includes('fitness')) cands.push({ key: 'age35', title: '체력이 떨어지기 시작하는 나이예요', body: '35세부터는 집중하지 않으면 체력이 해마다 조금씩 줄어요.', rec: recFor('fitness') });
  if (gap(lows[0]) <= -12) cands.push({ key: `bal:${me.rank}`, title: '역량 균형 경고', body: `${STAT_LABEL[lows[0]]}이(가) ${me.rank} 평균보다 ${-Math.round(gap(lows[0]))} 낮아요. 진급 점수의 15%가 균형에서 나와요.`.replace('이(가)', hasJong(STAT_LABEL[lows[0]]) ? '이' : '가'), rec: recFor(lows[0]) });
  if (save!.tpLast !== undefined && g.year - save!.tpLast < 4) return null;
  const tp = cands.find((c) => !seen.includes(c.key));
  if (!tp) return null;
  if (tp.rec[0] === tp.rec[1] || (focus.includes(tp.rec[0]) && focus.includes(tp.rec[1]))) return null;
  return tp;
}

function tpCard(g: GameState): string {
  const tp = turningPoint(g);
  if (!tp) return '';
  return `
  <section class="tp" data-key="${tp.key}">
    <div class="tp-top"><span class="tp-badge">${icon('target', 14)} 터닝포인트</span></div>
    <b>${tp.title}</b>
    <p>${tp.body}</p>
    <p class="tp-rec">추천 집중 육성 · <b>${STAT_LABEL[tp.rec[0]]}, ${STAT_LABEL[tp.rec[1]]}</b></p>
    <div class="two"><button class="btn quiet" style="height:48px" data-act="tp-dismiss" data-v="${tp.key}">지금은 괜찮아요</button><button class="btn" style="height:48px" data-act="tp-open" data-v="${tp.key}" data-r="${tp.rec.join(',')}">집중 육성 바꾸기</button></div>
  </section>`;
}

function viewHome(g: GameState): string {
  const me = g.me;
  const up = upcoming(g);
  const a = asg(me.assignmentId);
  const focus = save!.focus;
  const rival = rivalOf(g);
  const row = (act: string, mk: string, cls: string, title: string, sub: string) =>
    `<button class="row" data-act="${act}"><div class="mark ${cls}">${icon(mk)}</div><div class="g"><b>${title}</b><span>${sub}</span></div>${act === 'noop' ? '' : icon('chev')}</button>`;
  const plan: string[] = [];
  if (up.promotion) plan.push(row('noop', 'up', 'amber', `${up.promotion.to} 진급 심사`, `${up.promotion.attempt}차 · 기회 ${up.promotion.tries}번 중`));
  if (up.longService) plan.push(row('noop', 'shield', 'amber', '장기복무 선발', up.longService === 2 ? '마지막 기회예요' : '지금까지의 평정 평균이 반영돼요'));
  if (up.education) plan.push(row('noop', 'book', 'gray', `${up.education} 입교`, '전문성이 석차를 좌우해요'));
  if (up.reassign) plan.push(row('noop', 'swap', 'gray', '정기 인사', '연말에 희망 조사가 있어요'));
  if (lacksRequired(me)) plan.push(row('noop', 'alert', 'amber', `필수 보직: ${REQUIRED_BILLET[me.rank]!.label}`, '거치지 않으면 다음 진급 심사를 받을 수 없어요'));
  const diff = rankCount(rival.rank) - rankCount(me.rank);
  const rivalState = !rival.active ? '전역했어요' : diff > 0 ? `나보다 ${diff}계급 위` : diff < 0 ? `나보다 ${-diff}계급 아래` : '나와 같은 계급';
  const risk = me.hidden.risk;
  const ready = !g.desk || g.desk.results[0];
  return `
  ${serviceCard(g)}
  ${tpCard(g)}
  ${deskBlock(g)}
  ${plan.length ? `<section class="doc"><div class="hd"><span>올해 일정</span></div><div class="bd" style="padding-top:4px;padding-bottom:4px">${plan.join('')}</div></section>` : ''}
  <section class="doc">
    <div class="hd"><span>라이벌</span><em>${rivalState}</em></div>
    <div class="bd"><div class="svc">
      <div class="rk">${insignia(rival.rank, 26, false)}<span>${rival.rank}</span></div>
      <div class="who"><b>${esc(rival.name)}</b> <span class="faint">${rival.origin}</span><p class="sub small">${rival.active ? asg(rival.assignmentId).name : esc(rival.exitReason ?? '전역')} · ${PERSONALITY[rival.personality].line}</p></div>
    </div></div>
  </section>
  <section class="doc">
    <div class="hd"><span>현재 보직</span><em>임기 2년 중 ${me.yearsInAssignment + 1}년차</em></div>
    <div class="bd">
      <div class="kv"><span>보직</span><b>${a.name} <span class="chip gray">${a.kind}</span></b></div>
      <div class="kv"><span>잘 오르는 능력치</span><b>${STAT_LABEL[a.grows[0]]}, ${STAT_LABEL[a.grows[1]]}</b></div>
      <div class="kv"><span>경력 가치</span><b>${a.kind === '지휘' || a.kind === '요직' ? '<span class="olive">핵심 경력</span>' : '보조 경력'}</b></div>
      <div class="kv"><span>병과 궁합</span><b>${branchFits(me.branch, a) ? '<span class="olive">잘 맞아요 · 성장 +20%</span>' : '보통'}</b></div>
      ${me.policy ? `<div class="kv"><span>지휘 방침</span><b>${me.policy}</b></div>` : ''}
      ${me.term ? `<div class="kv"><span>부대 · 상관</span><b>${UNITS[me.term.unit].short} · ${BOSSES[me.term.boss].name}</b></div>
      <div class="kv"><span>임기 목표</span><b>${goalOf(me.term).text} ${me.term.done === true ? '<span class="chip on">달성</span>' : me.term.done === false ? '<span class="chip gray">미달</span>' : ''}</b></div>` : ''}
    </div>
    <div style="border-top:1px solid var(--line);padding:0 14px">
      ${row('open-focus', 'target', '', '집중 육성', `${STAT_LABEL[focus[0]]}, ${STAT_LABEL[focus[1]]}`)}
      ${risk > 0 ? row('noop', 'alert', 'amber', `마음에 걸리는 일 ${risk}건`, risk >= 2 ? '언젠가 감사에서 드러날 수 있어요' : '아직은 괜찮아요') : ''}
    </div>
  </section>
  <button class="link" data-act="open-retire">전역 지원서 내기</button>
  <div class="bar withtabs"><button class="btn" data-act="next-year" ${ready ? '' : 'disabled'}>${ready ? `${g.year}년 보내기` : '결재함을 먼저 처리해 주세요'}</button></div>`;
}

const STAT_DESC: Record<StatKey, string> = {
  command: '지휘 보직 성과, 부대 사건 예방, 표창',
  tactics: '야전 보직 성과, 훈련 결재, 대위→소령 전투 점수',
  admin: '참모·요직 성과, 보고·감사 결재',
  expertise: '군사교육 석차, 기획 결재',
  fitness: '체력검정 (35세부터 조금씩 떨어져요)',
  social: '소통 결재, 인사 배정, 표창',
};

function viewRecord(g: GameState): string {
  const me = g.me;
  const pr = PROMOTION[me.rank];
  const b = promotionBreakdown(me);
  return `
  ${serviceCard(g)}
  <section class="doc">
    <div class="hd"><span>능력치</span><em>${me.path} 기준 종합 ${overall(me.stats, me.path)}</em></div>
    <div class="bd">
      ${STAT_KEYS.map((k) => `<div class="stat"><div class="kv"><span>${STAT_LABEL[k]}</span><b>${me.stats[k]}</b></div><div class="track"><div style="width:${me.stats[k]}%"></div></div><p class="faint" style="margin-top:4px">${STAT_DESC[k]}</p></div>`).join('')}
    </div>
  </section>
  <section class="doc">
    <div class="hd"><span>경험 태그</span><em>결재 확률 +8 · 인사 +5</em></div>
    <div class="bd">${me.tags.length ? `<div class="chips">${me.tags.map((t) => `<span class="chip">#${t}</span>`).join('')}</div>` : '<p class="sub">결재에서 성공하면 태그가 쌓여요</p>'}</div>
  </section>
  ${pr ? `<section class="doc">
    <div class="hd"><span>지금 심사를 받는다면</span><em>${RANKS[rankCount(me.rank) + 1]} 진급</em></div>
    <div class="bd">
      ${REQUIRED_BILLET[me.rank] ? `<div class="kv" style="margin-bottom:14px"><span>필수 보직</span><b>${REQUIRED_BILLET[me.rank]!.label} ${lacksRequired(me) ? '<span class="chip red">아직 안 함</span>' : '<span class="chip on">완료</span>'}</b></div>` : ''}
      ${([['평정', pr.weights.eval, b.eval, '현재 계급 최근 4년 평균'], ['경력', pr.weights.career, b.career, `55 + 핵심 ${me.rankLog.core ? 25 : 0} + 보조 ${Math.min(2, me.rankLog.support.length) * 10}${me.origin === '육사' ? ' + 출신 3' : ''}`], ['교육', pr.weights.edu, b.edu, '최근 군사교육 석차'], ['전투', pr.weights.combat, b.combat, '작전·전술'], ['균형', pr.weights.balance, b.balance, `가장 낮은 두 능력치(${weakestStats(me)})`]] as [string, number, number, string][])
        .filter((x) => x[1] > 0).map(([l, w, v, d]) => `<div class="stat"><div class="kv"><span>${l} <span class="faint">${Math.round(w * 100)}%</span></span><b>${Math.round(v)}</b></div><div class="track light"><div style="width:${v}%"></div></div><p class="faint" style="margin-top:4px">${d}</p></div>`).join('')}
    </div>
  </section>` : ''}
  ${save!.potentialSeen ? `<section class="doc"><div class="hd"><span>교관 평가서</span><em>임관 당시</em></div><div class="bd"><div class="kv"><span>잠재력${save!.potentialSeen.includes('~') ? ' 범위' : ''}</span><b class="olive">${save!.potentialSeen}${save!.potentialSeen.includes('~') ? '' : '등급'}</b></div></div></section>` : ''}
  <section class="doc">
    <div class="hd"><span>규칙 한눈에</span></div>
    <div class="bd"><p class="body">1년 성장은 숨은 <b>잠재력</b>과 <b>나이</b>로 정해지고, 절반은 보직 능력치·절반은 집중 육성으로 가요. <b>결재</b> 결과는 나이와 상관없이 바로 더해져요. 진급은 <b>평정·경력·교육·역량 균형</b>을 동기와 비교해 정원만큼 선발해요. 대위는 <b>중대장</b>, 중령은 <b>대대장</b>, 대령은 <b>연대장이나 본부 과장</b>을 거쳐야 심사를 받을 수 있어요. 능력치는 80을 넘으면 덜 올라요.</p></div>
  </section>`;
}

function viewCohort(g: GameState): string {
  const all = [g.me, ...g.cohort].sort((a, b) => Number(b.active) - Number(a.active) || rankCount(b.rank) - rankCount(a.rank));
  return `
  <section class="doc">
    <div class="hd"><span>동기 ${all.length}명</span><em>현역 ${all.filter((o) => o.active).length}명</em></div>
    <div class="bd" style="padding-top:2px;padding-bottom:2px">
      ${all.map((o) => `
        <div class="mate ${o.id === 'me' ? 'me' : ''} ${o.active ? '' : 'off'}">
          <div class="rk">${insignia(o.rank, 18, false)}<span>${o.rank}</span></div>
          <div class="g"><b>${esc(o.name)} ${o.id === 'me' ? '<span class="chip on">나</span>' : o.id === g.rivalId ? '<span class="chip red">라이벌</span>' : ''}</b><span>${o.origin} · ${o.active ? asg(o.assignmentId).name : esc(o.exitReason ?? '전역')}${o.id !== 'me' ? ` · ${o.personality}` : ''}</span></div>
        </div>`).join('')}
    </div>
  </section>`;
}

function viewDex(g: GameState | null): string {
  const now = g ? earnedRibbons(g) : [];
  const cells = RIBBONS.map((r) => {
    const cur = now.find((e) => e.id === r.id);
    const past = meta.ribbons[r.id] ?? [];
    const tierIndex = cur ? cur.tierIndex : past.length ? Math.max(...past) : 0;
    const e: Earned = { id: r.id, name: r.name, tier: r.tiers?.[tierIndex], tierIndex, design: r.design };
    const got = !!cur || past.length > 0;
    return `<div class="${got ? '' : 'off'}">${ribbonSvg(e, 54, !got)}<b>${r.name}${got && r.tiers ? ` ${r.tiers[tierIndex]}` : ''}</b><span>${r.cond}</span>${cur ? '<span class="chip" style="align-self:flex-start">이번 복무</span>' : past.length ? '<span class="chip gray" style="align-self:flex-start">이전 복무</span>' : ''}</div>`;
  }).join('');
  const titles = TITLES.map((t) => {
    const has = meta.titles.includes(t.id) || (g ? earnedTitles(g).includes(t.id) : false);
    const on = meta.equipped === t.id;
    return `<button class="row" data-act="${has ? 'equip' : 'noop'}" data-v="${t.id}" ${has ? '' : 'disabled'}><div class="mark ${has ? '' : 'gray'}">${icon('star')}</div><div class="g"><b>${has ? t.name : '???'}</b><span>${t.cond}</span></div>${on ? '<span class="chip">장착 중</span>' : has && meta.titles.includes(t.id) ? '<span class="faint">장착</span>' : has ? '<span class="faint">전역 후 장착</span>' : ''}</button>`;
  }).join('');
  const hist = g && g.history.length ? [...g.history].reverse().map((h) => `<div class="line-item ${h.grade === '탁월' || h.grade === '우수' ? 'good' : h.grade === '미흡' ? 'bad' : ''}"><div class="tick"></div><div class="g"><b>${h.year} · ${h.rank} ${h.assignment}</b><span>${h.events.filter((e) => e.kind !== 'work').map((e) => e.title).slice(0, 3).join(' · ') || '평범한 한 해'}</span></div><em>${h.grade}</em></div>`).join('') : '';
  return `
  <section class="doc"><div class="hd"><span>약장 도감</span><em>${RIBBONS.filter((r) => (meta.ribbons[r.id] ?? []).length || now.some((e) => e.id === r.id)).length} / ${RIBBONS.length}</em></div><div class="bd"><div class="dex">${cells}</div><p class="faint" style="margin-top:10px">약장은 판을 넘어 쌓여요. 이름은 모두 게임 전용이에요.</p></div></section>
  <section class="doc"><div class="hd"><span>칭호</span><em>복무 카드에 달려요</em></div><div class="bd" style="padding-top:2px;padding-bottom:2px">${titles}</div></section>
  ${hist ? `<section class="doc"><div class="hd"><span>연도별 기록</span></div><div class="bd" style="padding-top:2px;padding-bottom:2px">${hist}</div></section>` : ''}`;
}

function shell(g: GameState, inner: string): string {
  const nav = (t: Tab, ic: string, label: string) => `<button class="nav ${ui.tab === t ? 'on' : ''}" data-act="tab" data-v="${t}">${icon(ic, 20)}<span>${label}</span></button>`;
  return `
  <div class="page">
    <header class="top"><span class="t">말뚝</span><span class="yr">${g.year}년</span><span class="sp"></span><button class="iconbtn" data-act="go-lobby" aria-label="로비">${icon('home', 20)}</button><button class="iconbtn" data-act="open-reset" aria-label="설정">${icon('gear', 20)}</button></header>
    <main class="stack">${inner}</main>
    <nav class="tabbar">${nav('home', 'home', '복무')}${nav('record', 'file', '인사기록')}${nav('cohort', 'people', '동기')}${nav('dex', 'ribbon', '약장')}</nav>
    ${sheet(g)}
  </div>`;
}

function sheet(g: GameState | null): string {
  if (!ui.sheet) return '';
  let body = '';
  if (ui.sheet === 'focus' && g) {
    const ok = ui.draftFocus.length === 2;
    const rec: StatKey[] = ui.tp?.rec ?? [];
    body = `<h3 class="h2">집중 육성할 능력치 2개</h3><p class="sub">${ui.tp ? '터닝포인트 추천을 미리 골라 뒀어요. 바꿔도 돼요.' : '올해 기본 성장의 절반이 여기로 가요.'}</p>
      <div class="pick">${STAT_KEYS.map((k) => `<button class="pk ${ui.draftFocus.includes(k) ? 'on' : ''}" data-act="toggle-focus" data-v="${k}"><b>${STAT_LABEL[k]}${rec.includes(k) ? ' <span class="chip on" style="margin-left:4px">추천</span>' : ''}</b><span>${g.me.stats[k]} · ${g.me.rank} 평균 ${RANK_BASELINE[g.me.rank]}</span></button>`).join('')}</div>
      <button class="btn" data-act="confirm-focus" ${ok ? '' : 'disabled'}>${ok ? '이걸로 할게요' : `${2 - ui.draftFocus.length}개 더 골라 주세요`}</button>`;
  } else if (ui.sheet === 'retire' && g) {
    body = `<h3 class="h2">전역 지원서를 낼까요?</h3><p class="sub">${g.me.rank} 계급으로 군 생활을 마무리해요. 되돌릴 수 없어요.</p>
      <div class="two"><button class="btn quiet" data-act="close-sheet">더 해볼게요</button><button class="btn" data-act="confirm-retire">전역하기</button></div>`;
  } else if (ui.sheet === 'reset' && isFixed(g)) {
    body = `<h3 class="h2">${isDaily(g) ? '오늘의 기수는' : isContest(g) ? '대항전 판은' : '우리 기수 판은'} 다시 시작할 수 없어요</h3><p class="sub">${isDaily(g) ? '하루 한 번' : isContest(g) ? '한 주에 한 번' : '한 사람당 한 번'}, 첫 판만 기록돼요. 그만두려면 복무 화면 아래 '전역 지원서 내기'로 전역해 주세요. 자유 플레이는 로비에서 따로 할 수 있어요.</p>
      <button class="btn" data-act="close-sheet">알겠어요</button>`;
  } else if (ui.sheet === 'reset') {
    body = `<h3 class="h2">처음부터 다시 할까요?</h3><p class="sub">진행 중인 군 생활이 지워져요. 약장 도감과 칭호는 남아요.</p>
      <div class="two"><button class="btn quiet" data-act="close-sheet">취소</button><button class="btn danger" data-act="confirm-reset">새로 시작</button></div>`;
  } else if (ui.sheet === 'ad') {
    const ready = ui.ad.left <= 0;
    body = `<h3 class="h2">${ui.ad.kind === 'eval' ? '교관 평가서' : '다른 학교로 다시 지원'}</h3>
      <p class="sub">${ui.ad.kind === 'eval' ? '광고를 보면 숨겨진 잠재력을 확인할 수 있어요.' : '광고를 보면 다른 학교 합격 통지서를 다시 받아요. 생도 시절은 처음부터 다시 해요.'}</p>
      <div class="adbox"><span class="faint">광고 자리 (프로토타입)</span><b id="adleft">${ready ? '✓' : ui.ad.left}</b><span class="faint">${ready ? '시청 완료' : '초 남음'}</span></div>
      <div class="two"><button class="btn quiet" data-act="close-sheet">닫기</button><button class="btn" id="adok" data-act="ad-reward" ${ready ? '' : 'disabled'}>보상 받기</button></div>`;
  }
  return `<div class="dim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true">${body}</div>`;
}

// ── 결재 문서 ──
function viewDesk(g: GameState): string {
  const slot = ui.desk.slot;
  const item = g.desk!.items[slot];
  const def = CHOICE_BY_ID[item.defId];
  const res = g.desk!.results[slot];
  const stampCell = res ? (res.success ? '결재' : '반려') : '';
  const header = `
    <div class="approve"><table><tr><td>담당</td><td>검토</td><td>결재</td></tr><tr><td>${res ? '✓' : ''}</td><td>${res ? '✓' : ''}</td><td>${stampCell}</td></tr></table></div>`;
  if (res) return viewDeskResult(g, res, header);
  return `
  <div class="page"><div class="pad tight">
    <p class="kicker">${slot === 0 ? '상반기 결재' : '7월 결재'} · ${def.type}${def.major ? ' · 중대 사건' : ''}</p>
    ${header}
    <h1 class="h1" style="margin-top:0">${deskText(item.defId, item.v).title}</h1>
    <p class="body">${deskText(item.defId, item.v).body}</p>
    ${def.major ? '<p class="faint" style="margin-top:8px">· 커리어에 오래 남는 사건이에요</p>' : ''}
    ${pityBonus(g.me) ? `<p class="pity">연속 실패 보정 · 이번 결재는 성공 판정에 +${pityBonus(g.me)}%p가 몰래 더해져요</p>` : ''}
    <div style="margin-top:14px">
      ${def.options.map((o) => {
        const { p, parts } = optionOdds(g.me, o);
        const on = ui.desk.pick === o.key;
        const tier = rewardTier(p, o.sure);
        const win = scaledOutcome(o.success, tier.mult);
        const why = parts.map((x) => (x.label === '기본' ? `기본 ${x.value}%` : `${x.label} ${sgn(x.value).replace('-', '−')}%p`)).join(' · ');
        return `<button class="opt ${on ? 'on' : ''}" data-act="desk-pick" data-v="${o.key}">
          <div class="top2"><span class="chip">${o.style}</span><b>${o.label}</b>${tier.label ? `<span class="tierb ${tier.mult > 1 ? 'hot' : ''}">${tier.mult > 1 ? `${tier.label} ×${tier.mult}` : tier.label}</span>` : ''}<span class="pct">${o.sure ? '확정' : `${p}%`}</span></div>
          <p class="d">${o.desc}</p>
          <div class="outc"><span class="ol">${o.sure ? '결과' : '성공하면'}</span><div class="chips">${outcomeChips(win) || '<span class="chip gray">변화 없음</span>'}</div></div>
          ${o.sure ? '' : `<div class="outc"><span class="ol bad">실패하면</span><div class="chips">${outcomeChips(o.fail) || '<span class="chip gray">변화 없음</span>'}</div></div>`}
          ${why ? `<p class="why">확률 근거 · ${why}</p>` : ''}
        </button>`;
      }).join('')}
    </div>
  </div>
  <div class="bar"><button class="btn" data-act="desk-sign" ${ui.desk.pick ? '' : 'disabled'}>${ui.desk.pick ? '이대로 결재하기' : '선택지를 골라 주세요'}</button></div></div>`;
}

function outcomeChips(o: Outcome): string {
  const out: string[] = [];
  if (o.eval) out.push(`<span class="chip ${o.eval < 0 ? 'red' : ''}">평정 ${sgn(o.eval).replace('-', '−')}</span>`);
  for (const [k, v] of Object.entries(o.stats ?? {})) out.push(`<span class="chip ${v! < 0 ? 'red' : ''}">${STAT_LABEL[k as StatKey]} ${sgn(v!).replace('-', '−')}</span>`);
  if (o.gainTag) out.push(`<span class="chip">#${o.gainTag} 태그</span>`);
  if (o.award) out.push(`<span class="chip">${o.award}</span>`);
  if (o.fitnessTop) out.push('<span class="chip">체력 특급</span>');
  if (o.chain) out.push('<span class="chip line">2년 뒤 후속 이야기</span>');
  if (o.risk && o.risk > 0) out.push('<span class="chip amber">마음에 걸리는 일 +1</span>');
  if (o.risk && o.risk < 0) out.push('<span class="chip">마음에 걸리는 일 −1</span>');
  return out.join('');
}
const effectChips = (r: DeskResult) => outcomeChips(r.outcome);

/** 실패 이유: 가장 크게 깎인 근거를 짚고, 다음 보정을 알려준다 */
function failReason(g: GameState, r: DeskResult): string {
  const low = (r.parts ?? []).filter((x) => x.label.startsWith('내 ') && x.value < 0).sort((a, b) => a.value - b.value)[0];
  const next = pityBonus(g.me);
  const stat = low ? low.label.replace(/^내 /, '').replace(/ \d+ \(.*\)$/, '') : '';
  const why = low
    ? `${stat}${hasJong(stat) ? '이' : '가'} ${g.me.rank} 평균보다 ${-low.value} 낮아서 확률이 ${r.odds}%였어요. ${stat}${hasJong(stat) ? '을' : '를'} 키우면 확률이 올라가요.`
    : `확률 ${r.odds}%였는데 운이 따르지 않았어요.`;
  return `왜 실패했나요 · ${why}${next ? ` 다음 결재는 성공 판정에 +${next}%p 보정이 붙어요.` : ''}`;
}

function viewDeskResult(g: GameState, r: DeskResult, header: string): string {
  const sure = r.odds >= 100;
  return `
  <div class="page"><div class="pad tight">
    <p class="kicker">결재 결과</p>
    ${header}
    <div class="paper" style="margin-top:4px">
      <div class="stamp sm ${r.success ? 'olive' : ''} pop" style="position:absolute;right:16px;top:16px"><b>${sure ? '처리' : r.success ? '성공' : '실패'}</b><i>${sure ? '' : `${r.odds}%`}</i></div>
      <p class="faint">${r.title}</p>
      <p class="h2" style="margin-top:6px;padding-right:84px">${r.label}</p>
      <p class="body" style="margin-top:10px">${esc(r.outcome.text)}</p>
      <div class="effects">${effectChips(r) || '<span class="chip gray">변화 없음</span>'}</div>
      ${!sure && r.success && (r.mult ?? 1) > 1 ? `<p class="resnote hot">${(r.mult ?? 1) >= 2 ? '대박 성공' : '도전 성공'} · 확률 ${r.odds}%를 뚫어서 보상이 ×${r.mult}로 커졌어요</p>` : ''}
      ${!sure && !r.success ? `<p class="resnote">${failReason(g, r)}</p>` : ''}
    </div>
  </div>
  <div class="bar"><button class="btn" data-act="desk-ok">${ui.desk.back === 'progress' ? '하반기 계속' : '확인'}</button></div></div>`;
}

// ── 1년 진행 (달력) ──
function monthMessages(g: GameState): string[] {
  const work = WORK_TITLE[g.me.assignmentId] ?? '업무 평가';
  const up = upcoming(g);
  const m = ['신년 업무계획을 세우고 있어요', '부대 정비 기간이에요', '상반기 교육훈련 중이에요', `${eul(work)} 준비하고 있어요`, '체력검정을 받고 있어요', `${iga(work)} 한창이에요`,
    '하반기 결재가 올라왔어요', '휴가 계획을 정리하고 있어요', '하반기 교육훈련 중이에요', '상급부대 점검을 받고 있어요', '연말 평가를 준비하고 있어요', '한 해를 마무리하고 있어요'];
  if (up.education) m[2] = `${up.education} 중이에요`;
  if (up.longService) m[8] = '장기복무 심사가 진행 중이에요';
  if (up.promotion) { m[9] = '진급 심사가 진행 중이에요'; m[10] = '진급 발표를 기다리고 있어요'; }
  return m;
}

function viewProgress(g: GameState): string {
  const msgs = monthMessages(g);
  return `
  <div class="page"><div class="pad" style="padding-top:44px">
    <p class="kicker">${g.year}년 · ${g.me.rank} ${asg(g.me.assignmentId).name}</p>
    <h1 class="h1" id="pmsg">${msgs[Math.min(11, ui.month - 1)]}</h1>
    <div class="gauge" id="pgauge"><div id="pbar" style="width:${((ui.month - 1) / 12) * 100}%"></div></div>
    <p class="sub small" id="pmon">${Math.min(12, ui.month)}월 / 12월</p>
    <p class="faint" style="margin-top:22px">집중 육성 · ${STAT_LABEL[save!.focus[0]]}, ${STAT_LABEL[save!.focus[1]]}</p>
  </div>
  <div class="bar"><button class="btn quiet" data-act="skip">건너뛰기</button></div></div>`;
}

let timer = 0;
function stopTimer() { cancelAnimationFrame(timer); clearTimeout(timer); }
/** 게이지가 차오르며 한 달씩 지나간다. 하반기 결재가 있으면 7월에서 멈춘다 */
function runProgress() {
  const g = save!.game;
  const msgs = monthMessages(g);
  const needStop = !!g.desk && g.desk.items.length > 1 && !g.desk.results[1];
  stopTimer();
  const PER_MONTH = 270;
  const start = (ui.month - 1) / 12;
  const end = needStop ? 6 / 12 : 1;
  const t0 = performance.now();
  let shown = 0;
  const frame = (t: number) => {
    const bar = document.getElementById('pbar');
    if (!bar) return;
    const p = Math.min(end, start + (t - t0) / (PER_MONTH * 12));
    bar.style.width = `${p * 100}%`;
    const month = Math.min(12, Math.floor(p * 12) + 1);
    if (month !== shown) {
      shown = month;
      ui.month = month;
      document.getElementById('pmon')!.textContent = `${month}월 / 12월`;
      const el = document.getElementById('pmsg')!;
      el.classList.remove('fade'); void el.offsetWidth; el.classList.add('fade');
      el.textContent = msgs[month - 1];
    }
    if (p < end) { timer = requestAnimationFrame(frame); return; }
    if (needStop) {
      document.getElementById('pgauge')!.classList.add('paused');
      document.getElementById('pmon')!.textContent = '7월 / 12월';
      const el = document.getElementById('pmsg')!;
      el.textContent = msgs[6];
      timer = window.setTimeout(() => { ui.desk = { slot: 1, pick: null, back: 'progress' }; go('desk'); }, 700);
    } else timer = window.setTimeout(finishYear, 400);
  };
  timer = requestAnimationFrame(frame);
}

function newMedals(before: Earned[], after: Earned[]): Earned[] {
  return after.filter((e) => { const b = before.find((x) => x.id === e.id); return !b || e.tierIndex > b.tierIndex; })
    .sort((a, b) => (RIBBONS.find((r) => r.id === a.id)?.prec ?? 0) - (RIBBONS.find((r) => r.id === b.id)?.prec ?? 0));
}

function finishYear() {
  stopTimer();
  (save!.log ??= []).push({ y: save!.game.year, f: save!.focus });
  const beforeRib = earnedRibbons(save!.game);
  const { next, report } = advanceYear(save!.game, save!.focus);
  ui.medals = next.ended ? [] : newMedals(beforeRib, earnedRibbons(next));
  ui.medalIdx = 0;
  save!.game = next;
  persist();
  ui.report = report;
  go('result');
}

// ── 근무평정 통지서 ──
function viewResult(g: GameState, r: YearReport): string {
  const statChips = STAT_KEYS.filter((k) => r.deltas[k]).map((k) => `<span class="chip ${r.deltas[k]! < 0 ? 'red' : ''}">${STAT_LABEL[k]} ${sgn(r.deltas[k]!)}</span>`).join('');
  const evs = r.events.filter((e) => e.id !== 'promotion');
  const tone = (t: string) => (t === 'good' ? 'good' : t === 'bad' ? 'bad' : '');
  return `
  <div class="page"><div class="pad tight">
    <div class="paper">
      <div class="phead"><div><p class="title">근무평정 통지서</p>
      <p class="no">${r.year}년도 · 제${r.year}-${String(g.history.length).padStart(2, '0')}호</p></div><div class="stamp pop ${r.grade === '탁월' || r.grade === '우수' ? 'olive' : ''}"><b>${r.grade}</b><i>${r.evalScore}점</i></div></div>
      <div class="meta" style="padding-right:0">
        <div class="kv"><span>성명</span><b>${esc(g.me.name)}</b></div>
        <div class="kv"><span>계급 · 보직</span><b>${r.rank} · ${r.assignment}</b></div>
        <div class="kv"><span>평정 기간</span><b>${r.year}. 1. 1. ~ 12. 31.</b></div>
        <div class="kv"><span>종합 능력치</span><b>${r.overallBefore} → ${r.overallAfter} ${signed(r.overallAfter - r.overallBefore)}</b></div>
      </div>
      ${statChips ? `<div class="chips">${statChips}${r.branchFit ? '<span class="chip line">병과 궁합 +20%</span>' : ''}</div>` : ''}
      <p class="sec">주요 사항</p>
      ${evs.map((e) => `<div class="line-item ${tone(e.tone)}"><div class="tick"></div><div class="g"><b>${e.title}</b><span>${esc(e.detail)}</span></div><em>${e.kind === 'work' ? `${e.tag} ${e.evalEffect}` : e.kind === 'choice' ? (e.evalEffect ? sgn(e.evalEffect) : e.tag) : e.tag}</em></div>`).join('')}
      <div class="opinion"><p class="faint">평정자 의견</p><p>${r.comment}</p></div>
    </div>
    ${r.records.map((x) => `<div class="record">${icon('star', 16)} ${x}</div>`).join('')}
    ${r.notes.filter((n) => !n.includes('진급했어요')).map((n) => `<p class="sub" style="margin-top:12px">${n}</p>`).join('')}
    ${r.cohortNews.length ? `<p class="sec">동기 소식</p>${r.cohortNews.map((n) => `<p class="news">${esc(n)}</p>`).join('')}` : ''}
  </div>
  <div class="bar"><button class="btn" data-act="result-ok">확인</button></div></div>`;
}

// ── 진급 심사 결과 ──
function viewPromotion(r: YearReport): string {
  const p = r.promotion!;
  const lastTry = !p.selected && p.attempt >= p.tries;
  const w = PROMOTION[p.from]!.weights;
  const parts = ([['평정', w.eval, p.breakdown.eval], ['경력', w.career, p.breakdown.career], ['교육', w.edu, p.breakdown.edu], ['전투', w.combat, p.breakdown.combat], ['균형', w.balance, p.breakdown.balance]] as [string, number, number][]).filter((x) => x[1] > 0);
  const peers = [...p.peers].sort((a, b) => b.score - a.score).slice(0, 6);
  return `
  <div class="page"><div class="pad tight">
    <div class="paper">
      <div class="phead"><div><p class="title">진급 심사 결과</p>
      <p class="no">${r.year}년 ${p.to} 진급 · ${p.attempt}차 심사</p></div><div class="stamp pop ${p.selected ? 'olive' : ''}"><b style="font-size:22px">${p.selected ? '선발' : '낙천'}</b><i>${p.score.toFixed(1)}점</i></div></div>
      <div class="meta">
        <div class="kv"><span>심사 대상</span><b>${p.candidates}명${p.others ? ` (다른 기수 ${p.others}명 포함)` : ''}</b></div>
        <div class="kv"><span>선발</span><b>${p.selectedCount}명</b></div>
        <div class="kv"><span>커트라인</span><b>${p.cut === null ? '올해 선발 없음' : `${p.cut.toFixed(1)}점 ${signed(Math.round((p.score - p.cut) * 10) / 10)}`}</b></div>
        <div class="kv"><span>남은 기회</span><b>${p.selected ? '-' : lastTry ? '없음' : `${p.tries - p.attempt}번`}</b></div>
      </div>
      ${parts.map(([l, wt, v]) => `<div class="stat"><div class="kv"><span>${l} <span class="faint">${Math.round(wt * 100)}%</span></span><b>${Math.round(v)}</b></div><div class="track ${l === p.weakest.label && !p.selected ? 'light' : ''}"><div style="width:${v}%"></div></div></div>`).join('')}
      ${!p.selected ? `<div class="opinion"><p class="faint">가장 아쉬웠던 항목 · ${p.weakest.label}</p><p>${p.weakest.why}</p></div>` : ''}
    </div>
    <p class="sec">함께 심사받은 동기</p>
    ${peers.length ? peers.map((x) => `<div class="mate"><div class="g"><b>${esc(x.name)} ${x.rival ? '<span class="chip red">라이벌</span>' : ''}</b><span>${x.origin} · ${x.score.toFixed(1)}점</span></div><span class="chip ${x.selected ? '' : 'gray'}">${x.selected ? '선발' : '낙천'}</span></div>`).join('') : '<p class="sub">함께 심사받은 동기가 없어요.</p>'}
  </div>
  <div class="bar"><button class="btn" data-act="queue-next">${p.selected ? `${p.to} 계급장 달기` : lastTry ? '확인' : '내년에 다시 도전'}</button></div></div>`;
}

// ── 진급식 ──
const PROMO_FLAVOR = ['가족이 직접 계급장을 달아줬어요', '지휘관이 계급장을 달아줬어요', '동기들의 박수 속에 계급장을 달았어요', '부하들이 꽃다발을 건넸어요'];
function viewPromoCeremony(g: GameState, r: YearReport): string {
  const me = g.me;
  const to = r.promotedTo!;
  const from = r.rank;
  const star = rankCount(to) >= rankCount('준장');
  const yearsIn = g.history.filter((h) => h.rank === from).length;
  const reached = [me, ...g.cohort].filter((o) => rankCount(o.rank) >= rankCount(to)).length;
  return `
  <div class="page"><div class="pad center">
    <p class="kicker">${r.year + 1}년 1월 · 진급식</p>
    <div class="stage"><div class="old">${insignia(from, 70)}</div><div class="glow"></div><div class="new">${insignia(to, 108)}</div></div>
    <h1 class="h1 rise d1">${star ? `드디어 <span class="olive">별</span>을 달았어요` : `<span class="olive">${to}</span> 진급을<br>축하해요`}</h1>
    <div class="speech rise d2"><p class="faint">진급 신고</p><p>충성! 신고합니다. ${from} ${esc(eunNeun(me.name))} ${r.year + 1}년 1월 1일부로 ${to} 진급을 명받았기에 이에 신고합니다. 충성!</p></div>
    <div class="doc rise d3" style="margin:14px 0 0;text-align:left"><div class="bd">
      <div class="kv"><span>${ro(from)} 보낸 시간</span><b>${yearsIn}년</b></div>
      <div class="kv"><span>진급 방식</span><b>${r.promotion ? `${r.promotion.attempt}차 심사 선발` : '자동 진급'}</b></div>
      <div class="kv"><span>동기 중</span><b>${r.promotion ? `${reached}번째 ${to}` : '동기들과 함께'}</b></div>
    </div></div>
    <p class="flavor rise d4">${PROMO_FLAVOR[(r.year + me.name.length) % PROMO_FLAVOR.length]}</p>
  </div>
  <div class="bar"><button class="btn" data-act="queue-next">${star ? '별 달기' : '계급장 달기'}</button></div></div>`;
}

// ── 희망 조사 ──
const CHANCE_CLS = { 안정: 'on', 경합: 'amber', 어려움: 'red' } as const;
function viewWish(g: GameState): string {
  const me = g.me;
  const opts = assignmentsFor(me.rank);
  const info = new Map(wishPreview(me, g.cohort, g.year, g.seed).map((x) => [x.id, x]));
  const label = (id: string) => (ui.wish[0] === id ? '1지망' : ui.wish[1] === id ? '2지망' : '');
  const ok = ui.wish.length === 2;
  return `
  <div class="page"><div class="pad tight">
    <p class="kicker">${g.year}년 정기 인사 · ${me.rank}</p>
    <h1 class="h1">보직 희망 조사서</h1>
    <p class="sub">자리마다 부대 사정이 달라요. 1지망과 2지망을 골라 주세요. 같은 시기 인사 대상인 동기들과 점수 순으로 정원 안에서 배정돼요.</p>
    <p class="faint" style="margin-top:6px">배정 점수 = 최근 평정 60% + 보직 능력치 30% + 처세 10% + 경험 태그${me.hidden.risk >= 2 ? ' − 마음에 걸리는 일' : ''} · 상관은 발표 날 알 수 있어요</p>
    ${lacksRequired(me) ? `<div class="record" style="margin-top:12px">필수 보직(${REQUIRED_BILLET[me.rank]!.label})을 아직 안 했어요. 안 거치면 ${RANKS[rankCount(me.rank) + 1]} 심사를 받을 수 없어요</div>` : ''}
    <div style="margin-top:10px">
    ${opts.map((a) => {
      const l = label(a.id);
      const fit = branchFits(me.branch, a);
      const core = a.kind === '지휘' || a.kind === '요직';
      const w = info.get(a.id)!;
      const u = w.card ? UNITS[w.card] : null;
      const comp = w.quota === null ? '정원 제한 없음' : w.chance ? `정원 ${w.quota}명 · 1지망 예상 동기 ${w.rivals}명${w.rivals ? ` (나보다 점수 높은 ${w.ahead}명)` : ''}` : '선후배 기수와 경쟁';
      return `<button class="opt ${l ? 'on' : ''}" data-act="wish" data-v="${a.id}">
        <div class="top2">${l ? `<span class="chip on">${l}</span>` : `<span class="chip gray">${a.kind}</span>`}<b>${a.name}</b>${w.chance ? `<span class="chip ${CHANCE_CLS[w.chance]}">${w.chance}</span>` : `<span class="faint">${quotaLabel(a, w.card)}</span>`}</div>
        ${u ? `<p class="d"><b style="color:var(--ink)">${u.name}</b> · ${u.desc}</p>` : ''}
        ${isRequired(me, a.id) ? `<p class="d" style="color:var(--olive);font-weight:600">${lacksRequired(me) ? '필수 보직 · 아직 안 했어요 (지원하면 가점)' : '필수 보직 · 완료'}</p>` : ''}
        <p class="d">${core ? '<b class="olive">핵심 경력</b>' : '보조 경력'} · ${STAT_LABEL[a.grows[0]]}·${STAT_LABEL[a.grows[1]]} 성장${fit ? ' · 병과 궁합 +20%' : ''}</p>
        <p class="why">내 배정 점수 ${wishScore(me, a)}${a.wantTags.filter((t) => me.tags.includes(t)).map((t) => ` · #${t}`).join('')}${a.id === me.assignmentId ? ' · 지금 보직' : ''}<br>${comp}</p>
      </button>`;
    }).join('')}
    </div>
  </div>
  <div class="bar"><button class="btn" data-act="wish-submit" ${ok ? '' : 'disabled'}>${ok ? '희망 조사서 제출' : `${ui.wish.length ? '2지망' : '1지망'}을 골라 주세요`}</button></div></div>`;
}

/** 새 임기 카드: 부대 · 상관 · 임기 목표 */
function termRows(g: GameState): string {
  const t = g.me.term;
  if (!t) return '';
  const u = UNITS[t.unit], b = BOSSES[t.boss], goal = goalOf(t);
  return `<div class="kv"><span>부대 분위기</span><b>${u.name}</b></div>
      <p class="faint" style="margin:-4px 0 10px;text-align:right">${u.desc}</p>
      <div class="kv"><span>상관</span><b class="olive">${b.name}</b></div>
      <p class="faint" style="margin:-4px 0 10px;text-align:right">${b.line} · ${b.desc}</p>
      <div class="kv"><span>임기 목표</span><b>${goal.text}</b></div>
      <p class="faint" style="margin:-4px 0 0;text-align:right">달성하면 평정 +${goal.bonus}, 표창</p>`;
}

// ── 인사명령: 봉투를 열면 발령과 새 상관이 공개된다 ──
function viewOrder(g: GameState): string {
  const p = g.personnel[g.personnel.length - 1];
  const a = asg(p.got);
  if (!ui.orderOpen) return `
  <div class="page"><div class="pad">
    <p class="kicker">${g.year}년 정기 인사 발표</p>
    <h1 class="h1">인사 발표가<br>나왔어요</h1>
    <p class="sub">1지망 ${asg(p.wishes[0]).name} · 2지망 ${asg(p.wishes[1]).name}</p>
    <div class="notice" data-act="order-open" role="button" aria-label="인사 발표 확인">
      <p class="to">${esc(g.me.name)} ${p.rank} 귀하</p>
      <p class="nt">인사명령</p>
      <div class="slot"><b>눌러서 확인하기</b><span>어디로, 누구 밑으로 갈까요?</span></div>
    </div>
  </div>
  <div class="bar"><button class="btn" data-act="order-open">발표 확인하기</button></div></div>`;
  const b = p.boss ? BOSSES[p.boss] : null;
  const u = p.unit ? UNITS[p.unit] : null;
  return `
  <div class="page"><div class="pad tight">
    <div class="paper">
      <div class="phead"><div><p class="title">인 사 명 령</p>
      <p class="no">${docNo(g, '-인')}</p></div><div class="stamp pop ${p.wishRank === 1 ? 'olive' : ''}"><b style="font-size:20px">${p.wishRank ? `${p.wishRank}지망` : '조정'}</b><i>배정</i></div></div>
      <div class="meta">
        <div class="kv"><span>성명</span><b>${esc(g.me.name)}</b></div>
        <div class="kv"><span>계급</span><b>${p.rank}</b></div>
        <div class="kv"><span>현 보직</span><b>${p.from ? asg(p.from).name : '-'}</b></div>
        <div class="kv"><span>신 보직</span><b class="olive">${a.name}</b></div>
        <div class="kv"><span>발령일</span><b>${g.year}. 1. 1.</b></div>
      </div>
      <p class="body">${p.note}.</p>
      <div class="chips" style="margin-top:10px">
        <span class="chip gray">1지망 ${asg(p.wishes[0]).name}</span><span class="chip gray">2지망 ${asg(p.wishes[1]).name}</span>
        <span class="chip line">${p.quota === null ? '정원 제한 없음' : `정원 ${p.quota}명 · 1지망 지원 ${p.applicants}명`}</span>
      </div>
    </div>
    ${b && u ? `<div class="doc rise" style="margin:14px 0 0;animation-delay:.6s"><div class="hd"><span>새 부대 소식</span></div><div class="bd">${termRows(g)}</div></div>` : ''}
  </div>
  <div class="bar"><button class="btn" data-act="queue-next">확인</button></div></div>`;
}

// ── 지휘 방침 ──
function viewPolicy(g: GameState): string {
  const a = asg(g.me.assignmentId);
  return `
  <div class="page"><div class="pad tight">
    <p class="kicker">${a.name} 취임</p>
    <h1 class="h1">임기 동안의<br>지휘 방침을 정해요</h1>
    <p class="sub">장성 보직에서는 방침에 따라 1년의 흐름이 달라져요.</p>
    ${(Object.keys(POLICY) as Policy[]).map((p) => `<button class="opt ${ui.policy === p ? 'on' : ''}" data-act="policy" data-v="${p}"><div class="top2"><b>${p}</b></div><p class="d">${POLICY[p].desc}</p></button>`).join('')}
  </div>
  <div class="bar"><button class="btn" data-act="policy-ok" ${ui.policy ? '' : 'disabled'}>${ui.policy ? `${ro(ui.policy)} 취임하기` : '방침을 골라 주세요'}</button></div></div>`;
}

// ── 전입 신고 ──
const POST_FLAVOR = ['전임자에게 인수인계를 받았어요', '부대원들이 반갑게 맞아줬어요', '첫 회의에 참석했어요', '새 사무실 책상을 정리했어요', '부대 현황 브리핑을 받았어요'];
function viewAssignCeremony(g: GameState): string {
  const me = g.me;
  const a = asg(me.assignmentId);
  const from = ui.assignFrom ? asg(ui.assignFrom) : null;
  const date = ui.firstPost ? `${g.year}년 3월 1일` : `${g.year}년 1월 1일`;
  const speech = `충성! 신고합니다. ${me.rank} ${eunNeun(me.name)} ${date}부로 ${a.name} 보직을 명받았기에 이에 신고합니다. 충성!`;
  return `
  <div class="page"><div class="pad tight">
    <p class="kicker">${ui.firstPost ? '임관 후 첫 보직' : `${g.year}년 전입 신고`}</p>
    <h1 class="h1"><span class="olive">${ro(a.name)}</span><br>새 출발해요</h1>
    ${from ? `<div class="move"><div><p class="faint">전출</p><b>${from.name}</b></div>${icon('chev', 22)}<div><p class="faint">전입</p><b class="olive">${a.name}</b></div></div>` : ''}
    <div class="speech"><p class="faint">전입 신고</p><p id="typer" data-text="${esc(speech)}"></p></div>
    <div class="doc" style="margin:14px 0 0"><div class="bd">
      <div class="kv"><span>보직 유형</span><b>${a.kind} · ${a.kind === '지휘' || a.kind === '요직' ? '핵심 경력' : '보조 경력'}</b></div>
      <div class="kv"><span>잘 오르는 능력치</span><b>${STAT_LABEL[a.grows[0]]}, ${STAT_LABEL[a.grows[1]]}</b></div>
      <div class="kv"><span>병과 궁합</span><b>${branchFits(me.branch, a) ? '<span class="olive">잘 맞아요 · 성장 +20%</span>' : '보통'}</b></div>
      ${me.policy ? `<div class="kv"><span>지휘 방침</span><b>${me.policy}</b></div>` : ''}
      ${termRows(g)}
    </div></div>
    <p class="flavor">${POST_FLAVOR[(g.year + a.name.length) % POST_FLAVOR.length]}</p>
  </div>
  <div class="bar"><button class="btn" data-act="queue-next">신고 마치기</button></div></div>`;
}

let typerId = 0;
function runTyper() {
  const el = document.getElementById('typer');
  if (!el) return;
  const text = el.dataset.text ?? '';
  let i = 0;
  clearInterval(typerId);
  typerId = window.setInterval(() => { i += 1; el.textContent = text.slice(0, i); if (i >= text.length) clearInterval(typerId); }, 32);
}

// ── 전역 ──
function applyMeta(g: GameState) {
  if (!save || save.metaApplied) return;
  const rib = earnedRibbons(g);
  ui.newRibbons = [];
  for (const e of rib) {
    const have = meta.ribbons[e.id] ?? [];
    if (!have.includes(e.tierIndex)) { meta.ribbons[e.id] = [...have, e.tierIndex]; ui.newRibbons.push(e.tier ? `${e.name} ${e.tier}` : e.name); }
  }
  for (const t of earnedTitles(g)) if (!meta.titles.includes(t)) meta.titles.push(t);
  meta.cleared = true;
  meta.runs += 1;
  meta.bestRank = Math.max(meta.bestRank ?? -1, rankCount(g.me.rank));
  save.metaApplied = true;
  persistMeta(); persist();
}

const TITLE_QUOTE: Record<string, string> = {
  chief: '군 전체를 책임졌던 사람', apex: '야전의 끝에 섰던 사람', star: '끝내 별을 단 사람',
  hard_way: '손해를 알고도 원칙을 지킨 사람', first: '늘 동기보다 한발 앞섰던 사람', field: '현장을 떠나지 않은 지휘관',
  policy: '정책으로 군을 바꾼 사람', clean: '흠잡을 데 없는 복무', top_grad: '처음부터 끝까지 수석', honor_grad: '우등생의 품격',
};

function endingQuote(g: GameState, titleId: string | null): string {
  if (g.me.log.thirdTry) return '마지막 기회에서 살아남은 불사조';
  if (titleId && TITLE_QUOTE[titleId]) return TITLE_QUOTE[titleId];
  const r = g.ended!.reason;
  if (r.includes('계급정년')) return '마지막 날까지 자리를 지킨 사람';
  if (r.includes('자진')) return '스스로 다음 길을 고른 사람';
  if (r.includes('장기복무')) return '짧지만 굵었던 복무';
  return '묵묵히 제 몫을 다한 사람';
}

function shareText(nick: string, rank: Rank, years: number): string {
  void nick;
  return `말뚝 · ${ro(rank)} ${years}년 버텼어요. 너는 몇 성까지?`;
}

/** 운 지수: 확률 판정의 기대 성공 대비 실제 성공 (정규 근사 백분위) */
function luckOf(l: { luckExp?: number; luckHit?: number; luckVar?: number }) {
  if (!l.luckExp || !l.luckVar) return null;
  const z = ((l.luckHit ?? 0) - l.luckExp) / Math.sqrt(l.luckVar);
  const cdf = 1 / (1 + Math.exp(-1.702 * z));
  return { exp: Math.round(l.luckExp), hit: l.luckHit ?? 0, pct: Math.round(cdf * 100) };
}

function endingCard(g: GameState): CardData & { titleId: string | null } {
  const me = g.me;
  const end = g.ended!;
  const all = [me, ...g.cohort];
  const same = all.filter((o) => rankCount(o.rank) >= rankCount(me.rank)).length;
  const titles = earnedTitles(g);
  const titleId = meta.equipped && meta.titles.includes(meta.equipped) ? meta.equipped : titles[0] ?? null;
  return {
    nickname: ui.upload.nick || me.name, finalRank: end.finalRank, origin: me.origin, startYear: g.history[0]?.year ?? end.year, endYear: end.year,
    years: g.history.length, honor: g.history.length >= 20 || end.reason.includes('명예') || rankCount(me.rank) >= rankCount('준장'),
    quote: endingQuote(g, titleId), title: titleId ? titleName(titleId) : null, ribbons: earnedRibbons(g),
    pct: Math.max(1, Math.round((same / all.length) * 100)), same, cohort: all.length,
    su: g.history.filter((h) => h.grade === '탁월').length, clean: me.log.cleanCommandBest, awards: me.log.awards.length + me.log.majorAwards, titleId, luck: luckOf(me.log),
  };
}

/** 전역 화면: 이번 판 경험치와 호봉 (서버 기록 기준) */
function hobongLine(): string {
  const me = myId();
  if (!me || !save?.game) return '';
  const st = load(`person:stats:${me}`, () => myStatsCached(me).catch(() => null));
  if (st.state !== 'ok' || !st.data) return '';
  const g = save.game;
  const mode = isDaily(g) ? 'daily' : isContest(g) ? 'contest' : isGroup(g) ? 'cohort' : 'free';
  const gain = mode === 'free' && freeToday() > 5 ? 0 : runXp(rankCount(g.me.rank), mode);
  const hb = hobongOf(st.data.xp);
  return `<span class="hbline"><b>+${gain}</b> · ${hb.level}호봉 · 다음 호봉까지 ${hb.need - hb.into}${gain === 0 ? ' · 자유 플레이 경험치는 하루 5판까지' : ''}</span>`;
}
const FREE_KEY = 'malttuk-free-xp';
function freeToday(): number { try { const x = JSON.parse(localStorage.getItem(FREE_KEY) ?? 'null'); return x?.d === today() ? x.n : 0; } catch { return 0; } }
function bumpFreeToday() { try { localStorage.setItem(FREE_KEY, JSON.stringify({ d: today(), n: freeToday() + 1 })); } catch { /* 무시 */ } }

function uploadBox(): string {
  const u = ui.upload;
  if (save!.runId) return `<div class="upbox done"><div class="g"><b>랭킹에 올렸어요</b><span>오늘의 랭킹과 갤러리에 내 카드가 보여요</span>${hobongLine()}</div><button class="more" data-act="open-card" data-v="${save!.runId}">내 카드 ${icon('chev')}</button></div>`;
  return `<div class="upbox">
    <b>마지막 단계 · 랭킹에 올리기</b>
    <span>올리면 내 카드 링크가 생기고, 다른 사람과 순위를 겨뤄요</span>
    ${u.fixed ? `<p class="sub" style="margin-top:12px"><b class="olive">${esc(u.fixed)}</b> 이름으로 올려요 · 닉네임은 인사기록카드에서 바꿀 수 있어요</p>` : `
    <label class="lbl" for="upnick" style="margin:14px 0 6px">랭킹에 보일 닉네임 · 한 번 정하면 계속 써요</label>
    <input id="upnick" class="inp" style="height:50px;background:var(--bg)" maxlength="12" placeholder="닉네임 (2~12자)" value="${esc(u.nick)}">`}
    ${u.msg ? `<p class="small" style="margin-top:8px;color:var(--red)">${esc(u.msg)}</p>` : ''}
  </div>`;
}

function viewEnding(g: GameState): string {
  applyMeta(g);
  const me = g.me;
  const rival = rivalOf(g);
  if (!ui.upload.loaded) {
    ui.upload.loaded = true;
    track('game_end', { final_rank: g.ended!.finalRank, years: g.history.length, reason: String(g.ended!.reason ?? '') });
    ui.upload.nick = me.name;
    getProfile().then((p) => { if (p && !save?.runId) { ui.upload.nick = p.nickname; ui.upload.fixed = nicknameProblem(p.nickname) ? null : p.nickname; if (!ui.upload.fixed) ui.upload.msg = '지금 닉네임은 쓸 수 없는 이름이에요. 새 닉네임을 정해 주세요'; render(); } }).catch(() => {});
  }
  const d = endingCard(g);
  void prepareCard(d, imgLink()).catch(() => {});
  const daily = isDaily(g);
  const group = isGroup(g);
  const contest = isContest(g);
  const hs = honorScore(g);
  const dailyBox = daily && save!.runId ? dailyResult({ day: g.day!, rank_index: rankCount(g.me.rank), honor: hs!.total, years: g.history.length, log: (save!.log ?? []) as { d?: string; k?: string; ok?: boolean | null }[] }) : '';
  return `
  <div class="page"><div class="pad tight">
    ${daily ? `<p class="kicker" style="margin:4px 4px 10px">오늘의 기수 · ${dayLabel(g.day!)}</p>` : group ? `<p class="kicker" style="margin:4px 4px 10px">우리 기수 · ${esc(g.group!.name)}</p>` : contest ? `<p class="kicker" style="margin:4px 4px 10px">기수 대항전 · 제${weekNo(g.week!)}주</p>` : ''}
    ${contest && save!.runId ? contestAfter(g.week!) : ''}
    ${group && save!.runId ? `<a class="newnote" style="margin:0 0 12px" href="#/c/${g.group!.code}"><span class="nb">순위</span><span><b>${esc(g.group!.name)} 순위 보기</b><span>동기들과의 갈림길, 기수 시상</span></span>${icon('chev')}</a>` : ''}
    ${uploadBox()}
    ${save!.runId ? `<div style="margin:-2px -12px 12px">${loginRow()}</div>` : ''}
    ${dailyBox}
    ${daily && save!.runId ? dailyNext() : ''}
    ${hs ? `<p class="sec">명예 점수 ${hs.total}</p><div class="doc" style="margin:0"><div class="bd" style="padding-top:16px">${hs.parts.map((x) => `<div class="kv"><span>${x.label}</span><b>${x.v > 0 ? '+' : ''}${x.v}</b></div>`).join('')}<p class="faint" style="margin-top:6px">같은 계급이면 명예 점수가 높은 사람이 앞서요</p></div></div>` : ''}
    <div style="height:12px"></div>
    ${cardHtml(d, '<button class="share" data-act="share">나는 몇 성까지 갈 수 있을까? <small>[카드 공유]</small></button><button class="share alt" style="margin-top:8px" data-act="save-img">이미지로 저장</button><button class="link" style="margin:6px auto 0;display:block;font-size:13px" data-act="copy-link">링크만 복사</button>')}
    ${ui.newRibbons.length ? `<p class="sec">도감에 새로 등록된 약장</p><div class="chips">${ui.newRibbons.map((n) => `<span class="chip">${n}</span>`).join('')}</div>` : ''}
    <p class="sec">숨겨져 있던 것</p>
    <div class="doc" style="margin:0"><div class="bd" style="padding-top:18px">
      <div class="kv"><span>잠재력</span><b class="olive">${me.hidden.potential}등급${me.awakenings ? ` (각성 ${me.awakenings}회)` : ''}</b></div>
      <div class="kv"><span>마음에 걸리는 일</span><b>${me.hidden.risk}건</b></div>
      <div class="kv"><span>중대 사건</span><b>${me.log.incidents}건 중 원칙대로 ${me.log.principled}건</b></div>
      <div class="kv"><span>라이벌 ${esc(rival.name)}</span><b>${rival.rank}${rival.active ? ' (현역)' : ''}</b></div>
    </div></div>
    ${group ? `<a class="link" href="#/c/${g.group!.code}">우리 기수 순위 보기</a>` : contest ? '<a class="link" href="#/contest">대항전 순위 보기</a>' : `<button class="link" data-act="${daily ? 'route-daily' : 'route-rank'}">${daily ? '오늘의 기수 순위 보기' : '명예의 전당 보기'}</button>`}
  </div>
  ${save!.runId
    ? `<div class="bar"><div class="two"><button class="btn line" data-act="go-dex">약장 도감</button><button class="btn" data-act="new-game">${daily || group ? '로비로' : '새 인생 시작'}</button></div></div>`
    : `<div class="bar"><button class="btn" data-act="upload" ${ui.upload.busy ? 'disabled' : ''}>${ui.upload.busy ? '올리는 중이에요…' : '랭킹에 올리기'}</button>${ui.upload.fails >= 2 ? '<button class="link" style="margin-top:2px;padding:8px" data-act="new-game">서버 문제로 지금은 건너뛰기</button>' : '<p class="faint" style="text-align:center;margin-top:8px">랭킹에 올려야 새 인생을 시작할 수 있어요</p>'}</div>`}</div>`;
}

/** v3.2 오늘의 기수 전역 뒤 다음 행동 두 개 */
function dailyNext(): string {
  const free = peek('free')?.game;
  const live = free && !free.ended;
  return `<p class="sec">다음은</p><div class="doc" style="margin:0"><div class="bd">
    <button class="row" data-act="${live ? 'continue' : 'start-new'}"><div class="mark gray">${icon('swap')}</div><div class="g"><b>${live ? '자유 플레이 이어서 하기' : '자유 플레이로 한 판 더'}</b><span>${live ? `${free!.me.rank} ${esc(free!.me.name)} · ${free!.year}년` : '다시 뽑기 2회 · 약장 모으기'}</span></div>${icon('chev')}</button>
    <button class="row" data-act="route-cohort"><div class="mark gray">${icon('people')}</div><div class="g"><b>친구랑 우리 기수 만들기</b><span>같은 후보·같은 동기로 7일 동안 겨뤄요</span></div>${icon('chev')}</button>
  </div></div>`;
}

async function upload(g: GameState) {
  const u = ui.upload;
  const nick = (u.fixed ?? u.nick).trim();
  const problem = u.fixed ? null : nicknameProblem(nick);
  if (problem) { u.msg = problem; render(); return; }
  u.busy = true; u.msg = ''; render();
  try {
    const d = endingCard(g);
    const best = g.me.billets.map((id) => asg(id)).sort((a, b) => b.prestige - a.prestige)[0];
    const rival = rivalOf(g);
    await saveProfile(nick, d.title);
    { const mt = myTeamsNow(); if (mt?.length) await ensureMainTeam(mt[0].cohort_id); }
    const id = await saveRun({
      nickname: nick, origin: g.me.origin, branch: g.me.branch, final_rank: d.finalRank, rank_index: rankCount(d.finalRank),
      best_billet: best?.name ?? null, best_prestige: best?.prestige ?? null, years: d.years, su_count: d.su,
      ribbons: d.ribbons.map((e) => ({ id: e.id, t: e.tierIndex })), title: d.title, quote: d.quote,
      rival_result: `${rival.name} ${rival.rank}${rival.active ? ' (현역)' : ''}`, seed: g.seed,
      choices: { log: save!.log ?? [], card: { pct: d.pct, same: d.same, cohort: d.cohort, clean: d.clean, awards: d.awards, start: d.startYear, end: d.endYear, honor: d.honor, reason: g.ended!.reason, luck: d.luck ?? null } },
      honor: honorScore(g).total,
      ...(isDaily(g) ? { mode: 'daily' as const, day: g.day! } : {}),
      ...(isGroup(g) ? { mode: 'cohort' as const, cohort_id: g.group!.id } : {}),
      ...(isContest(g) ? { mode: 'contest' as const, week: g.week! } : {}),
    });
    if (isContest(g)) invalidate('contest');
    if (isDaily(g)) invalidateDaily();
    if (isGroup(g)) invalidate('grpruns');
    save!.runId = id; persist();
    if (!isFixed(g)) bumpFreeToday();
    ui.upload.fixed = nick; invalidate('person'); unstash('stats');
    invalidate('rank'); invalidate('gallery'); invalidate('mine'); invalidate('profile');
    toast('랭킹에 올렸어요');
    track('rank_upload', { final_rank: g.ended!.finalRank });
  } catch (e) {
    if (e instanceof AlreadyError) { u.msg = e.message; u.fails = 2; u.busy = false; render(); return; }
    u.fails++;
    u.msg = `올리지 못했어요 · ${e instanceof Error ? e.message : '알 수 없는 오류'}`;
  }
  u.busy = false; render();
}

function toast(msg: string) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

const baseUrl = () => (location.href.startsWith('http') ? location.href.split('#')[0] : '');
/** 대표 기수가 없으면 이 기수를 대표로 (프로필이 있을 때만) */
async function ensureMainTeam(cohortId: string) {
  try {
    const prof = await getProfile();
    if (prof && !prof.main_cohort) await setMainTeam(cohortId);
  } catch { /* 프로필이 없으면 첫 업로드 뒤에 정해요 */ }
  invalidate('profile');
}

async function shareLink(text: string, url: string) {
  try {
    if (navigator.share) { await navigator.share({ title: '말뚝', text, url: url || undefined }); return; }
  } catch { return; }
  try { await navigator.clipboard.writeText(url ? `${text}\n${url}` : text); toast('공유 링크를 복사했어요'); } catch { toast('이 화면을 캡처해서 공유해 보세요'); }
}
const imgLink = () => (location.href.startsWith('http') ? location.host + location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') : '');
/** 카드 공유: 되는 폰에선 이미지+문구+링크를 한 번에, 안 되면 링크만 */
async function shareCard(d: CardData, text: string, url: string) {
  const r = await shareCardImage(d, imgLink(), text, url).catch(() => 'fallback' as const);
  if (r === 'retry') { toast('카드를 준비했어요. 한 번 더 눌러 주세요'); return; }
  if (r === 'fallback') await shareLink(text, url);
}
async function share(g: GameState) {
  const id = save?.runId;
  const url = id && baseUrl() ? `${baseUrl()}#/card/${id}` : baseUrl();
  await shareCard(endingCard(g), shareText(ui.upload.nick || g.me.name, g.ended!.finalRank, g.history.length), url);
}

// ── 훈장 수여 ──
function viewMedal(): string {
  const e = ui.medals[ui.medalIdx];
  if (!e) return '';
  const def = RIBBONS.find((r) => r.id === e.id)!;
  const m = metalOf(e);
  const upgrade = e.tierIndex > 0 && !!def.tiers && def.id !== 'cheongun';
  const n = ui.medals.length;
  return `
  <div class="medal-ov ${m}" data-act="medal-next" role="dialog" aria-label="${e.name} 수여" data-k="${ui.medalIdx}">
    <p class="mk rise" style="animation-delay:.05s">${upgrade ? '훈장 승급' : '훈장 수여'}${n > 1 ? ` · ${ui.medalIdx + 1}/${n}` : ''}</p>
    <div class="medal-stage">
      <div class="halo"></div><i class="ring"></i>
      <div class="medal-img">${medalSvg(e, 230)}</div>
      <div class="medal-shadow"></div>
    </div>
    <p class="mt rise" style="animation-delay:1s">${esc(e.name)}${e.tier ? ` ${e.tier}` : ''}${hasJong(e.tier ?? e.name) ? '을' : '를'} 받았어요</p>
    <p class="ms rise" style="animation-delay:1.25s">${esc(def.cond)}</p>
    <p class="mh rise" style="animation-delay:1.8s">화면을 누르면 계속</p>
  </div>`;
}

// ═════════ 렌더 & 이벤트 ═════════
const root = document.getElementById('app')!;
function go(s: Screen) { ui.screen = s; render(); window.scrollTo(0, 0); }
function nextInQueue() {
  const g = save!.game;
  let n = ui.queue.shift();
  // 희망 조사·지휘 방침은 상태를 보고 끼워 넣는다
  if (n === 'home' && g.personnelDue) { ui.queue.unshift('home'); n = 'wish'; ui.wish = []; }
  else if (g.policyDue && n !== undefined && n !== 'policy') { ui.queue.unshift(n); n = 'policy'; ui.policy = null; }
  if (n === 'home') ui.tab = 'home';
  go(n ?? (g.ended ? 'ending' : 'home'));
}
function buildQueue(r: YearReport, g: GameState): Screen[] {
  const q: Screen[] = [];
  if (ui.medals.length) q.push('medal');
  if (r.promotion) q.push('promotion');
  if (g.ended) { q.push('ending'); return q; }
  if (r.promotedTo) q.push('promo-ceremony');
  q.push('home');
  return q;
}

function render() {
  renderScreen();
  mountAds(ui.route ? location.hash : ui.screen);
}
function renderScreen() {
  if (ui.route) { root.innerHTML = viewRoute(ui.route); return; }
  const g = save?.game ?? null;
  const sc = ui.screen;
  if (sc === 'lobby') { root.innerHTML = viewLobby(); return; }
  if (sc === 'medal') { if (ui.medals.length) { root.innerHTML = viewMedal(); return; } ui.screen = 'home'; }
  if (sc.startsWith('p-') && sc !== 'p-commission') {
    if (!ui.pro) ui.pro = newPrologue();
    root.innerHTML = (sc === 'p-intro' ? viewIntro() : sc === 'p-cands' ? viewCands() : sc === 'p-envelope' ? viewEnvelope() : sc === 'p-focus' ? viewFocus() : sc === 'p-school' ? viewSchool() : viewGrad()) + `<div>${sheet(null)}</div>`;
    if (sc === 'p-school') runSchool();
    return;
  }
  if (!g) { ui.screen = 'p-intro'; renderScreen(); return; }
  if (sc === 'p-commission') { root.innerHTML = viewCommission(); return; }
  if (sc === 'desk' && g.desk) { root.innerHTML = viewDesk(g); return; }
  if (sc === 'progress') { root.innerHTML = viewProgress(g); runProgress(); return; }
  if (sc === 'result' && ui.report) { root.innerHTML = viewResult(g, ui.report); return; }
  if (sc === 'promotion' && ui.report?.promotion) { root.innerHTML = viewPromotion(ui.report); return; }
  if (sc === 'promo-ceremony' && ui.report?.promotedTo) { root.innerHTML = viewPromoCeremony(g, ui.report); return; }
  if (sc === 'wish' && g.personnelDue) { root.innerHTML = viewWish(g); return; }
  if (sc === 'order' && g.personnel.length) { root.innerHTML = viewOrder(g); return; }
  if (sc === 'policy' && g.policyDue) { root.innerHTML = viewPolicy(g); return; }
  if (sc === 'assign-ceremony') { root.innerHTML = viewAssignCeremony(g); runTyper(); return; }
  if (sc === 'ending' && g.ended) {
    if (ui.tab === 'dex') { root.innerHTML = `<div class="page"><header class="top"><span class="t">약장 도감</span></header><main class="stack">${viewDex(g)}</main><div class="bar"><button class="btn" data-act="back-ending">전역 카드로</button></div></div>`; return; }
    root.innerHTML = viewEnding(g); return;
  }
  if (g.ended) { ui.screen = 'ending'; renderScreen(); return; }
  if (g.personnelDue) { ui.queue = ['home']; ui.wish = []; ui.screen = 'wish'; root.innerHTML = viewWish(g); return; }
  if (g.policyDue) { ui.queue = ['home']; ui.policy = null; ui.screen = 'policy'; root.innerHTML = viewPolicy(g); return; }
  ui.screen = 'home';
  const inner = ui.tab === 'record' ? viewRecord(g) : ui.tab === 'cohort' ? viewCohort(g) : ui.tab === 'dex' ? viewDex(g) : viewHome(g);
  root.innerHTML = shell(g, inner);
}

let schoolTimer = 0;
function runSchool() {
  const p = ui.pro!;
  const moments = SCHOOL_MOMENTS[p.origin];
  let i = 0;
  clearInterval(schoolTimer);
  const step = () => {
    const bar = document.getElementById('sbar');
    if (!bar) { clearInterval(schoolTimer); return; }
    bar.style.transition = 'width 1.1s linear';
    bar.style.width = `${((i + 1) / moments.length) * 100}%`;
    const el = document.getElementById('smsg')!;
    el.classList.remove('fade'); void el.offsetWidth; el.classList.add('fade');
    el.textContent = moments[i];
    i += 1;
    if (i >= moments.length) { clearInterval(schoolTimer); schoolTimer = window.setTimeout(() => { prologueGraduate(); go('p-grad'); }, 900); }
  };
  step();
  schoolTimer = window.setInterval(step, 1100);
}

let adTimer = 0;
function openAd(kind: 'eval' | 'reroll') {
  ui.ad = { kind, left: 3 };
  ui.sheet = 'ad';
  render();
  clearInterval(adTimer);
  adTimer = window.setInterval(() => {
    ui.ad.left -= 1;
    const el = document.getElementById('adleft');
    if (el) el.textContent = ui.ad.left > 0 ? String(ui.ad.left) : '✓';
    if (ui.ad.left <= 0) { clearInterval(adTimer); const b = document.getElementById('adok') as HTMLButtonElement | null; if (b) b.disabled = false; }
  }, 1000);
}

root.addEventListener('compositionend', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'nm' && ui.pro) ui.pro.name = t.value;
  if (t.id === 'upnick') ui.upload.nick = t.value;
  if (t.id === 'gname') gs.name = t.value;
  if (t.id === 'gbnick') gs.gbNick = t.value;
  if (t.id === 'gbtext') gs.gbText = t.value;
});
root.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'nm' && ui.pro) ui.pro.name = t.value;
  if (t.id === 'upnick') ui.upload.nick = t.value;
  if (t.id === 'nick') rk.nick = t.value;
  if (t.id === 'gname') gs.name = t.value;
  if (t.id === 'gcode') gs.code = t.value.toUpperCase();
  if (t.id === 'gbnick') gs.gbNick = t.value;
  if (t.id === 'gbtext') gs.gbText = t.value;
  if (t.id === 'tname') cs.name = t.value;
  if (t.id === 'tmotto') cs.motto = t.value;
  if (t.id === 'lnick') loginState.nick = t.value;
});
root.addEventListener('change', (e) => {
  const t = e.target as HTMLSelectElement;
  if (t.id === 'rday') { rk.day = Number(t.value); render(); }
});
/** 이 페이지 안에서 화면을 옮긴 횟수: 뒤로 가기가 다른 사이트(로그인 화면 등)로 나가지 않게 */
let hashMoves = 0;
window.addEventListener('hashchange', () => { hashMoves++; });
window.addEventListener('hashchange', () => { settingsState.confirmWipe = false; settingsState.msg = ''; settingsState.confirmDelete = false; settingsState.confirmLogout = false; settingsState.authMsg = ''; ui.route = routeOf(location.hash); prefillGuest(); render(); window.scrollTo(0, 0); });
function prefillGuest() {
  if (ui.route?.name !== 'guestbook' || gs.gbNick) return;
  getProfile().then((p) => { if (p && !gs.gbNick) { gs.gbNick = p.nickname; render(); } }).catch(() => {});
}
/** 랭킹·기수 화면에서 게임 화면으로 */
function leaveRoute() { ui.route = null; history.replaceState(null, '', location.pathname + location.search); }
setRerender(() => render());
if (new URLSearchParams(location.search).get('demo') === 'medal') {
  const pick = (id: string, t = 0): Earned => { const d = RIBBONS.find((r) => r.id === id)!; return { id, name: d.name, tier: d.tiers?.[t], tierIndex: t, design: d.design }; };
  ui.medals = [pick('imgwan'), pick('boru'), pick('gongjeok', 1), pick('seongjwa')];
  ui.screen = 'medal';
}

root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const act = el.dataset.act!;
  const v = el.dataset.v ?? '';
  const nmEl = document.getElementById('nm') as HTMLInputElement | null;
  if (nmEl && ui.pro) ui.pro.name = nmEl.value;
  const upEl = document.getElementById('upnick') as HTMLInputElement | null;
  if (upEl) ui.upload.nick = upEl.value;
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;
  gs.name = val('gname') ?? gs.name; gs.code = (val('gcode') ?? gs.code).toUpperCase(); gs.gbNick = val('gbnick') ?? gs.gbNick; gs.gbText = val('gbtext') ?? gs.gbText;
  cs.name = val('tname') ?? cs.name; cs.motto = val('tmotto') ?? cs.motto;
  const g = save?.game ?? null;
  const p = ui.pro;
  switch (act) {
    // 프롤로그
    case 'p-apply': go('p-cands'); break;
    case 'p-back-intro': go('p-intro'); break;
    case 'p-cand': if (p) { p.pick = Number(v); render(); } break;
    case 'p-reroll': if (p && !fixedWorld(p) && p.rerolls < REROLL_MAX && !ui.adBusy) {
      ui.adBusy = true; if (rewardedOn()) render();
      void showRewarded('reroll').then((r) => {
        ui.adBusy = false; track('rewarded', { place: 'reroll', result: r });
        if (r === 'dismissed') { toast('광고를 끝까지 봐야 다시 뽑을 수 있어요'); render(); return; }
        p.rerolls += 1; p.cands = makeCandidates(); p.pick = null; p.ranges = null; track('candidate_reroll', { n: p.rerolls }); render(); window.scrollTo(0, 0);
      });
    } break;
    case 'p-view': if (p && !p.viewed && !ui.adBusy) {
      ui.adBusy = true; if (rewardedOn()) render();
      void showRewarded('evaluation').then((r) => {
        ui.adBusy = false; track('rewarded', { place: 'evaluation', result: r });
        if (r === 'dismissed') { toast('광고를 끝까지 봐야 평가서를 열 수 있어요'); render(); return; }
        p.viewed = true; p.range = potentialRange(p.potential); track('potential_view'); render();
      });
    } break;
    case 'p-cand-go': if (p && p.pick !== null) {
      const c = p.cands[p.pick];
      p.origin = c.origin; p.potential = c.potential; p.seed = c.seed; p.spread = c.spread; p.range = null; p.viewed = false;
      p.open = false; p.focus = []; p.grad = null;
      track('candidate_pick', { origin: c.origin, index: p.pick + 1, rerolls: p.rerolls, viewed: p.viewed });
      go('p-envelope');
    } break;
    case 'go-lobby': ui.sheet = null; stopTimer(); go('lobby'); break;
    case 'daily-go': {
      const { st, save: d } = dailyState();
      useSlot('daily');
      if (st === 'none') { save = null; ui.pro = newPrologue(today()); track('daily_start'); go('p-intro'); }
      else { void d; ui.tab = 'home'; go(save!.game.ended ? 'ending' : 'home'); }
      break;
    }
    case 'route-cohort': location.hash = '#/cohort'; break;
    // v3.3 기수 대항전
    case 'lobby-tab': ui.lobbyTab = v as 'd' | 'c' | 'f'; try { localStorage.setItem('malttuk-lobby-tab', v); } catch { /* 무시 */ } render(); break;
    case 'route-contest': location.hash = '#/contest'; break;
    case 'contest-go': {
      const k = contestState();
      if (k.st !== 'none') { useSlot('contest'); leaveRoute(); ui.tab = 'home'; go(save!.game.ended ? 'ending' : 'home'); break; }
      if (!contestOpen(today())) { toast(`${Number(CONTEST_FROM.slice(5, 7))}월 ${Number(CONTEST_FROM.slice(8, 10))}일(월)부터 출전할 수 있어요`); break; }
      const teams = myTeamsNow();
      if (teams === null) { toast('기수 정보를 불러오는 중이에요'); break; }
      if (!teams.length) { toast('먼저 대항전 기수에 들어가 주세요'); location.hash = '#/contest'; break; }
      useSlot('contest'); leaveRoute();
      save = null; ui.pro = newPrologue(undefined, undefined, weekOf(today()));
      track('contest_start', { teams: teams.length }); go('p-intro'); break;
    }
    case 'team-new': {
      if ((myTeamsNow()?.length ?? 0) >= MAX_TEAMS) { toast(`기수는 ${MAX_TEAMS}곳까지 들어갈 수 있어요`); break; }
      if (!loginInfo().linked) { toast('기수 만들기는 로그인이 필요해요 · 기수장 자리를 지켜 줘요'); location.hash = '#/login'; break; }
      Object.assign(cs, { name: '', motto: '', ribbon: randomRibbon(), pub: true, msg: '', busy: false, edit: null });
      location.hash = '#/contest/new'; break;
    }
    case 'team-edit': {
      void getCohort(v).then((c) => { if (!c) return; Object.assign(cs, { name: c.name, motto: c.motto ?? '', ribbon: c.ribbon ?? [3, 0, 0], pub: !!c.public, msg: '', busy: false, edit: c.id }); location.hash = '#/contest/new'; });
      break;
    }
    case 'rib-b': cs.ribbon = [Number(v), cs.ribbon[1], cs.ribbon[2]]; render(); break;
    case 'rib-p': cs.ribbon = [cs.ribbon[0], Number(v), cs.ribbon[2]]; render(); break;
    case 'rib-c': cs.ribbon = [cs.ribbon[0], cs.ribbon[1], Number(v)]; render(); break;
    case 'rib-rand': cs.ribbon = randomRibbon(); render(); break;
    case 'team-pub': cs.pub = !cs.pub; render(); break;
    case 'team-save': {
      const name = cs.name.trim(), motto = cs.motto.trim();
      const bad = name.length < 2 ? '기수 이름을 2자 이상 써 주세요' : name.length > 16 ? '16자까지 쓸 수 있어요' : textProblem(name) ?? (motto ? textProblem(motto.length < 2 ? `${motto}  ` : motto) : null);
      if (bad) { cs.msg = bad; render(); break; }
      cs.busy = true; cs.msg = ''; render();
      const input = { name, motto, ribbon: cs.ribbon, public: cs.pub };
      const job = cs.edit ? updateTeam(cs.edit, input).then(() => null) : createTeam(input);
      void job.then(async (c) => {
        cs.busy = false;
        invalidate('contest'); invalidate('grp');
        if (c) { await ensureMainTeam(c.id); track('team_create'); location.hash = `#/c/${c.code}`; }
        else { toast('고쳤어요'); history.back(); }
      }).catch((e) => { cs.busy = false; cs.msg = e instanceof Error ? e.message : '저장하지 못했어요'; render(); });
      break;
    }
    case 'team-join': {
      void joinTeam(v).then(async () => { invalidate('contest'); await ensureMainTeam(v); toast('기수에 들어갔어요'); track('team_join'); render(); })
        .catch((e) => toast(e instanceof Error ? e.message : '들어가지 못했어요'));
      break;
    }
    case 'team-random': {
      const mine = myTeamsNow() ?? [];
      if (mine.length >= MAX_TEAMS) { toast(`기수는 ${MAX_TEAMS}곳까지 들어갈 수 있어요`); break; }
      const have = new Set(mine.map((t) => t.cohort_id));
      void publicTeams().then(async (ts) => {
        const cand = ts.filter((t) => !have.has(t.id));
        const cnt = await memberCounts(cand.map((t) => t.id));
        const open = cand.filter((t) => (cnt[t.id] ?? 0) < t.max_members).sort((a, b) => (cnt[a.id] ?? 0) - (cnt[b.id] ?? 0));
        if (!open.length) { toast('자리가 있는 공개 기수가 없어요. 직접 만들어 보세요'); return; }
        const pick = open[Math.floor(Math.random() * Math.min(3, open.length))];
        await joinTeam(pick.id); invalidate('contest'); await ensureMainTeam(pick.id);
        track('team_random'); toast(`'${pick.name}' 기수에 들어갔어요`); location.hash = `#/c/${pick.code}`;
      }).catch((e) => toast(e instanceof Error ? e.message : '들어가지 못했어요'));
      break;
    }
    case 'team-leave': {
      if (!confirm('이 기수에서 나갈까요? 이번 주 기록은 기수 점수에서 빠져요.')) break;
      void leaveTeam(v).then(async () => {
        invalidate('contest');
        const prof = await getProfile().catch(() => null);
        if (prof?.main_cohort === v) await setMainTeam(null).catch(() => {});
        invalidate('profile'); toast('기수에서 나왔어요'); location.hash = '#/contest';
      }).catch((e) => toast(e instanceof Error ? e.message : '나가지 못했어요'));
      break;
    }
    case 'team-main': void setMainTeam(v).then(() => { invalidate('profile'); toast('대표 기수로 정했어요 · 랭킹에 이 약장이 보여요'); render(); }).catch(() => toast('먼저 랭킹에 한 번 올려야 정할 수 있어요')); break;
    case 'copy-award': navigator.clipboard?.writeText(location.href).then(() => toast('링크를 복사했어요')).catch(() => toast(location.href)); break;
    case 'grp-continue': {
      useSlot('cohort'); leaveRoute();
      if (!save?.game) { go('lobby'); break; }
      ui.tab = 'home'; go(save.game.ended ? 'ending' : 'home'); break;
    }
    case 'grp-join': {
      const c = cohortCached(v);
      if (!c) { toast('기수 정보를 불러오는 중이에요'); break; }
      if (!cohortOpen(c)) { toast('마감된 기수예요'); break; }
      const cur = groupState();
      if ((cur.st === 'playing' || cur.st === 'ended') && cur.save!.game.group!.code !== c.code) { toast(`'${cur.save!.game.group!.name}' 판을 먼저 끝내 주세요`); break; }
      useSlot('cohort'); leaveRoute();
      if (cur.st === 'playing' || cur.st === 'ended') { go(save!.game.ended ? 'ending' : 'home'); break; }
      rememberCohort(c.code, c.name);
      save = null; ui.pro = newPrologue(undefined, { id: c.id, code: c.code, name: c.name, seed: c.seed, day: today(0, c.created_at) });
      track('cohort_join'); go('p-intro'); break;
    }
    case 'grp-create': {
      const name = gs.name.trim();
      const bad = name.length > 16 ? '16자까지 쓸 수 있어요' : textProblem(name);
      if (bad) { gs.msg = bad; render(); break; }
      gs.busy = true; gs.msg = ''; render();
      createCohort(name).then((c) => { gs.busy = false; gs.name = ''; rememberCohort(c.code, c.name); track('cohort_create'); location.hash = `#/c/${c.code}`; })
        .catch((e) => { gs.busy = false; gs.msg = e instanceof Error ? e.message : '만들지 못했어요'; render(); });
      break;
    }
    case 'grp-code': { const code = gs.code.trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(code)) { toast('코드 6자리를 넣어 주세요'); break; } location.hash = `#/c/${code}`; break; }
    case 'grp-share': {
      const iv = inviteData(v);
      track('cohort_share');
      const url = `${baseUrl() || 'https://malttuk.com/'}#/c/${v}`;
      const text = `말뚝 · '${iv?.name ?? '우리'}' 기수 초대 · 코드 ${v}`;
      // 글 한 줄 + 링크만: 카톡이 링크 미리보기(og)를 붙여 주므로 이미지는 따로 안 보낸다
      void shareLink(text, url);
      break;
    }
    case 'gb-write': {
      const nick = gs.gbNick.trim(), body = gs.gbText.trim();
      const bad = nicknameProblem(nick) ?? textProblem(body);
      if (bad) { gs.gbMsg = bad; render(); break; }
      gs.gbBusy = true; gs.gbMsg = ''; render();
      writeGuest(nick, body).then(() => { gs.gbBusy = false; gs.gbText = ''; invalidate('gb'); toast('남겼어요'); track('guestbook_write'); render(); })
        .catch((e) => { gs.gbBusy = false; gs.gbMsg = e instanceof Error ? e.message : '올리지 못했어요'; render(); });
      break;
    }
    case 'gb-report': reportGuest(Number(v)).then(() => toast('신고했어요. 3번 쌓이면 가려져요')).catch(() => toast('신고하지 못했어요')); break;
    case 'route-daily': rk.tab = 'daily'; location.hash = '#/rank'; if (ui.route?.name === 'rank') render(); break;
    case 'start-new': useSlot('free'); { const g = save?.game ?? null; if (g?.ended && !save!.runId && ui.upload.fails < 2) { toast('먼저 지난 기록을 랭킹에 올려 주세요'); go('ending'); break; } ui.pro = null; go('p-intro'); } break;
    case 'continue': useSlot('free'); ui.tab = 'home'; go(save?.game.ended ? 'ending' : 'home'); break;
    case 'p-open': if (p && !p.open) { p.open = true; render(); } break;
    case 'p-origin': if (p) { p.origin = v as Origin; p.chosen = true; render(); } break;
    case 'p-enter': if (p) { p.open = true; go('p-focus'); } break;
    case 'p-focus': if (p) { const f = v as SchoolFocus; p.focus = p.focus.includes(f) ? p.focus.filter((x) => x !== f) : [...p.focus, f].slice(-2); render(); } break;
    case 'p-branch': if (p) { p.branch = v as Branch; render(); } break;
    case 'p-study': go('p-school'); break;
    case 'p-skip': clearInterval(schoolTimer); clearTimeout(schoolTimer); prologueGraduate(); go('p-grad'); break;
    case 'ad-eval': track('ad_click', { type: 'eval' }); openAd('eval'); break;
    case 'ad-reroll': track('ad_click', { type: 'reroll' }); openAd('reroll'); break;
    case 'ad-reward': {
      clearInterval(adTimer);
      ui.sheet = null;
      render();
      break;
    }
    case 'p-commission': {
      track('game_start', { origin: ui.pro?.origin ?? '' });
      if (!p) break;
      const game = startGame();
      const focus: [StatKey, StatKey] = p.focus.includes('리더십') ? ['command', 'tactics'] : p.focus.includes('학업') ? ['expertise', 'admin'] : ['command', 'social'];
      save = { game, focus, potentialSeen: p.fixedPot ?? p.range, metaApplied: false, log: [], runId: null };
      ui.upload = { nick: '', msg: '', busy: false, loaded: false, fails: 0, fixed: null };
      persist();
      go('p-commission');
      break;
    }
    case 'p-done': ui.pro = null; ui.assignFrom = null; ui.firstPost = true; ui.medals = earnedRibbons(save!.game); ui.medalIdx = 0; ui.queue = ['assign-ceremony', 'home']; go('medal'); break;
    case 'medal-next': if (ui.medalIdx < ui.medals.length - 1) { ui.medalIdx += 1; render(); } else { ui.medals = []; nextInQueue(); } break;

    // 홈
    case 'tab': ui.tab = v as Tab; render(); window.scrollTo(0, 0); break;
    case 'open-focus': ui.tp = null; ui.draftFocus = [...save!.focus]; ui.sheet = 'focus'; render(); break;
    case 'toggle-focus': { const k = v as StatKey; ui.draftFocus = ui.draftFocus.includes(k) ? ui.draftFocus.filter((x) => x !== k) : [...ui.draftFocus, k].slice(-2); render(); break; }
    case 'confirm-focus': save!.focus = [ui.draftFocus[0], ui.draftFocus[1]]; if (ui.tp) { (save!.tpSeen ??= []).push(ui.tp.key); save!.tpLast = save!.game.year; ui.tp = null; toast('집중 육성을 바꿨어요'); } persist(); ui.sheet = null; render(); break;
    case 'tp-open': track('turning_point', { action: 'open' }); ui.tp = { key: v, rec: (el.dataset.r ?? '').split(',') as [StatKey, StatKey] }; ui.draftFocus = [...ui.tp.rec]; ui.sheet = 'focus'; render(); break;
    case 'tp-dismiss': track('turning_point', { action: 'dismiss' }); (save!.tpSeen ??= []).push(v); save!.tpLast = save!.game.year; persist(); render(); break;
    case 'open-retire': ui.sheet = 'retire'; render(); break;
    case 'confirm-retire': save!.game = retire(g!); persist(); ui.sheet = null; go('ending'); break;
    case 'open-reset': ui.sheet = 'reset'; render(); break;
    case 'new-game': if (isFixed(g)) { ui.sheet = null; ui.report = null; useSlot('free'); go('lobby'); break; }
    // falls through
    case 'confirm-reset': if (isFixed(g)) { ui.sheet = null; render(); break; } ui.upload = { nick: '', msg: '', busy: false, loaded: false, fails: 0, fixed: null }; save = null; persist(); ui.sheet = null; ui.report = null; ui.pro = null; ui.tab = 'home'; invalidate('rank'); go(act === 'new-game' ? 'lobby' : 'p-intro'); break;
    case 'close-sheet': clearInterval(adTimer); ui.sheet = null; ui.tp = null; render(); break;
    case 'equip': meta.equipped = meta.equipped === v ? null : v; persistMeta(); render(); break;
    case 'share': track('share_link'); if (g) void share(g); break;
    case 'upload': if (g) void upload(g); break;
    case 'save-img': {
      track('save_image');
      const d = ui.route?.name === 'card' ? lastCard : g?.ended ? endingCard(g) : null;
      if (!d) break;
      toast('이미지를 만드는 중이에요');
      saveCardImage(d, imgLink()).then((how) => { if (how === 'downloaded') toast('이미지를 저장했어요'); }).catch(() => toast('이미지를 만들지 못했어요. 캡처해서 공유해 주세요'));
      break;
    }
    case 'route-home': location.hash = ''; break;
    case 'set-motion': setReduceMotion(!reduceMotion()); render(); break;
    case 'set-wipe':
      if (!settingsState.confirmWipe) { settingsState.confirmWipe = true; settingsState.msg = ''; render(); break; }
      try { localStorage.removeItem(KEY); localStorage.removeItem(META_KEY); } catch { /* 무시 */ }
      save = null; ui.pro = null; Object.assign(meta, { cleared: false, ribbons: {}, titles: [], equipped: null, runs: 0, bestRank: -1 });
      settingsState.confirmWipe = false; settingsState.msg = '이 기기의 기록을 지웠어요'; render(); break;
    case 'route-rank': rk.tab = 'top'; location.hash = '#/rank'; break;
    case 'route-mine': rk.tab = 'mine'; location.hash = '#/rank'; if (ui.route?.name === 'rank') render(); break;
    case 'route-gallery': location.hash = '#/gallery'; break;
    case 'open-card': location.hash = `#/card/${v}`; break;
    case 'open-person': location.hash = `#/p/${v}`; break;
    // v3.3 로그인
    case 'auth-link': settingsState.authMsg = ''; loginState.msg = ''; track('login_link', { provider: v }); void linkProvider(v as Provider).catch((e) => { settingsState.authMsg = loginState.msg = e instanceof Error ? e.message : '연결하지 못했어요'; render(); }); break;
    case 'nick-set': {
      const n = (val('lnick') ?? loginState.nick).trim();
      loginState.nick = n;
      const bad = nicknameProblem(n);
      if (bad) { loginState.nickMsg = bad; render(); break; }
      loginState.busy = true; loginState.nickMsg = ''; render();
      void saveProfile(n, null).then(() => {
        loginState.busy = false; invalidate('profile'); invalidate('person'); forgetPeople();
        toast(`'${n}' 이름으로 시작해요`); location.hash = '';
      }).catch((e) => { loginState.busy = false; loginState.nickMsg = e instanceof Error ? e.message.replace(/^서버 오류 \d+ · /, '') : '저장하지 못했어요'; render(); });
      break;
    }
    case 'auth-signin': loginState.conflict = null; track('login_signin', { provider: v }); signInProvider(v as Provider); break;
    case 'auth-logout': {
      if (!settingsState.confirmLogout) { settingsState.confirmLogout = true; render(); break; }
      logout(); invalidate(''); forgetPeople(); ui.lobbyTab = null; settingsState.confirmLogout = false; toast('로그아웃했어요'); location.hash = ''; break;
    }
    case 'auth-delete': {
      if (!settingsState.confirmDelete) { settingsState.confirmDelete = true; render(); break; }
      settingsState.confirmDelete = false;
      void deleteAccount().then(() => { invalidate(''); forgetPeople(); toast('계정을 지웠어요'); location.hash = ''; })
        .catch((e) => { settingsState.authMsg = e instanceof Error ? e.message : '지우지 못했어요'; render(); });
      break;
    }
    case 'go-back': if (hashMoves > 0) history.back(); else location.hash = ''; break;
    case 'rank-tab': rk.tab = v as typeof rk.tab; render(); break;
    case 'rank-origin': rk.origin = v || null; render(); break;
    case 'save-nick': void saveNickname(); break;
    case 'copy-link': {
      const id = ui.route?.name === 'card' ? ui.route.id : save?.runId;
      const url = id && baseUrl() ? `${baseUrl()}#/card/${id}` : baseUrl() || 'https://malttuk.com';
      navigator.clipboard?.writeText(url).then(() => toast('링크를 복사했어요')).catch(() => toast(url));
      break;
    }
    case 'share-card': { const url = baseUrl() ? `${baseUrl()}#/card/${v}` : ''; const text = '말뚝 · 이 커리어 어때요? 너는 몇 성까지?'; if (lastCard) void shareCard(lastCard, text, url); else void shareLink(text, url); break; }
    case 'go-dex': ui.tab = 'dex'; render(); window.scrollTo(0, 0); break;
    case 'back-ending': ui.tab = 'home'; render(); window.scrollTo(0, 0); break;

    // 결재
    case 'open-desk': ui.desk = { slot: Number(v), pick: null, back: 'home' }; go('desk'); break;
    case 'desk-pick': ui.desk.pick = v; render(); break;
    case 'desk-sign': {
      const it = g!.desk!.items[ui.desk.slot];
      save!.game = decide(g!, ui.desk.slot, ui.desk.pick!);
      (save!.log ??= []).push({ y: g!.year, s: ui.desk.slot, k: ui.desk.pick, d: it.defId, ok: save!.game.desk?.results[ui.desk.slot]?.success ?? null });
      persist(); render(); window.scrollTo(0, 0); break;
    }
    case 'desk-ok': if (ui.desk.back === 'progress') { ui.month = 7; go('progress'); } else go('home'); break;

    // 1년
    case 'next-year': ui.month = 1; go('progress'); break;
    case 'skip': {
      stopTimer();
      const needStop = g!.desk && g!.desk.items.length > 1 && !g!.desk.results[1];
      if (needStop && ui.month <= 7) { ui.desk = { slot: 1, pick: null, back: 'progress' }; go('desk'); }
      else finishYear();
      break;
    }
    case 'result-ok': ui.queue = buildQueue(ui.report!, save!.game); nextInQueue(); break;
    case 'queue-next': clearInterval(typerId); nextInQueue(); break;

    // 인사
    case 'wish': {
      if (ui.wish.includes(v)) ui.wish = ui.wish.filter((x) => x !== v);
      else if (ui.wish.length < 2) ui.wish.push(v);
      else ui.wish = [ui.wish[0], v];
      render(); break;
    }
    case 'wish-submit': {
      const before = g!.me.assignmentId;
      (save!.log ??= []).push({ y: g!.year, w: [ui.wish[0], ui.wish[1]] });
      save!.game = submitWishes(g!, [ui.wish[0], ui.wish[1]]);
      persist();
      ui.assignFrom = before; ui.firstPost = false;
      const changed = save!.game.me.assignmentId !== before;
      // 인사명령 → (지휘 방침) → 신고 → 홈
      ui.queue = ui.queue.filter((x) => x !== 'home');
      ui.queue.unshift(...(changed ? ['assign-ceremony', 'home'] as Screen[] : ['home'] as Screen[]));
      ui.orderOpen = false;
      go('order');
      break;
    }
    case 'order-open': ui.orderOpen = true; render(); window.scrollTo(0, 0); break;
    case 'policy': ui.policy = v as Policy; render(); break;
    case 'policy-ok': (save!.log ??= []).push({ y: g!.year, p: ui.policy }); save!.game = setPolicy(g!, ui.policy!); persist(); nextInQueue(); break;
  }
});

initAnalytics();
initRewarded();
prefillGuest();
applySettings();
// v3.3 로그인 화면에서 돌아왔으면 토큰 저장
const authBack = consumeAuthReturn();
if (authBack) { ui.route = null; invalidate(''); if (authBack.conflict) { loginState.conflict = authBack.conflict; location.hash = '#/login'; ui.route = { name: 'login' }; } else if (!authBack.ok) loginState.msg = authBack.msg ?? ''; }
render();
if (authBack) {
  track(authBack.ok ? 'login_ok' : 'login_fail', { kind: authBack.kind });
  if (authBack.ok) void getProfile().then((p) => { if (!p) location.hash = '#/login'; }).catch(() => {});
  if (!authBack.conflict) toast(authBack.ok ? (authBack.kind === 'link' ? '로그인했어요 · 이제 기기를 바꿔도 기록이 이어져요' : '로그인했어요') : authBack.msg ?? '로그인하지 못했어요');
}
