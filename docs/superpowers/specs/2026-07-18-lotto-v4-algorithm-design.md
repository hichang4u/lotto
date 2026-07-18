# 로또 알고리즘 v4.0 설계 — 연금 v3 기법 이식

날짜: 2026-07-18
상태: 승인됨 (구현 전)
관련: `964a014` (연금복권 알고리즘 v3, pension-multi-set-v3.0)

## 목표

연금복권 v3에서 검증된 4가지 개선을 로또 6/45 알고리즘에 이식한다.

1. 가중치 학습: 전체 이력 지수 감쇠 + 이론 prior 베이지안 수축
2. 포트폴리오 다양화: 5세트 × 6개 = 30개 번호 완전 비중첩 (완화 사다리 포함)
3. 백테스트: 등수 시뮬레이션 + 랜덤 대조군 + 회차당 최소 1개 당첨률
4. 시드 RNG(mulberry32)로 백테스트 재현성 확보

수학적 전제(연금 v3와 동일): 추첨은 균등 독립이므로 개별 세트의 기대 성적은 어떤 알고리즘도 바꿀 수 없다. 실익은 ①상금 구조에 정렬된 정직한 평가, ②세트 포트폴리오의 "최소 한 번 당첨" 확률 개선(다양화), ③진단 재현성·안정성이다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 이식 범위 | 전체 이식 (4가지 모두) |
| 다양화 강도 | 완전 비중첩 + 완화 사다리 (중복 0 → ≤1 → ≤2 → 성향 완화 → 폴백) |
| 코드 구조 | 공용 통계 모듈 `algorithms/statistics.ts` 추출, 도메인 로직은 파일별 유지 |
| 버전 | `v3.2` → `v4.0` |
| hot/cold 번호 가중치(`buildWeights`) | 로또 고유 기능으로 변경 없이 유지 |
| 성향 5종 체계 | 유지 (제품 정체성) |

## 1. 공용 통계 모듈 (신규 `backend/src/algorithms/statistics.ts`)

- `createSeededRng(seed: number): () => number` — mulberry32. pension.ts에서 이동.
- `shrinkRate(observed: number, totalWeight: number, prior: number, priorStrength: number): number` — `(observed + strength × prior) / (total + strength)`.
- `clamp(value, min, max)`.
- `pension.ts`는 자체 구현을 제거하고 이 모듈을 import (동작 불변 리팩토링, 백테스트 재현성 결과가 바뀌지 않아야 함).
- 감쇠 루프는 도메인 자료형이 달라(6자리 문자열 vs 번호 배열) 각 파일에 유지.

## 2. 가중치 학습 (`lotto.ts` `buildRuleWeights` v4)

- 입력 관례: 기존과 동일하게 과거순(ASC) 배열. 감쇠 인덱스는 최신 회차부터 0 (`decay = 0.5^(ageFromNewest / 52)`).
- `RULE_WEIGHT_LOOKBACK = 24` 제거, 전체 이력 사용.
- 수축 강도 24, 이론 prior는 45C6 = 8,145,060 조합 전수 열거로 오프라인 산출한 상수:
  - `P(공통 규칙 통과)` 1개
  - 성향 5종별 `{ passRate: P(공통∧성향), matchRate: P(성향) }`
  - 산출 스크립트는 스크래치패드에서 실행하고 값·산출 방법을 상수 주석에 명기. 구현 시 독립 재계산으로 대조 검증.
- 점수: 연금 v3와 동일한 lift 공식 — `score = clamp(0.5 × (liftPass × 0.65 + liftMatch × 0.35), 0.05, 1)`, `weight = base × (0.75 + score)`. 이력이 이론과 같으면 전 성향 동일 가중치(1.25).
- 진단 타입 `RuleWeightDiagnostic` 필드는 유지(passRate·recentMatchRate에 수축 추정치 기록).

## 3. 생성 파이프라인 (`lotto.ts`)

- 모든 난수 경로에 `rng: () => number = Math.random` 파라미터 스레딩 (`buildFallbackSet`, `weightedPick`, `pickWeightedNumbers`, `pickSet`, `buildGeneratedSets`).
- `buildGeneratedSets`는 진단 우선순위 배열(`buildRuleWeights` 정렬 결과) 순서로 생성 — 동점 시 표시 순위와 생성 순위 불일치 방지(연금 리뷰 반영사항 미러).
- 다양화: `usedNumbers: Set<number>` 누적. `pickSet` 완화 사다리(각 단계 최대 300회 시도):
  1. 공통 ∧ 성향 ∧ 기존 세트와 교집합 0
  2. 공통 ∧ 성향 ∧ 교집합 ≤1
  3. 공통 ∧ 성향 ∧ 교집합 ≤2
  4. 공통 ∧ 교집합 ≤2 (성향 완화)
  5. 최종 폴백: 미사용 번호 우선으로 6개 채움 (기존 `buildFallbackSet` 대체)
- hot/cold 가중 추출(`buildWeights` → `pickWeightedNumbers`)은 사다리 1~4단계의 후보 생성기로 그대로 사용.

## 4. 백테스트 (`lotto-backtest.ts`)

- 타겟 회차마다 `createSeededRng(0x9e3779b9 ^ drwNo)` — 동일 요청 2회 바이트 단위 동일해야 함.
- 등수 판정: 일치 수 + 보너스 → 6개=1등, 5개+보너스=2등, 5개=3등, 4개=4등, 3개=5등. `prizeCounts: Record<number, number>` (키 1~5 = 등수).
- 랜덤 대조군: 같은 회차·같은 세트 수의 순수 랜덤 6/45 조합(중복 없는 6개)을 같은 RNG 흐름에서 생성. `baseline: { totalSets, averageMatchPerSet, atLeastOnePrizeRate, prizeCounts }`.
- `atLeastOnePrizeRate`(%): 회차당 3개 이상 일치 세트가 하나라도 있는 비율 — 추천/대조군 모두.
- 기존 지표(`hitDistribution`, `bestHitDistribution`, `actualRate`, 성향 성과, 공통 규칙 통과율 등)는 유지하고 필드만 추가.

## 5. API·타입·UI

- `backend/src/types/lotto/summaries.ts` `LottoBacktestSummary`에 `prizeCounts`, `baseline`, `atLeastOnePrizeRate` 추가. 프론트 `types/index.ts` 동기화.
- `LottoPage.tsx` 진단 섹션: 연금 페이지와 같은 형식으로 — 시뮬레이션 당첨 박스(추천/랜덤 두 줄 + 회차당 당첨률 줄), "랜덤 대비(평균 일치)" 타일.
- "최근 24회 기준" 성향 우선순위 문구 → "전체 이력 감쇠 가중 기준"으로 수정.
- `PENSION_PRIZE_TIER_LABELS` 상응물: 로또 등수 라벨(1~5등)은 등수 숫자가 곧 라벨이므로 `{n}등` 포맷 함수로 처리.

## 6. 성능·제약

- 백테스트 비용: 평가 300회 × 이력 ~1,230회 × 성향 5종 감쇠 루프 ≈ 수 밀리초~수백 밀리초 수준(연금 실측 0.33초와 동급 예상). Workers 유료 플랜 기준 문제없음. 실측해서 1초를 크게 넘으면 이력 파싱 1회 선계산으로 최적화.
- 완전 비중첩 5번째 세트는 잔여 21개 번호로 공통 규칙(합계 110-170 등)을 만족해야 함 — 통상 가능하나 실패 시 사다리가 자동 완화. 시도 예산 소진 확률은 무시 가능 수준이어야 하며 구현 후 반복 생성으로 실측.

## 7. 검증 계획

1. 전수 열거 상수: 스크립트 2회(독립 구현 1회 포함) 산출값 일치.
2. 루트 `npm run typecheck` 통과.
3. 백테스트 API 2회 호출 → 바이트 단위 동일.
4. 추천 생성 20회 반복 → 매회 30개 번호 전부 상이(완화 발동률 로그).
5. `atLeastOnePrizeRate` 추천 > 랜덤 확인 및 이론 기대치와 대조.
6. 백테스트 wall time 실측.
7. 로또 페이지 UI 스크린샷 (신규 박스·타일·문구).

## 범위 제외

- 로또 회차 데이터 수집·동기화 로직 변경 없음.
- 연금 알고리즘 동작 변경 없음 (statistics.ts 추출은 동작 불변이어야 함).
- 테스트 프레임워크 도입은 이번 범위 밖 (검증은 스크립트·API 실측으로 수행).
