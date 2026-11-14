// 우리 기수(#/cohort, #/c/코드)와 방명록(#/guestbook) 화면
import { CHOICE_BY_ID } from '../data/choices';
import { RANKS } from '../data/config';
import { deskText } from '../engine/choice';
import type { Rank } from '../engine/types';
import { cohortRuns, getCohort, guestbook, myId, type CohortRow, type GuestRow, type RunRow } from '../net/api';
import { errorBox, header, load, loadingBox, rowHtml } from './social';
import { insignia } from './insignia';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const chev = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

/** 입력 상태 (main.ts가 이벤트를 처리한다) */
export const gs = { name: '', code: '', msg: '', busy: false, gbText: '', gbNick: '', gbMsg: '', gbBusy: false };

// ── 내가 만든·들어간 기수 목록 (이 기기) ──
const MY_KEY = 'malttuk-my-cohorts';
export function myCohorts(): { code: string; name: string }[] { try { return JSON.parse(localStorage.getItem(MY_KEY) ?? '[]'); } catch { return []; } }
export function rememberCohort(code: string, name: string) {
  const list = myCohorts().filter((c) => c.code !== code);
  list.unshift({ code, name });
  try { localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, 12))); } catch { /* 무시 */ }
}

/** 이 기기에서 진행 중인 우리 기수 판 */
function localGroup(): { code: string; name: string; ended: boolean; uploaded: boolean; rank: string; year: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem('malttuk-cohort-v1') ?? 'null');
    const g = s?.game;
    if (!g?.group) return null;
    return { code: g.group.code, name: g.group.name, ended: !!g.ended, uploaded: !!s.runId, rank: g.me.rank, year: g.year };
  } catch { return null; }
}

export const cohortCached = (code: string): CohortRow | null => {
  const st = load(`grp:${code}`, () => getCohort(code));
  return st.state === 'ok' ? st.data : null;
};

const daysLeft = (c: CohortRow) => Math.ceil((new Date(c.closes_at).getTime() - Date.now()) / 86400000);
/** 초대장에 넣을 값 (기수 페이지를 연 뒤에만) */
export function inviteData(code: string): { name: string; code: string; days: number; done: number; max: number } | null {
  const c = cohortCached(code);
  if (!c) return null;
  const rs = load(`grpruns:${c.id}`, () => cohortRuns(c.id));
  return { name: c.name, code: c.code, days: daysLeft(c), done: rs.state === 'ok' ? rs.data.length : 0, max: c.max_members };
}
export const cohortOpen = (c: CohortRow) => daysLeft(c) > 0;

// ── 허브: 만들기 · 코드로 참가 · 내 기수 ──
export function viewGroupHub(): string {
  const mine = myCohorts();
  const lg = localGroup();
  return `<div class="page">${header('우리 기수')}<main class="pad tight" style="padding-top:8px">
    <p class="sub" style="margin:0 4px 14px">친구들과 같은 후보·같은 동기·같은 결재함으로 출발해요. 7일 안에 한 판씩, 누가 더 멀리 가는지 겨뤄요. 최대 30명.</p>
    ${lg && !lg.uploaded ? `<button class="newnote" style="margin:0 0 12px" data-act="grp-continue"><span class="nb">진행 중</span><span><b>${esc(lg.name)}</b><span>${lg.ended ? '전역했어요 · 결과를 올려 주세요' : `${lg.rank} · ${lg.year}년`}</span></span>${chev}</button>` : ''}
    <section class="doc" style="margin:0 0 12px"><div class="hd"><span>새 기수 만들기</span></div><div class="bd">
      <input id="gname" class="inp" style="height:50px;background:var(--bg)" maxlength="16" placeholder="기수 이름 (예: 임관 동기 모임)" value="${esc(gs.name)}">
      ${gs.msg ? `<p class="small" style="margin-top:8px;color:var(--red)">${esc(gs.msg)}</p>` : ''}
      <button class="btn" style="margin-top:10px" data-act="grp-create" ${gs.busy ? 'disabled' : ''}>${gs.busy ? '만드는 중…' : '만들고 초대 링크 받기'}</button>
    </div></section>
    <section class="doc" style="margin:0 0 12px"><div class="hd"><span>초대 코드로 들어가기</span></div><div class="bd">
      <div style="display:flex;gap:8px"><input id="gcode" class="inp" style="height:46px;background:var(--bg);text-transform:uppercase" maxlength="6" placeholder="코드 6자리" value="${esc(gs.code)}"><button class="btn" style="width:92px;height:46px" data-act="grp-code">찾기</button></div>
    </div></section>
    ${mine.length ? `<section class="doc" style="margin:0"><div class="hd"><span>내 기수</span><em>이 기기 기준</em></div><div class="bd" style="padding:4px 16px">${mine.map((c) => `<a class="row" href="#/c/${c.code}"><div class="mark">${c.code.slice(0, 2)}</div><div class="g"><b>${esc(c.name)}</b><span>코드 ${c.code}</span></div>${chev}</a>`).join('')}</div></section>` : ''}
  </main><div class="bar"><button class="btn line" data-act="route-home">로비로</button></div></div>`;
}

// ── 기수 페이지 ──
type Log = { y?: number; s?: number; d?: string; k?: string; ok?: boolean | null }[];
const label = (d: string, k: string) => CHOICE_BY_ID[d]?.options.find((o) => o.key === k)?.label ?? k;

/** 나와 친구의 첫 갈림길 */
function fork(mine: Log, theirs: Log): string {
  const a = mine.filter((e) => e.d), b = theirs.filter((e) => e.d);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i].d !== b[i].d) return `${a[i].y}년부터 다른 일을 겪었어요`;
    if (a[i].k !== b[i].k) return `${a[i].y}년 '${esc(deskText(a[i].d!).title)}' · 나는 '${esc(label(a[i].d!, a[i].k!))}', 이쪽은 '${esc(label(b[i].d!, b[i].k!))}'`;
  }
  return '끝까지 같은 선택을 했어요';
}

function awards(rows: RunRow[]): string {
  if (rows.length < 2) return '';
  const card = (r: RunRow) => r.choices?.card;
  const best = (f: (r: RunRow) => number | null | undefined, lo = false) => {
    const xs = rows.filter((r) => f(r) !== null && f(r) !== undefined);
    return xs.length ? xs.sort((x, y) => (lo ? f(x)! - f(y)! : f(y)! - f(x)!))[0] : null;
  };
  const list: [string, RunRow | null, (r: RunRow) => string][] = [
    ['명예왕', best((r) => r.honor), (r) => `명예 ${r.honor}`],
    ['표창왕', best((r) => card(r)?.awards), (r) => `표창 ${card(r)?.awards}회`],
    ["탁월 장인", best((r) => r.su_count), (r) => `평정 '탁월' ${r.su_count}회`],
    ['말뚝상', best((r) => r.years), (r) => `${r.years}년 복무`],
    ['행운아', best((r) => card(r)?.luck?.pct), (r) => `운 상위 ${Math.max(1, 100 - (card(r)?.luck?.pct ?? 50))}%`],
    ['불운아', best((r) => card(r)?.luck?.pct, true), (r) => `운 하위 ${Math.max(1, card(r)?.luck?.pct ?? 50)}%`],
  ];
  return `<p class="sec">기수 시상</p><div class="doc" style="margin:0"><div class="bd" style="padding-top:16px">${list.filter(([, r]) => r).map(([t, r, f]) => `<div class="kv"><span>${t}</span><b>${esc(r!.nickname)} <span class="faint">${f(r!)}</span></b></div>`).join('')}</div></div>`;
}

export function viewGroup(code: string): string {
  const cs = load(`grp:${code}`, () => getCohort(code));
  if (cs.state !== 'ok') return `<div class="page">${header('우리 기수')}<main class="pad tight">${cs.state === 'loading' ? loadingBox : errorBox(cs.msg)}</main></div>`;
  const c = cs.data;
  if (!c) return `<div class="page">${header('우리 기수')}<main class="pad tight">${errorBox('없는 기수 코드예요. 코드를 다시 확인해 주세요')}</main><div class="bar"><button class="btn line" data-act="route-cohort">우리 기수로</button></div></div>`;
  rememberCohort(c.code, c.name);
  const rs = load(`grpruns:${c.id}`, () => cohortRuns(c.id));
  const rows = rs.state === 'ok' ? rs.data : [];
  const me = myId();
  const mineRow = rows.find((r) => r.user_id === me) ?? null;
  const lg = localGroup();
  const here = lg?.code === c.code ? lg : null;
  const left = daysLeft(c);
  const full = rows.length >= c.max_members;
  let action = '';
  if (here && !here.uploaded) action = `<button class="btn" data-act="grp-continue">${here.ended ? '결과 올리기' : `이어서 하기 · ${here.rank} · ${here.year}년`}</button>`;
  else if (mineRow) action = `<button class="btn line" data-act="grp-share" data-v="${c.code}">동기 더 초대하기</button>`;
  else if (left <= 0) action = '<button class="btn" disabled>마감된 기수예요</button>';
  else if (full) action = '<button class="btn" disabled>정원 30명이 다 찼어요</button>';
  else action = `<div class="two"><button class="btn line" data-act="grp-share" data-v="${c.code}">초대하기</button><button class="btn" data-act="grp-join" data-v="${c.code}">이 기수로 입대</button></div>`;

  let list = '';
  if (rs.state === 'loading') list = loadingBox;
  else if (rs.state === 'error') list = errorBox(rs.msg);
  else if (!rows.length) list = '<div class="doc" style="margin:0"><div class="bd" style="padding-top:20px"><p class="sub">아직 전역한 동기가 없어요. 첫 번째로 기록을 남겨 보세요.</p></div></div>';
  else list = `<div class="doc" style="margin:0"><div class="bd" style="padding:4px 16px">${rows.map((r, i) => rowHtml(r, i + 1)).join('')}</div></div>`;

  const myLog = (mineRow?.choices?.log ?? []) as Log;
  const forks = mineRow && rows.length > 1 ? `<p class="sec">갈림길</p><p class="faint" style="margin:-2px 4px 8px">같은 출발선에서 처음 다른 선택을 한 순간이에요</p>
    <div class="doc" style="margin:0"><div class="bd" style="padding:6px 16px">${rows.filter((r) => r !== mineRow).slice(0, 10).map((r) => `<div class="line-item"><div class="tick"></div><div class="g"><b>${esc(r.nickname)} · ${r.final_rank}</b><span>${fork(myLog, (r.choices?.log ?? []) as Log)}</span></div></div>`).join('')}</div></div>` : '';

  const top = rows[0];
  return `<div class="page">${header('우리 기수')}<main class="pad tight" style="padding-top:8px;padding-bottom:150px">
    <section class="doc" style="margin:0"><div class="bd" style="padding:22px 20px;text-align:center">
      <div style="display:flex;justify-content:center;min-height:64px;align-items:center">${insignia((top?.final_rank as Rank) ?? '소위', 60)}</div>
      <p class="h2" style="margin-top:10px">${esc(c.name)}</p>
      <p class="faint" style="margin-top:4px">코드 ${c.code} · 전역 ${rows.length}/${c.max_members}명 · ${left > 0 ? `마감까지 ${left}일` : '마감'}</p>
      ${mineRow ? `<p class="sub" style="margin-top:8px">내 순위 <b class="olive">${rows.indexOf(mineRow) + 1}위</b> · ${mineRow.final_rank}</p>` : ''}
    </div></section>
    <p class="sec">순위</p>
    <p class="faint" style="margin:-2px 4px 8px">최종 계급 → 명예 점수 → 복무 기간 짧은 순</p>
    ${list}
    ${awards(rows)}
    ${forks}
  </main><div class="bar">${action}</div></div>`;
}

// ── 방명록 ──
const ago = (t: string) => {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
};
const gbItem = (g: GuestRow, actions = true) => `<div class="gb">
    <div class="gh"><b>${esc(g.nickname)}</b><span>${ago(g.created_at)}</span>${actions && g.user_id !== myId() ? `<button class="gr" data-act="gb-report" data-v="${g.id}">신고</button>` : ''}</div>
    <p>${esc(g.body)}</p>
    ${g.reply ? `<div class="rep"><b>개발자 동우캉</b><p>${esc(g.reply)}</p></div>` : ''}
  </div>`;

export function viewGuestbook(): string {
  const st = load('gb:list', () => guestbook(40));
  let list = '';
  if (st.state === 'loading') list = loadingBox;
  else if (st.state === 'error') list = errorBox(st.msg);
  else if (!st.data.length) list = '<div class="doc"><div class="bd" style="padding-top:20px"><p class="sub">아직 글이 없어요. 첫 한마디를 남겨 주세요.</p></div></div>';
  else list = `<div class="doc" style="margin:0"><div class="bd" style="padding:4px 16px">${st.data.map((g) => gbItem(g)).join('')}</div></div>`;
  return `<div class="page">${header('개발자한테 한마디')}<main class="pad tight" style="padding-top:8px">
    <section class="doc" style="margin:0 0 12px"><div class="bd" style="padding-top:16px">
      <input id="gbnick" class="inp" style="height:46px;background:var(--bg)" maxlength="12" placeholder="닉네임" value="${esc(gs.gbNick)}">
      <textarea id="gbtext" class="inp" style="background:var(--bg);height:88px;margin-top:8px;padding:12px 14px;resize:none" maxlength="100" placeholder="버그, 바라는 점, 응원 한마디 (100자)">${esc(gs.gbText)}</textarea>
      ${gs.gbMsg ? `<p class="small" style="margin-top:8px;color:var(--red)">${esc(gs.gbMsg)}</p>` : ''}
      <button class="btn" style="margin-top:10px" data-act="gb-write" ${gs.gbBusy ? 'disabled' : ''}>${gs.gbBusy ? '올리는 중…' : '남기기'}</button>
      <p class="faint" style="margin-top:8px">실제 부대 이름, 연락처, 링크는 쓸 수 없어요. 신고가 3번 쌓이면 가려져요.</p>
    </div></section>
    ${list}
  </main><div class="bar"><button class="btn line" data-act="route-home">로비로</button></div></div>`;
}

/** 로비 상단 한 줄 띠 */
export function guestPreview(): string {
  const st = load('gb:pre', () => guestbook(1));
  const g = st.state === 'ok' ? st.data[0] : null;
  return `<a class="gbstrip" href="#/guestbook"><span class="nb">한마디</span><span class="tx">${g ? `<b>${esc(g.nickname)}</b> · ${esc(g.body)}` : '개발자한테 버그·건의·응원을 남겨 주세요'}</span><span class="go">쓰기 ›</span></a>`;
}

export const rankName = (i: number) => RANKS[i];
