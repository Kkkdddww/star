import { adSlot } from './ads';
// 사이트 페이지: 공지·패치노트, 게임 소개, 게임 가이드, 개인정보처리방침, 이용약관, 설정 + 공통 푸터
const back = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
export const CONTACT_URL = 'https://github.com/Kkkdddww/star/issues';
export const SITE_NAME = '말뚝';

export type SitePage = 'notice' | 'about' | 'guide' | 'privacy' | 'terms' | 'settings';
export const SITE_PAGES: SitePage[] = ['notice', 'about', 'guide', 'privacy', 'terms', 'settings'];

// ── 공지·패치노트 (위가 최신) ──
export const NOTICES: { id: string; date: string; title: string; items: string[] }[] = [
  { id: '3.2', date: '2026.11.14', title: '공정한 출발선 · 시즌 2', items: ['오늘의 기수 · 우리 기수는 후보 3명 잠재력이 모두 같아요. 평일 A, 토요일 S(장군이 많이 나오는 날), 일요일 B(어려운 날). 11월 15일 기수부터 적용돼요', '잠재력 차이를 줄였어요. B·C도 선택을 잘하면 대령, 장군까지 갈 수 있어요. 각성도 더 자주 일어나요', '명예의 전당이 시즌 2로 새로 시작해요. 시즌 1 기록은 보관돼 있고, 시즌 전체 순위는 한 사람당 최고 기록 하나만 보여요', '오늘의 기수를 마치면 자유 플레이와 우리 기수로 바로 갈 수 있어요', '내 한마디에 답글이 달리면 로비 한마디 띠에 표시돼요', '운영진으로 보이는 닉네임은 쓸 수 없어요'] },
  { id: '3.1', date: '2026.11.13', title: '우리 기수 · 한마디 · 로비 정리', items: ['우리 기수: 기수를 만들고 링크로 친구를 부르면, 모두 같은 후보·같은 동기·같은 결재함으로 출발해요. 7일 동안 한 사람당 한 판, 최대 30명', '기수 페이지에서 순위, 기수 시상(명예왕·표창왕·말뚝상·행운아 등), 친구와 처음 선택이 갈린 순간을 볼 수 있어요', '개발자한테 한마디: 버그·건의·응원을 남겨 주세요. 개발자가 답글을 달아요', '로비를 정리했어요. 플레이 방식 세 가지를 한곳에 모았고, 아래 버튼은 지금 할 만한 것 하나만 보여줘요', '자유 플레이 랭킹이 "명예의 전당"이 됐어요. 세 모드 모두 계급 → 명예 점수 → 복무 기간 순이에요. 명예 점수가 없는 예전 기록은 같은 계급 안에서 뒤로 가요'] },
  { id: '3.0', date: '2026.11.13', title: '오늘의 기수 · 인사 개편', items: ['오늘의 기수: 하루 한 번, 오늘 입대한 모두가 같은 후보·같은 동기·같은 첫 결재함으로 시작해요. 다시 뽑기 없이 첫 판만 기록돼요', '같은 계급이면 명예 점수(약장·칭호·표창·무사고 등)로 순위를 가려요. 전역하면 남들과 달랐던 선택을 보여줘요', '희망 조사: 자리마다 부대 분위기(훈련 많은·새로 만든·잘나가는·분위기 안 좋은·평가 앞둔)가 달라요. 1지망으로 올 동기 수와 내 순위도 미리 보여줘요', '인사 발표: 봉투를 열면 새 상관(꼼꼼한·성과형·방임형·사람 좋은)이 공개돼요. 상관에 따라 결재 확률과 평정이 달라져요', '임기 목표: 2년 임기 동안 목표를 이루면 평정 가점과 표창', '자유 플레이는 그대로예요'] },
  { id: '2.23', date: '2026.11.13', title: '별의 무게 (밸런스 조정)', items: ['실제 플레이 약 4,800판을 분석해 보니 대령의 73%가 별을 달고, 중장의 76%가 대장이 됐어요. 그래서 장성 심사를 어렵게 바꿨어요', '목표: 준장 이상 약 8%, 중장 약 1%, 대장 약 0.4%', '이미 올라간 랭킹 기록은 그대로 남아요'] },
  { id: '2.20', date: '2026.11.12', title: '새 주소 malttuk.com', items: ['이제 malttuk.com 으로 접속할 수 있어요. 예전 주소로 들어와도 자동으로 넘어와요', '주소가 바뀌어서 이 기기에 저장된 진행 기록·약장 도감은 새로 시작돼요. 랭킹에 올린 기록은 그대로예요'] },
  { id: '2.19', date: '2026.11.12', title: '사이트 단장', items: ['공지·설정 메뉴와 하단 안내(게임 소개, 가이드, 개인정보처리방침, 이용약관)를 만들었어요', '로비 랭킹을 더 가볍게 불러와요'] },
  { id: '2.18', date: '2026.11.11', title: '쓰리스타·포스타 개방', items: ['중장(★★★)은 약 1%, 대장(★★★★)은 약 0.5% 확률로 오를 수 있어요'] },
  { id: '2.17', date: '2026.11.11', title: '후보 3명 중에 고르기', items: ['출신과 능력치 분포가 다른 후보 3명 중 한 명을 골라 시작해요', '후보 다시 뽑기 2회 (무료)', '졸업 때 교관 평가서로 잠재력 범위를 확인할 수 있어요', '다시 뽑기 없이 장성이 되면 칭호 "정공법"'] },
  { id: '2.16', date: '2026.11.11', title: '확률 체감 개선', items: ['확률이 낮을수록 성공 보상이 커져요 (대박 ×1.6, 도전 ×1.3)', '연속 실패 보정: 실패할 때마다 다음 판정 +5%p (최대 +15%p)', '실패하면 이유를 알려줘요', '전역 카드에 운 지수가 나와요'] },
  { id: '2.13', date: '2026.11.11', title: '연출 다듬기', items: ['훈장 수여 연출을 가볍게 바꿨어요', '터닝포인트가 너무 자주 뜨지 않게 했어요'] },
  { id: '2.12', date: '2026.11.11', title: '평정 등급 변경', items: ['수·우·미·양 → 탁월·우수·보통·미흡', '전역 후 랭킹 올리기가 필수가 됐어요'] },
];
const SEEN_KEY = 'malttuk-notice-seen';
export const hasNewNotice = () => { try { return localStorage.getItem(SEEN_KEY) !== NOTICES[0].id; } catch { return false; } };
export const markNoticeSeen = () => { try { localStorage.setItem(SEEN_KEY, NOTICES[0].id); } catch { /* 무시 */ } };

// ── 설정 ──
const MOTION_KEY = 'malttuk-reduce-motion';
export const reduceMotion = () => { try { return localStorage.getItem(MOTION_KEY) === '1'; } catch { return false; } };
export function setReduceMotion(on: boolean) {
  try { localStorage.setItem(MOTION_KEY, on ? '1' : '0'); } catch { /* 무시 */ }
  document.documentElement.classList.toggle('calm', on);
}
export const applySettings = () => document.documentElement.classList.toggle('calm', reduceMotion());
export const settingsState = { confirmWipe: false, msg: '' };

function head(title: string): string {
  return `<header class="top"><button class="iconbtn" style="margin:0 0 0 -8px" data-act="route-home" aria-label="게임으로">${back}</button><span class="t">${title}</span><span class="sp"></span></header>`;
}
const wrap = (title: string, body: string, cta = '게임으로', ad = false) =>
  `<div class="page">${head(title)}<main class="pad tight site" style="padding-top:8px;padding-bottom:130px">${body}${ad ? adSlot('notice') : ''}${footer()}</main><div class="bar"><button class="btn" data-act="route-home">${cta}</button></div></div>`;
const sec = (t: string, inner: string) => `<section class="doc" style="margin:0 0 10px"><div class="hd"><span>${t}</span></div><div class="bd prose">${inner}</div></section>`;

function viewNotice(): string {
  markNoticeSeen();
  return wrap('공지 · 패치노트', NOTICES.map((n) => `<section class="doc" style="margin:0 0 10px"><div class="hd"><span>v${n.id} · ${n.title}</span><em>${n.date}</em></div><div class="bd prose"><ul>${n.items.map((i) => `<li>${i}</li>`).join('')}</ul></div></section>`)
  .join(''), '게임으로', true);
}

function viewAbout(): string {
  return wrap('게임 소개', sec('말뚝은 어떤 게임인가요', `
    <p><b>2년 말고 30년.</b> 소위로 임관해서 별까지, 장교 인생을 한 번에 1년씩 보내는 커리어 시뮬레이션이에요.</p>
    <p>출신과 능력치가 다른 후보 세 명 중 한 명을 골라 학교에 들어가고, 동기 30명과 함께 결재하고, 평정을 받고, 진급 심사를 기다려요. 한 판은 10분 정도예요.</p>`) +
    sec('만들면서 지킨 원칙', `<ul>
      <li>실제 부대명, 위치, 무기, 작전·경계 절차는 넣지 않았어요.</li>
      <li>사건의 결과는 표창, 경고, 견책 같은 행정 처분까지만 다뤄요.</li>
      <li>계급장, 약장, 훈장 이름은 이 게임을 위해 새로 만들었어요.</li>
      <li>진급률과 수치는 모두 게임용 가상 값이고, 실제 규정과는 달라요.</li>
      <li>실제 인물·부대·사건과는 관계없는 가상의 이야기예요.</li></ul>`) +
    sec('만든 사람', `<p><b>동우캉</b>이 혼자 기획하고, 그리고, 만들고 있어요. 의견은 <a href="${CONTACT_URL}" target="_blank" rel="noopener">문의</a>로 남겨 주세요.</p>`));
}

function viewGuide(): string {
  return wrap('게임 가이드', sec('한 해의 흐름', `<ol>
      <li><b>결재함</b> · 상반기 결재 한 건. 원칙, 소통, 도전, 편법 중에 골라요.</li>
      <li><b>1년 보내기</b> · 7월에 멈추면 하반기 결재를 한 번 더 해요.</li>
      <li><b>근무평정</b> · 탁월, 우수, 보통, 미흡.</li>
      <li><b>진급 심사</b> · 평정, 경력, 교육, 역량 균형을 동기들과 비교해요.</li>
      <li><b>정기 인사</b> · 1·2지망을 내면 점수 순으로 보직이 정해져요.</li></ol>`) +
    sec('결재 확률과 보상', `<ul>
      <li>확률이 낮을수록 성공 보상이 커요. 35% 이하 ×1.6, 50% 이하 ×1.3, 70% 초과 ×0.8.</li>
      <li>실패할 때마다 다음 판정에 +5%p 보정이 붙어요(최대 +15%p). 60% 이상 선택은 3연속 실패가 없어요.</li>
      <li>편법은 당장 편하지만, 쌓이면 감사에서 드러날 수 있어요.</li></ul>`) +
    sec('진급 팁', `<ul>
      <li><b>필수 보직</b> · 대위는 중대장, 중령은 대대장, 대령은 연대장급을 거쳐야 다음 심사를 받아요.</li>
      <li><b>역량 균형</b> · 가장 약한 능력치 두 개가 진급 점수의 15%예요. 한 우물만 파면 중령에서 멈춰요.</li>
      <li><b>집중 육성</b> · 진급이나 필수 보직 부임 때 바꿔 주면 좋아요.</li>
      <li><b>별 확률</b> · 준장 약 8%, 중장 약 1%, 대장 약 0.4%.</li></ul>`), '게임으로', true);
}

function viewPrivacy(): string {
  return wrap('개인정보처리방침', sec('1. 수집하는 정보', `<ul>
      <li><b>게임 진행 기록</b> · 내 브라우저(로컬 저장소)에만 저장돼요. 서버로 보내지 않아요.</li>
      <li><b>랭킹 기록</b> · 랭킹에 올릴 때만 닉네임, 전역 카드 내용(계급, 보직, 약장 등), 익명 식별자를 서버에 저장해요.</li>
      <li><b>방문 통계</b> · Google Analytics로 방문 페이지, 기기 종류, 대략적 지역, 게임 이벤트(시작, 전역 등)를 수집해요. 쿠키를 사용해요.</li></ul>
      <p>이름, 연락처, 이메일 같은 개인 식별 정보는 받지 않아요. 게임 속 이름은 기기 안에만 저장돼요.</p>`) +
    sec('2. 이용 목적', '<p>랭킹·카드 공유 기능 제공, 게임 개선을 위한 통계 분석, 광고 게재에 써요.</p>') +
    sec('3. 보관과 삭제', `<ul>
      <li>랭킹 기록은 서비스를 운영하는 동안 보관해요. 삭제를 원하면 <a href="${CONTACT_URL}" target="_blank" rel="noopener">문의</a>로 카드 링크를 알려 주세요.</li>
      <li>기기에 저장된 기록은 설정 메뉴나 브라우저 데이터 삭제로 지울 수 있어요.</li></ul>`) +
    sec('4. 외부 서비스', `<ul>
      <li>Supabase · 랭킹 데이터 저장</li>
      <li>Google Analytics · 방문 통계 (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">구글 개인정보처리방침</a>)</li>
      <li>카카오 애드핏, 구글 애드센스 · 광고 게재. 광고 회사는 광고를 보여주고 성과를 측정하기 위해 쿠키나 기기 식별 정보를 사용할 수 있어요. 맞춤형 광고는 각 회사의 광고 설정에서 끌 수 있어요 (<a href="https://adssettings.google.com" target="_blank" rel="noopener">구글 광고 설정</a>)</li></ul>`) +
    sec('5. 문의', `<p>개인정보 관련 문의는 <a href="${CONTACT_URL}" target="_blank" rel="noopener">문의 페이지</a>로 남겨 주세요.</p><p class="faint">시행일 2026년 11월 12일</p>`));
}

function viewTerms(): string {
  return wrap('이용약관', sec('1. 서비스', '<p>말뚝은 무료로 제공되는 웹 게임이에요. 기능과 내용은 예고 없이 바뀔 수 있어요.</p>') +
    sec('2. 랭킹과 닉네임', `<ul>
      <li>욕설, 비하, 실제 부대 이름, 다른 사람을 사칭하는 닉네임은 쓸 수 없고, 발견되면 기록을 지울 수 있어요.</li>
      <li>비정상적인 방법으로 만든 기록은 랭킹에서 빠질 수 있어요.</li></ul>`) +
    sec('3. 콘텐츠', '<p>게임 속 계급장, 약장, 훈장, 이벤트는 이 게임을 위해 만든 가상의 콘텐츠예요. 실제 군 규정, 인물, 부대, 사건과 관계없어요.</p>') +
    sec('4. 책임', '<p>게임 기록은 기기나 서비스 사정으로 사라질 수 있어요. 고의나 중대한 과실이 없는 한 이에 대한 책임은 지지 않아요.</p><p class="faint">시행일 2026년 11월 12일</p>'));
}

function viewSettings(): string {
  const on = reduceMotion();
  return wrap('설정', `<section class="doc" style="margin:0 0 10px"><div class="bd">
      <button class="setrow" data-act="set-motion"><span><b>움직임 줄이기</b><span>훈장·진급 연출과 애니메이션을 최소로 해요</span></span><i class="tog ${on ? 'on' : ''}"></i></button>
    </div></section>
    <section class="doc" style="margin:0 0 10px"><div class="hd"><span>데이터</span></div><div class="bd">
      <button class="setrow" data-act="set-wipe"><span><b>${settingsState.confirmWipe ? '한 번 더 누르면 지워져요' : '이 기기의 기록 모두 지우기'}</b><span>진행 중인 게임, 약장 도감, 칭호가 지워져요. 랭킹에 올린 기록은 남아요</span></span></button>
      ${settingsState.msg ? `<p class="faint" style="margin-top:8px">${settingsState.msg}</p>` : ''}
    </div></section>
    <section class="doc" style="margin:0 0 10px"><div class="bd">
      <div class="kv"><span>버전</span><b>v${NOTICES[0].id}</b></div>
      <a class="setrow" href="${CONTACT_URL}" target="_blank" rel="noopener"><span><b>문의 · 버그 제보</b><span>GitHub Issues로 연결돼요</span></span></a>
    </div></section>`);
}

export function viewSite(p: SitePage): string {
  return p === 'notice' ? viewNotice() : p === 'about' ? viewAbout() : p === 'guide' ? viewGuide() : p === 'privacy' ? viewPrivacy() : p === 'terms' ? viewTerms() : viewSettings();
}

export function footer(): string {
  const L = (h: string, t: string) => `<a href="#/${h}">${t}</a>`;
  return `<footer class="sitefoot">
    <div class="ftop">
      <div><p class="fn">말뚝</p><p class="ft">2년 말고 30년, 장교 커리어 시뮬레이션</p></div>
      <a class="fver" href="#/notice">v${NOTICES[0].id}</a>
    </div>
    <div class="fcols">
      <div><p class="fh">플레이</p>${L('rank', '랭킹')}${L('gallery', '커리어 갤러리')}<a href="/notice.html">패치노트</a></div>
      <div><p class="fh">안내</p><a href="/about.html">게임 소개</a><a href="/guide.html">게임 가이드</a><a href="${CONTACT_URL}" target="_blank" rel="noopener">문의</a></div>
      <div><p class="fh">정책</p><a href="/privacy.html">개인정보처리방침</a><a href="/terms.html">이용약관</a></div>
    </div>
    <div class="fbot"><span>made by <b>동우캉</b></span><span>© 2026 말뚝</span></div>
    <p class="cp">실제 인물·부대·사건과 관계없는 가상의 게임이에요.</p>
  </footer>`;
}
