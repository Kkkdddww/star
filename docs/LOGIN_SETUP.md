# 로그인 설정 안내 (구글 · 카카오)

v3.3 다음 단계(로그인 · 인사기록카드 · 호봉)에 필요해요. 비밀 키는 **Supabase 화면에만** 넣고, 대화나 코드에는 절대 붙여넣지 마세요.

공통으로 쓰는 주소 (돌아올 주소):
`https://mbjmppksxxfdbeuywepf.supabase.co/auth/v1/callback`

## 1. 구글 (약 10분)
1. console.cloud.google.com → 새 프로젝트 "말뚝"
2. API 및 서비스 → OAuth 동의 화면 → 외부 → 앱 이름 "말뚝", 지원 이메일, 앱 도메인 malttuk.com
3. 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 웹 애플리케이션
   - 승인된 리디렉션 URI: 위의 돌아올 주소
4. 나온 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사
5. Supabase → Authentication → Sign In / Providers → Google → 켜기 → 두 값 붙여넣기 → 저장
6. 동의 화면을 "프로덕션"으로 게시 (테스트 상태면 등록한 사람만 로그인돼요)

## 2. 카카오 (약 10분)
1. developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가 → 앱 이름 "말뚝"
2. 앱 설정 → 플랫폼 → Web → 사이트 도메인 `https://malttuk.com`
3. 제품 설정 → 카카오 로그인 → 활성화 ON → Redirect URI에 위의 돌아올 주소
4. 카카오 로그인 → 동의항목 → 닉네임 "필수" (이메일은 비즈 앱이 아니면 선택으로만 돼요. 막히면 알려 주세요)
5. 제품 설정 → 카카오 로그인 → 보안 → Client Secret 코드 생성 → 활성화
6. 앱 키의 **REST API 키**와 **Client Secret**을 복사
7. Supabase → Authentication → Sign In / Providers → Kakao → 켜기 → REST API 키(Client ID)와 Client Secret 붙여넣기 → 저장

## 3. Supabase 공통 (2분)
1. Authentication → URL Configuration → Site URL `https://malttuk.com`, Redirect URLs에 `https://malttuk.com/**` 추가
2. Authentication → Sign In / Providers 맨 위 설정에서 **Allow manual linking** 켜기 (지금 익명 계정에 구글 · 카카오를 "연결"하는 데 필요)
3. Anonymous sign-ins는 지금처럼 켜 둔 채로

다 하면 "로그인 설정 끝"이라고만 알려 주세요. 키 값은 보내지 않아도 돼요.
