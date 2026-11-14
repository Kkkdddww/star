// v3.3 로그인 화면 (#/login): 다른 앱처럼 카카오 · 구글 버튼. 브랜드 버튼은 각 회사 디자인 규칙을 따른다(국방색 예외)
import { PROVIDER_NAME, type Provider } from '../net/api';
import { header } from './social';

export const loginState = { msg: '', conflict: null as Provider | null };

const GOOGLE = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const KAKAO = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.84 5.31 4.61 6.73l-.94 3.44c-.08.3.26.54.52.37l4.1-2.71c.56.08 1.13.12 1.71.12 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>';

export const loginButtons = (act = 'auth-link') => `
  <button class="sbtn kakao" data-act="${act}" data-v="kakao">${KAKAO}<span>카카오로 계속하기</span></button>
  <button class="sbtn google" data-act="${act}" data-v="google">${GOOGLE}<span>Google로 계속하기</span></button>`;

export function viewLogin(): string {
  const c = loginState.conflict;
  return `<div class="page">${header('로그인')}<main class="pad tight" style="padding-top:8px">
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
