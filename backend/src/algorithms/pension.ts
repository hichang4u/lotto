import type { PensionRecommendationSet } from '../types/pension'
import { clamp, shrinkRate } from './statistics'

type PensionSetConfig = {
  id: string
  label: string
  baseWeight: number
  check: (digits: number[]) => boolean
}

export type PensionRuleWeightDiagnostic = {
  ruleId: string
  label: string
  weight: number
  score: number
  passRate: number
  recentMatchRate: number
}

type Rng = () => number

export const PENSION_ALGORITHM_VERSION = 'pension-multi-set-v3.0'

export const PENSION_RULES = {
  sumRange: '22-34',
  oddCountRange: '2-4',
  minUniqueDigits: 4,
  noThreeConsecutive: true,
  maxDuplicateCount: 2,
  setProfiles: ['균형형', '홀수 집중형', '고유수 확장형', '저합계 안정형'],
  fallback: ['세트 규칙', '공통 규칙 완화 폴백', '통계 기반 폴백', '랜덤 폴백'],
  portfolio: '세트 간 끝자리(7등 라인) 중복 회피',
}

const MAX_PENSION_ATTEMPTS = 300
const PENSION_HISTORY_LOOKBACK = 60
// 가중치 학습: 최근 회차일수록 크게 반영하는 지수 감쇠 반감기 (약 1년치)
const PENSION_DECAY_HALF_LIFE = 52
// 베이지안 수축 강도: 이론 확률을 이만큼의 가상 관측으로 간주해 소표본 노이즈를 억제
const PENSION_PRIOR_STRENGTH = 24

// 000000~999999 전수 열거로 구한 이론 확률 (scratchpad enumerate 스크립트로 산출)
// passRate: 공통 규칙 ∧ 성향 규칙 동시 통과 확률, matchRate: 성향 규칙 단독 통과 확률
const PENSION_THEORETICAL_RATES: Record<string, { passRate: number; matchRate: number }> = {
  'balanced-core': { passRate: 0.167568, matchRate: 0.3125 },
  'odd-focus': { passRate: 0.134076, matchRate: 0.234375 },
  'unique-focus': { passRate: 0.343338, matchRate: 0.6048 },
  'low-sum-stable': { passRate: 0.251414, matchRate: 0.360514 },
}

const PENSION_SET_CONFIGS: PensionSetConfig[] = [
  {
    id: 'balanced-core',
    label: '균형형 추천',
    baseWeight: 1,
    check: (digits) => getOddDigitCount(digits) === 3,
  },
  {
    id: 'odd-focus',
    label: '홀수 집중형 추천',
    baseWeight: 1,
    check: (digits) => getOddDigitCount(digits) === 4,
  },
  {
    id: 'unique-focus',
    label: '고유수 확장형 추천',
    baseWeight: 1,
    check: (digits) => getUniqueDigitCount(digits) >= 5,
  },
  {
    id: 'low-sum-stable',
    label: '저합계 안정형 추천',
    baseWeight: 1,
    check: (digits) => {
      const sum = getDigitSum(digits)
      return sum >= 22 && sum <= 28
    },
  },
]

function getDigitSum(digits: number[]) {
  return digits.reduce((sum, digit) => sum + digit, 0)
}

function getOddDigitCount(digits: number[]) {
  return digits.filter(digit => digit % 2 === 1).length
}

function getUniqueDigitCount(digits: number[]) {
  return new Set(digits).size
}

function hasThreeConsecutiveDigits(digits: number[]) {
  for (let i = 0; i <= digits.length - 3; i++) {
    const ascending = digits[i] + 1 === digits[i + 1] && digits[i + 1] + 1 === digits[i + 2]
    const descending = digits[i] - 1 === digits[i + 1] && digits[i + 1] - 1 === digits[i + 2]
    if (ascending || descending) return true
  }
  return false
}

function getMaxDuplicateCount(digits: number[]) {
  const counts = new Map<number, number>()
  for (const digit of digits) counts.set(digit, (counts.get(digit) ?? 0) + 1)
  return Math.max(...counts.values(), 1)
}

function passesCommonPensionRules(digits: number[]) {
  const sum = getDigitSum(digits)
  const oddCount = getOddDigitCount(digits)
  const uniqueDigitCount = getUniqueDigitCount(digits)
  const hasThreeConsecutive = hasThreeConsecutiveDigits(digits)
  const maxDuplicateCount = getMaxDuplicateCount(digits)

  return sum >= 22
    && sum <= 34
    && oddCount >= 2
    && oddCount <= 4
    && uniqueDigitCount >= 4
    && !hasThreeConsecutive
    && maxDuplicateCount < 3
}

function buildPensionMeta(digits: number[]) {
  return {
    sum: getDigitSum(digits),
    oddCount: getOddDigitCount(digits),
    uniqueDigitCount: getUniqueDigitCount(digits),
    maxDuplicateCount: getMaxDuplicateCount(digits),
    hasThreeConsecutive: hasThreeConsecutiveDigits(digits),
  }
}

// historyNumbers는 최신 회차가 앞에 오는(내림차순) 배열을 기대한다
function parseHistoryDigits(historyNumbers: string[]) {
  return historyNumbers
    .map((raw) => raw.padStart(6, '0').slice(-6).split('').map(Number))
    .filter((digits) => digits.length === 6 && digits.every((digit) => Number.isFinite(digit)))
}

export function buildPensionRuleWeights(historyNumbers: string[]): PensionRuleWeightDiagnostic[] {
  const historyDigits = parseHistoryDigits(historyNumbers)

  return PENSION_SET_CONFIGS.map((config) => {
    const prior = PENSION_THEORETICAL_RATES[config.id] ?? { passRate: 0.2, matchRate: 0.3 }

    // 지수 감쇠 가중 관측: 최신 회차(i=0)가 가장 큰 비중
    let decayedTotal = 0
    let decayedPass = 0
    let decayedMatch = 0
    historyDigits.forEach((digits, index) => {
      const decay = Math.pow(0.5, index / PENSION_DECAY_HALF_LIFE)
      decayedTotal += decay
      if (config.check(digits)) {
        decayedMatch += decay
        if (passesCommonPensionRules(digits)) decayedPass += decay
      }
    })

    // 이론 확률을 prior로 두는 베이지안 수축 — 표본이 적을수록 이론값에 가깝게
    const passRate = shrinkRate(decayedPass, decayedTotal, prior.passRate, PENSION_PRIOR_STRENGTH)
    const matchRate = shrinkRate(decayedMatch, decayedTotal, prior.matchRate, PENSION_PRIOR_STRENGTH)

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

function weightedDigitPick(pool: number[], rng: Rng) {
  const total = pool.reduce((sum, weight) => sum + weight, 0)
  let random = rng() * total

  for (let digit = 0; digit < pool.length; digit++) {
    random -= pool[digit]
    if (random <= 0) return digit
  }

  return pool.length - 1
}

function buildHistoricalDigitWeights(historyNumbers: string[]) {
  const positionWeights = Array.from({ length: 6 }, () => Array.from({ length: 10 }, () => 1))

  for (const raw of historyNumbers.slice(0, PENSION_HISTORY_LOOKBACK)) {
    const digits = raw.padStart(6, '0').slice(-6).split('').map(Number)
    if (digits.some((digit) => Number.isNaN(digit))) continue

    digits.forEach((digit, index) => {
      positionWeights[index][digit] += 1
    })
  }

  return positionWeights
}

type PensionGenerateOptions = {
  rng?: Rng
  // 포트폴리오 다양화: 이미 다른 세트가 사용한 끝자리/끝 2자리 — 겹치면 "최소 한 번 당첨" 확률이 깎이므로 회피
  avoidLastDigits?: Set<number>
  avoidLastTwo?: Set<string>
}

function randomDigits(rng: Rng) {
  return Array.from({ length: 6 }, () => Math.floor(rng() * 10))
}

function violatesTailConstraints(digits: number[], avoidLastDigits?: Set<number>, avoidLastTwo?: Set<string>) {
  if (avoidLastDigits?.has(digits[5])) return true
  if (avoidLastTwo?.has(`${digits[4]}${digits[5]}`)) return true
  return false
}

function buildStatisticalFallback(
  config: PensionSetConfig,
  historyNumbers: string[],
  ruleWeight: number | undefined,
  options: PensionGenerateOptions,
): PensionRecommendationSet | null {
  if (historyNumbers.length === 0) return null

  const rng = options.rng ?? Math.random
  const positionWeights = buildHistoricalDigitWeights(historyNumbers)

  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = positionWeights.map((weights) => weightedDigitPick(weights, rng))
    if (!passesCommonPensionRules(digits)) continue
    // 통계 폴백에서도 끝자리 중복 회피는 유지 — 시도 소진 시 4단계(미사용 끝자리 강제)로 넘어간다
    if (violatesTailConstraints(digits, options.avoidLastDigits, options.avoidLastTwo)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: {
        ...buildPensionMeta(digits),
        ruleId: config.id,
        ruleWeight,
      },
    }
  }

  return null
}

export function buildPensionRecommendation(
  config: PensionSetConfig,
  historyNumbers: string[] = [],
  ruleWeight?: number,
  options: PensionGenerateOptions = {},
): PensionRecommendationSet {
  const rng = options.rng ?? Math.random

  // 1단계: 공통 규칙 + 성향 규칙 + 끝자리 다양화 모두 충족
  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = randomDigits(rng)
    if (!passesCommonPensionRules(digits)) continue
    if (!config.check(digits)) continue
    if (violatesTailConstraints(digits, options.avoidLastDigits, options.avoidLastTwo)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: {
        ...buildPensionMeta(digits),
        ruleId: config.id,
        ruleWeight,
      },
    }
  }

  // 2단계(완화): 성향 규칙을 내려놓되 공통 규칙 + 끝자리 다양화는 유지
  for (let attempt = 0; attempt < MAX_PENSION_ATTEMPTS; attempt++) {
    const digits = randomDigits(rng)
    if (!passesCommonPensionRules(digits)) continue
    if (violatesTailConstraints(digits, options.avoidLastDigits, undefined)) continue

    return {
      label: config.label,
      number: digits.join(''),
      meta: {
        ...buildPensionMeta(digits),
        ruleId: config.id,
        ruleWeight,
      },
    }
  }

  // 3단계: 최근 이력의 자리별 출현 빈도 기반 통계 폴백
  const statisticalFallback = buildStatisticalFallback(config, historyNumbers, ruleWeight, options)
  if (statisticalFallback) return statisticalFallback

  // 4단계(최종): 끝자리만 미사용 숫자로 강제한 랜덤 폴백
  const availableLastDigits = Array.from({ length: 10 }, (_, digit) => digit)
    .filter((digit) => !options.avoidLastDigits?.has(digit))
  const fallbackDigits = randomDigits(rng)
  if (availableLastDigits.length > 0) {
    fallbackDigits[5] = availableLastDigits[Math.floor(rng() * availableLastDigits.length)]
  }

  return {
    label: config.label,
    number: fallbackDigits.join(''),
    meta: {
      ...buildPensionMeta(fallbackDigits),
      ruleId: config.id,
      ruleWeight,
    },
  }
}

export function buildPensionRecommendations(historyNumbers: string[] = [], rng: Rng = Math.random) {
  const ruleWeights = buildPensionRuleWeights(historyNumbers)
  const configById = new Map(PENSION_SET_CONFIGS.map((config) => [config.id, config]))

  const avoidLastDigits = new Set<number>()
  const avoidLastTwo = new Set<string>()

  // 진단에 표시되는 우선순위(동점 시 한글 라벨 순 포함)와 동일한 순서로 생성 → 첫 세트가 대표 추천
  return ruleWeights
    .map((entry) => {
      const config = configById.get(entry.ruleId)
      if (!config) return null
      const set = buildPensionRecommendation(config, historyNumbers, entry.weight, {
        rng,
        avoidLastDigits,
        avoidLastTwo,
      })
      const digits = set.number.split('')
      avoidLastDigits.add(Number(digits[5]))
      avoidLastTwo.add(`${digits[4]}${digits[5]}`)
      return set
    })
    .filter((set): set is PensionRecommendationSet => set !== null)
}

// 각조 구매 = 1~5조 전부 구매. 번호 하나당 5매를 보유한 것으로 판정한다.
export const PENSION_BANDS_PER_TICKET = 5

// 연금복권720+ 상금은 "뒤에서부터 연속 일치"로 결정된다 (끝 1자리=7등 … 6자리 전체=2등, 조까지=1등)
export function longestSuffixMatch(picked: string, winning: string) {
  const left = picked.padStart(6, '0').slice(-6)
  const right = winning.padStart(6, '0').slice(-6)

  let matches = 0
  for (let index = 5; index >= 0; index -= 1) {
    if (left[index] !== right[index]) break
    matches += 1
  }

  return matches
}

// 각조(5매) 기준 등수별 당첨 매수.
// 6자리 전장 일치면 당첨 조 1매가 1등, 나머지 4조가 2등. 1~5자리는 조와 무관하므로 5매 모두 당첨.
export function getPensionPrizeCounts(suffixMatches: number): Record<number, number> {
  if (suffixMatches >= 6) return { 1: 1, 2: PENSION_BANDS_PER_TICKET - 1 }
  if (suffixMatches >= 1) return { [8 - suffixMatches]: PENSION_BANDS_PER_TICKET }
  return {}
}

// 가장 높은 등수(숫자가 작을수록 높음). 낙첨이면 0.
export function getPensionTopRank(prizeCounts: Record<number, number>) {
  const ranks = Object.keys(prizeCounts).map(Number)
  return ranks.length === 0 ? 0 : Math.min(...ranks)
}
