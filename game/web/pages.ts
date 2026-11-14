// 검색·애드센스용 정적 페이지 생성기: npx tsx web/pages.ts → dist/site/*.html
import { BOSSES, UNITS } from '../src/engine/term';
import { writeFileSync, mkdirSync } from 'fs';
import { ASSIGNMENTS, MIN_YEARS, ORIGIN, ORIGIN_SCHOOL, PITY, POTENTIAL, PROMOTION, RANKS, REQUIRED_BILLET, REWARD_TIERS, START_STATS, yearlyRate } from '../src/data/config';
import { RIBBONS, TITLES } from '../src/engine/meta';
import { STAT_KEYS, STAT_LABEL, type Rank } from '../src/engine/types';
import { insignia } from '../src/ui/insignia';
import { ribbonSvg } from '../src/ui/ribbon';
import { NOTICES } from '../src/ui/site';

const OUT = 'dist/site';
mkdirSync(OUT, { recursive: true });
const SITE = 'https://malttuk.com';
const TODAY = '2026-11-12';
const FORM = 'https://github.com/Kkkdddww/star/issues';

const CSS = `
:root{--ink:#191F28;--sub:#6B7684;--faint:#9AA092;--line:#E8EBE4;--bg:#F2F3F0;--wash:#F6F7F3;--olive:#4B5D3A;--olive-t:#EEF2E7}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Pretendard','Inter','Noto Sans KR',system-ui,sans-serif;letter-spacing:-.02em;color:var(--ink);background:var(--bg);line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--olive)}
.wrap{max-width:720px;margin:0 auto;padding:0 16px}
header.top{display:flex;align-items:center;gap:12px;height:60px}
header.top .logo{font-size:20px;font-weight:800;color:var(--ink);text-decoration:none;letter-spacing:-.04em}
header.top .sp{flex:1}
header.top .play{background:var(--olive);color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:12px;padding:9px 14px}
.crumb{font-size:13px;color:var(--faint);margin:6px 4px 10px}.crumb a{color:var(--faint);text-decoration:none}
.hero{background:#fff;border-radius:24px;padding:26px 22px;margin-bottom:12px}
.hero .k{font-size:14px;font-weight:700;color:var(--olive)}
.hero h1{font-size:28px;line-height:1.3;letter-spacing:-.04em;margin:6px 0 10px}
.hero p{color:#4E5968;font-size:15px}
.hero .meta{font-size:12px;color:var(--faint);margin-top:12px}
section.doc{background:#fff;border-radius:24px;padding:22px;margin-bottom:12px}
section.doc h2{font-size:19px;letter-spacing:-.03em;margin-bottom:10px}
section.doc h3{font-size:16px;margin:18px 0 6px}
section.doc p{font-size:15px;color:#4E5968}
section.doc p+p{margin-top:10px}
section.doc ul,section.doc ol{padding-left:20px;font-size:15px;color:#4E5968}
section.doc li+li{margin-top:6px}
b,strong{color:var(--ink)}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}
th{text-align:left;font-size:12px;color:var(--faint);font-weight:700;padding:8px 6px;border-bottom:1px solid var(--line)}
td{padding:10px 6px;border-bottom:1px solid var(--line);color:#4E5968;vertical-align:middle}
td b{color:var(--ink)}
.tip{background:var(--olive-t);border-radius:14px;padding:12px 14px;font-size:14px;color:var(--olive);margin-top:12px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.card{display:block;background:#fff;border-radius:20px;padding:18px;text-decoration:none;color:inherit}
.card b{display:block;font-size:16px}.card span{font-size:13px;color:var(--sub)}
.rk{display:flex;align-items:center;gap:8px;white-space:nowrap}.rk .ins{width:56px;display:flex;justify-content:center}
.rib{display:flex;align-items:center;gap:10px;white-space:nowrap}
.cta{display:block;text-align:center;background:var(--olive);color:#fff;text-decoration:none;font-weight:700;border-radius:16px;padding:16px;margin:16px 0}
footer.sitefoot{margin:20px 0 30px;background:#fff;border-radius:24px;padding:20px;color:var(--sub);font-size:13px;line-height:1.6}
.ftop{display:flex;justify-content:space-between;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.fn{font-size:18px;font-weight:800;color:var(--ink)}.fver{font-size:12px;font-weight:700;color:var(--olive);background:var(--olive-t);border-radius:999px;padding:5px 10px;text-decoration:none;height:fit-content}
.fcols{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px 0}
.fcols div{display:flex;flex-direction:column;gap:9px}.fh{font-size:12px;font-weight:700;color:var(--faint)}
.fcols a{color:#4E5968;text-decoration:none;font-size:14px}
.fbot{display:flex;justify-content:space-between;padding-top:14px;border-top:1px solid var(--line)}.fbot b{color:var(--ink)}
.cp{font-size:12px;color:var(--faint);margin-top:6px}
`;

function footer(): string {
  return `<footer class="sitefoot">
    <div class="ftop"><div><p class="fn">말뚝</p><p>2년 말고 30년, 장교 커리어 시뮬레이션</p></div><a class="fver" href="/notice.html">v${NOTICES[0].id}</a></div>
    <div class="fcols">
      <div><p class="fh">플레이</p><a href="/">게임 시작</a><a href="/#/rank">랭킹</a><a href="/notice.html">패치노트</a></div>
      <div><p class="fh">안내</p><a href="/about.html">게임 소개</a><a href="/guide.html">게임 가이드</a><a href="${FORM}" target="_blank" rel="noopener">문의</a></div>
      <div><p class="fh">정책</p><a href="/privacy.html">개인정보처리방침</a><a href="/terms.html">이용약관</a></div>
    </div>
    <div class="fbot"><span>made by <b>동우캉</b></span><span>© 2026 말뚝</span></div>
    <p class="cp">실제 인물·부대·사건과 관계없는 가상의 게임이에요.</p>
  </footer>`;
}

function page(file: string, title: string, desc: string, crumbs: [string, string][], body: string) {
  const url = `${SITE}/${file === 'index' ? '' : file + '.html'}`;
  const html = `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - 말뚝</title>
<meta name="description" content="${desc}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#F2F3F0"><link rel="canonical" href="${url}">
<meta property="og:type" content="article"><meta property="og:title" content="${title} - 말뚝"><meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og.png"><meta property="og:site_name" content="말뚝">
<meta name="twitter:card" content="summary_large_image">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5510087854953837" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ZNK1Y11H3B"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-ZNK1Y11H3B');</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head><body><div class="wrap">
<header class="top"><a class="logo" href="/">말뚝</a><span class="sp"></span><a class="play" href="/">게임 시작</a></header>
<nav class="crumb"><a href="/">홈</a>${crumbs.map(([h, t]) => ` › ${h ? `<a href="${h}">${t}</a>` : t}`).join('')}</nav>
${body}
<a class="cta" href="/">말뚝 한 판 하러 가기 · 설치 없이 바로</a>
${footer()}
</div></body></html>`;
  writeFileSync(`${OUT}/${file}.html`, html);
  return url;
}
const hero = (k: string, h: string, p: string) => `<div class="hero"><p class="k">${k}</p><h1>${h}</h1><p>${p}</p><p class="meta">마지막 수정 2026년 11월 12일 · 게임 버전 v${NOTICES[0].id}</p></div>`;
const sec = (h: string, inner: string) => `<section class="doc"><h2>${h}</h2>${inner}</section>`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const urls: string[] = [];

// ── 게임 소개 ──
urls.push(page('about', '게임 소개', '말뚝은 소위로 임관해 장군이 되기까지, 장교의 30년 커리어를 한 번에 1년씩 보내는 웹 육성 시뮬레이션 게임이에요.', [['', '게임 소개']],
  hero('게임 소개', '2년 말고 30년,<br>말뚝은 이런 게임이에요', '소위로 임관해서 별을 달기까지, 장교 인생을 버튼 한 번에 1년씩 보내는 커리어 시뮬레이션이에요. 설치 없이 모바일과 PC 브라우저에서 바로 열리고, 한 판은 10분 정도 걸려요.') +
  sec('어떻게 진행되나요', `<p>게임은 지원서를 내는 순간 시작돼요. 출신과 능력치 분포가 서로 다른 후보 세 명 가운데 한 명을 골라 사관학교, 학군단, 학사장교 과정, 3사관학교 중 한 곳에 들어가요. 생도 시절에 집중해서 키울 능력치를 정하고, 졸업 석차에 따라 병과가 정해지면 소위로 임관해요.</p>
    <p>임관하면 같은 해에 임관한 동기 30명과 함께 커리어가 시작돼요. 한 해 동안 결재함에 올라오는 일을 처리하고, 연말에 근무평정을 받고, 때가 되면 진급 심사를 기다려요. 2년마다 정기 인사로 보직이 바뀌고, 어떤 보직을 거쳤는지가 다음 진급을 좌우해요.</p>
    <p>끝까지 버티면 별을 달 수도 있고, 진급 심사에서 계속 떨어지면 계급정년으로 전역하게 돼요. 전역하면 최종 계급, 최고 보직, 받은 약장과 운 지수가 담긴 전역 카드가 나오고, 명예의 전당이나 오늘의 기수 순위에 올려 다른 사람과 비교할 수 있어요.</p>`) +
  sec('이런 분께 추천해요', `<ul><li>군 생활을 해봤거나 지금 하고 있어서 "말뚝 박으면 어떻게 될까" 궁금했던 분</li><li>육성 시뮬레이션처럼 한 판씩 결과가 달라지는 게임을 좋아하는 분</li><li>출퇴근길이나 쉬는 시간에 짧게 한 판 할 게임을 찾는 분</li></ul>`) +
  sec('만들면서 지킨 원칙', `<ul><li>실제 부대명, 위치, 무기, 작전·경계 절차는 넣지 않았어요.</li><li>사건의 결과는 표창, 경고, 견책 같은 행정 처분까지만 다뤄요.</li><li>보직 이름은 공개된 일반 직책명만 썼어요.</li><li>계급장, 약장, 훈장 이름과 디자인은 이 게임을 위해 새로 만들었어요.</li><li>진급률과 수치는 모두 게임용 가상 값이고, 실제 규정과는 달라요.</li></ul>`) +
  sec('만든 사람', `<p><b>동우캉</b>이 혼자 기획하고, 그리고, 만들고 있어요. 플레이하다 불편한 점이나 아이디어가 있으면 <a href="${FORM}" target="_blank" rel="noopener">문의</a>로 남겨 주세요. 받은 의견은 <a href="/notice.html">패치노트</a>에 반영 내역을 정리하고 있어요.</p>`)));

// ── 가이드 허브 ──
const GUIDES: [string, string, string][] = [
  ['guide-promotion', '계급별 진급 조건 총정리', '최소 연차, 심사 기회, 선발률, 점수 구성'],
  ['guide-billets', '보직 전체 목록과 필수 보직', '계급별로 갈 수 있는 31개 보직'],
  ['guide-odds', '결재 확률과 보상 배율', '확률 계산법, 대박 배율, 연속 실패 보정'],
  ['guide-ribbons', '약장·칭호 전체 목록', '25개 약장과 11개 칭호 얻는 법'],
  ['guide-start', '출신과 잠재력, 첫 선택 가이드', '후보 고르는 법, 출신별 특징'],
];
urls.push(page('guide', '게임 가이드', '말뚝 게임 가이드: 한 해의 흐름, 진급 조건, 보직, 결재 확률, 약장과 칭호까지 정리했어요.', [['', '게임 가이드']],
  hero('게임 가이드', '처음이라면 여기부터', '말뚝의 기본 흐름과 진급에 필요한 핵심만 모았어요. 아래 주제별 가이드에서 더 자세한 수치를 볼 수 있어요.') +
  `<div class="cards" style="margin-bottom:12px">${GUIDES.map(([f, t, d]) => `<a class="card" href="/${f}.html"><b>${t}</b><span>${d}</span></a>`).join('')}</div>` +
  sec('한 해의 흐름', `<ol><li><b>결재함</b> · 상반기에 결재 한 건이 올라와요. 원칙, 소통, 도전, 편법 중에 골라요. 각 선택지에는 성공 확률과 성공·실패 결과가 미리 보여요.</li>
    <li><b>1년 보내기</b> · 게이지가 차오르다가 7월에 멈추면 하반기 결재를 한 번 더 해요.</li>
    <li><b>근무평정</b> · 한 해 성과가 탁월, 우수, 보통, 미흡으로 나와요. 최근 평정이 진급 점수의 가장 큰 부분이에요.</li>
    <li><b>진급 심사</b> · 연차가 차면 평정, 경력, 공적, 교육, 역량 균형 점수로 동기들과 겨뤄요.</li>
    <li><b>정기 인사</b> · 2년마다 1지망과 2지망을 내면 점수 순으로 정원 안에서 보직이 정해져요.</li></ol>`) +
  sec('꼭 알아야 할 세 가지', `<h3>1. 필수 보직</h3><p>대위는 중대장, 중령은 대대장, 대령은 연대장이나 본부 과장을 거쳐야 다음 진급 심사를 받을 수 있어요. 인사 때 필수 보직을 1지망으로 내면 가점이 붙어요.</p>
    <h3>2. 역량 균형</h3><p>진급 점수의 15%는 가장 약한 능력치 두 개에서 나와요. 한 능력치만 키우면 영관급에서 막혀요. 매년 고르는 집중 육성으로 약점을 채워 주세요.</p>
    <h3>3. 편법의 대가</h3><p>편법 선택지는 확률이 높고 당장 편하지만, "마음에 걸리는 일"이 쌓여요. 쌓일수록 감사에서 드러날 확률이 올라가고, 걸리면 평정과 진급에 큰 손해를 봐요.</p>`)));

// ── 진급 조건 ──
const promoRows = (RANKS as Rank[]).map((r, i) => {
  const to = RANKS[i + 1] as Rank | undefined;
  if (!to) return '';
  const p = PROMOTION[r];
  const req = REQUIRED_BILLET[r];
  const auto = !p;
  return `<tr><td><div class="rk"><span class="ins">${insignia(r, 30, false)}</span><b>${r} → ${to}</b></div></td><td>${MIN_YEARS[r] ?? '-'}년</td><td>${auto ? '자동 진급' : `${p!.tries}번 · 누적 ${pct(p!.cumulative)}`}</td><td>${req ? req.label : '-'}</td></tr>`;
}).join('');
const weightRows = (['대위', '소령', '중령', '대령', '준장'] as Rank[]).map((r) => {
  const w = PROMOTION[r]!.weights;
  return `<tr><td><b>${RANKS[RANKS.indexOf(r) + 1]} 심사</b></td><td>${pct(w.eval)}</td><td>${pct(w.career)}</td><td>${pct(w.merit)}</td><td>${pct(w.edu)}</td><td>${w.combat ? pct(w.combat) : '-'}</td><td>${pct(w.balance)}</td></tr>`;
}).join('');
urls.push(page('guide-promotion', '계급별 진급 조건 총정리', '소위부터 대장까지, 말뚝의 계급별 최소 연차, 심사 기회, 누적 선발률, 필수 보직과 진급 점수 구성을 정리했어요.', [['/guide.html', '게임 가이드'], ['', '진급 조건']],
  hero('게임 가이드 · 진급', '계급별 진급 조건 총정리', '언제 심사를 받는지, 몇 번 기회가 있는지, 무엇으로 점수가 매겨지는지 계급별로 정리했어요.') +
  sec('계급별 진급 표', `<p>소위와 중위는 연차가 차면 자동으로 진급해요. 대위부터는 심사를 통과해야 하고, 정해진 횟수 안에 붙지 못하면 계급정년으로 전역해요. "누적"은 그 계급에 오른 사람 중 결국 다음 계급으로 올라가는 비율이에요.</p>
    <table><tr><th>진급</th><th>최소 연차</th><th>심사 기회·누적 선발</th><th>필수 보직</th></tr>${promoRows}</table>
    <div class="tip">예를 들어 대령에서 준장 심사는 4번의 기회가 있고, 대령의 ${pct(PROMOTION['대령']!.cumulative)}만 결국 별을 달아요. 한 해 선발률로 바꾸면 매년 약 ${pct(yearlyRate('대령'))}예요.</div>`) +
  sec('진급 점수는 이렇게 매겨요', `<table><tr><th>심사</th><th>평정</th><th>경력</th><th>공적</th><th>교육</th><th>전투</th><th>균형</th></tr>${weightRows}</table>
    <h3>평정</h3><p>그 계급에서 받은 최근 4년 평정의 평균이에요. 결재에서 성공을 쌓을수록 올라가요.</p>
    <h3>경력</h3><p>기본 55점에 지휘·요직 경험이 있으면 25점, 보조 보직 경험 1곳당 10점(최대 2곳)이 더해져요. 사관학교 출신은 3점을 더 받아요.</p>
    <h3>공적</h3><p>최근 4년 동안 쌓은 공적이에요. 기본 40점에 표창 1개당 5점, 큰 표창 10점, 지휘 보직 무사고 1년당 3점, 임기 목표 달성 6점이 더해져요(최대 100점). 평정처럼 최근 4년만 봐요.</p>
    <h3>교육</h3><p>군사교육 석차예요. 전문성이 높을수록 석차가 좋아요.</p>
    <h3>역량 균형</h3><p>가장 낮은 능력치 두 개의 평균이 계급 기준보다 얼마나 높은지로 매겨요. 모든 심사에서 15%를 차지해요.</p>`) +
  sec('별을 다는 확률', `<p>실제 플레이 기록을 바탕으로 맞춘 목표 비율은 준장 이상 약 8%, 중장(쓰리스타) 이상 약 1%, 대장(포스타) 약 0.5%예요. 처음 해보는 판에서는 이보다 낮고, 규칙을 익힐수록 올라가요. 중령 이상 심사는 동기만으로는 인원이 적어서 다른 기수 대상자와 함께 10명 규모로 심사해요.</p>
    <div class="tip">대령에서 별을 다는 건 4명 중 1명 정도예요. 필수 보직과 역량 균형을 모두 챙겨야 이 안에 들 수 있어요.</div>`)));

// ── 보직 ──
const KINDS = ['지휘', '요직', '참모', '교육'] as const;
const billetRows = (RANKS as Rank[]).map((r) => {
  const list = ASSIGNMENTS.filter((a) => a.ranks.includes(r) && (r !== '중위' || a.id !== 'platoon' || true));
  if (!list.length || r === '중위') return '';
  return `<tr><td><b>${r}${r === '소위' ? '·중위' : ''}</b></td><td>${list.map((a) => `${a.name} <span style="color:var(--faint);font-size:12px">${a.kind}</span>`).join('<br>')}</td><td>${list.map((a) => a.grows.map((g) => STAT_LABEL[g]).join('·')).join('<br>')}</td></tr>`;
}).join('');
urls.push(page('guide-billets', '보직 전체 목록과 필수 보직', '말뚝에 나오는 31개 보직을 계급별로 정리하고, 지휘·요직·참모·교육 보직의 차이와 필수 보직 규칙을 설명해요.', [['/guide.html', '게임 가이드'], ['', '보직']],
  hero('게임 가이드 · 보직', '보직 전체 목록과 필수 보직', '어떤 자리를 거쳤는지가 다음 진급을 좌우해요. 계급별로 갈 수 있는 보직과 각 보직에서 크는 능력치를 정리했어요.') +
  sec('보직의 네 가지 종류', `<ul><li><b>지휘</b> · 소대장, 중대장, 대대장처럼 부대를 맡는 자리예요. 진급 경력 점수에서 가장 크게 인정받고, 필수 보직도 대부분 지휘 보직이에요. 정원이 좁아서 경쟁이 세요.</li>
    <li><b>요직</b> · 사단·군단 참모처럼 상급 부대의 핵심 자리예요. 지휘 보직과 같은 핵심 경력으로 인정받아요.</li>
    <li><b>참모</b> · 정원 제한이 없어서 원하면 대부분 갈 수 있어요. 보조 경력으로 인정받아요.</li>
    <li><b>교육</b> · 교관, 교육기관 보직이에요. 전문성과 처세가 크고, 보조 경력으로 인정받아요.</li></ul>`) +
  sec('필수 보직', `<p>아래 보직을 한 번도 거치지 않으면 다음 진급 심사 대상에서 빠져요. 심사에서 빠져도 기회는 한 번 줄어들기 때문에, 필수 보직은 최대한 빨리 거치는 게 좋아요.</p>
    <table><tr><th>계급</th><th>필수 보직</th><th>규칙</th></tr>${Object.entries(REQUIRED_BILLET).map(([r, v]) => `<tr><td><b>${r}</b></td><td>${v!.label}</td><td>${v!.forceAt ? `${v!.forceAt}년차 인사에서 아직 안 했으면 자동 배정` : '인사에서 1지망으로 내면 가점 +10'}</td></tr>`).join('')}</table>`) +
  sec('계급별 보직표', `<p>보직마다 성장 포인트의 절반이 가는 능력치 두 개가 정해져 있어요. 약한 능력치를 키워 주는 보직을 고르면 역량 균형 점수를 챙길 수 있어요.</p>
    <table><tr><th>계급</th><th>보직</th><th>크는 능력치</th></tr>${billetRows}</table>`) +
  sec('부대 분위기와 상관 (v3.0)', `<p>위관·영관 보직은 희망 조사 때 자리마다 <b>부대 분위기</b>가 보이고, 인사 발표 날 <b>새 상관</b>이 공개돼요. 2년 임기 동안 <b>임기 목표</b>를 이루면 평정 가점과 표창을 받아요.</p>
    <table><tr><th>부대 분위기</th><th>효과</th></tr>${Object.values(UNITS).map((u) => `<tr><td><b>${u.name}</b></td><td>${u.desc}</td></tr>`).join('')}</table>
    <table style="margin-top:10px"><tr><th>상관</th><th>효과</th></tr>${Object.values(BOSSES).map((b) => `<tr><td><b>${b.name}</b></td><td>${b.desc}</td></tr>`).join('')}</table>`) +
  sec('인사 팁', `<ul><li>희망 조사 화면에 1지망으로 올 동기 수와 그중 나보다 점수가 높은 사람이 보여요. '어려움'이면 2지망을 안전하게 내세요.</li><li>1지망은 필수 보직이나 지휘·요직으로, 2지망은 정원 제한이 없는 참모·교육 보직으로 내면 안전해요.</li><li>같은 종류 보직만 계속하면 크는 능력치가 겹쳐요. 두 번에 한 번은 약점을 채우는 보직을 고르세요.</li><li>장성급 보직은 다른 기수와 함께 경쟁해서 정원이 더 좁아요.</li></ul>`)));

// ── 확률 ──
urls.push(page('guide-odds', '결재 확률과 보상 배율', '말뚝 결재 선택지의 성공 확률 계산법, 확률이 낮을수록 커지는 보상 배율, 연속 실패 보정과 운 지수를 설명해요.', [['/guide.html', '게임 가이드'], ['', '확률과 보상']],
  hero('게임 가이드 · 결재', '결재 확률과 보상 배율', '결재 카드에 보이는 확률이 어떻게 계산되는지, 위험한 선택을 하면 무엇을 얻는지 정리했어요.') +
  sec('확률은 이렇게 계산돼요', `<p>선택지마다 기본 확률이 있고, 여기에 내 능력치가 같은 계급 평균보다 높은 만큼 더해지거나 낮은 만큼 빠져요. 예를 들어 소통 선택지는 처세를, 원칙 선택지는 보통 전문성이나 행정력을 봐요.</p>
    <ul><li>관련 경험 태그가 있으면 +8%p (최대 2개)</li><li>관련 군사교육을 받았으면 +5%p</li><li>관련 보직 경험이 있으면 +5%p</li><li>최종 확률은 10%보다 낮거나 95%보다 높아지지 않아요</li></ul>
    <p>카드 아래의 작은 글씨에 "내 처세 40, 평균보다 −5" 같은 근거가 같이 나와요.</p>`) +
  sec('확률이 낮을수록 보상이 커요', `<table><tr><th>표시 확률</th><th>성공 시 평정</th><th>카드 표시</th></tr>${REWARD_TIERS.map((t, i) => `<tr><td>${i === 0 ? `${t.max}% 이하` : `${REWARD_TIERS[i - 1].max + 1}~${t.max}%`}</td><td>×${t.mult}</td><td>${t.label || '-'}</td></tr>`).join('')}</table>
    <p>능력치 상승에는 배율의 절반만 붙어요. 능력치가 오르면 이후 확률이 계속 같이 오르기 때문이에요. 실패했을 때의 손해는 배율과 상관없이 그대로예요.</p>
    <div class="tip">평정 +5짜리 선택지를 확률 30%로 성공하면 +8이 돼요. 반대로 확률 80%짜리는 +4로 줄어요.</div>`) +
  sec('연속 실패 보정', `<p>운이 지나치게 나쁜 판을 막기 위한 장치예요.</p>
    <ul><li>실패할 때마다 다음 결재의 성공 판정에 +${PITY.step}%p가 몰래 더해지고, 최대 +${PITY.max}%p까지 쌓여요. 성공하면 다시 0이 돼요.</li>
    <li>표시 확률 ${PITY.guardOdds}% 이상인 선택은 ${PITY.guardStreak + 1}번 연속으로 실패하지 않아요.</li>
    <li>보정이 걸려 있으면 결재 화면 위에 안내가 떠요.</li></ul>`) +
  sec('운 지수', `<p>전역 카드에 나오는 운 지수는 "확률대로라면 몇 번 성공했어야 하는지"와 "실제로 몇 번 성공했는지"를 비교한 값이에요. 예를 들어 기대 성공 15회에 실제 17회면 운이 좋았던 편이고, 상위 몇 %인지로 보여줘요.</p>`)));

// ── 약장·칭호 ──
urls.push(page('guide-ribbons', '약장·칭호 전체 목록', '말뚝에서 얻을 수 있는 약장 25종과 칭호 11종의 이름과 획득 조건을 모두 정리했어요.', [['/guide.html', '게임 가이드'], ['', '약장·칭호']],
  hero('게임 가이드 · 수집', '약장·칭호 전체 목록', '약장과 칭호는 판이 끝나도 도감에 계속 쌓여요. 이름과 디자인은 모두 이 게임을 위해 새로 만든 가상의 것이에요.') +
  sec(`약장 ${RIBBONS.length}종`, `<p>약장은 서열 순서대로 정렬돼 있어요. 등급이 있는 약장은 조건을 더 채우면 한 단계씩 올라가요.</p>
    <table><tr><th>약장</th><th>얻는 법</th></tr>${RIBBONS.map((r) => `<tr><td><div class="rib">${ribbonSvg({ id: r.id, name: r.name, tierIndex: r.tiers ? r.tiers.length - 1 : 0, design: r.design, tier: r.tiers?.at(-1) } as never, 46)}<b>${r.name}</b></div></td><td>${r.cond}${r.tiers ? `<br><span style="color:var(--faint);font-size:12px">등급 ${r.tiers.join(' · ')}</span>` : ''}</td></tr>`).join('')}</table>`) +
  sec(`칭호 ${TITLES.length}종`, `<p>칭호는 하나를 골라 전역 카드와 랭킹에 달 수 있어요.</p>
    <table><tr><th>칭호</th><th>얻는 법</th></tr>${TITLES.map((t) => `<tr><td><b>${t.name}</b></td><td>${t.cond}</td></tr>`).join('')}</table>`) +
  sec('수집 팁', `<ul><li>보직 종류별 약장(통솔장, 경륜장, 보좌장, 사도장)은 한 판에 여러 종류의 보직을 거치면 한 번에 모을 수 있어요.</li><li>정도장은 중대 사건을 모두 원칙대로 처리해야 해요. 손해를 보더라도 원칙을 고르는 판을 따로 해 보세요.</li><li>맞수장은 라이벌보다 높은 계급으로 전역하면 받아요. 라이벌 소식은 매년 뉴스로 나와요.</li></ul>`)));

// ── 시작 가이드 ──
urls.push(page('guide-start', '출신과 잠재력, 첫 선택 가이드', '말뚝을 시작할 때 고르는 후보 3명, 출신별 특징과 시작 능력치, 숨겨진 잠재력 등급을 설명해요.', [['/guide.html', '게임 가이드'], ['', '시작하기']],
  hero('게임 가이드 · 시작', '출신과 잠재력, 첫 선택 가이드', '첫 화면에서 고르는 후보가 30년 커리어의 출발점이에요. 무엇을 보고 골라야 하는지 정리했어요.') +
  sec('후보 3명', `<p>세 후보는 출신이 서로 다르고, 출신 보너스를 포함한 능력치 총합이 같아요. 분포만 달라서, 어떤 스타일로 커리어를 쌓을지를 고르는 셈이에요. 마음에 드는 후보가 없으면 한 판에 2번까지 다시 뽑을 수 있어요.</p>`) +
  sec('출신별 특징', `<table><tr><th>출신</th><th>교육 기간</th><th>특징</th></tr>${Object.entries(ORIGIN).map(([o, v]) => `<tr><td><b>${ORIGIN_SCHOOL[o as keyof typeof ORIGIN_SCHOOL].school}</b></td><td>${ORIGIN_SCHOOL[o as keyof typeof ORIGIN_SCHOOL].years}</td><td>${v.note}</td></tr>`).join('')}</table>
    <p>사관학교 출신은 처음부터 장기복무라 중위 때 장기복무 심사를 받지 않아요. 나머지 출신은 장기복무 선발을 통과해야 대위 이후 커리어가 이어져요.</p>`) +
  sec('기본 능력치', `<table><tr>${STAT_KEYS.map((k) => `<th>${STAT_LABEL[k]}</th>`).join('')}</tr><tr>${STAT_KEYS.map((k) => `<td>${START_STATS[k]}</td>`).join('')}</tr></table>
    <p>여기에 출신 보너스, 후보별 분포(±8 정도), 생도 시절 집중 육성, 병과 보너스가 더해져서 임관 때 능력치가 정해져요.</p>`) +
  sec('숨겨진 잠재력', `<p>잠재력은 성장 속도와 능력치 상한을 정하는 숨은 값이에요. 상한에 가까워지면 성장이 느려지지만 멈추지는 않아요. 졸업할 때 교관 평가서로 범위(예: A ~ S)를 확인할 수 있어요.</p>
    <table><tr><th>등급</th><th>설명</th></tr>${Object.entries(POTENTIAL).map(([g, v]) => `<tr><td><b>${g}</b></td><td>${v.label}</td></tr>`).join('')}</table>
    <p>오늘의 기수와 우리 기수에서는 후보 3명의 잠재력이 모두 같아요. 난이도는 평일 보통(A), 토요일 쉬움(S), 일요일 어려움(B)이에요. 우리 기수는 기수를 만든 날의 요일을 따라요.</p>
    <div class="tip">잠재력이 낮아도 끝이 아니에요. 등급 사이 차이가 크지 않고, C·B·A 등급은 특정 계기를 만나면 각성해서 한 단계 올라가요.</div>`)));

// ── 패치노트 ──
urls.push(page('notice', '공지 · 패치노트', '말뚝의 업데이트 내역과 공지사항이에요.', [['', '패치노트']],
  hero('공지', '패치노트', '받은 피드백과 바뀐 점을 버전별로 정리하고 있어요.') +
  NOTICES.map((n) => sec(`v${n.id} · ${n.title} <span style="font-size:13px;color:var(--faint);font-weight:500">${n.date}</span>`, `<ul>${n.items.map((i) => `<li>${i}</li>`).join('')}</ul>`)).join('')));

// ── 개인정보처리방침 ──
urls.push(page('privacy', '개인정보처리방침', '말뚝의 개인정보처리방침: 수집하는 정보, 이용 목적, 보관과 삭제, 외부 서비스와 광고 쿠키 안내.', [['', '개인정보처리방침']],
  hero('정책', '개인정보처리방침', '말뚝(malttuk.com)은 이용자의 개인정보를 소중히 다루며, 필요한 최소한의 정보만 처리해요.') +
  sec('1. 수집하는 정보', `<ul><li><b>게임 진행 기록</b> · 이용자의 브라우저(로컬 저장소)에만 저장돼요. 서버로 보내지 않아요.</li>
    <li><b>랭킹 기록</b> · 랭킹에 올릴 때만 닉네임, 전역 카드 내용(계급, 보직, 약장 등), 익명 식별자를 서버에 저장해요.</li>
    <li><b>방문 통계</b> · Google Analytics로 방문 페이지, 기기 종류, 대략적 지역, 게임 이벤트(시작, 전역 등)를 수집해요.</li>
    <li><b>로그인(선택)</b> · 구글 · 카카오로 연결하면 그 회사가 주는 로그인 고유번호를 인증 서비스(Supabase)에 저장해요. 회사가 이메일을 함께 주는 경우 인증 서비스에 저장되지만, 화면에 보여주거나 다른 용도로 쓰지 않아요.</li>
    <li><b>인사기록카드</b> · 닉네임, 군번(가입 순서), 랭킹에 올린 기록으로 계산한 호봉 · 기록, 소속 기수가 다른 이용자에게 보여요.</li>
    <li><b>문의</b> · 문의를 남길 때 답변용 이메일은 선택이에요. 답변 후 지워요.</li></ul>
    <p>실명, 연락처는 받지 않아요. 게임 속 이름은 기기 안에만 저장돼요.</p>`) +
  sec('2. 이용 목적', '<p>랭킹·카드 공유 기능 제공, 게임 개선을 위한 통계 분석, 광고 게재에만 써요.</p>') +
  sec('3. 쿠키와 광고', `<p>이 사이트는 방문 통계와 광고를 위해 쿠키를 사용해요.</p>
    <ul><li>Google을 포함한 제3자 광고 회사는 쿠키를 사용해 이용자가 이 사이트나 다른 사이트를 방문한 기록을 바탕으로 광고를 보여줄 수 있어요.</li>
    <li>Google의 광고 쿠키 사용으로 Google과 파트너는 이용자의 방문 기록을 바탕으로 적절한 광고를 보여줄 수 있어요.</li>
    <li>맞춤 광고는 <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google 광고 설정</a>에서 끌 수 있어요. 카카오 애드핏 광고는 카카오의 맞춤형 광고 안내에 따라요.</li>
    <li>브라우저 설정에서 쿠키를 거부할 수 있지만, 일부 기능이 제대로 동작하지 않을 수 있어요.</li></ul>`) +
  sec('4. 보관과 삭제', `<ul><li>랭킹 기록은 서비스를 운영하는 동안 보관해요. 게임의 설정 → 계정 삭제를 누르면 서버의 내 기록, 닉네임, 호봉, 기수 소속, 로그인 정보가 바로 지워져요.</li><li>기기에 저장된 기록은 게임의 설정 메뉴나 브라우저 데이터 삭제로 지울 수 있어요.</li></ul>`) +
  sec('5. 외부 서비스', `<ul><li>Supabase · 랭킹 데이터 저장, 로그인 인증</li><li>Google · 카카오 · 로그인(선택)</li><li>Google Analytics · 방문 통계 (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google 개인정보처리방침</a>)</li><li>Google 애드센스, 카카오 애드핏 · 광고 게재</li></ul>`) +
  sec('6. 문의', `<p>개인정보 관련 문의는 <a href="${FORM}" target="_blank" rel="noopener">문의 페이지</a>로 남겨 주세요.</p><p style="font-size:13px;color:var(--faint)">시행일 2026년 11월 14일 (로그인 · 인사기록카드 추가)</p>`)));

// ── 이용약관 ──
urls.push(page('terms', '이용약관', '말뚝 이용약관: 서비스, 랭킹과 닉네임, 콘텐츠, 책임에 관한 안내.', [['', '이용약관']],
  hero('정책', '이용약관', '말뚝을 이용하기 전에 아래 내용을 확인해 주세요.') +
  sec('1. 서비스', '<p>말뚝은 무료로 제공되는 웹 게임이에요. 기능과 내용은 예고 없이 바뀔 수 있고, 바뀐 내용은 패치노트로 알려요.</p>') +
  sec('2. 랭킹과 닉네임', '<ul><li>욕설, 비하, 실제 부대 이름, 다른 사람을 사칭하는 닉네임은 쓸 수 없고, 발견되면 기록을 지울 수 있어요.</li><li>비정상적인 방법으로 만든 기록은 랭킹에서 빠질 수 있어요.</li></ul>') +
  sec('3. 콘텐츠', '<p>게임 속 계급장, 약장, 훈장, 이벤트는 이 게임을 위해 만든 가상의 콘텐츠예요. 실제 군 규정, 인물, 부대, 사건과 관계없어요.</p>') +
  sec('4. 광고', '<p>서비스 운영을 위해 배너 광고와 보상형 광고가 표시될 수 있어요. 보상형 광고는 이용자가 직접 선택할 때만 나오고, 진급 확률을 올려주지 않아요.</p>') +
  sec('5. 책임', '<p>게임 기록은 기기나 서비스 사정으로 사라질 수 있어요. 고의나 중대한 과실이 없는 한 이에 대한 책임은 지지 않아요.</p><p style="font-size:13px;color:var(--faint)">시행일 2026년 11월 12일</p>')));

// ── 사이트맵 ──
const all = [`${SITE}/`, ...urls];
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${all.map((u, i) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod><changefreq>${i === 0 ? 'daily' : 'weekly'}</changefreq><priority>${i === 0 ? '1.0' : u.includes('guide') ? '0.8' : '0.5'}</priority></url>`).join('\n')}\n</urlset>\n`);
console.log(all.join('\n'));
