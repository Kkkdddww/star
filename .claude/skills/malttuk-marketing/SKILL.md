---
name: malttuk-marketing
description: 말뚝 AI 마케팅 팀 운영 절차. 매일 · 매주 홍보물(SNS 글 · 카드 이미지 · 숏폼 대본)을 만들 때, 마케팅 팀 에이전트(mkt-analyst · mkt-writer · mkt-designer · mkt-editor)를 부릴 때, "오늘 홍보물", "마케팅 돌려줘" 같은 요청에 사용한다.
---

# 말뚝 AI 마케팅 팀

팀장은 메인 세션(Claude)이다. 사용자는 사장(최종 승인)이다. **SNS에 올리는 것은 항상 사장이 직접 한다.** 팀은 올릴 거리를 만들고 검수해서 휴대폰으로 보낸다.

## 먼저 읽기
1. `.agents/product-marketing.md` (제품 · 대상 · 말투 · 금지 사항)
2. `CLAUDE.md`의 "절대 지킬 것"
3. 필요한 스킬: social(채널별 형식), copywriting · copy-editing(문구), marketing-psychology(투표 · 비교 심리), video(숏폼), image(카드), marketing-loops(정기 작업 설계), analytics(UTM · 지표)

## 팀
| 역할 | 에이전트 | 하는 일 | 쓰는 것 |
|---|---|---|---|
| 팀장 | 메인 세션 | 순서 정하기, 결과 모아 사장에게 보내기, 학습 기록 | 이 문서 |
| 데이터 분석관 | `mkt-analyst` | 공개 기록에서 오늘의 사실 뽑기 (`facts.json`) | `marketing/scripts/facts.mts` |
| 카피라이터 | `mkt-writer` | 채널별 글 (X · 스레드 · 인스타 · 오픈채팅), 투표 문구, 숏폼 대본 | social · copywriting 스킬 |
| 디자이너 | `mkt-designer` | 카드 이미지 (결과 카드 · 투표 카드 · 표창장) | `bash marketing/render.sh` (틀: `marketing/scripts/render.mts`) |
| 검수관 | `mkt-editor` | 금지 사항 · 사실 · 말투 · 맞춤법 검사, 통과/반려 | copy-editing 스킬, 이 문서의 검수표 |

## 매일 루프 (밤 9시, 오늘의 기수 마감 3시간 전)
1. **analyst**: `bash marketing/facts.sh` → `marketing/out/날짜/facts.json` (참가 수, 1~3위, 장군 수, 가장 갈린 결재, 내일 난이도)
2. **writer**: facts.json만 근거로 글 3종 + 투표 1개 → `posts.md`
3. **designer**: `bash marketing/render.sh` → 결과 카드 · 투표 카드 · 어제 투표 결과 카드 (`card_result.png`, `card_poll.png`, `card_reveal.png`, 1080×1350), 월요일엔 `card_award.png`
4. **editor**: 검수표로 확인 → 통과하면 `review.md`에 "통과", 반려면 이유와 고친 문구
5. **팀장**: 통과본을 사장에게 보낸다 (파일 + 글은 복사하기 쉽게 코드 블록). 다음 날 결과 공개용 "어제 투표 결과" 글도 같이

## 매주 루프 (월요일 오전)
- 지난주 대항전 1~3위 표창장 카드 + 글, 이번 주 시작 알림
- 지난주 홍보물 반응(사장이 알려 준 좋아요 · 유입) → `marketing/LEARNINGS.md`에 한 줄씩

## 검수표 (editor가 하나라도 걸리면 반려)
- [ ] 실제 부대 · 무기 · 작전 · 실존 인물 · 정치 · 성별 · 지역 갈등 없음
- [ ] 운영자 신분(현역 · 실명 · 소속) 암시 없음
- [ ] 숫자는 전부 facts.json에 있음 (지어낸 숫자 0개)
- [ ] 닉네임은 facts.json의 공개 이름 그대로 (금칙어 이름은 이미 "익명 장교")
- [ ] 확률 · 능력치를 판다는 오해 없음, 과장 · 낚시 없음
- [ ] 말투: 짧은 해요체, 이모지 0~1개, AI 티 나는 문형("X가 아니라 Y", 세 개 나열) 없음
- [ ] 링크에 utm (`?utm_source=x|threads|instagram|kakao&utm_medium=post&utm_campaign=날짜`)

## 채널 형식
- **X:** 140자 안팎 한 덩어리 + 링크. 투표는 X 투표 기능 (선택지 최대 4개, 25자)
- **스레드:** 2~4문단, 질문으로 끝내서 댓글 유도
- **인스타:** 카드 이미지 + 캡션 3~5줄, 해시태그 5개 이내 (#말뚝 #장교 #군대 #진급 #웹게임)
- **오픈채팅 · 단톡:** 두 줄 + 링크

## 하지 않는 것
- SNS 자동 게시, 커뮤니티 자동 글쓰기, 댓글 자동 응답 (스팸 · 계정 정지 · 신분 노출 위험)
- 서버에 무거운 집계 요청 (facts.mts는 앱이 쓰는 것과 같은 가벼운 조회만. 큰 통계는 사장이 SQL Editor에서)
