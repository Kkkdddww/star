---
name: malttuk-qa
description: 말뚝 코드를 바꾼 뒤 커밋·PR 전에 반드시 돌리는 자동 QA. 타입 검사, 빌드, 휴대폰 크기 브라우저로 주요 화면을 눌러 보고 화면 오류 0개와 스크린샷을 확인한다.
---

# 말뚝 자동 QA

코드를 바꿨으면 PR 전에 이 순서를 끝까지 통과시킨다. 하나라도 실패하면 고치고 처음부터 다시.

## 순서 (game 폴더에서)
1. `npm run check` — 타입 오류 0개
2. `npm run build` — dist/index.html 생성
3. `npm run qa` — `qa/smoke.mjs`가 390×844 화면으로 로비 → 오늘의 기수 후보 → 자유 플레이 후보 → 우리 기수 → 기수 페이지 → 한마디 → 랭킹 → 공지를 열고, pageerror 0개인지 확인. 스크린샷은 `qa/shots/`
   - Playwright 브라우저가 없으면 `npx playwright install chromium` 후 다시. 설치가 막히면 그 사실을 사용자에게 알리고 1·2만 통과시킨 채 진행한다.
4. **바꾼 화면은 smoke에 단계를 추가해서** 직접 열어 보고 스크린샷을 확인한다. 저장 데이터가 필요한 화면(희망 조사, 전역 화면 등)은 엔진으로 상태를 만들어 localStorage에 넣고 연다. 키는 `src/ui/main.ts`의 SLOT_KEY(자유 `sowi-to-star-v2`, 오늘의 기수 `malttuk-daily-v1`, 우리 기수 `malttuk-cohort-v1`).
5. 스크린샷을 보고 확인: 글자 넘침·겹침, 상자 안 상자, 디자인 원칙 위반(그라데이션·금색·이모지), 버튼이 바(bar)에 가려짐
6. `npm run deploy` — 맨 위 사이트 파일 갱신

## 보고
- 사용자에게는 "QA 통과 · 오류 0개"와 바뀐 화면 스크린샷 1~3장만 보여준다.
- 서버(Supabase)는 가짜 응답이라 실제 업로드·순위는 확인되지 않는다. 서버를 건드린 변경이면 그 점을 한 줄로 알린다.
