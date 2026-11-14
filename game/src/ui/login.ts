// v3.3 로그인 화면 (#/login): 다른 앱처럼 카카오 · 구글 버튼. 브랜드 버튼은 각 회사 디자인 규칙을 따른다(국방색 예외)
import { getProfile, loginInfo, PROVIDER_NAME, type Provider } from '../net/api';
import { header, load, loadingBox } from './social';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const loginState = { msg: '', conflict: null as Provider | null, nick: '', nickMsg: '', busy: false, sugg: [] as string[] };

const GOOGLE = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const KAKAO = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.84 5.31 4.61 6.73l-.94 3.44c-.08.3.26.54.52.37l4.1-2.71c.56.08 1.13.12 1.71.12 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>';

export const loginButtons = (act = 'auth-link') => `
  <button class="sbtn kakao" data-act="${act}" data-v="kakao">${KAKAO}<span>카카오로 계속하기</span></button>
  <button class="sbtn google" data-act="${act}" data-v="google">${GOOGLE}<span>Google로 계속하기</span></button>`;

/** 로그인했는데 닉네임(프로필)이 없으면: 닉네임 정하기 */
function viewNickStep(): string {
  return `<div class="page">${header('닉네임 정하기', '', 'go-back')}<main class="pad tight" style="padding-top:8px">
    <section class="doc" style="margin:0"><div class="bd lgn">
      <p class="lgt" style="font-size:26px">거의 다 됐어요</p>
      <p class="sub">랭킹과 인사기록카드에 보일 닉네임을 정해 주세요</p>
      <input id="lnick" class="inp" style="height:52px;background:var(--bg);margin-top:18px;text-align:center" maxlength="12" placeholder="닉네임 (2~12자)" value="${esc(loginState.nick)}">
      ${loginState.nickMsg ? `<p class="small" style="margin-top:8px;color:var(--red)">${esc(loginState.nickMsg)}</p>` : ''}
      ${loginState.sugg.length ? `<div class="chips" style="margin-top:8px;justify-content:center">${loginState.sugg.map((x) => `<button class="chip on" data-act="nick-suggest" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      <button class="btn" style="margin-top:12px" data-act="nick-set" ${loginState.busy ? 'disabled' : ''}>${loginState.busy ? '저장하는 중…' : '이 닉네임으로 시작'}</button>
      <p class="faint" style="margin-top:10px">다른 사람과 겹치지 않는 이름만 돼요 · 바꾸기는 7일에 한 번</p>
    </div></section></main></div>`;
}

export function viewLogin(): string {
  if (loginInfo().linked) {
    const prof = load('profile', getProfile);
    if (prof.state === 'loading') return `<div class="page">${header('로그인', '', 'go-back')}<main class="pad tight">${loadingBox}</main></div>`;
    if (prof.state === 'ok' && !prof.data) return viewNickStep();
    const li = loginInfo();
    return `<div class="page">${header('로그인', '', 'go-back')}<main class="pad tight" style="padding-top:8px"><section class="doc" style="margin:0"><div class="bd lgn">
      <p class="lgt" style="font-size:26px">로그인했어요</p><p class="sub">${li.provider ? `${PROVIDER_NAME[li.provider]} 계정` : '계정'}${prof.state === 'ok' && prof.data ? ` · ${esc(prof.data.nickname)}` : ''}</p>
      <a class="btn" href="#" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:16px">로비로</a></div></section></main></div>`;
  }
  const c = loginState.conflict;
  return `<div class="page">${header('로그인', '', 'go-back')}<main class="pad tight" style="padding-top:8px">
    <section class="doc" style="margin:0"><div class="bd lgn">
      <p class="lgt">말뚝</p>
      <p class="sub">로그인하고 기록을 지켜요</p>
      <ul class="lgb"><li>기기를 바꿔도 호봉 · 기수 · 기록이 이어져요</li><li>대항전 기수를 만들 수 있어요</li><li>지금까지 쌓은 기록은 그대로 남아요</li></ul>
      ${c ? `<div class="lgc"><b>이 ${PROVIDER_NAME[c]} 계정은 이미 말뚝 계정이 있어요</b><p>다른 기기에서 쓰던 계정이에요. 그 계정으로 로그인할까요? 이 기기에서 로그인 없이 쌓은 서버 기록은 그 계정으로 옮겨지지 않아요.</p>
        <button class="sbtn ${c}" data-act="auth-signin" data-v="${c}">${c === 'kakao' ? KAKAO : GOOGLE}<span>그 계정으로 로그인</span></button></div>` : loginButtons()}
      ${loginState.msg ? `<p class="small" style="margin-top:10px;color:var(--red);text-align:center">${loginState.msg}</p>` : ''}
    </div></section>
    <p class="faint" style="text-align:center;margin:14px 8px 0">로그인하면 <a href="#/terms" style="color:inherit">이용약관</a>과 <a href="#/privacy" style="color:inherit">개인정보처리방침</a>에 동의해요. 이름 · 이메일은 화면에 보이지 않아요</p>
  </main><div class="bar"><button class="btn line" data-act="go-back">나중에 할게요</button></div></div>`;
}
