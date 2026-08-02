import type { DrawNumbersRow, GeneratedSet } from '../types/lotto'
import { clamp, shrinkRate } from './statistics'

type SetConfig = {
  id: string
  label: string
  baseWeight: number
  check: (numbers: number[]) => boolean
}

type Rng = () => number

export type RuleWeightDiagnostic = {
  ruleId: string
  label: string
  weight: number
  score: number
  passRate: number
  recentMatchRate: number
}

const COLS = ['drwtNo1', 'drwtNo2', 'drwtNo3', 'drwtNo4', 'drwtNo5', 'drwtNo6'] as const

export const LOTTO_ALGORITHM_VERSION = 'v5.0'

export const SET_CONFIGS: SetConfig[] = [
  {
    id: 'odd-balance',
    label: '홀짝 균형형',
    baseWeight: 1,
    check: (numbers) => numbers.filter(n => n % 2 === 1).length === 3,
  },
  {
    id: 'no-consecutive-pair',
    label: '연속 독립형',
    baseWeight: 1,
    check: (numbers) => {
      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] === numbers[i - 1] + 1) return false
      }
      return true
    },
  },
  {
    id: 'stable-sum',
    label: '합계 안정형',
    baseWeight: 1,
    check: (numbers) => {
      const sum = numbers.reduce((a, b) => a + b, 0)
      return sum >= 110 && sum <= 155
    },
  },
  {
    id: 'zone-distribution',
    label: '구간 분포형',
    baseWeight: 1,
    check: (numbers) => getProfileZoneCount(numbers) >= 4,
  },
  {
    id: 'tail-balance',
    label: '끝수 균형형',
    baseWeight: 1,
    check: (numbers) => new Set(numbers.map(n => n % 10)).size === numbers.length,
  },
]

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

const RECENT_DRAW_COUNT = 50
const COLD_DRAW_COUNT = 15
const AGE_BONUS_WINDOW = 10
const MAX_PICK_ATTEMPTS = 300

// ---------------------------------------------------------------------------
// v5 패턴 모델: 완성 조합 점수 매기기에 사용하는 이력 기반 특성
// ---------------------------------------------------------------------------

// 고정 쌍 포함 확률: P(두 수 모두 6-of-45에 포함) = C(43,4)/C(45,6) = (6×5)/(45×44) = 1/66
const PAIR_PRIOR = 1 / 66
// 쌍 빈도 수축 강도
const PAIR_PRIOR_STRENGTH = 12
// 개별 번호 포함 확률: 6/45 = 2/15
const NUMBER_INCLUSION_PRIOR = 6 / 45
// 번호 빈도 수축 강도
const NUMBER_PRIOR_STRENGTH = 16
// 조합 점수 매기기 시 최대 후보 수 (러그 당)
const CANDIDATES_PER_RUNG = 8
// 형상 중위수 계산에 사용할 최근 회차 수
const SHAPE_WINDOW = 100

// 조합 점수 구성 요소 가중치 (합계 = 1.0)
const W_FREQUENCY = 0.25
const W_OVERDUE = 0.15
const W_PAIR_LIFT = 0.20
const W_SUM_FIT = 0.15
const W_ODD_FIT = 0.10
const W_ZONE_SPREAD = 0.05
const W_CONSEC_PENALTY = 0.05
const W_TAIL_UNIQUE = 0.05
// 합 적합도 가우시안 커널 σ
const SUM_FIT_SIGMA = 15
// 과숙 시그모이드 척도
const OVERDUE_SCALE = 10

export type PatternModel = {
  decayedFreq: Float64Array
  lastSeenGap: Uint16Array
  medianGap: number
  pairFreq: Map<number, number>
  pairPrior: number
  shapeMed: { sum: number; oddCount: number; zoneSpread: number; maxRun: number; tailUnique: number }
}

// 공통 규칙 구간: ceil(n/9) — 5개 구간 (1-9, 10-18, 19-27, 28-36, 37-45)
export function getCommonZoneCount(numbers: number[]) {
  return new Set(numbers.map(n => Math.ceil(n / 9))).size
}

// 성향 규칙 구간: ceil(n/10) — 5개 구간 (1-10, 11-20, 21-30, 31-40, 41-45), SET_CONFIGS['zone-distribution']과 동일
export function getProfileZoneCount(numbers: number[]) {
  return new Set(numbers.map(n => Math.ceil(n / 10))).size
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// 입력: ASC 정렬된 회차 배열 (oldest first). 1회 호출로 재사용 가능한 모델을 구축한다.
export function buildPatternModel(draws: DrawNumbersRow[]): PatternModel | null {
  if (draws.length === 0) return null

  const rawFreq = new Float64Array(45)
  const lastSeenGap = new Uint16Array(45)
  lastSeenGap.fill(Math.min(draws.length, 200))
  const pairRaw = new Map<number, number>()
  let totalDecayedWeight = 0

  // 1. 지수 감쇠 빈도 + 쌍 동시출현 (단일 순회)
  for (let i = 0; i < draws.length; i++) {
    const age = draws.length - 1 - i
    const decay = Math.pow(0.5, age / LOTTO_DECAY_HALF_LIFE)
    totalDecayedWeight += decay

    const nums = COLS.map(col => draws[i][col])
    for (const n of nums) {
      rawFreq[n - 1] += decay
    }

    // 쌍 동시출현 — 15개 쌍
    for (let a = 0; a < nums.length; a++) {
      for (let b = a + 1; b < nums.length; b++) {
        const lo = Math.min(nums[a], nums[b])
        const hi = Math.max(nums[a], nums[b])
        const key = lo * 46 + hi
        pairRaw.set(key, (pairRaw.get(key) ?? 0) + decay)
      }
    }
  }

  // 2. 번호별 수축 빈도 — 이론 prior 6/45로 수축, 상대적 리프트로 정규화
  const decayedFreq = new Float64Array(45)
  for (let j = 0; j < 45; j++) {
    const shrunk = shrinkRate(rawFreq[j], totalDecayedWeight, NUMBER_INCLUSION_PRIOR, NUMBER_PRIOR_STRENGTH)
    // 이론 prior 대비 상대 리프트, [0, 1]로 클램프
    decayedFreq[j] = clamp(shrunk / NUMBER_INCLUSION_PRIOR - 0.5, 0, 1)
  }

  // 3. 마지막 출현 갭 (newest-first 순회)
  const seen = new Uint8Array(45)
  for (let i = draws.length - 1; i >= 0; i--) {
    const gap = draws.length - 1 - i
    const nums = COLS.map(col => draws[i][col])
    for (const n of nums) {
      if (!seen[n - 1]) {
        lastSeenGap[n - 1] = Math.min(gap, 200)
        seen[n - 1] = 1
      }
    }
  }
  const medianGap = median(Array.from(lastSeenGap))

  // 4. 쌍 빈도 수축 — 모든 990개 쌍을 사전 계산 (관측·미관측 모두 동일한 posterior)
  const pairFreq = new Map<number, number>()
  for (let lo = 1; lo <= 44; lo++) {
    for (let hi = lo + 1; hi <= 45; hi++) {
      const key = lo * 46 + hi
      const observed = pairRaw.get(key) ?? 0
      pairFreq.set(key, shrinkRate(observed, totalDecayedWeight, PAIR_PRIOR, PAIR_PRIOR_STRENGTH))
    }
  }

  // 5. 형상 중위수 (최근 SHAPE_WINDOW 회차)
  const windowDraws = draws.slice(-Math.min(SHAPE_WINDOW, draws.length))
  const sums: number[] = []
  const odds: number[] = []
  const zones: number[] = []
  const runs: number[] = []
  const tails: number[] = []
  for (const d of windowDraws) {
    const nums = COLS.map(col => d[col]).sort((a, b) => a - b)
    sums.push(getSum(nums))
    odds.push(getOddCount(nums))
    zones.push(getCommonZoneCount(nums))
    runs.push(getConsecutiveRun(nums))
    tails.push(new Set(nums.map(n => n % 10)).size)
  }

  return {
    decayedFreq,
    lastSeenGap,
    medianGap,
    pairFreq,
    pairPrior: PAIR_PRIOR,
    shapeMed: {
      sum: median(sums),
      oddCount: median(odds),
      zoneSpread: median(zones),
      maxRun: median(runs),
      tailUnique: median(tails),
    },
  }
}

// 완성 조합 점수: 이력 기반 특성 8개의 가중 합, [0, 1] 클램프.
// ruleWeight는 프로필 간 순서 결정에만 사용되며, 같은 프로필 내 후보는 동일 ruleWeight를 갖기 때문에
// 조합 내 점수에 곱하면 순위에 영향을 주지 않는다. 따라서 후보 수준 점수에 포함하지 않는다.
export function scoreCombination(numbers: number[], model: PatternModel): number {
  // 1. 수축 빈도 리프트 평균
  let freqSum = 0
  for (const n of numbers) freqSum += model.decayedFreq[n - 1]
  const freqScore = freqSum / numbers.length

  // 2. 과숙 시그모이드 평균
  let overdueSum = 0
  for (const n of numbers) {
    const x = (model.lastSeenGap[n - 1] - model.medianGap) / OVERDUE_SCALE
    overdueSum += 1 / (1 + Math.exp(-x))
  }
  const overdueScore = overdueSum / numbers.length

  // 3. 쌍 리프트 평균 (15쌍)
  let pairLiftSum = 0
  let pairCount = 0
  for (let a = 0; a < numbers.length; a++) {
    for (let b = a + 1; b < numbers.length; b++) {
      const lo = Math.min(numbers[a], numbers[b])
      const hi = Math.max(numbers[a], numbers[b])
      const key = lo * 46 + hi
      const freq = model.pairFreq.get(key) ?? model.pairPrior
      pairLiftSum += freq
      pairCount++
    }
  }
  const pairMean = pairLiftSum / pairCount
  const pairScore = clamp(pairMean / model.pairPrior, 0.3, 3.0) / 3.0

  // 4. 합 적합도 (가우시안 커널)
  const sumDiff = getSum(numbers) - model.shapeMed.sum
  const sumScore = Math.exp(-0.5 * (sumDiff / SUM_FIT_SIGMA) ** 2)

  // 5. 홀수 적합도
  const oddScore = clamp(1 - Math.abs(getOddCount(numbers) - model.shapeMed.oddCount) / 3, 0, 1)

  // 6. 공통 구간 분산 (ceil/9, 5개 구간)
  const zoneScore = getCommonZoneCount(numbers) / 5

  // 7. 연속 패널티
  const consecScore = clamp(1 - (getConsecutiveRun(numbers) - 1) / 4, 0, 1)

  // 8. 끝수 고유성
  const tailScore = new Set(numbers.map(n => n % 10)).size / 6

  return clamp(
    W_FREQUENCY * freqScore +
    W_OVERDUE * overdueScore +
    W_PAIR_LIFT * pairScore +
    W_SUM_FIT * sumScore +
    W_ODD_FIT * oddScore +
    W_ZONE_SPREAD * zoneScore +
    W_CONSEC_PENALTY * consecScore +
    W_TAIL_UNIQUE * tailScore,
    0,
    1,
  )
}

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

function getOddCount(numbers: number[]) {
  return numbers.filter(n => n % 2 === 1).length
}

function getConsecutiveRun(numbers: number[]) {
  let maxRun = 1
  let currentRun = 1

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1] + 1) {
      currentRun += 1
      maxRun = Math.max(maxRun, currentRun)
    } else {
      currentRun = 1
    }
  }

  return maxRun
}

function getSum(numbers: number[]) {
  return numbers.reduce((a, b) => a + b, 0)
}

function buildSetMeta(numbers: number[], passedRules: string[], ruleId?: string, ruleWeight?: number) {
  return {
    ruleId,
    ruleWeight,
    sum: getSum(numbers),
    oddCount: getOddCount(numbers),
    maxConsecutiveRun: getConsecutiveRun(numbers),
    passedRules,
  }
}

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

function passesCommonRules(numbers: number[]) {
  const sum = getSum(numbers)
  const oddCount = getOddCount(numbers)
  const maxConsecutiveRun = getConsecutiveRun(numbers)
  const zoneCount = getCommonZoneCount(numbers)

  return sum >= 110
    && sum <= 170
    && oddCount >= 2
    && oddCount <= 4
    && maxConsecutiveRun < 3
    && zoneCount >= 3
}

function buildWeights(draws: DrawNumbersRow[]) {
  const recentN = Math.min(RECENT_DRAW_COUNT, draws.length)
  const coldN = Math.min(COLD_DRAW_COUNT, draws.length)
  const ageN = Math.min(AGE_BONUS_WINDOW, draws.length)
  const recentDraws = draws.slice(-recentN)
  const coldDraws = recentDraws.slice(-coldN)
  const ageDraws = recentDraws.slice(-ageN)

  const freqMap = new Map<number, number>()
  for (const row of draws) {
    for (const col of COLS) freqMap.set(row[col], (freqMap.get(row[col]) ?? 0) + 1)
  }

  const recentMap = new Map<number, number>()
  for (const row of recentDraws) {
    for (const col of COLS) recentMap.set(row[col], (recentMap.get(row[col]) ?? 0) + 1)
  }

  const ageSet = new Set<number>()
  for (const row of ageDraws) {
    for (const col of COLS) ageSet.add(row[col])
  }

  const coldSet = new Set<number>()
  for (const row of coldDraws) {
    for (const col of COLS) coldSet.add(row[col])
  }

  const maxRecent = Math.max(...recentMap.values(), 1)

  const priorMap = new Map<number, number>()
  for (let i = 1; i <= 45; i++) priorMap.set(i, 1)

  for (const [num, count] of freqMap) {
    priorMap.set(num, priorMap.get(num)! + count)
  }

  const totalPrior = Array.from(priorMap.values()).reduce((a, b) => a + b, 0)
  const posteriorMap = new Map<number, number>()
  for (const [num, prior] of priorMap) {
    posteriorMap.set(num, prior / totalPrior)
  }

  return Array.from({ length: 45 }, (_, i) => {
    const num = i + 1
    const recentScore = (recentMap.get(num) ?? 0) / maxRecent
    const isCold = !coldSet.has(num)
    const isOverheat = ageSet.has(num) && (recentMap.get(num) ?? 0) >= 3
    let weight = posteriorMap.get(num)! * 0.5 + recentScore * 0.5
    if (isCold) weight *= 0.5
    if (isOverheat) weight *= 0.7
    return { num, weight: Math.max(weight, 0.02) }
  })
}

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

function countOverlap(numbers: number[], usedNumbers: Set<number>) {
  let overlap = 0
  for (const num of numbers) {
    if (usedNumbers.has(num)) overlap += 1
  }
  return overlap
}

// 후보 선택: 최고 점수 반환, 동점 시 먼저 수집된 후보 우선 (strict >로 삽입 순서 유지)
export function selectBestCandidate(
  candidates: { numbers: number[]; score: number }[],
): { numbers: number[]; score: number } {
  let best = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].score > best.score) best = candidates[i]
  }
  return best
}

function pickSet(
  config: SetConfig,
  weights: { num: number; weight: number }[],
  ruleWeight: number,
  rng: Rng,
  usedNumbers: Set<number>,
  model: PatternModel | null,
): GeneratedSet {
  // 완화 사다리: 기존 세트와의 중복 허용치를 0 → 1 → 2로 단계적 완화
  for (const maxOverlap of [0, 1, 2]) {
    // 0단계는 미사용 번호 풀에서 직접 샘플링해 비중첩 성공률을 높인다 (1~2단계는 전체 풀 유지)
    const rungWeights = maxOverlap === 0
      ? weights.filter((entry) => !usedNumbers.has(entry.num))
      : weights
    if (rungWeights.length < 6) continue

    const candidates: { numbers: number[]; score: number }[] = []
    for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
      const numbers = pickWeightedNumbers(rungWeights, rng)
      if (countOverlap(numbers, usedNumbers) > maxOverlap) continue
      if (passesCommonRules(numbers) && config.check(numbers)) {
        const score = model ? scoreCombination(numbers, model) : 0
        candidates.push({ numbers, score })
        if (candidates.length >= CANDIDATES_PER_RUNG) break
      }
    }

    if (candidates.length > 0) {
      const best = selectBestCandidate(candidates)
      return {
        label: config.label,
        numbers: best.numbers,
        meta: buildSetMeta(best.numbers, ['common-rules', config.label], config.id, ruleWeight),
      }
    }
  }

  // 성향 완화 단계: 공통 규칙 + 중복 ≤2만 유지
  const relaxedCandidates: { numbers: number[]; score: number }[] = []
  for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
    const numbers = pickWeightedNumbers(weights, rng)
    if (countOverlap(numbers, usedNumbers) > 2) continue
    if (passesCommonRules(numbers)) {
      const score = model ? scoreCombination(numbers, model) : 0
      relaxedCandidates.push({ numbers, score })
      if (relaxedCandidates.length >= CANDIDATES_PER_RUNG) break
    }
  }

  if (relaxedCandidates.length > 0) {
    const best = selectBestCandidate(relaxedCandidates)
    return {
      label: config.label,
      numbers: best.numbers,
      meta: buildSetMeta(best.numbers, ['common-rules', 'fallback-set-rule-relaxed'], config.id, ruleWeight),
    }
  }

  return buildFallbackSet(config.label, rng, usedNumbers, config.id, ruleWeight)
}

export function buildGeneratedSets(draws: DrawNumbersRow[], rng: Rng = Math.random): GeneratedSet[] {
  const ruleWeights = buildRuleWeights(draws)
  const configById = new Map(SET_CONFIGS.map((config) => [config.id, config]))
  const usedNumbers = new Set<number>()
  const numberWeights = draws.length > 0 ? buildWeights(draws) : null
  // v5: 패턴 모델은 1회만 구축하여 모든 프로필에서 재사용
  const model = draws.length > 0 ? buildPatternModel(draws) : null

  // 진단에 표시되는 우선순위(동점 시 한글 라벨 순 포함)와 동일한 순서로 생성 → 첫 세트가 대표 추천
  return ruleWeights
    .map((entry) => {
      const config = configById.get(entry.ruleId)
      if (!config) return null
      const set = numberWeights
        ? pickSet(config, numberWeights, entry.weight, rng, usedNumbers, model)
        : buildFallbackSet(config.label, rng, usedNumbers, config.id, entry.weight)
      set.numbers.forEach((num) => usedNumbers.add(num))
      return set
    })
    .filter((set): set is GeneratedSet => set !== null)
}

export function countMatches(picked: number[], draw: DrawNumbersRow) {
  const winning = new Set(COLS.map(col => draw[col]))
  let matches = 0
  for (const num of picked) {
    if (winning.has(num)) matches += 1
  }
  return matches
}

// 일치 수 + 보너스 → 등수 (해당 없으면 null). 백테스트와 구매 판정의 단일 소스.
export function getPrizeTier(matches: number, hasBonus: boolean): number | null {
  if (matches === 6) return 1
  if (matches === 5 && hasBonus) return 2
  if (matches === 5) return 3
  if (matches === 4) return 4
  if (matches === 3) return 5
  return null
}
