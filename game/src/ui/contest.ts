// v3.3 기수 대항전 화면: 대항전(#/contest), 기수 만들기(#/contest/new), 대항전 기수 페이지(#/c/코드), 표창장(#/award/코드/주)
// 로비의 대항전 문서, 전역 화면의 팀 반영, 랭킹 닉네임 옆 약장도 여기서 만든다
import { CONTEST_FROM, contestOpen, daysLeftInWeek, MAX_TEAMS, personScore, teamScore, weekEnd, weekNo, weekOf, prevWeek } from '../engine/contest';
import type { Rank } from '../engine/types';
import {
  contestBoard, contestTotals, getProfile, memberCounts, myId, myTeams, nicknames, publicTeams, teamHonors, teamMembers, teamPlaces, teamTags, today, weekRuns,
  type BoardRow, type CohortRow, type Honors, type MyTeam, type RunRow,
} from '../net/api';
import { awards } from './group';
import { insignia } from './insignia';
import { errorBox, header, load, loadingBox, refresh } from './social';
import { RIB_BASES, RIB_COLORS, RIB_PATTERNS, teamRibbon } from './teamRibbon';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const chev = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

/** 기수 만들기 · 고치기 입력 상태 (main.ts가 이벤트를 처리한다) */
export const cs = { name: '', motto: '', ribbon: [0, 0, 1] as number[], pub: true, msg: '', busy: false, edit: null as string | null };

/** 이번 회차 월요일. 첫 회차 전이면 첫 회차 */
export const curWeek = () => (contestOpen(today()) ? weekOf(today()) : CONTEST_FROM);
/** 시작 전: 지금까지 모인 기수 · 사람 */
const totalsL = () => load('contest:totals', contestTotals);
const totalsText = () => { const t = totalsL(); return t.state === 'ok' ? `${t.data.teams}개 기수 · ${t.data.people}명` : null; };
const dLeft = () => (contestOpen(today()) ? daysLeftInWeek(today()) : null);
const docNo = (week: string) => `제${week.slice(0, 4)}-${weekNo(week)}호`;

// ── 데이터 ──
export const mineL = () => load('contest:mine', () => (myId() ? myTeams() : Promise.resolve([] as MyTeam[])));
/** 내 대항전 기수 (불러오는 중이면 null) */
export function myTeamsNow(): MyTeam[] | null {
  const st = mineL();
  return st.state === 'ok' ? st.data : st.state === 'error' ? [] : null;
}
const boardL = (week: string) => load(`contest:board:${week}`, () => contestBoard(week));
const honorsL = (ids: string[]) => load(`contest:hon:${[...ids].sort().join(',')}`, () => teamHonors(ids));
const honorOf = (ids: string[], id: string): Honors | null => { const st = honorsL(ids); return st.state === 'ok' ? st.data.find((h) => h.cohort_id === id) ?? null : null; };

function placeOf(rows: BoardRow[], id: string): { place: number; score: number; n: number; gap: number | null } | null {
  const i = rows.findIndex((r) => r.cohort_id === id);
  if (i < 0) return null;
  const r = rows[i];
  const place = r.place ?? i + 1;
  const third = rows[2];
  return { place, score: r.score, n: r.n, gap: place > 3 && third ? third.score - r.score : null };
}

// ── 공통 조각 ──
const teamRow = (o: { ribbon: number[] | null | undefined; name: string; sub: string; right?: string; href?: string; me?: boolean; n?: number | string; hon?: Honors | null; w?: number }) => {
  const inner = `${o.n !== undefined ? `<span class="tn">${o.n}</span>` : ''}<span class="trb">${teamRibbon(o.ribbon, o.w ?? 40, o.hon)}</span><span class="g"><b>${esc(o.name)}</b><span>${o.sub}</span></span>${o.right ?? ''}`;
  return o.href ? `<a class="trow2 ${o.me ? 'me' : ''}" href="${o.href}">${inner}</a>` : `<div class="trow2 ${o.me ? 'me' : ''}">${inner}</div>`;
};
const scoreCell = (score: number | string, sub = '') => `<span class="tsc"><b>${score}</b>${sub ? `<span>${sub}</span>` : ''}</span>`;

// ── 로비: 타일 한 줄 · 대항전 문서 ──
export function contestTileSub(): string {
  if (!contestOpen(today())) { const t = totalsL(); return t.state === 'ok' && t.data.teams ? `<span class="todo">${t.data.teams}개 기수</span> · ${md(CONTEST_FROM)}` : `<span class="todo">${md(CONTEST_FROM)} 시작</span>`; }
  const mine = myTeamsNow();
  const left = `D-${dLeft()}`;
  if (!mine?.length) return `기수 없음 · ${left}`;
  const b = boardL(curWeek());
  const places = b.state === 'ok' ? mine.map((t) => placeOf(b.data, t.cohort_id)?.place).filter((x): x is number => !!x) : [];
  return places.length ? `<span class="todo">${Math.min(...places)}위</span> · ${left}` : `<span class="todo">출전 전</span> · ${left}`;
}

/** 로비 대항전 문서. play: 이번 주 판 버튼 상태 */
export function contestDoc(play: { label: string; act: string }): string {
  const week = curWeek(), open = contestOpen(today());
  const mine = myTeamsNow();
  const b = boardL(week);
  const rows = b.state === 'ok' ? b.data : [];
  const ids = (mine ?? []).map((t) => t.cohort_id).concat(rows.slice(0, 3).map((r) => r.cohort_id));
  const head = `<div class="hd">
    <div class="dn">주간 공문 · ${docNo(week)} · ${md(week)}~${md(weekEnd(week))}${open ? ` · <b>D-${dLeft()}</b>` : ''}</div>
    <div class="tt">기수 대항전<em>${open ? `${rows.length}개 기수` : `첫 회차 ${md(CONTEST_FROM)}(월)`}</em></div>
    ${!open && totalsText() ? `<p class="ds">지금까지 <b class="olive">${totalsText()}</b>이 모였어요</p>` : mine?.length ? '' : '<p class="ds">팀으로 겨루는 한 주 · 못하는 친구를 불러도 점수가 깎이지 않아요</p>'}
  </div>`;
  let body = '';
  if (mine?.length) {
    body += mine.map((t) => {
      const p = placeOf(rows, t.cohort_id);
      return teamRow({ ribbon: t.cohorts.ribbon, name: t.cohorts.name, href: `#/c/${t.cohorts.code}`, hon: honorOf(ids, t.cohort_id),
        sub: `${t.cohorts.no ?? '-'}기 · ${p ? `전역 ${p.n}명${p.gap !== null ? ` · 3위까지 ${p.gap}점` : ''}` : open ? '이번 주 전역 2명부터 순위' : '동기를 모아 두세요'}`,
        right: p ? `<span class="tsc"><b class="olive">${p.place}위</b><span>${p.score}</span></span>` : '' });
    }).join('');
  }
  if (rows.length) {
    body += `<div class="lk"><span>이번 주 순위</span><a href="#/contest">전체 ›</a></div>`;
    body += rows.slice(0, 3).map((r, i) => teamRow({ n: r.place ?? i + 1, ribbon: r.ribbon, name: r.name, sub: `${r.no ?? '-'}기 · 전역 ${r.n}명`, right: scoreCell(r.score), href: `#/c/${r.code}`, hon: honorOf(ids, r.cohort_id), w: 36 })).join('');
  } else if (open) body += `<p class="sub" style="margin-top:8px">아직 순위에 오른 기수가 없어요. 전역 2명이면 순위에 올라요.</p>`;
  else if (!mine?.length) body += `<p class="sub" style="margin-top:4px">${md(CONTEST_FROM)}(월) 0시부터 매주 열려요. 지금 기수를 만들거나 들어가 두세요.</p>`;
  const btns = mine?.length
    ? `<div class="two"><button class="btn line" data-act="grp-share" data-v="${mine[0].cohorts.code}">동기 부르기</button><button class="btn" data-act="${play.act}" ${open ? '' : 'disabled'}>${open ? play.label : `${md(CONTEST_FROM)}부터 출전`}</button></div>`
    : `<div class="two"><button class="btn line" data-act="team-new">기수 만들기</button><button class="btn" data-act="team-random">아무 기수나 들어가기</button></div>`;
  const pubN = load('contest:public', async () => { const ts = await publicTeams(); return { ts, cnt: await memberCounts(ts.map((t) => t.id)) }; });
  const pubCount = pubN.state === 'ok' ? pubN.data.ts.filter((t) => (pubN.data.cnt[t.id] ?? 0) < t.max_members).length : null;
  const go = `<a class="golink" href="#/contest"><span class="g"><b>대항전 전체 보기</b><span>전체 순위 · ${pubCount ? `공개 기수 ${pubCount}곳` : '공개 기수'} · 지난주 표창 · 포상 규칙</span></span>${chev}</a>`;
  return `<section class="doc lcard">${head}<div class="bd">${body}${go}${btns}
    <p class="lmore"><a href="#/cohort">친선 기수 (7일 한 판) ›</a></p></div></section>`;
}

// ── 전역 화면: 팀 반영 ──
export function contestAfter(week: string): string {
  const mine = myTeamsNow();
  const b = boardL(week);
  if (!mine?.length) return '';
  const rows = b.state === 'ok' ? b.data : [];
  return `<p class="sec">내 기수에 들어갔어요</p><div class="doc" style="margin:0 0 12px"><div class="bd" style="padding:4px 16px">${mine.map((t) => {
    const p = placeOf(rows, t.cohort_id);
    return teamRow({ ribbon: t.cohorts.ribbon, name: t.cohorts.name, href: `#/c/${t.cohorts.code}`, sub: p ? `팀 점수 ${p.score} · 전역 ${p.n}명${p.gap !== null ? ` · 3위까지 ${p.gap}점` : ''}` : '전역 2명부터 순위에 올라요', right: p ? `<span class="tsc"><b class="olive">${p.place}위</b></span>` : '' });
  }).join('')}</div></div>`;
}

// ── 대항전 페이지 ──
export function viewContest(): string {
  const week = curWeek(), open = contestOpen(today());
  const b = boardL(week);
  const mine = myTeamsNow() ?? [];
  const mineIds = new Set(mine.map((t) => t.cohort_id));
  const rows = b.state === 'ok' ? b.data : [];
  const last = open ? prevWeek(week) : null;
  const lb = last && last >= CONTEST_FROM ? boardL(last) : null;
  const lrows = lb?.state === 'ok' ? lb.data.slice(0, 3) : [];
  const ids = [...mineIds, ...rows.slice(0, 30).map((r) => r.cohort_id), ...lrows.map((r) => r.cohort_id)];

  const notice = `<section class="doc lcard" style="margin-top:4px"><div class="hd">
    <div class="dn">주간 공문 · ${docNo(week)}</div>
    <div class="tt">제${weekNo(week)}주 기수 대항전<em>${open ? `D-${dLeft()}` : `${md(CONTEST_FROM)} 시작`}</em></div>
    <p class="ds">${md(week)}(월) ~ ${md(weekEnd(week))}(일) 24시 · 모든 기수가 같은 세상, 난이도 보통 · 한 사람 한 주 한 판</p>
  </div><div class="bd">
    <div class="kv"><span>${open ? '참가' : '지금까지 모임'}</span><b>${open ? `${rows.length}개 기수 · ${rows.reduce((a, r) => a + r.n, 0)}명` : totalsText() ?? '불러오는 중…'}</b></div>
    <div class="kv"><span>팀 점수</span><b>상위 3명 평균 + 4번째부터 +5</b></div>
    <div class="kv"><span>포상</span><b>1~3위 표창장 · 약장에 별</b></div>
  </div></section>`;

  const mineBox = mine.length ? `<p class="secx"><span>내 기수 ${mine.length}곳</span><span>${MAX_TEAMS}곳까지</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:4px 16px">${mine.map((t) => {
    const p = placeOf(rows, t.cohort_id);
    return teamRow({ ribbon: t.cohorts.ribbon, name: t.cohorts.name, href: `#/c/${t.cohorts.code}`, me: true, hon: honorOf(ids, t.cohort_id),
      sub: `${t.cohorts.no ?? '-'}기 · ${p ? `전역 ${p.n}명${p.gap !== null ? ` · 3위까지 ${p.gap}점` : ''}` : '순위 전'}`, right: p ? `<span class="tsc"><b class="olive">${p.place}위</b><span>${p.score}</span></span>` : '' });
  }).join('')}</div></section>` : '';

  let board = '';
  if (b.state === 'loading') board = loadingBox;
  else if (b.state === 'error') board = errorBox(b.msg);
  else if (!rows.length) board = `<section class="doc" style="margin-top:0"><div class="bd" style="padding-top:20px"><p class="sub">${open ? '아직 순위에 오른 기수가 없어요. 전역 2명이면 순위에 올라요.' : `${md(CONTEST_FROM)}(월) 0시에 첫 회차가 열려요.`}</p></div></section>`;
  else board = `<section class="doc" style="margin-top:0"><div class="bd" style="padding:4px 16px">${rows.map((r, i) => teamRow({ n: r.place ?? i + 1, ribbon: r.ribbon, name: r.name, sub: `${r.no ?? '-'}기 · 전역 ${r.n}명`, right: scoreCell(r.score), href: `#/c/${r.code}`, me: mineIds.has(r.cohort_id), hon: honorOf(ids, r.cohort_id), w: 36 })).join('')}</div></section>`;

  const lastBox = lrows.length ? `<p class="secx"><span>지난주 표창 · 제${weekNo(last!)}주</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:4px 16px">${lrows.map((r, i) => teamRow({ n: r.place ?? i + 1, ribbon: r.ribbon, name: r.name, sub: `${r.no ?? '-'}기 · 팀 점수 ${r.score}`, right: '<span class="chip on">표창장</span>', href: `#/award/${r.code}/${last}`, hon: honorOf(ids, r.cohort_id), w: 36 })).join('')}</div></section>` : '';

  const pub = load('contest:public', async () => { const ts = await publicTeams(); return { ts, cnt: await memberCounts(ts.map((t) => t.id)) }; });
  let pubBox = '';
  if (pub.state === 'ok') {
    const list = pub.data.ts.filter((t) => !mineIds.has(t.id) && (pub.data.cnt[t.id] ?? 0) < t.max_members).slice(0, 6);
    pubBox = `<p class="secx"><span>공개 기수 · 자리 있음</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:4px 16px">
      ${list.length ? list.map((t) => teamRow({ ribbon: t.ribbon, name: t.name, href: `#/c/${t.code}`, sub: `${t.motto ? `"${esc(t.motto)}" · ` : ''}${t.no ?? '-'}기 · 동기 ${pub.data.cnt[t.id] ?? 0}명`, right: '<span class="chip on">보기</span>' })).join('') : '<p class="sub" style="padding:14px 0 6px">지금 자리가 있는 공개 기수가 없어요. 직접 만들어 보세요.</p>'}
      ${mine.length < MAX_TEAMS ? '<button class="btn" style="height:48px;font-size:15px;margin:10px 0 12px" data-act="team-random">아무 기수나 들어가기</button>' : ''}
    </div></section>`;
  }
  return `<div class="page">${header('기수 대항전')}<main class="pg">
    ${notice}${mineBox}
    <p class="secx"><span>이번 주 순위</span><span>${open ? '방금 갱신' : ''}</span></p>${board}
    ${lastBox}${pubBox}
  </main><div class="bar">${mine.length < MAX_TEAMS ? '<button class="btn line" data-act="team-new">새 기수 만들기</button>' : `<button class="btn line" disabled>기수는 ${MAX_TEAMS}곳까지 들어갈 수 있어요</button>`}</div></div>`;
}

// ── 기수 만들기 · 고치기 ──
export function viewTeamForm(): string {
  const [b, p, c] = cs.ribbon;
  const sw = (arr: string[], on: number, act: string) => `<div class="sw">${arr.map((col, i) => `<button class="${i === on ? 'on' : ''}" style="background:${col}" data-act="${act}" data-v="${i}" aria-label="${i + 1}번"></button>`).join('')}</div>`;
  return `<div class="page">${header(cs.edit ? '기수 고치기' : '새 기수 만들기', '', 'go-back')}<main class="pg">
  <section class="doc" style="margin-top:4px"><div class="thead">${teamRibbon(cs.ribbon, 190)}<p class="tmeta">${cs.edit ? '기수 번호는 그대로예요' : '기수 번호는 만들 때 정해져요'}</p><p class="tnm">${esc(cs.name.trim() || '기수 이름')}</p>${cs.motto.trim() ? `<p class="tmt">"${esc(cs.motto.trim())}"</p>` : ''}</div>
  <div class="bd" style="padding-top:0">
    <p class="lbl">기수 이름</p><input id="tname" class="inp" style="background:var(--bg);height:48px" maxlength="16" placeholder="예: 임관 동기 모임" value="${esc(cs.name)}">
    <p class="lbl">구호 (한 줄, 선택)</p><input id="tmotto" class="inp" style="background:var(--bg);height:48px" maxlength="20" placeholder="예: 끝까지 말뚝" value="${esc(cs.motto)}">
    <p class="lbl">기수 약장 · ① 바탕색</p>${sw(RIB_BASES, b, 'rib-b')}
    <p class="lbl">② 줄무늬 모양</p><div class="pat">${RIB_PATTERNS.map((_, i) => `<button class="${i === p ? 'on' : ''}" data-act="rib-p" data-v="${i}">${teamRibbon([b, i, c], 72)}</button>`).join('')}</div>
    <p class="lbl">③ 줄무늬 색</p>${sw(RIB_COLORS, c, 'rib-c')}
    <button class="btn line" style="height:44px;margin-top:14px" data-act="rib-rand">무작위로 뽑기</button>
    <p class="faint" style="margin-top:8px">240가지 · 별은 대항전 성적으로만 붙어요</p>
    <button class="kvt" data-act="team-pub"><span><b>공개 기수</b><span class="faint">혼자 온 사람이 들어올 수 있어요</span></span><span class="tog ${cs.pub ? 'on' : ''}"></span></button>
    ${cs.msg ? `<p class="small" style="margin-top:10px;color:var(--red)">${esc(cs.msg)}</p>` : ''}
    <p class="faint" style="margin-top:12px">실제 부대 이름·번호는 쓸 수 없어요.</p>
  </div></section>
  </main><div class="bar"><button class="btn" data-act="team-save" ${cs.busy ? 'disabled' : ''}>${cs.busy ? '저장하는 중…' : cs.edit ? '고친 내용 저장' : '기수 창설하기'}</button></div></div>`;
}

// ── 대항전 기수 페이지 ──
export function viewTeam(c: CohortRow): string {
  const week = curWeek(), open = contestOpen(today());
  const me = myId();
  const mem = load(`contest:mem:${c.id}`, () => teamMembers(c.id));
  const members = mem.state === 'ok' ? mem.data : [];
  const uids = members.map((m) => m.user_id);
  const names = load(`contest:names:${c.id}:${uids.length}`, () => nicknames(uids));
  const nm = (id: string) => (names.state === 'ok' ? names.data[id] : null) ?? '이름 없음';
  const runs = load(`contest:runs:${c.id}:${week}:${uids.length}`, () => weekRuns(week, uids));
  const joined = new Map(members.map((m) => [m.user_id, m.joined_at]));
  const wr = (runs.state === 'ok' ? runs.data : []).filter((r) => (joined.get(r.user_id) ?? '9') <= r.created_at);
  const hist = load(`contest:hist:${c.id}`, () => teamPlaces(c.id));
  const hon = honorOf([c.id], c.id);
  const b = boardL(week);
  const place = b.state === 'ok' ? placeOf(b.data, c.id) : null;
  const isMember = !!me && members.some((m) => m.user_id === me);
  const isCaptain = me === c.created_by;
  const prof = load('profile', getProfile);
  const isMain = prof.state === 'ok' && prof.data?.main_cohort === c.id;
  const myCount = myTeamsNow()?.length ?? 0;

  const pts = wr.map((r) => ({ r, p: personScore(r.rank_index, r.honor) })).sort((x, y) => y.p - x.p);
  const top = pts.slice(0, 3), extra = pts.slice(3);
  const done = new Set(wr.map((r) => r.user_id));
  const notYet = members.filter((m) => !done.has(m.user_id));
  const score = pts.length ? teamScore(pts.map((x) => x.p)) : null;
  const who = (x: { r: RunRow; p: number }, v: string) => `<a class="who" href="#/p/${x.r.user_id}">${insignia(x.r.final_rank as Rank, 18, false)}<span class="g"><b>${esc(nm(x.r.user_id))}</b><span>${x.r.final_rank} · 명예 ${x.r.honor ?? 0}</span></span><span class="v">${v}</span></a>`;

  const created = new Date(c.created_at);
  const headDoc = `<section class="doc" style="margin-top:4px"><div class="thead">
    ${teamRibbon(c.ribbon, 200, hon)}
    <p class="tno">제 ${c.no ?? '-'} 기</p>
    <p class="tnm">${esc(c.name)}</p>
    ${c.motto ? `<p class="tmt">"${esc(c.motto)}"</p>` : ''}
    <p class="tmeta">창설 ${created.getMonth() + 1}.${created.getDate()} · 동기 ${members.length}명 · ${c.public ? '공개' : '초대만'}${hon?.wins ? ` · 우승 ${hon.wins}회` : hon?.podiums ? ` · 입상 ${hon.podiums}회` : ''}</p>
    ${isCaptain ? `<button class="link" style="margin-top:6px" data-act="team-edit" data-v="${c.code}">기수장 · 이름·구호·약장 고치기</button>` : ''}
  </div></section>`;

  const weekDoc = `<section class="doc lcard"><div class="hd">
    <div class="dn">제${weekNo(week)}주${open ? ` · D-${dLeft()}` : ` · ${md(CONTEST_FROM)} 시작`}</div>
    <div class="bigrk">${place ? `<b>${place.place}위</b>` : `<b class="sm">${open ? '순위 전' : '출전 대기'}</b>`}${place?.gap !== null && place?.gap !== undefined ? `<span class="sub">3위까지 ${place.gap}점</span>` : ''}</div>
  </div><div class="bd">
    ${score !== null ? `<div class="kv"><span>팀 점수</span><b>${score}</b></div>
    <div class="kv"><span>상위 ${top.length}명 평균</span><b>${Math.round(top.reduce((a, x) => a + x.p, 0) / top.length)}</b></div>
    <div class="kv"><span>인원 보너스</span><b>${extra.length ? `+${Math.min(50, extra.length * 5)}` : '4번째 동기부터 +5'}</b></div>
    <div class="lk"><span>점수에 들어간 ${top.length}명</span></div>${top.map((x) => who(x, String(x.p))).join('')}
    ${extra.length ? `<div class="lk"><span>인원 +5를 보탠 동기</span></div>${extra.map((x) => who(x, '+5')).join('')}` : ''}`
    : `<p class="sub">${open ? '이번 주 전역한 동기가 아직 없어요. 전역 2명부터 순위에 올라요.' : `${md(CONTEST_FROM)}(월)부터 한 주에 한 판씩 출전해요.`}</p>`}
    ${notYet.length && members.length ? `<div class="lk"><span>아직 안 한 동기 ${notYet.length}명</span></div><p class="sub">${notYet.slice(0, 8).map((m) => esc(nm(m.user_id))).join(' · ')}${notYet.length > 8 ? ` 외 ${notYet.length - 8}명` : ''}${pts.length >= 3 && pts.length < 13 ? ' — 한 명 더 하면 +5예요' : ''}</p>
    <button class="btn line" style="height:44px;margin-top:10px" data-act="grp-share" data-v="${c.code}">동기 부르기</button>` : ''}
  </div></section>`;

  const awardBox = wr.length >= 2 ? awards(wr.map((r) => ({ ...r, nickname: nm(r.user_id) }))) .replace('<p class="sec">기수 시상</p>', '<p class="secx"><span>이번 주 기수 시상</span></p>').replace('class="doc" style="margin:0"', 'class="doc" style="margin-top:0"') : '';

  const roster = mem.state === 'loading' ? loadingBox : `<p class="secx"><span>기수 명부</span><span>${members.length}명</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:4px 16px">${members.map((m) => {
    const founding = new Date(m.joined_at).getTime() - created.getTime() < 86400000;
    return `<a class="trow2 ${m.user_id === me ? 'me' : ''}" href="#/p/${m.user_id}"><span class="tn">${m.seq}</span><span class="g"><b>${esc(nm(m.user_id))}${m.user_id === c.created_by ? ' <span class="chip">기수장</span>' : ''}${m.user_id === me ? ' <span class="chip on">나</span>' : ''}</b><span>${founding ? '창설 동기 · ' : ''}${md(m.joined_at.slice(0, 10))} 입대</span></span></a>`;
  }).join('')}</div></section>`;

  const hrows = hist.state === 'ok' ? hist.data : [];
  const history = `<p class="secx"><span>연혁</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:14px 20px">
    ${hrows.map((h) => { const fin = h.week < weekOf(today()); return `<div class="kv"><span>제${weekNo(h.week)}주</span><b>${h.place}위${fin ? '' : ' · 진행 중'}${fin && (h.place ?? 9) <= 3 ? ` <a class="chip on" href="#/award/${c.code}/${h.week}">표창장</a>` : ''}</b></div>`; }).join('')}
    <div class="kv"><span>${created.getFullYear()}.${created.getMonth() + 1}.${created.getDate()}</span><b>창설</b></div>
  </div></section>`;

  const mine = isMember ? `<p class="lmore">${isMain ? '<span>대표 기수예요</span>' : `<button data-act="team-main" data-v="${c.id}">대표 기수로 정하기</button>`}${isCaptain ? '' : `<button data-act="team-leave" data-v="${c.id}">기수 나가기</button>`}</p>` : '';
  const bar = isMember
    ? `<div class="two"><button class="btn line" data-act="grp-share" data-v="${c.code}">동기 부르기</button><button class="btn" data-act="contest-go" ${open ? '' : 'disabled'}>${open ? '이번 주 출전' : `${md(CONTEST_FROM)}부터 출전`}</button></div>`
    : members.length >= c.max_members ? '<button class="btn" disabled>정원 30명이 다 찼어요</button>'
    : myCount >= MAX_TEAMS ? `<button class="btn" disabled>기수는 ${MAX_TEAMS}곳까지 들어갈 수 있어요</button>`
    : `<div class="two"><button class="btn line" data-act="grp-share" data-v="${c.code}">공유</button><button class="btn" data-act="team-join" data-v="${c.id}">이 기수 들어가기</button></div>`;
  return `<div class="page">${header('기수', '', 'go-back')}<main class="pg">${headDoc}${weekDoc}${awardBox}${roster}${history}${mine}</main><div class="bar">${bar}</div></div>`;
}

// ── 표창장 ──
export function viewAward(code: string, week: string, c: CohortRow | null): string {
  if (!c) return `<div class="page">${header('표창장', '', 'go-back')}<main class="pad tight">${loadingBox}</main></div>`;
  const hist = load(`contest:hist:${c.id}`, () => teamPlaces(c.id));
  const h = hist.state === 'ok' ? hist.data.find((x) => x.week === week) : null;
  const fin = week < weekOf(today());
  let body = '';
  if (hist.state === 'loading') body = loadingBox;
  else if (!h || !fin || (h.place ?? 9) > 3) body = errorBox('이 주에는 표창 기록이 없어요');
  else {
    const issued = new Date(`${weekEnd(week)}T00:00:00Z`); issued.setUTCDate(issued.getUTCDate() + 1);
    body = `<div class="paper award">
      <p class="no">${docNo(week)}</p>
      ${teamRibbon(c.ribbon, 120, null)}
      <p class="ttl">표창장</p>
      <p class="sub">제${weekNo(week)}주 기수 대항전 · ${h.place}위</p>
      <p class="abody"><b>${esc(c.name)}</b> 기수<br>제 ${c.no ?? '-'} 기 · 전역 ${h.n}명<br><br>위 기수는 제${weekNo(week)}주 기수 대항전에서<br>팀 점수 ${h.score}점으로 ${h.place}위에 올랐기에<br>이 표창장을 드립니다.</p>
      <p class="sub">${issued.getUTCFullYear()}년 ${issued.getUTCMonth() + 1}월 ${issued.getUTCDate()}일</p>
      <div class="sign">말뚝 인사과장 <span class="stamp"><b>인사</b><i>과장</i></span></div>
    </div>`;
  }
  return `<div class="page">${header('표창장', '', 'go-back')}<main class="pad tight" style="padding-top:8px">${body}</main>
    <div class="bar"><div class="two"><button class="btn line" data-act="copy-award">링크 복사</button><a class="btn" href="#/c/${code}" style="display:flex;align-items:center;justify-content:center;text-decoration:none">기수 페이지</a></div></div></div>`;
}

// ── 랭킹 줄: 지금 닉네임 + 닉네임 옆 약장 (대표 기수) ──
type Person = { nick: string | null; tag: { ribbon: number[] | null; no: number | null; name: string; cohort: string } | null };
const people = new Map<string, Person | undefined>();
const honorCache = new Map<string, Honors | null>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  const ids = [...queue]; queue = new Set(); timer = null;
  if (!ids.length) return;
  void teamTags(ids).then(async (rows) => {
    for (const id of ids) people.set(id, { nick: null, tag: null });
    for (const r of rows) people.set(r.id, { nick: r.nickname, tag: r.cohorts && r.main_cohort ? { ...r.cohorts, cohort: r.main_cohort } : null });
    const cids = [...new Set(rows.map((r) => r.main_cohort).filter((x): x is string => !!x && !honorCache.has(x)))];
    if (cids.length) { const hs = await teamHonors(cids).catch(() => [] as Honors[]); for (const c of cids) honorCache.set(c, hs.find((h) => h.cohort_id === c) ?? null); }
    refresh();
  }).catch(() => { for (const id of ids) people.set(id, { nick: null, tag: null }); });
}
function person(userId: string): Person | undefined {
  if (!people.has(userId)) {
    people.set(userId, undefined);
    queue.add(userId);
    if (!timer) timer = setTimeout(flush, 30);
  }
  return people.get(userId);
}
/** 랭킹 줄 이름: 지금 프로필 닉네임 (불러오기 전에는 판에 적힌 닉네임) */
export const nameOf = (userId: string, fallback: string) => person(userId)?.nick ?? fallback;
/** 닉네임 옆에 붙는 작은 기수 약장 (없으면 빈 문자열) */
export function teamTag(userId: string): string {
  const t = person(userId)?.tag;
  return t ? `<span class="ttag">${teamRibbon(t.ribbon, 22, honorCache.get(t.cohort) ?? null, `${t.no ?? ''}기 ${t.name}`)}</span>` : '';
}
/** 닉네임을 바꾼 뒤 다시 불러오기 */
export function forgetPeople() { people.clear(); }
