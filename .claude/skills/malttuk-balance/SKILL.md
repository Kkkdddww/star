---
name: malttuk-balance
description: 말뚝의 성장·평정·진급·잠재력·보상 수치를 바꿨을 때 시뮬로 장군 비율을 확인하고 목표에 맞추는 절차. config.ts, promotion.ts, growth.ts, term.ts, choice.ts의 수치 변경 뒤에 사용한다.
---

# 말뚝 밸런스 확인

## 목표
- 실제 사람: 준장 이상 약 8%, 중장 이상 약 1%, 대장 약 0.4%
- 봇은 사람보다 2~3배 낮게 나온다 → 봇 기준 준장+ 약 3%, 중장+ 약 0.4%
- 잠재력보다 선택 실력이 중요해야 한다: `sim:pot`에서 같은 잠재력의 최선/최악 차이가 크고, B 잠재력 + 최선 선택이 대령 이상 20% 이상

## 도구 (game 폴더에서)
- `npm run sim` — 봇 전략별 계급 분포 (`sim/balance.ts`, 2000판)
- `npm run sim:gen` — 잠재력 S/A 기준 장군 비율 (`sim/gen3.ts`)
  - `TERM_OFF=1`: 부대 카드·상관 효과를 끈 비교용
  - `VM_ADD=2`: 다른 기수 평균(VIRTUAL_MEAN)을 임시로 +2 해서 비교
- `npm run sim:pot` — 잠재력 × 선택 실력 표 (`sim/potvs.ts`, 인자: 판 수, best|worst|rand)

## 절차
1. 바꾸기 **전** 기준 숫자를 먼저 뽑아 둔다(같은 판 수로).
2. 바꾼 뒤 같은 시뮬을 돌려 표로 비교한다. 판 수가 적으면 오차가 크니 장군 비율은 최소 1500판.
3. 장군 비율이 목표를 벗어나면 먼저 `game/src/engine/promotion.ts`의 `VIRTUAL_MEAN`을 조정한다(전체가 오르면 +, 내려가면 −). 그래도 안 맞으면 바꾼 수치 자체를 줄인다.
4. 시뮬은 몇 분 걸린다. 여러 설정은 병렬로 돌린다.

## 보고
- "변경 전 → 변경 후" 표 하나(준장+ · 중장+ · 대장, 잠재력별 대령+)
- 표본이 작아 오차가 큰 숫자는 그렇다고 적는다
- 출시 2일 뒤 사용자에게 실데이터 SQL로 다시 확인하자고 알린다:
  `select final_rank, count(*) from runs where created_at >= now() - interval '2 days' group by 1 order by 2 desc;`
