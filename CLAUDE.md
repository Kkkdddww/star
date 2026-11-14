# 말뚝 (malttuk.com) — Claude Code 작업 안내

장교 커리어 시뮬레이션 웹게임. 한 번 누르면 1년, 소위에서 시작해 진급하거나 전역한다.
GitHub Pages가 이 저장소의 **맨 위 폴더**를 malttuk.com으로 서비스한다 (Cloudflare DNS, CNAME 파일).

## 저장소 구조
- `/` (맨 위): **배포 결과물만**. index.html, 정적 페이지(about·guide·notice·privacy·terms 등), sitemap.xml, robots.txt, ads.txt, CNAME, og.png, 파비콘. 직접 고치지 말고 빌드로 만든다.
- `game/`: 소스 코드
  - `src/engine/`: 게임 엔진 (순수 TypeScript, 화면 없음). 성장·결재·인사·진급·임기(term.ts)·메타(약장·칭호·명예 점수)
  - `src/data/`: 설정값(config.ts), 결재 사건(choices.ts) 등
  - `src/ui/`: 화면 (문자열 HTML + data-act 클릭 위임). main.ts가 중심, social.ts(랭킹·카드), group.ts(우리 기수·한마디), site.ts(공지·설정·푸터), ads.ts, cardImage.ts
  - `src/net/`: Supabase REST(api.ts), GA(analytics.ts)
  - `web/template.html`: HTML 틀 + CSS 전부. `web/pages.ts`: 정적 페이지 생성기. `web/build.mjs`, `web/deploy.mjs`
  - `sim/`: 밸런스 시뮬레이션
  - `sql/`: Supabase에 사람이 직접 실행할 SQL (날짜_버전.sql)
  - `NOTES.md`: 버전별 개발 기록
- `docs/ROADMAP.md`: v3.2 → v4.0 계획. 작업 전에 해당 버전 부분을 읽는다.

## 명령 (game 폴더에서)
```
npm install
npm run check     # 타입 검사. 커밋 전 항상
npm run build     # game/dist/index.html + dist/site/*
npm run deploy    # check + build + 맨 위 폴더로 복사
npm run sim       # 계급 분포 시뮬 (봇 2000판, 몇 분 걸림)
npm run sim:gen   # 잠재력 S/A 기준 장군 비율. TERM_OFF=1, VM_ADD=2 같은 환경변수로 비교
npm run sim:pot   # 잠재력 × 선택 실력 비교
npm run qa        # 휴대폰 크기 브라우저로 주요 화면 열기 + 오류 0개 확인 (build 후)
```
작업이 끝나면 **반드시 `npm run deploy`로 맨 위 파일까지 갱신**해서 같이 커밋한다. 안 하면 사이트에 반영되지 않는다.

## 절대 지킬 것
- **실제 부대 이름·번호·위치, 무기 이름·제원, 작전 계획, 경계·대응 절차, 보고 체계, 교전 기준, 암구호를 넣지 않는다.** 실제 인물·실제 사건을 떠올리게 하는 내용도 금지. 결과는 행정적인 것만(평정·표창·인사·관계·평판).
- 약장·훈장 이름은 게임 전용 이름, 그림은 직접 만든 것만.
- 광고·결제로 파는 것은 **정보·다시 뽑기·꾸미기만**. 확률·능력치·순위에 영향 주는 것은 절대 팔지 않는다.
- 오늘의 기수·우리 기수·대항전은 "같은 출발선"이 핵심. 세상 시드(seed)는 모두 같고 판정 주사위만 rollSeed로 다르다. 이 구조를 깨지 않는다.
- Supabase **service_role 키나 DB 비밀번호를 코드에 절대 넣지 않는다.** 코드에는 publishable 키만 있다.
- 서버 구조가 바뀌면 `game/sql/`에 SQL 파일을 만들고, 사용자에게 "Supabase SQL Editor에서 먼저 Run" 하라고 알린다. 새 칸을 읽는 코드는 SQL 실행 전에도 깨지지 않게 한다.
- 통계에서 정원과 심사 대상을 섞지 않는다.
- 개발자 개인정보(실명·이메일)를 코드·문서·커밋에 넣지 않는다.

## 디자인 원칙 (중요)
- 말뚝의 화면 언어는 **군 행정 문서**: 흰 종이 카드, 국방색(var(--olive)) 하나, 회색 배경, 1px 줄, 문서번호, 도장, 인사명령·통지서·표창장 형식.
- 어두운 그라데이션, 금색 배경, 네온·빨간 LIVE 점, 이모지, 시상대 같은 "AI스러운" 장식은 쓰지 않는다.
- 상자 안에 상자를 겹치지 않는다. 새 화면은 기존 클래스(.doc, .kv, .chip, .paper, .stamp, .opt, .row 등)를 재사용한다.
- 문구는 짧은 해요체. 숫자는 구체적으로("47위까지 명예 3점").
- 휴대폰(390px) 기준으로 확인한다.

## 밸런스 목표
- 실제 사람 기준: 준장 이상 약 8%, 중장 이상 약 1%, 대장 약 0.4%. 봇은 사람보다 2~3배 낮게 나온다.
- 중령 이상 진급은 다른 기수 평균(promotion.ts의 VIRTUAL_MEAN)과 겨룬다. 전체 능력치가 오르는 변경을 하면 이 값을 시뮬로 다시 맞춘다.

## 프로젝트 스킬 (.claude/skills/)
- `malttuk-plan`: 새 기능 전 1페이지 명세 → 확인
- `malttuk-qa`: 커밋 전 자동 QA (check · build · qa · 스크린샷)
- `malttuk-balance`: 수치 변경 뒤 시뮬로 장군 비율 확인
- `malttuk-design`: 화면·카드 디자인 규칙
- `malttuk-writing`: 사건·이야기·엔딩 문구 규칙

## 작업 방식
- 사용자는 휴대폰으로 작업하고, 코드를 직접 읽기보다 결과를 본다. 설명은 짧고 쉽게, 한국어로.
- 큰 기능은 만들기 전에 계획을 먼저 보여주고 확인받는다.
- 작업이 끝나면: 무엇이 바뀌었는지 3~5줄, 사용자가 할 일(SQL 실행 등)이 있으면 순서대로.
- `game/NOTES.md`에 버전별 개발 기록을 한 단락 추가하고, 패치노트는 `src/ui/site.ts`의 NOTICES 맨 앞에 추가한다.
