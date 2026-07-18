# 로또 알고리즘 v4.0 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연금 v3에서 검증된 4가지 기법(감쇠+수축 가중치, 포트폴리오 다양화, 등수 시뮬레이션+랜덤 대조군, 시드 RNG)을 로또 6/45 알고리즘에 이식한다.

**Architecture:** 공용 통계 모듈(`statistics.ts`)을 추출해 연금·로또가 공유하고, `lotto.ts`의 가중치 학습·생성 파이프라인과 `lotto-backtest.ts`를 재작성한다. API 응답 필드가 추가되므로 백엔드 타입 → 프론트 타입 → UI 순으로 동기화한다.

**Tech Stack:** TypeScript (Cloudflare Workers backend + React/Vite frontend). 테스트 프레임워크 없음 — 스펙 결정에 따라 검증은 node 스크립트·로컬 API 실측·typecheck로 수행한다.

**Spec:** `docs/superpowers/specs/2026-07-18-lotto-v4-algorithm-design.md`

## Global Constraints

- 알고리즘 버전 문자열: `v3.2` → `v4.0` (`LOTTO_ALGORITHM_VERSION`)
- 감쇠 반감기 52, 수축 강도 24 (연금 v3와 동일 값)
- 히스토리 정렬 관례: **로또 함수 입력은 과거순(ASC)** — 감쇠 나이는 `배열길이-1-index`로 계산 (연금은 최신순 관례 — 혼동 금지)
- 연금 알고리즘의 **동작(백테스트 응답 바이트)이 변하면 안 됨** — statistics.ts 추출은 순수 리팩토링
- hot/cold 번호 가중치(`buildWeights`)와 성향 5종 체계는 변경 금지
- 커밋 메시지는 한국어, 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 각 태스크 완료 시 루트 `npm run typecheck` 통과 필수
- 검증용 로컬 서버: `npm run dev` (backend :8787, frontend :5173). 이미 떠 있으면 재사용
- 이론 상수는 아래 값을 그대로 사용 (45C6 = 8,145,060 전수 열거로 산출·검증 완료, 산출 스크립트: 스크래치패드 `enumerate-lotto.js`):

| ruleId | passRate (공통∧성향) | matchRate (성향 단독) |
|---|---|---|
| (공통 규칙만) | 0.522828 | — |
| odd-balance | 0.210928 | 0.334846 |
| no-consecutive-pair | 0.261534 | 0.471253 |
| stable-sum | 0.414568 | 0.540736 |
| zone-distribution | 0.380643 | 0.639652 |
| tail-balance | 0.122234 | 0.209710 |

---

### Task 1: 공용 통계 모듈 추출 + 연금 리팩토링 (동작 불변)

**Files:**
- Create: `backend/src/algorithms/statistics.ts`
- Modify: `backend/src/algorithms/pension.ts` (자체 구현 제거, import 전환)
- Modify: `backend/src/services/pension-backtest.ts:1-6` (import 경로 변경)

**Interfaces:**
- Produces: `createSeededRng(seed: number): () => number`, `shrinkRate(observed: number, totalWeight: number, prior: number, priorStrength: number): number`, `clamp(value: number, min: number, max: number): number` — 이후 모든 태스크가 `./statistics`(알고리즘 파일 기준) 또는 `../algorithms/statistics`(서비스 기준)에서 import

- [ ] **Step 1: 리팩토링 전 연금 백테스트 응답 캡처 (동작 불변 검증 기준선)**

```bash
curl -s "http://localhost:8787/api/pension/generate/backtest?draws=120" -o /c/Users/kbays/AppData/Local/Temp/claude/c--Project-lotto/68dacd75-4c81-4815-a758-d41377ae8f7b/scratchpad/pension-before-refactor.json
```

Expected: 파일 생성됨 (`algorithm: "pension-multi-set-v3.0"` 포함)

- [ ] **Step 2: statistics.ts 작성**

```ts
// 공용 통계 유틸 — 연금·로또 알고리즘이 공유한다

// mulberry32 — 백테스트 재현성을 위한 시드 기반 RNG
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 베이지안 수축: 이론 확률(prior)을 priorStrength만큼의 가상 관측으로 간주해 소표본 노이즈를 억제
export function shrinkRate(observed: number, totalWeight: number, prior: number, priorStrength: number) {
  return (observed + priorStrength * prior) / (totalWeight + priorStrength)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
```

- [ ] **Step 3: pension.ts에서 자체 구현 제거·전환**

파일 상단에 import 추가:

```ts
import { clamp, createSeededRng, shrinkRate } from './statistics'
```

다음 세 가지를 수정:
1. 로컬 `createSeededRng` 함수 정의(mulberry32 블록)를 삭제하고, 기존 시그니처 호환을 위해 재export 추가: `export { createSeededRng } from './statistics'` — 단, import와 재export가 겹치지 않게 **로컬 정의 삭제 + `export { createSeededRng }`를 import 문 바로 아래에 배치**
2. 로컬 `clamp` 함수 정의 삭제
3. `buildPensionRuleWeights` 내부의 수축 계산 두 줄을 교체:

```ts
    const passRate = shrinkRate(decayedPass, decayedTotal, prior.passRate, PENSION_PRIOR_STRENGTH)
    const matchRate = shrinkRate(decayedMatch, decayedTotal, prior.matchRate, PENSION_PRIOR_STRENGTH)
```

- [ ] **Step 4: pension-backtest.ts import 경로 변경**

`import { ..., createSeededRng, ... } from '../algorithms/pension'`에서 `createSeededRng`를 제거하고 별도 줄 추가:

```ts
import { createSeededRng } from '../algorithms/statistics'
```

(pension.ts의 재export 덕에 기존 경로도 동작하지만, 신규 코드는 원 출처를 직접 참조한다)

- [ ] **Step 5: typecheck + 동작 불변 검증**

```bash
npm run typecheck
sleep 3
curl -s "http://localhost:8787/api/pension/generate/backtest?draws=120" -o /c/Users/kbays/AppData/Local/Temp/claude/c--Project-lotto/68dacd75-4c81-4815-a758-d41377ae8f7b/scratchpad/pension-after-refactor.json
node -e "const a=require(process.env.SS+'/pension-before-refactor.json'),b=require(process.env.SS+'/pension-after-refactor.json');console.log('IDENTICAL:',JSON.stringify(a)===JSON.stringify(b))"
```

(SS 환경변수 대신 절대경로 사용 가능) Expected: `IDENTICAL: true` — false면 리팩토링이 동작을 바꾼 것이므로 중단하고 원인 규명

- [ ] **Step 6: Commit**

```bash
git add backend/src/algorithms/statistics.ts backend/src/algorithms/pension.ts backend/src/services/pension-backtest.ts
git commit -m "refactor: 공용 통계 모듈(statistics.ts) 추출 — 시드 RNG·수축 공식 공유

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: lotto.ts 가중치 학습 v4 (감쇠 + 수축 + lift)

**Files:**
- Modify: `backend/src/algorithms/lotto.ts` (버전 상수, `RULE_WEIGHT_LOOKBACK` 제거, `buildRuleWeights` 재작성)

**Interfaces:**
- Consumes: Task 1의 `clamp`, `shrinkRate`
- Produces: `buildRuleWeights(draws: DrawNumbersRow[]): RuleWeightDiagnostic[]` — 시그니처 불변(과거순 ASC 입력), 반환 정렬: weight 내림차순, 동점 시 한글 라벨 순

- [ ] **Step 1: import·상수 교체**

파일 상단에 추가:

```ts
import { clamp, shrinkRate } from './statistics'
```

기존 로컬 `clamp` 함수 정의 삭제. `LOTTO_ALGORITHM_VERSION`을 `'v4.0'`으로 변경. `const RULE_WEIGHT_LOOKBACK = 24` 삭제 후 다음 상수 추가:

```ts
// 가중치 학습: 최근 회차일수록 크게 반영하는 지수 감쇠 반감기 (주 1회 추첨, 약 1년치)
const LOTTO_DECAY_HALF_LIFE = 52
// 베이지안 수축 강도: 이론 확률을 이만큼의 가상 관측으로 간주해 소표본 노이즈를 억제
const LOTTO_PRIOR_STRENGTH = 24

// 1~45 중 6개 조합(45C6 = 8,145,060) 전수 열거로 구한 이론 확률
// passRate: 공통 규칙 ∧ 성향 규칙 동시 통과 확률, matchRate: 성향 규칙 단독 통과 확률
// (공통 규칙 단독 통과율: 0.522828)
const LOTTO_THEORETICAL_RATES: Record<string, { passRate: number; matchRate: number }> = {
  'odd-balance': { passRate: 0.210928, matchRate: 0.334846 },
  'no-consecutive-pair': { passRate: 0.261534, matchRate: 0.471253 },
  'stable-sum': { passRate: 0.414568, matchRate: 0.540736 },
  'zone-distribution': { passRate: 0.380643, matchRate: 0.639652 },
  'tail-balance': { passRate: 0.122234, matchRate: 0.209710 },
}
```

- [ ] **Step 2: buildRuleWeights 전체 교체**

기존 `buildRuleWeights` 함수(빈 이력 early-return 포함)를 다음으로 교체:

```ts
export function buildRuleWeights(draws: DrawNumbersRow[]): RuleWeightDiagnostic[] {
  const parsed = draws.map((draw) => COLS.map((col) => draw[col]).sort((a, b) => a - b))

  return SET_CONFIGS.map((config) => {
    const prior = LOTTO_THEORETICAL_RATES[config.id] ?? { passRate: 0.25, matchRate: 0.4 }

    // 지수 감쇠 가중 관측 — 입력은 과거순(ASC)이므로 최신 회차의 나이가 0
    let decayedTotal = 0
    let decayedPass = 0
    let decayedMatch = 0
    parsed.forEach((numbers, index) => {
      const ageFromNewest = parsed.length - 1 - index
      const decay = Math.pow(0.5, ageFromNewest / LOTTO_DECAY_HALF_LIFE)
      decayedTotal += decay
      if (config.check(numbers)) {
        decayedMatch += decay
        if (passesCommonRules(numbers)) decayedPass += decay
      }
    })

    // 이론 확률을 prior로 두는 베이지안 수축 — 표본이 적을수록 이론값에 가깝게
    const passRate = shrinkRate(decayedPass, decayedTotal, prior.passRate, LOTTO_PRIOR_STRENGTH)
    const matchRate = shrinkRate(decayedMatch, decayedTotal, prior.matchRate, LOTTO_PRIOR_STRENGTH)

    // 이론 대비 상대 강도(lift): 이력이 이론과 같으면 1 → score 0.5 → 전 성향 동일 가중치
    const liftPass = passRate / prior.passRate
    const liftMatch = matchRate / prior.matchRate
    const score = clamp(0.5 * (liftPass * 0.65 + liftMatch * 0.35), 0.05, 1)
    const weight = Number((config.baseWeight * (0.75 + score)).toFixed(3))

    return {
      ruleId: config.id,
      label: config.label,
      weight,
      score: Number(score.toFixed(3)),
      passRate: Number(passRate.toFixed(3)),
      recentMatchRate: Number(matchRate.toFixed(3)),
    }
  }).sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label, 'ko'))
}
```

주의: `passesCommonRules`·`COLS`는 파일 내 기존 정의를 그대로 사용. 빈 배열 입력 시 `decayedTotal = 0`이지만 `shrinkRate` 분모에 `PRIOR_STRENGTH(24)`가 있어 안전 — 전 성향 score 0.5, weight 1.25가 된다.

- [ ] **Step 3: typecheck + 가중치 스모크 검증**

```bash
npm run typecheck
sleep 3
curl -s -X POST "http://localhost:8787/api/generate" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('algorithm:',j.algorithm);j.ruleWeights.forEach(w=>console.log(w.ruleId,w.weight,w.score))})"
```

Expected: `algorithm: v4.0`, 각 weight가 대략 1.15~1.35 범위(수축으로 좁아진 범위), score 0.4~0.6 부근. 1.75 같은 극단값이 나오면 lift 공식 오류

- [ ] **Step 4: Commit**

```bash
git add backend/src/algorithms/lotto.ts
git commit -m "feat: 로또 가중치 학습 v4 — 전체 이력 감쇠 + 이론 prior 베이지안 수축

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: lotto.ts 생성 파이프라인 — rng 스레딩 + 완전 비중첩 사다리

**Files:**
- Modify: `backend/src/algorithms/lotto.ts` (`buildFallbackSet`, `weightedPick`, `pickWeightedNumbers`, `pickSet`, `buildGeneratedSets`)

**Interfaces:**
- Produces: `buildGeneratedSets(draws: DrawNumbersRow[], rng?: () => number): GeneratedSet[]` — rng 기본값 `Math.random`. Task 4의 백테스트가 시드 rng를 주입한다. 세트 생성 순서는 `buildRuleWeights` 정렬 순서와 동일

- [ ] **Step 1: Rng 타입과 헬퍼 추가, 기존 함수들에 rng 스레딩**

파일 상단(타입 선언부)에 추가:

```ts
type Rng = () => number
```

`weightedPick`·`pickWeightedNumbers` 교체:

```ts
function weightedPick(pool: { num: number; weight: number }[], rng: Rng) {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)
  let random = rng() * total
  for (const entry of pool) {
    random -= entry.weight
    if (random <= 0) return entry.num
  }
  return pool[pool.length - 1].num
}

function pickWeightedNumbers(weights: { num: number; weight: number }[], rng: Rng) {
  const picked = new Set<number>()
  while (picked.size < 6) picked.add(weightedPick(weights.filter(entry => !picked.has(entry.num)), rng))
  return Array.from(picked).sort((a, b) => a - b)
}
```

- [ ] **Step 2: buildFallbackSet 교체 (미사용 번호 우선)**

```ts
function buildFallbackSet(label: string, rng: Rng, usedNumbers: Set<number>, ruleId?: string, ruleWeight?: number): GeneratedSet {
  // 최종 폴백에서도 미사용 번호를 우선 사용해 세트 간 비중첩을 유지
  const unused: number[] = []
  for (let num = 1; num <= 45; num++) {
    if (!usedNumbers.has(num)) unused.push(num)
  }

  const picked = new Set<number>()
  while (picked.size < 6 && unused.length > 0) {
    const index = Math.floor(rng() * unused.length)
    picked.add(unused[index])
    unused.splice(index, 1)
  }
  while (picked.size < 6) picked.add(Math.floor(rng() * 45) + 1)

  const numbers = Array.from(picked).sort((a, b) => a - b)
  return {
    label,
    numbers,
    meta: buildSetMeta(numbers, ['fallback-random'], ruleId, ruleWeight),
  }
}
```

- [ ] **Step 3: pickSet을 완화 사다리로 교체**

`pickSet` 앞에 헬퍼 추가:

```ts
function countOverlap(numbers: number[], usedNumbers: Set<number>) {
  let overlap = 0
  for (const num of numbers) {
    if (usedNumbers.has(num)) overlap += 1
  }
  return overlap
}
```

`pickSet` 교체:

```ts
function pickSet(
  config: SetConfig,
  weights: { num: number; weight: number }[],
  ruleWeight: number,
  rng: Rng,
  usedNumbers: Set<number>,
): GeneratedSet {
  // 완화 사다리: 기존 세트와의 중복 허용치를 0 → 1 → 2로 단계적 완화
  for (const maxOverlap of [0, 1, 2]) {
    for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
      const numbers = pickWeightedNumbers(weights, rng)
      if (countOverlap(numbers, usedNumbers) > maxOverlap) continue
      if (passesCommonRules(numbers) && config.check(numbers)) {
        return {
          label: config.label,
          numbers,
          meta: buildSetMeta(numbers, ['common-rules', config.label], config.id, ruleWeight),
        }
      }
    }
  }

  // 성향 완화 단계: 공통 규칙 + 중복 ≤2만 유지
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights, rng)
    if (countOverlap(numbers, usedNumbers) > 2) continue
    if (passesCommonRules(numbers)) {
      return {
        label: config.label,
        numbers,
        meta: buildSetMeta(numbers, ['common-rules', 'fallback-set-rule-relaxed'], config.id, ruleWeight),
      }
    }
  }

  return buildFallbackSet(config.label, rng, usedNumbers, config.id, ruleWeight)
}
```

- [ ] **Step 4: buildGeneratedSets 교체 (진단 순서 생성 + usedNumbers 누적)**

```ts
export function buildGeneratedSets(draws: DrawNumbersRow[], rng: Rng = Math.random): GeneratedSet[] {
  const ruleWeights = buildRuleWeights(draws)
  const configById = new Map(SET_CONFIGS.map((config) => [config.id, config]))
  const usedNumbers = new Set<number>()

  // 진단에 표시되는 우선순위(동점 시 한글 라벨 순 포함)와 동일한 순서로 생성 → 첫 세트가 대표 추천
  return ruleWeights
    .map((entry) => {
      const config = configById.get(entry.ruleId)
      if (!config) return null
      const set = draws.length === 0
        ? buildFallbackSet(config.label, rng, usedNumbers, config.id, entry.weight)
        : pickSet(config, buildWeightsCached(draws), entry.weight, rng, usedNumbers)
      set.numbers.forEach((num) => usedNumbers.add(num))
      return set
    })
    .filter((set): set is GeneratedSet => set !== null)
}
```

주의: `buildWeights(draws)`는 세트마다 재계산하면 낭비이므로 함수 상단에서 1회만 계산한다. 위 코드의 `buildWeightsCached(draws)`는 실제로는 다음처럼 지역 변수로 처리:

```ts
export function buildGeneratedSets(draws: DrawNumbersRow[], rng: Rng = Math.random): GeneratedSet[] {
  const ruleWeights = buildRuleWeights(draws)
  const configById = new Map(SET_CONFIGS.map((config) => [config.id, config]))
  const usedNumbers = new Set<number>()
  const numberWeights = draws.length > 0 ? buildWeights(draws) : null

  return ruleWeights
    .map((entry) => {
      const config = configById.get(entry.ruleId)
      if (!config) return null
      const set = numberWeights
        ? pickSet(config, numberWeights, entry.weight, rng, usedNumbers)
        : buildFallbackSet(config.label, rng, usedNumbers, config.id, entry.weight)
      set.numbers.forEach((num) => usedNumbers.add(num))
      return set
    })
    .filter((set): set is GeneratedSet => set !== null)
}
```

(두 번째 형태가 최종 코드다 — `buildWeightsCached`라는 함수는 만들지 않는다)

- [ ] **Step 5: typecheck + 비중첩 검증 (20회 반복)**

```bash
npm run typecheck
sleep 3
node -e "
(async () => {
  let allOk = true;
  for (let i = 0; i < 20; i++) {
    const res = await fetch('http://localhost:8787/api/generate', { method: 'POST' });
    const data = await res.json();
    const all = data.sets.flatMap(s => s.numbers);
    const distinct = new Set(all).size;
    const fallbacks = data.sets.filter(s => !s.meta.passedRules.includes('common-rules')).length;
    if (distinct !== 30) allOk = false;
    console.log('회', i+1, '고유번호:', distinct + '/30', '세트순서:', data.sets.map(s=>s.meta.ruleId).join('>'), '폴백:', fallbacks);
  }
  console.log(allOk ? '=> 20회 모두 30개 비중첩' : '=> 비중첩 실패 발생 (완화 발동)');
})();"
```

Expected: 대부분 `30/30`. 간헐적으로 29 이하(완화 발동)가 나올 수 있으나 20회 중 2회 이하 수준이어야 한다. 매회 30 미만이면 사다리 로직 오류. 세트 순서가 `/api/generate` 응답의 `ruleWeights` 순서와 같은지도 확인

- [ ] **Step 6: Commit**

```bash
git add backend/src/algorithms/lotto.ts
git commit -m "feat: 로또 세트 생성 v4 — 완전 비중첩 완화 사다리 및 시드 RNG 스레딩

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: lotto-backtest.ts — 시드 + 등수 시뮬레이션 + 랜덤 대조군

**Files:**
- Modify: `backend/src/services/lotto-backtest.ts`
- Modify: `backend/src/types/lotto/summaries.ts:10-50` (`LottoBacktestSummary`)

**Interfaces:**
- Consumes: Task 1 `createSeededRng`, Task 3 `buildGeneratedSets(draws, rng)`
- Produces: `LottoBacktestSummary`에 추가되는 필드 — `atLeastOnePrizeRate: number`(%), `prizeCounts: Record<number, number>`(키 1~5 = 등수), `baseline: { totalSets: number; averageMatchPerSet: number; atLeastOnePrizeRate: number; prizeCounts: Record<number, number> }`. Task 5의 프론트 타입이 이 형태를 미러링

- [ ] **Step 1: summaries.ts 타입 확장**

`LottoBacktestSummary`의 `averageBestMatchPerDraw` 필드 아래에 추가:

```ts
  // 회차당 최소 1개 당첨률(%) — 3개 이상 일치 세트가 하나라도 있는 회차 비율
  atLeastOnePrizeRate: number
  // 등수(1~5) → 시뮬레이션 당첨 세트 수 (6개=1등, 5개+보너스=2등, 5개=3등, 4개=4등, 3개=5등)
  prizeCounts: Record<number, number>
  // 같은 조건에서 순수 랜덤 세트가 낸 성적 (알고리즘 대비 기준선)
  baseline: {
    totalSets: number
    averageMatchPerSet: number
    atLeastOnePrizeRate: number
    prizeCounts: Record<number, number>
  }
```

- [ ] **Step 2: lotto-backtest.ts 수정**

import에 추가:

```ts
import { createSeededRng } from '../algorithms/statistics'
```

파일 상단(상수 아래)에 헬퍼 추가:

```ts
// 일치 수 + 보너스 → 등수 (해당 없으면 null)
function getPrizeTier(matches: number, hasBonus: boolean): number | null {
  if (matches === 6) return 1
  if (matches === 5 && hasBonus) return 2
  if (matches === 5) return 3
  if (matches === 4) return 4
  if (matches === 3) return 5
  return null
}

function emptyPrizeCounts(): Record<number, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

function randomLottoNumbers(rng: () => number) {
  const picked = new Set<number>()
  while (picked.size < 6) picked.add(Math.floor(rng() * 45) + 1)
  return Array.from(picked)
}
```

`runLottoBacktest` 본문 수정 — 누적 변수 선언부(`let threePlusCount = 0` 근처)에 추가:

```ts
  let drawsWithPrize = 0
  const prizeCounts = emptyPrizeCounts()
  let baselineSets = 0
  let baselineMatches = 0
  let baselineDrawsWithPrize = 0
  const baselinePrizeCounts = emptyPrizeCounts()
```

타겟 루프의 시작을 다음으로 교체 (기존 `const sets = buildGeneratedSets(...)` 한 줄):

```ts
  for (const target of targetDraws) {
    // 회차 번호 시드 → 진단 결과가 호출 시마다 흔들리지 않고 재현 가능
    const rng = createSeededRng(0x9e3779b9 ^ (target.drwNo ?? 0))
    const sets = buildGeneratedSets(results.filter(row => (row.drwNo ?? 0) < (target.drwNo ?? 0)), rng)
```

세트별 루프 내부, 기존 `if (matches === 5 && ...) bonusHitCount += 1` 아래에 추가:

```ts
      const tier = getPrizeTier(matches, sets[i].numbers.includes(target.bnusNo ?? -1))
      if (tier !== null) prizeCounts[tier] += 1
```

타겟 루프 끝(기존 `bestHitDistribution[bestMatch] += 1` 아래)에 추가:

```ts
    if (bestMatch >= 3) drawsWithPrize += 1

    // 랜덤 대조군: 같은 회차에 같은 개수의 순수 랜덤 세트를 같은 RNG 흐름으로 생성
    let baselineBest = 0
    for (let i = 0; i < sets.length; i++) {
      const randomNumbers = randomLottoNumbers(rng)
      const matches = countMatches(randomNumbers, target)
      baselineSets += 1
      baselineMatches += matches
      if (matches > baselineBest) baselineBest = matches
      const tier = getPrizeTier(matches, randomNumbers.includes(target.bnusNo ?? -1))
      if (tier !== null) baselinePrizeCounts[tier] += 1
    }
    if (baselineBest >= 3) baselineDrawsWithPrize += 1
```

반환 객체의 `averageBestMatchPerDraw` 아래에 추가:

```ts
    atLeastOnePrizeRate: Number((drawsWithPrize / targetDraws.length * 100).toFixed(2)),
    prizeCounts,
    baseline: {
      totalSets: baselineSets,
      averageMatchPerSet: Number((baselineMatches / Math.max(baselineSets, 1)).toFixed(3)),
      atLeastOnePrizeRate: Number((baselineDrawsWithPrize / targetDraws.length * 100).toFixed(2)),
      prizeCounts: baselinePrizeCounts,
    },
```

- [ ] **Step 3: typecheck + 재현성·지표 검증**

```bash
npm run typecheck
sleep 3
SS="/c/Users/kbays/AppData/Local/Temp/claude/c--Project-lotto/68dacd75-4c81-4815-a758-d41377ae8f7b/scratchpad"
curl -s "http://localhost:8787/api/generate/backtest?draws=120" -o "$SS/lt1.json"
curl -s "http://localhost:8787/api/generate/backtest?draws=120" -o "$SS/lt2.json"
node -e "
const a=require('$SS/lt1.json'), b=require('$SS/lt2.json');
console.log('재현성:', JSON.stringify(a)===JSON.stringify(b));
console.log('algorithm:', a.algorithm);
console.log('회차당 최소 1개 당첨률 — 추천:', a.atLeastOnePrizeRate+'%', '/ 랜덤:', a.baseline.atLeastOnePrizeRate+'%');
console.log('추천 당첨:', JSON.stringify(a.prizeCounts), '랜덤:', JSON.stringify(a.baseline.prizeCounts));
console.log('평균 일치:', a.averageMatchPerSet, '/ 랜덤:', a.baseline.averageMatchPerSet);"
```

Expected: `재현성: true`, `algorithm: v4.0`. 이론 참고치: 세트당 평균 일치 ≈ 0.8 (6×6/45), 세트당 5등(3개 일치) 확률 ≈ 2.18% → 120회×5세트 = 600세트에서 5등 ≈ 13회 안팎. 회차당 최소 1개 당첨률: 랜덤(중복 허용) ≈ 1-(1-0.0218)^5 ≈ 10.4%, 추천(비중첩)은 그보다 높아야 함(이론상 약 11~13% 구간). 소요 시간도 기록 (`time curl ...`) — 5초 이상이면 스펙 6절의 이력 파싱 선계산 최적화를 적용

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/lotto-backtest.ts backend/src/types/lotto/summaries.ts
git commit -m "feat: 로또 백테스트 v4 — 시드 재현성·등수 시뮬레이션·랜덤 대조군

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 프론트엔드 — 타입 동기화 + 진단 UI + 문구 수정

**Files:**
- Modify: `frontend/src/types/index.ts:109-123` (`LottoBacktestDiagnostics`)
- Modify: `frontend/src/components/lotto/LottoPage.tsx` (진단 섹션, 문구)

**Interfaces:**
- Consumes: Task 4의 API 응답 필드 (`atLeastOnePrizeRate`, `prizeCounts`, `baseline`)

- [ ] **Step 1: 프론트 타입 확장**

`LottoBacktestDiagnostics`의 `averageBestMatchPerDraw` 아래에 추가:

```ts
    atLeastOnePrizeRate: number;
    prizeCounts: Record<number, number>;
    baseline: {
        totalSets: number;
        averageMatchPerSet: number;
        atLeastOnePrizeRate: number;
        prizeCounts: Record<number, number>;
    };
```

- [ ] **Step 2: LottoPage에 등수 포맷 헬퍼 추가**

`LottoPage.tsx`의 import 아래(컴포넌트 밖)에 추가:

```tsx
// 등수(1~5) → 시뮬레이션 당첨 표기. 높은 등수부터 표시
function formatLottoPrizeCounts(counts: Record<number, number>) {
    const parts = [1, 2, 3, 4, 5]
        .filter(tier => (counts[tier] ?? 0) > 0)
        .map(tier => `${tier}등 ${counts[tier]}회`);
    return parts.length > 0 ? parts.join(' · ') : '당첨 없음';
}
```

- [ ] **Step 3: 진단 지표 그리드 아래 시뮬레이션 박스 추가**

`LottoPage.tsx`의 지표 그리드(`공통 규칙 통과율` 타일이 있는 `<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">` 블록) 닫는 `</div>` 바로 뒤에 추가:

```tsx
                            {/* 상금 구조 기준 시뮬레이션 당첨 집계 (연금 페이지와 동일 형식) */}
                            <div className="mt-4 border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[3px_3px_0px_0px_#000000]">
                                <div className="text-xs font-bold text-slate-700">시뮬레이션 당첨 (평가 구간 누적)</div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-black text-black">
                                    <span className="text-xs font-bold text-slate-500">추천 세트</span>
                                    <span>{formatLottoPrizeCounts(backtestDiagnostics.prizeCounts)}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-600">
                                    <span className="text-xs font-bold text-slate-500">랜덤 대조군</span>
                                    <span>{formatLottoPrizeCounts(backtestDiagnostics.baseline.prizeCounts)}</span>
                                </div>
                                {/* 비중첩 다양화 효과가 드러나는 회차 단위 지표 */}
                                <div className="mt-2 border-t border-slate-200 pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-slate-700">
                                    <span className="text-xs font-bold text-slate-500">회차당 최소 1개 당첨률 (3개 이상 일치)</span>
                                    <span className="font-black text-black">추천 {backtestDiagnostics.atLeastOnePrizeRate.toFixed(1)}%</span>
                                    <span>· 랜덤 {backtestDiagnostics.baseline.atLeastOnePrizeRate.toFixed(1)}%</span>
                                </div>
                            </div>
```

- [ ] **Step 4: "최근 24회 기준" 문구 수정**

`LottoPage.tsx:140`:

```tsx
                                    <h3 className="mt-1 text-lg font-black text-black">전체 이력 감쇠 가중 기준 추천 규칙 우선순위</h3>
```

- [ ] **Step 5: typecheck + UI 스크린샷 검증**

```bash
npm run typecheck
```

이후 playwright-core 스크립트(스크래치패드 `shot.js` 재사용)로 `http://localhost:5173/lotto`를 1280px에서 캡처해 진단 섹션 스크롤 후 확인:

```bash
cd /c/Users/kbays/AppData/Local/Temp/claude/c--Project-lotto/68dacd75-4c81-4815-a758-d41377ae8f7b/scratchpad
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  await page.goto('http://localhost:5173/lotto');
  await page.waitForTimeout(5000);
  await page.locator('text=백테스트 규칙 진단').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'lotto-diag-v4.png' });
  await browser.close();
  console.log('done');
})();"
```

스크린샷을 Read로 열어 확인: 시뮬레이션 박스 3줄(추천/랜덤/회차당 당첨률), "전체 이력 감쇠 가중 기준" 문구, 기존 타일 4개 정상 표시

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/lotto/LottoPage.tsx
git commit -m "feat: 로또 진단 UI v4 — 등수 시뮬레이션·랜덤 대비·회차당 당첨률 표시

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 통합 검증 + 코드 리뷰 + 푸시

**Files:**
- 없음 (검증·리뷰·배포만)

- [ ] **Step 1: 검증 스위트 일괄 실행**

스펙 7절의 7개 항목을 순서대로:

1. 이론 상수 대조: `enumerate-lotto.js`를 다시 실행해 lotto.ts의 상수와 6자리 전부 일치 확인
2. `npm run typecheck` 통과
3. 백테스트 2회 호출 바이트 동일 (Task 4 Step 3 스크립트 재실행)
4. 추천 생성 20회 → 30개 비중첩 (Task 3 Step 5 스크립트 재실행)
5. `atLeastOnePrizeRate` 추천 > 랜덤 확인
6. 백테스트 wall time: `time curl -s "http://localhost:8787/api/generate/backtest?draws=300" -o /dev/null` — 3초 이내 목표
7. 로또 페이지 UI 스크린샷 확인 (Task 5 Step 5)

- [ ] **Step 2: 코드 리뷰 요청**

superpowers:requesting-code-review 절차로 general-purpose 서브에이전트에 리뷰 의뢰 (BASE: Task 1 이전 커밋, HEAD: 현재). Critical/Important는 즉시 수정 후 재검증

- [ ] **Step 3: 푸시 (자동 배포 트리거) 및 프로덕션 확인**

```bash
git push origin main
```

GitHub Actions 완료 감시(스크래치패드 `watch-run.js <sha>`), 성공 후:

```bash
curl -s "https://lotto-analysis-backend.kbaysin.workers.dev/api/generate/backtest?draws=120" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log(j.algorithm, j.atLeastOnePrizeRate, j.baseline.atLeastOnePrizeRate)})"
```

Expected: `v4.0` + 로컬과 동일한 수치 (시드 RNG 덕분에 일치해야 함)
