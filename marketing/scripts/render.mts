// 마케팅 팀 디자이너용: facts.json으로 SNS 카드 이미지(1080×1350)를 만든다. 군 행정 문서 스타일.
// 실행: bash marketing/render.sh [YYYY-MM-DD]  →  marketing/out/<날짜>/card_result.png · card_poll.png · card_reveal.png(전날 투표 결과) · card_award.png(월요일, 지난주 대항전)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '../../game/node_modules/playwright/index.mjs';
import { insignia } from '../../game/src/ui/insignia';
import type { Rank } from '../../game/src/engine/types';
declare const process: { argv: string[] };

const day = process.argv[2] ?? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const OUT = resolve(`../marketing/out/${day}`);
const FONT = resolve('../marketing/templates/fonts/PretendardVariable.woff2');
const facts = JSON.parse(readFileSync(`${OUT}/facts.json`, 'utf8'));
const prevDay = new Date(Date.parse(day) - 86400e3).toISOString().slice(0, 10);
const prevFile = resolve(`../marketing/out/${prevDay}/facts.json`);
const prev = existsSync(prevFile) ? JSON.parse(readFileSync(prevFile, 'utf8')) : null;

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const num = (n: number) => n.toLocaleString('ko-KR');
const docNo = `제${day.slice(0, 4)}-${day.slice(5, 7)}${day.slice(8, 10)}호`;
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

const CSS = `
@font-face{font-family:P;src:url("file://${FONT}") format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:#F2F3F0;font-family:P,sans-serif;color:#191F28;letter-spacing:-.02em;word-break:keep-all;padding:64px 60px}
.paper{background:#fff;border-radius:36px;height:100%;padding:64px 64px 56px;display:flex;flex-direction:column;position:relative}
.no{font-size:26px;color:#9AA092;font-weight:600}
.title{font-size:34px;font-weight:800;letter-spacing:.32em;margin-top:14px}
.rule{border-top:3px solid #191F28;margin:28px 0 0}
.h{font-size:76px;font-weight:800;line-height:1.22;margin-top:44px}
.h .o{color:#4B5D3A}
.sub{font-size:32px;color:#6B7684;margin-top:22px;line-height:1.5;font-weight:500}
.row{display:flex;align-items:center;gap:28px;padding:24px 0;border-top:1.5px solid #E4E7DF}
.row:first-child{border-top:0}
.pl{font-size:40px;font-weight:800;color:#4B5D3A;width:44px}
.ins{width:120px;display:flex;justify-content:center}
.g{flex:1;min-width:0}.g b{display:block;font-size:40px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.g span{font-size:27px;color:#6B7684}
.v{font-size:32px;font-weight:700;color:#4B5D3A;white-space:nowrap}
.opt{border:2.5px solid #E4E7DF;border-radius:26px;padding:28px 32px;margin-top:22px;font-size:40px;font-weight:700;display:flex;align-items:center;gap:22px}
.opt i{font-style:normal;width:62px;height:62px;border-radius:50%;background:#EEF2E7;color:#4B5D3A;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;flex-shrink:0}
.bar{height:22px;border-radius:11px;background:#EEF2E7;margin-top:14px;overflow:hidden}.bar div{height:100%;background:#4B5D3A;border-radius:11px}
.res{margin-top:30px}.res .t{display:flex;justify-content:space-between;font-size:38px;font-weight:700}.res .t span{color:#4B5D3A}
.foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between}
.foot .l{font-size:30px;color:#6B7684;line-height:1.5}.foot .l b{color:#191F28;font-size:34px}
.stamp{width:170px;height:170px;border:6px solid #B3261E;border-radius:50%;color:#B3261E;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-12deg);font-weight:800;opacity:.9}
.stamp b{font-size:40px;letter-spacing:.06em}.stamp i{font-style:normal;font-size:22px;margin-top:4px}
.stamp.olive{border-color:#4B5D3A;color:#4B5D3A}
.stats{display:flex;gap:18px;margin-top:40px}.stats div{flex:1;background:#F6F7F3;border-radius:24px;padding:26px 28px}.stats span{font-size:26px;color:#6B7684}.stats b{display:block;font-size:52px;font-weight:800;margin-top:6px}
`;
const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="paper">${body}</div></body></html>`;
const head = (title: string) => `<p class="no">말뚝 인사과 · ${docNo}</p><p class="title">${title}</p><div class="rule"></div>`;
const foot = (left: string, stamp = '<div class="stamp"><b>인사과</b><i>말뚝</i></div>') => `<div class="foot"><p class="l">${left}</p>${stamp}</div>`;

const cards: Record<string, string> = {};
const d = facts.daily;
// 1. 오늘의 기수 결과
cards.card_result = page(`${head('일 일 명 령')}
  <p class="h">${md(day)} 오늘의 기수<br><span class="o">${num(d.participants)}명</span> 중 별은 ${num(d.generals)}명</p>
  <div class="stats"><div><span>장군 비율</span><b>${d.generalPct}%</b></div><div><span>중장 이상</span><b>${num(d.threeStarPlus)}명</b></div><div><span>대장</span><b>${num(d.fourStar)}명</b></div></div>
  <div style="margin-top:34px">${d.top.map((r: { place: number; name: string; rank: Rank; billet: string; years: number; honor: number }) => `<div class="row"><span class="pl">${r.place}</span><span class="ins">${insignia(r.rank, 56, false)}</span><span class="g"><b>${esc(r.name)}</b><span>${r.rank} · ${esc(r.billet ?? '')} · ${r.years}년</span></span><span class="v">명예 ${r.honor}</span></div>`).join('')}</div>
  ${foot(`${md(facts.tomorrow.day)}은 <b>${facts.tomorrow.difficulty ?? '새 기수'}</b>${facts.tomorrow.difficulty ? ' 난이도' : ''}<br>malttuk.com`)}`);
// 2. 결재 투표 (답은 내일)
const c = facts.mostSplitChoice;
if (c) cards.card_poll = page(`${head('결 재 대 기')}
  <p class="h">당신이라면<br><span class="o">${esc(c.title)}</span></p>
  <p class="sub">${md(day)} ${num(c.total)}명이 이 결재를 받았어요</p>
  <div style="margin-top:20px">${[...c.options].sort((a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key)).map((o: { label: string }, i: number) => `<div class="opt"><i>${'ABCD'[i]}</i>${esc(o.label)}</div>`).join('')}</div>
  ${foot(`댓글로 골라 주세요<br><b>실제 결과는 ${md(new Date(Date.parse(day) + 86400e3).toISOString().slice(0, 10))} 공개</b>`, '<div class="stamp olive"><b>결재</b><i>대기</i></div>')}`);
// 3. 어제 투표 결과 공개
const pc = prev?.mostSplitChoice;
if (pc) cards.card_reveal = page(`${head('결 재 결 과')}
  <p class="h">${md(prevDay)} 투표<br><span class="o">${esc(pc.title)}</span></p>
  <p class="sub">${md(prevDay)} 오늘의 기수에서 이 결재를 받은 ${num(pc.total)}명의 실제 선택이에요</p>
  ${pc.options.map((o: { label: string; pct: number }) => `<div class="res"><p class="t">${esc(o.label)}<span>${o.pct}%</span></p><div class="bar"><div style="width:${o.pct}%"></div></div></div>`).join('')}
  ${foot('당신의 선택은 몇 %였나요?<br>malttuk.com', '<div class="stamp olive"><b>결재</b><i>완료</i></div>')}`);
// 4. 대항전 표창 (지난주 1~3위가 있을 때)
const lw = facts.contest?.lastWeek?.top ?? [];
if (lw.length) cards.card_award = page(`${head('표 창 장')}
  <p class="h">지난주 기수 대항전<br><span class="o">1~${lw.length}위</span></p>
  <div style="margin-top:34px">${lw.map((t: { name: string; no: number | null; n: number; score: number }, i: number) => `<div class="row"><span class="pl">${i + 1}</span><span class="g"><b>${esc(t.name)}</b><span>${t.no ?? '-'}기 · 전역 ${num(t.n)}명</span></span><span class="v">${num(t.score)}점</span></div>`).join('')}</div>
  <p class="sub">이번 주 대항전은 월요일 0시부터 일요일 24시까지예요</p>
  ${foot('우리 기수도 도전해 보세요<br>malttuk.com')}`);

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const p = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [name, html] of Object.entries(cards)) {
  const f = `${OUT}/${name}.html`;
  writeFileSync(f, html);
  await p.goto(`file://${f}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${OUT}/${name}.png`);
}
await browser.close();
