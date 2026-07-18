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

export const LOTTO_ALGORITHM_VERSION = 'v4.0'

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
    check: (numbers) => new Set(numbers.map(n => Math.ceil(n / 10))).size >= 4,
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

function getZoneCount(numbers: number[]) {
  return new Set(numbers.map(n => Math.ceil(n / 9))).size
}

function passesCommonRules(numbers: number[]) {
  const sum = getSum(numbers)
  const oddCount = getOddCount(numbers)
  const maxConsecutiveRun = getConsecutiveRun(numbers)
  const zoneCount = getZoneCount(numbers)

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

function pickSet(
  config: SetConfig,
  weights: { num: number; weight: number }[],
  ruleWeight: number,
  rng: Rng,
  usedNumbers: Set<number>,
): GeneratedSet {
  // 완화 사다리: 기존 세트와의 중복 허용치를 0 → 1 → 2로 단계적 완화
  for (const maxOverlap of [0, 1, 2]) {
    // 0단계는 미사용 번호 풀에서 직접 샘플링해 비중첩 성공률을 높인다 (1~2단계는 전체 풀 유지)
    const rungWeights = maxOverlap === 0
      ? weights.filter((entry) => !usedNumbers.has(entry.num))
      : weights
    if (rungWeights.length < 6) continue

    for (let attempt = 0; attempt < MAX_PICK_ATTEMPTS; attempt++) {
      const numbers = pickWeightedNumbers(rungWeights, rng)
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

export function buildGeneratedSets(draws: DrawNumbersRow[], rng: Rng = Math.random): GeneratedSet[] {
  const ruleWeights = buildRuleWeights(draws)
  const configById = new Map(SET_CONFIGS.map((config) => [config.id, config]))
  const usedNumbers = new Set<number>()
  const numberWeights = draws.length > 0 ? buildWeights(draws) : null

  // 진단에 표시되는 우선순위(동점 시 한글 라벨 순 포함)와 동일한 순서로 생성 → 첫 세트가 대표 추천
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

export function countMatches(picked: number[], draw: DrawNumbersRow) {
  const winning = new Set(COLS.map(col => draw[col]))
  let matches = 0
  for (const num of picked) {
    if (winning.has(num)) matches += 1
  }
  return matches
}
