// 공유·랭킹·갤러리·프로필 화면. 주소: #/card/<판번호>, #/rank, #/gallery
import { adSlot } from './ads';
import { SITE_PAGES, viewSite, type SitePage } from './site';
import { ASSIGNMENTS, ORIGIN, RANKS } from '../data/config';
import { RIBBONS, type Earned } from '../engine/meta';
import { ro } from '../engine/text';
import type { Rank } from '../engine/types';
import { dailyChoiceStats, dailyCount, dailyPlace, dailyRanking, getProfile, getRun, myId, myRuns, nicknameProblem, ranking, recentRuns, seasonRanking, SEASON2_FROM, saveProfile, today, type RunRow } from '../net/api';
import { CHOICE_BY_ID } from '../data/choices';
import { deskText } from '../engine/choice';
import { insignia } from './insignia';
import { prepareCard } from './cardImage';
import { viewGroup, viewGroupHub, viewGuestbook } from './group';
import { ribbonRack } from './ribbon';

export interface CardData {
  nickname: string; finalRank: Rank; origin: string; startYear: number; endYear: number; years: number; honor: boolean;
  quote: string; title: string | null; ribbons: Earned[]; pct: number; same: number; cohort: number; su: number; clean: number; awards: number;
  luck?: { exp: number; hit: number; pct: number } | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const chev = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const back = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

/** 전역 카드 (내 전역 화면과 공유 페이지가 같이 쓴다) */
export function cardHtml(d: CardData, button: string): string {
  const best = d.ribbons.slice().sort((a, b) => b.tierIndex - a.tierIndex)[0];
  return `
    <div class="xcard">
      <div class="brand">말뚝 <span class="chip">${d.honor ? '명예 전역' : '전역'}</span></div>
      <div class="hero">${insignia(d.finalRank, 92)}${d.ribbons.length ? ribbonRack(d.ribbons, 36, 4) : ''}</div>
      <p class="quote">“${esc(d.quote)}”</p>
      <p class="head"><span class="olive">${d.finalRank}</span>${ro(d.finalRank).slice(d.finalRank.length)} ${d.honor ? '명예롭게<br>' : ''}전역해요</p>
      <p class="meta2">${esc(d.nickname)} · ${esc(d.origin)} · ${d.startYear}–${d.endYear} · ${d.years}년 복무</p>
      <div class="big"><b>상위 ${d.pct}%</b><p>동기 ${d.cohort}명 중 ${d.finalRank} 이상까지 간 사람</p><span>${d.same}명 · 같은 해 임관한 동기 기준</span></div>
      <div class="three">
        <div><b>${d.su}회</b><span>평정 '탁월'</span></div>
        <div><b>${d.clean}년</b><span>무사고 지휘</span></div>
        <div><b>${d.awards}회</b><span>표창</span></div>
      </div>
      ${d.luck ? `<p class="luck">운 지수 · 기대 성공 ${d.luck.exp}회 → 실제 ${d.luck.hit}회 · <b>${d.luck.pct >= 50 ? `운 상위 ${Math.max(1, 100 - d.luck.pct)}%` : `운 하위 ${Math.max(1, d.luck.pct)}%`}</b></p>` : ''}
      <div class="tags">${d.title ? `<span class="ol">칭호 · ${esc(d.title)}</span>` : ''}${best ? `<span>${best.name}${best.tier ? ` ${best.tier}` : ''} · 약장 ${d.ribbons.length}</span>` : '<span>약장 0</span>'}</div>
      ${button}
    </div>`;
}

export function ribbonsFromRow(list: { id: string; t: number }[]): Earned[] {
  return list.map((r) => {
    const d = RIBBONS.find((x) => x.id === r.id);
    return d ? { id: d.id, name: d.name, tier: d.tiers?.[r.t], tierIndex: r.t, design: d.design } : null;
  }).filter(Boolean) as Earned[];
}

export function cardFromRow(r: RunRow): CardData {
  const c = r.choices?.card;
  return {
    nickname: r.nickname, finalRank: r.final_rank as Rank, origin: r.origin, startYear: c?.start ?? 2027, endYear: c?.end ?? 2027 + r.years,
    years: r.years, honor: c?.honor ?? false, quote: r.quote ?? '', title: r.title, ribbons: ribbonsFromRow(r.ribbons ?? []),
    pct: c?.pct ?? 0, same: c?.same ?? 0, cohort: c?.cohort ?? 30, su: r.su_count, clean: c?.clean ?? 0, awards: c?.awards ?? 0, luck: c?.luck ?? null,
  };
}

// ── 라우팅·데이터 ──
export type Route = { name: 'card'; id: string } | { name: 'rank' } | { name: 'gallery' } | { name: 'group'; code: string | null } | { name: 'guestbook' } | { name: 'site'; page: SitePage } | null;
export function routeOf(hash: string): Route {
  const m = hash.match(/^#\/card\/([\w-]+)/);
  if (m) return { name: 'card', id: m[1] };
  if (hash.startsWith('#/rank')) return { name: 'rank' };
  const c = hash.match(/^#\/c\/([A-Za-z0-9]{6})/);
  if (c) return { name: 'group', code: c[1].toUpperCase() };
  if (hash.startsWith('#/cohort')) return { name: 'group', code: null };
  if (hash.startsWith('#/guestbook')) return { name: 'guestbook' };
  if (hash.startsWith('#/gallery')) return { name: 'gallery' };
  const sp = hash.replace(/^#\//, '') as SitePage;
  if (SITE_PAGES.includes(sp)) return { name: 'site', page: sp };
  return null;
}

type Load<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; msg: string };
const cache = new Map<string, Load<unknown>>();
let rerender: () => void = () => {};
export function setRerender(f: () => void) { rerender = f; }
export function load<T>(key: string, f: () => Promise<T>): Load<T> {
  const hit = cache.get(key) as Load<T> | undefined;
  if (hit) return hit;
  cache.set(key, { state: 'loading' });
  f().then((data) => { cache.set(key, { state: 'ok', data }); rerender(); })
    .catch((e) => { cache.set(key, { state: 'error', msg: e instanceof Error ? e.message : '불러오지 못했어요' }); rerender(); });
  return { state: 'loading' };
}
export function invalidate(prefix = '') { for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k); }

export let lastCard: CardData | null = null;
export const rk = { tab: 'top' as 'daily' | 'hq' | 'top' | 'mine', day: 0, origin: null as string | null, nick: '', nickMsg: '' };

export const loadingBox = '<div class="doc"><div class="bd" style="padding-top:22px"><p class="sub">불러오는 중이에요…</p></div></div>';
export const errorBox = (m: string) => `<div class="doc"><div class="bd" style="padding-top:22px"><p class="sub">${esc(m)}</p><p class="faint" style="margin-top:6px">인터넷 연결을 확인하고 다시 열어 주세요.</p></div></div>`;

export function header(title: string, sub = ''): string {
  return `<header class="top"><button class="iconbtn" style="margin:0 0 0 -8px" data-act="route-home" aria-label="게임으로">${back}</button><span class="t">${title}</span><span class="sp"></span>${sub}</header>`;
}

export function rowHtml(r: RunRow, n: number | null): string {
  const me = r.user_id === myId();
  return `<button class="rrow ${me ? 'me' : ''}" data-act="open-card" data-v="${r.id}">
    ${n !== null ? `<span class="no">${n}</span>` : ''}
    <span class="ri">${insignia(r.final_rank as Rank, 22, false)}</span>
    <span class="g"><b>${esc(r.nickname)}${me ? ' <span class="chip on">나</span>' : ''}</b><span>${esc(r.best_billet ?? r.final_rank)} · ${esc(r.origin)} · 평정 탁월 ${r.su_count}회</span></span>
    <span class="rv">${r.honor !== null && r.honor !== undefined ? `명예 ${r.honor}` : r.rank_index >= 6 ? `★ ${r.rank_index - 5}` : `약장 ${(r.ribbons ?? []).length}`}</span>
  </button>`;
}

function podium(list: RunRow[]): string {
  const top = [list[1], list[0], list[2]];
  return `<div class="podium">${top.map((r, i) => {
    if (!r) return '<div class="pd empty"></div>';
    const place = i === 1 ? 1 : i === 0 ? 2 : 3;
    return `<button class="pd ${place === 1 ? 'first' : ''}" data-act="open-card" data-v="${r.id}"><span class="pn">${place}</span>${insignia(r.final_rank as Rank, place === 1 ? 46 : 38)}<b>${esc(r.nickname)}</b><span>${esc(r.best_billet ?? r.final_rank)} · ${esc(r.origin)}</span>${r.title ? `<i class="chip on">${esc(r.title)}</i>` : ''}</button>`;
  }).join('')}</div>`;
}

const HQ_ORDER = ['chief', 'commander', 'corps', 'hq_vcs', 'division', 'hq_dcs', 'brigade', 'deputy_div', 'regiment', 'hq_chief', 'battalion', 'corps_staff', 'company', 'platoon'];

function viewRank(): string {
  // 명예의 전당: rk.day -1 = 시즌 2 전체, -2 = 시즌 1 전체, 0~6 = 날짜
  if (rk.tab !== 'top' && rk.day < 0) rk.day = 0;
  const season = rk.day === -1 ? 2 : rk.day === -2 ? 1 : null;
  const date = today(Math.max(0, rk.day));
  const tabs = `<div class="seg">${([['daily', '오늘의 기수'], ['top', '명예의 전당'], ['hq', '사령부'], ['mine', '나의 기록']] as const).map(([k, l]) => `<button class="${rk.tab === k ? 'on' : ''}" data-act="rank-tab" data-v="${k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (rk.tab === 'mine') body = viewMine();
  else {
    const days = Array.from({ length: 7 }, (_, i) => i);
    const seasonOpts = rk.tab === 'top' ? `<option value="-1" ${rk.day === -1 ? 'selected' : ''}>시즌 2 전체 · ${SEASON2_FROM.slice(5).replace('-', '.')}~</option><option value="-2" ${rk.day === -2 ? 'selected' : ''}>시즌 1 전체 · 보관</option>` : '';
    const ctrl = `<div class="ctrl"><select data-act="noop" id="rday" aria-label="날짜">${seasonOpts}${days.map((i) => `<option value="${i}" ${i === rk.day ? 'selected' : ''}>${i === 0 ? '오늘' : i === 1 ? '어제' : `${i}일 전`} ${today(i).slice(5).replace('-', '.')}${rk.tab === 'top' && today(i) < SEASON2_FROM ? ' · 시즌 1' : ''}</option>`).join('')}</select></div>`;
    const chips = rk.tab === 'top' ? `<div class="chips filt">${[null, ...Object.keys(ORIGIN)].map((o) => `<button class="fchip ${rk.origin === o ? 'on' : ''}" data-act="rank-origin" data-v="${o ?? ''}">${o ?? '전체'}</button>`).join('')}</div>` : '';
    const st = rk.tab === 'daily' ? load(`rank:daily:${date}`, () => dailyRanking(date, 100))
      : season ? load(`rank:season${season}:${rk.origin ?? ''}`, () => seasonRanking(season, rk.origin, 100))
      : load(`rank:${date}:${rk.tab === 'hq' ? 'all300' : rk.origin ?? ''}`, () => ranking(date, rk.tab === 'hq' ? null : rk.origin, rk.tab === 'hq' ? 300 : 100));
    let list = '';
    if (st.state === 'loading') list = loadingBox;
    else if (st.state === 'error') list = errorBox(st.msg);
    else if (!st.data.length) list = `<div class="doc"><div class="bd" style="padding-top:22px"><p class="sub">${rk.day === 0 ? (rk.tab === 'daily' ? '오늘의 기수에서 전역한 사람이 아직 없어요. 첫 번째가 되어 보세요!' : '오늘 전역한 사람이 아직 없어요. 첫 번째가 되어 보세요!') : season ? '이 시즌 기록이 아직 없어요.' : '이 날은 기록이 없어요.'}</p></div></div>`;
    else if (rk.tab === 'hq') {
      const best = new Map<string, RunRow>();
      for (const r of st.data) { const id = ASSIGNMENTS.find((a) => a.name === r.best_billet)?.id; if (id && !best.has(id)) best.set(id, r); }
      const seats = HQ_ORDER.filter((id) => best.has(id));
      list = `<p class="faint" style="margin:4px 4px 10px">그날 그 자리로 전역한 사람 중 최고 기록이에요</p><div class="doc" style="margin:0"><div class="bd" style="padding:6px 16px">${seats.map((id) => `<div class="seat"><span class="sn">${ASSIGNMENTS.find((a) => a.id === id)!.name}</span>${rowHtml(best.get(id)!, null)}</div>`).join('')}</div></div>`;
    } else {
      const rows = st.data.slice(3);
      const box = (part: RunRow[], from: number) => part.length ? `<div class="doc" style="margin:10px 0 0"><div class="bd" style="padding:4px 16px">${part.map((r, i) => rowHtml(r, from + i)).join('')}</div></div>` : '';
      list = podium(st.data) + box(rows.slice(0, 7), 4) + (rows.length > 7 ? adSlot('rank') : '') + box(rows.slice(7), 11);
    }
    const note = season === 1 ? '<p class="faint" style="margin:4px 4px 10px">시즌 1은 잠재력이 크게 갈리던 시절 기록이에요. 한 사람당 최고 기록 하나만 보여요</p>'
      : season === 2 ? '<p class="faint" style="margin:4px 4px 10px">시즌 2 전체 기록이에요. 한 사람당 최고 기록 하나만 보여요</p>' : '';
    body = `${ctrl}${chips}${note}${list}`;
  }
  return `<div class="page">${header('랭킹')}<main class="pad tight" style="padding-top:8px">
    <p class="sub" style="margin:0 4px 12px">${rk.tab === 'daily' ? '같은 날 같은 출발선 · 최종 계급 → 명예 점수 → 복무 기간 짧은 순' : '자유 플레이 · 최종 계급 → 명예 점수 → 복무 기간 짧은 순'}</p>
    ${tabs}${body}</main>
    <div class="bar"><button class="btn" data-act="route-home">게임으로</button></div></div>`;
}

function viewMine(): string {
  const prof = load('profile', getProfile);
  const runs = load('mine', myRuns);
  const nick = prof.state === 'ok' && prof.data ? prof.data.nickname : '';
  const profBox = `<div class="doc" style="margin:0 0 10px"><div class="hd"><span>프로필</span></div><div class="bd">
      ${prof.state === 'loading' ? '<p class="sub">불러오는 중이에요…</p>' : prof.state === 'error' ? `<p class="sub">${esc(prof.msg)}</p>` : `
      <div class="kv"><span>닉네임</span><b>${nick ? esc(nick) : '아직 없어요'}</b></div>
      <div style="display:flex;gap:8px;margin-top:12px"><input id="nick" class="inp" style="height:46px" maxlength="12" placeholder="새 닉네임" value="${esc(rk.nick)}"><button class="btn" style="width:92px;height:46px" data-act="save-nick">저장</button></div>
      ${rk.nickMsg ? `<p class="faint" style="margin-top:6px">${esc(rk.nickMsg)}</p>` : ''}`}
    </div></div>`;
  let list = '';
  if (runs.state === 'loading') list = loadingBox;
  else if (runs.state === 'error') list = errorBox(runs.msg);
  else if (!runs.data.length) list = '<div class="doc" style="margin:0"><div class="bd" style="padding-top:22px"><p class="sub">아직 올린 기록이 없어요. 전역하면 여기에 쌓여요.</p></div></div>';
  else list = `<div class="doc" style="margin:0"><div class="hd"><span>내 커리어</span><em>${runs.data.length}판</em></div><div class="bd" style="padding:4px 16px">${runs.data.map((r) => rowHtml(r, null)).join('')}</div></div>`;
  return profBox + list;
}

function viewGallery(): string {
  const st = load('gallery', () => recentRuns(40));
  let body = '';
  if (st.state === 'loading') body = loadingBox;
  else if (st.state === 'error') body = errorBox(st.msg);
  else if (!st.data.length) body = '<div class="doc"><div class="bd" style="padding-top:22px"><p class="sub">아직 올라온 커리어가 없어요.</p></div></div>';
  else body = `<div class="gal">${st.data.map((r, i) => `${i && i % 8 === 0 && adSlot('gallery') ? `<div class="galad">${adSlot('gallery')}</div>` : ''}<button class="gcard" data-act="open-card" data-v="${r.id}">
      ${insignia(r.final_rank as Rank, 40)}
      <b>${esc(r.nickname)}</b><span>${r.final_rank} · ${esc(r.best_billet ?? '')}</span><span class="faint">${r.years}년 · 약장 ${(r.ribbons ?? []).length}</span>
      ${r.quote ? `<i>“${esc(r.quote)}”</i>` : ''}</button>`).join('')}</div>`;
  return `<div class="page">${header('커리어 갤러리')}<main class="pad tight" style="padding-top:8px"><p class="sub" style="margin:0 4px 12px">방금 전역한 사람들의 커리어예요</p>${body}</main>
    <div class="bar"><button class="btn" data-act="route-home">나도 도전하기</button></div></div>`;
}

function viewCard(id: string): string {
  const st = load(`card:${id}`, () => getRun(id));
  let body = '';
  if (st.state === 'loading') body = loadingBox;
  else if (st.state === 'error') body = errorBox(st.msg);
  else if (!st.data) body = errorBox('카드를 찾을 수 없어요');
  else {
    const r = st.data;
    const d = cardFromRow(r);
    lastCard = d;
    void prepareCard(d, location.href.startsWith('http') ? location.host + location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') : '').catch(() => {});
    body = cardHtml(d, `<div class="sharerow"><button class="share alt" data-act="save-img">이미지 저장</button><button class="share" data-act="share-card" data-v="${r.id}">카드 공유</button></div><button class="link" style="margin:6px auto 0;display:block;font-size:13px" data-act="copy-link">링크만 복사</button>`) +
      `<div class="doc" style="margin:12px 0 0"><div class="bd" style="padding-top:18px">
        <div class="kv"><span>최고 보직</span><b>${esc(r.best_billet ?? '-')}</b></div>
        <div class="kv"><span>병과</span><b>${esc(r.branch)}</b></div>
        ${r.rival_result ? `<div class="kv"><span>라이벌</span><b>${esc(r.rival_result)}</b></div>` : ''}
        <div class="kv"><span>전역일</span><b>${r.ended_on.replace(/-/g, '.')}</b></div>
      </div></div>
      ${adSlot('card')}`;
  }
  return `<div class="page">${header('전역 카드')}<main class="pad tight" style="padding-top:8px">${body}</main>
    <div class="bar"><div class="two"><button class="btn line" data-act="route-rank">랭킹 보기</button><button class="btn" data-act="route-home">나도 몇 성까지?</button></div></div></div>`;
}

export function viewRoute(r: NonNullable<Route>): string {
  if (r.name === 'card') return viewCard(r.id);
  if (r.name === 'gallery') return viewGallery();
  if (r.name === 'site') return viewSite(r.page);
  if (r.name === 'group') return r.code ? viewGroup(r.code) : viewGroupHub();
  if (r.name === 'guestbook') return viewGuestbook();
  return viewRank();
}

/** 시작 화면용: 오늘의 랭킹 3위까지 */
export function rankPreview(): string {
  const st = load(`rank:daily:${today()}:3`, () => dailyRanking(today(), 3));
  let body = '';
  if (st.state === 'loading') body = '<p class="sub">불러오는 중이에요…</p>';
  else if (st.state === 'error') body = '<p class="sub">랭킹을 불러오지 못했어요</p>';
  else if (!st.data.length) body = '<p class="sub">오늘의 기수에서 전역한 사람이 아직 없어요. 첫 번째가 되어 보세요!</p>';
  else body = st.data.slice(0, 3).map((r, i) => rowHtml(r, i + 1)).join('');
  return `<section class="doc" style="margin:0"><div class="hd"><span>오늘의 기수 순위</span><button class="more" data-act="route-daily">전체 보기 ${chev}</button></div><div class="bd" style="padding:6px 16px 12px">${body}</div>
    <div style="display:flex;border-top:1px solid var(--line)"><button class="half" data-act="route-gallery">커리어 갤러리</button><button class="half" data-act="route-mine">나의 기록</button></div></section>`;
}

export async function saveNickname(): Promise<void> {
  const n = rk.nick.trim();
  const problem = nicknameProblem(n);
  if (problem) { rk.nickMsg = problem; rerender(); return; }
  try { await saveProfile(n, null); rk.nickMsg = '저장했어요'; rk.nick = ''; invalidate('profile'); }
  catch { rk.nickMsg = '저장하지 못했어요. 다시 시도해 주세요'; }
  rerender();
}

export const rankList = (n: number) => RANKS[n];

// ── 오늘의 기수 ──
/** 로비 카드 조각: 'count' = 오늘 참가 인원, 'yesterday' = 어제 1위 */
export function dailyCard(kind: 'count' | 'yesterday'): string {
  if (kind === 'count') {
    const st = load(`dcount:${today()}`, () => dailyCount(today()));
    return st.state === 'ok' ? `전역 ${st.data}명` : '';
  }
  const y = today(1);
  const st = load(`rank:daily:${y}:1`, () => dailyRanking(y, 1));
  if (st.state !== 'ok' || !st.data.length) return '';
  const r = st.data[0];
  return `<p class="faint" style="margin-top:8px">어제 1위 · ${esc(r.nickname)} ${r.final_rank} · 명예 ${r.honor ?? 0}</p>`;
}

export interface DailyMine { day: string; rank_index: number; honor: number; years: number; log: { d?: string; k?: string; ok?: boolean | null }[] }
/** 전역 화면: 오늘의 기수 순위와 '남들과 달랐던 선택' */
export function dailyResult(m: DailyMine): string {
  const place = load(`dplace:${m.day}:${m.rank_index}:${m.honor}:${m.years}`, () => dailyPlace(m.day, m));
  const count = load(`dcount:${m.day}`, () => dailyCount(m.day));
  const stats = load(`dstats:${m.day}`, () => dailyChoiceStats(m.day));
  const head = place.state === 'ok' && count.state === 'ok'
    ? `<div class="big" style="margin:0"><b>${count.data}명 중 ${place.data}위</b><p>${dayLabel2(m.day)} 기수 · 같은 출발선에서 겨뤘어요</p><span>상위 ${Math.max(1, Math.round((place.data / Math.max(1, count.data)) * 100))}%</span></div>`
    : `<p class="sub">${place.state === 'error' ? esc(place.msg) : '순위를 불러오는 중이에요…'}</p>`;
  let picks = '';
  if (stats.state === 'ok' && stats.data.length) {
    const by = new Map<string, Map<string, { n: number; ok: number }>>();
    for (const r of stats.data) { if (!by.has(r.def_id)) by.set(r.def_id, new Map()); by.get(r.def_id)!.set(r.option_key, { n: r.n, ok: r.ok }); }
    const seen = new Set<string>();
    const rows = m.log.filter((e) => e.d && e.k && CHOICE_BY_ID[e.d] && !seen.has(e.d) && seen.add(e.d)).map((e) => {
      const opts = by.get(e.d!);
      const total = opts ? [...opts.values()].reduce((a, b) => a + b.n, 0) : 0;
      const mine = opts?.get(e.k!);
      const share = total ? Math.round(((mine?.n ?? 0) / total) * 100) : 0;
      const top = opts ? [...opts.entries()].sort((a, b) => b[1].n - a[1].n)[0] : null;
      return { e, share, total, top, okRate: mine ? Math.round(mine.ok * 100) : null };
    }).filter((x) => x.total >= 3);
    const same = rows.filter((x) => x.top && x.top[0] === x.e.k).length;
    const rare = [...rows].sort((a, b) => a.share - b.share).slice(0, 5);
    const label = (defId: string, key: string) => CHOICE_BY_ID[defId].options.find((o) => o.key === key)?.label ?? key;
    picks = rows.length ? `<p class="sec">남들과 달랐던 선택</p>
      <p class="faint" style="margin:-2px 4px 8px">결재 ${rows.length}건 중 ${same}건은 다수와 같은 선택이었어요</p>
      <div class="doc" style="margin:0"><div class="bd" style="padding:6px 16px">${rare.map((x) => `<div class="line-item"><div class="tick"></div><div class="g"><b>${esc(deskText(x.e.d!).title)}</b><span>내 선택 '${esc(label(x.e.d!, x.e.k!))}' · ${x.share}%가 같은 선택${x.okRate !== null ? ` · 성공률 ${x.okRate}%` : ''}${x.top && x.top[0] !== x.e.k ? ` · 다수는 '${esc(label(x.e.d!, x.top[0]))}'` : ''}</span></div><em>${x.e.ok ? '성공' : x.e.ok === false ? '실패' : ''}</em></div>`).join('')}</div></div>` : '';
  } else if (stats.state === 'error') picks = '';
  return `<p class="sec">오늘의 기수 결과</p><div class="doc" style="margin:0"><div class="bd" style="padding-top:18px">${head}</div></div>${picks}`;
}
const dayLabel2 = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
export const invalidateDaily = () => { invalidate('dplace'); invalidate('dcount'); invalidate('dstats'); invalidate('rank:daily'); };
