// v3.3 인사기록카드 (#/p/아이디, #/p/me): 랭킹 · 기수 명부 어디서든 사람을 누르면 열린다
import { RANKS } from '../data/config';
import { hobongOf, serialLabel } from '../engine/hobong';
import type { Rank } from '../engine/types';
import { dailyBest, myId, profileOf, ribbonsOf, runsOf, sameNickCount, statsOf, teamHonors, teamsOf, type RunRow } from '../net/api';
import { insignia } from './insignia';
import { ribbonRack } from './ribbon';
import { errorBox, header, load, loadingBox, ribbonsFromRow, rk } from './social';
import { teamRibbon } from './teamRibbon';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
const MODE: Record<string, string> = { free: '자유 플레이', daily: '오늘의 기수', cohort: '친선 기수', contest: '대항전' };

function bestRibbons(rows: { ribbons: { id: string; t: number }[] }[]) {
  const best = new Map<string, number>();
  for (const r of rows) for (const x of r.ribbons ?? []) best.set(x.id, Math.max(best.get(x.id) ?? -1, x.t));
  return ribbonsFromRow([...best].map(([id, t]) => ({ id, t })));
}

export function viewPerson(idArg: string): string {
  const me = myId();
  const id = idArg === 'me' ? me : idArg;
  if (!id) return `<div class="page">${header('인사기록카드', '', 'go-back')}<main class="pad tight">${errorBox('아직 기록이 없어요. 한 판 끝내고 랭킹에 올리면 카드가 생겨요')}</main></div>`;
  const own = id === me;
  const prof = load(`person:${id}`, () => profileOf(id));
  const stats = load(`person:stats:${id}`, () => statsOf(id).catch(() => null));
  const runs = load(`person:runs:${id}`, () => runsOf(id, 30));
  const best = load(`person:daily:${id}`, () => dailyBest(id).catch(() => null));
  const teams = load(`person:teams:${id}`, () => teamsOf(id).catch(() => []));
  const ribs = load(`person:ribs:${id}`, () => ribbonsOf(id));
  if (prof.state === 'loading') return `<div class="page">${header('인사기록카드', '', 'go-back')}<main class="pad tight">${loadingBox}</main></div>`;
  if (prof.state === 'error') return `<div class="page">${header('인사기록카드', '', 'go-back')}<main class="pad tight">${errorBox(prof.msg)}</main></div>`;
  const p = prof.data;
  if (!p) return `<div class="page">${header('인사기록카드', '', 'go-back')}<main class="pad tight">${errorBox(own ? '아직 카드가 없어요. 한 판 끝내고 랭킹에 올리면 카드가 생겨요' : '카드를 찾을 수 없어요')}</main></div>`;

  const st = stats.state === 'ok' ? stats.data : null;
  const rs: RunRow[] = runs.state === 'ok' ? runs.data : [];
  const bestRank = st?.best_rank ?? Math.max(-1, ...rs.map((r) => r.rank_index));
  const hb = hobongOf(st?.xp ?? 0);
  const origins = rs.reduce<Record<string, number>>((a, r) => ((a[r.origin] = (a[r.origin] ?? 0) + 1), a), {});
  const fav = Object.entries(origins).sort((a, b) => b[1] - a[1])[0];
  const ts = teams.state === 'ok' ? teams.data : [];
  const hons = load(`person:hon:${id}:${ts.length}`, () => teamHonors(ts.map((t) => t.cohort_id)).catch(() => []));
  const honOf = (cid: string) => (hons.state === 'ok' ? hons.data.find((h) => h.cohort_id === cid) ?? null : null);
  const podiums = hons.state === 'ok' ? hons.data.reduce((a, h) => a + h.podiums, 0) : 0;

  const head = `<section class="doc card8"><div class="bd">
    <p class="faint">인사기록카드 · 군번 ${serialLabel(p.serial, p.created_at)}</p>
    <div class="idrow">${insignia((bestRank >= 0 ? RANKS[bestRank] : '소위') as Rank, 30, false)}<div class="g"><p class="nm">${esc(p.nickname)}${own ? ' <span class="chip on">나</span>' : ''}</p><p class="sb">${p.equipped_title ? `칭호 '${esc(p.equipped_title)}' · ` : ''}${fav ? `${esc(fav[0])} 출신을 가장 많이 골라요` : '아직 기록이 적어요'}</p></div></div>
    <div class="hobong"><b>${hb.level}호봉</b><span>다음 호봉까지 ${hb.need - hb.into}</span></div>
    <div class="xpbar"><i style="width:${Math.round((hb.into / hb.need) * 100)}%"></i></div>
    <div class="grid3"><div><b>${st?.runs ?? rs.length}</b><span>판 수</span></div><div><b>${st?.generals ?? '-'}</b><span>장군 전역</span></div><div><b>${st?.fourstars ?? '-'}</b><span>대장</span></div></div>
  </div></section>`;

  const teamBox = ts.length ? `<p class="secx"><span>소속 기수</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:4px 16px">${ts.map((t) => {
    const h = honOf(t.cohort_id);
    return `<a class="trow2" href="#/c/${t.cohorts.code}"><span class="trb" style="width:52px">${teamRibbon(t.cohorts.ribbon, 44, h)}</span><span class="g"><b>${esc(t.cohorts.name)}</b><span>${t.cohorts.no ?? '-'}기 · 동기 번호 ${t.seq}${p.main_cohort === t.cohort_id ? ' · 대표 기수' : ''}${h?.wins ? ` · 우승 ${h.wins}회` : h?.podiums ? ` · 입상 ${h.podiums}회` : ''}</span></span></a>`;
  }).join('')}</div></section>` : '';

  const b = best.state === 'ok' ? best.data : null;
  const record = `<p class="secx"><span>기록</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:16px 20px">
    <div class="kv"><span>자유 플레이 최고</span><b>${st?.best_free !== null && st?.best_free !== undefined ? RANKS[st.best_free] : '-'}</b></div>
    <div class="kv"><span>오늘의 기수 최고</span><b>${b ? `${md(b.day)} · ${b.place}위 (${b.total}명 중)` : '-'}</b></div>
    <div class="kv"><span>오늘의 기수 참가</span><b>${st ? `${st.daily_days}일` : '-'}</b></div>
    <div class="kv"><span>대항전</span><b>${st ? `${st.contest_weeks}주 출전${podiums ? ` · 소속 기수 입상 ${podiums}회` : ''}` : '-'}</b></div>
  </div></section>`;

  const ribList = ribs.state === 'ok' ? bestRibbons(ribs.data) : [];
  const ribBox = ribList.length ? `<p class="secx"><span>약장 ${ribList.length}개</span></p><section class="doc" style="margin-top:0"><div class="bd" style="display:flex;justify-content:center;padding:16px">${ribbonRack(ribList, 34, 6)}</div></section>` : '';

  const recent = rs.slice(0, 5);
  const recentBox = recent.length ? `<p class="secx"><span>최근 전역</span></p><section class="doc" style="margin-top:0"><div class="bd" style="padding:4px 16px">${recent.map((r) => `<a class="trow2" href="#/card/${r.id}"><span class="trb" style="width:48px">${insignia(r.final_rank as Rank, 18, false)}</span><span class="g"><b>${r.final_rank} · 명예 ${r.honor ?? '-'}</b><span>${MODE[r.mode ?? 'free'] ?? ''} · ${md(r.ended_on)}</span></span><span class="tsc"><b class="olive" style="font-size:13px">카드 ›</b></span></a>`).join('')}</div></section>` : '';

  let mine = '';
  if (own) {
    const dup = load(`person:dup:${p.nickname}`, () => sameNickCount(p.nickname).catch(() => 1));
    const wait = p.nick_changed_at ? Math.ceil((new Date(p.nick_changed_at).getTime() + 7 * 86400000 - Date.now()) / 86400000) : 0;
    mine = `<p class="secx"><span>닉네임</span></p><section class="doc" style="margin-top:0"><div class="bd">
      ${dup.state === 'ok' && dup.data > 1 ? `<p class="sub" style="margin-bottom:10px">'${esc(p.nickname)}'은 다른 사람도 쓰는 이름이에요. 겹치지 않는 이름으로 바꿔 볼까요?</p>` : ''}
      <div style="display:flex;gap:8px"><input id="nick" class="inp" style="height:46px;background:var(--bg)" maxlength="12" placeholder="새 닉네임" value="${esc(rk.nick)}" ${wait > 0 ? 'disabled' : ''}><button class="btn" style="width:92px;height:46px" data-act="save-nick" ${wait > 0 ? 'disabled' : ''}>바꾸기</button></div>
      <p class="faint" style="margin-top:6px">${rk.nickMsg ? esc(rk.nickMsg) : wait > 0 ? `${wait}일 뒤에 바꿀 수 있어요` : '7일에 한 번 바꿀 수 있어요 · 예전 기록도 새 이름으로 보여요'}</p>
    </div></section>`;
  }
  return `<div class="page">${header('인사기록카드', '', 'go-back')}<main class="pg">${head}${teamBox}${record}${ribBox}${recentBox}${mine}</main>
    <div class="bar"><button class="btn line" data-act="${own ? 'route-home' : 'go-back'}">${own ? '로비로' : '닫기'}</button></div></div>`;
}
