import { buildGeneratedSets, buildRuleWeights, countMatches, LOTTO_ALGORITHM_VERSION, SET_CONFIGS } from '../algorithms/lotto'
import { createSeededRng } from '../algorithms/statistics'
import { getAllLottoBacktestRowsQuery } from '../queries/lotto'
import type { DrawNumbersRow, LottoBacktestSummary } from '../types/lotto'

const MIN_BACKTEST_DRAWS = 40
const MIN_TRAINING_DRAWS = 30

const DRAW_NUM_COLS = ['drwtNo1', 'drwtNo2', 'drwtNo3', 'drwtNo4', 'drwtNo5', 'drwtNo6'] as const

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

export function runLottoBacktest(results: DrawNumbersRow[], lookback: number): LottoBacktestSummary {
  if (results.length < MIN_BACKTEST_DRAWS) {
    throw new Error('백테스트에 필요한 데이터가 부족합니다.')
  }

  const startIndex = Math.max(MIN_TRAINING_DRAWS, results.length - lookback)
  const targetDraws = results.slice(startIndex)

  // 각 규칙별로 전체 데이터(1회차 ~ 최신회차) 기준 실측 확률 계산
  const actualRateMap = new Map(SET_CONFIGS.map((config) => {
    let matchCount = 0
    for (const draw of results) {
      const numbers = DRAW_NUM_COLS.map((col) => draw[col]).sort((a, b) => a - b)
      if (config.check(numbers)) matchCount += 1
    }
    return [config.id, Number((matchCount / results.length * 100).toFixed(2))]
  }))

  let totalSets = 0
  let totalMatches = 0
  let bestMatchSum = 0
  let bonusHitCount = 0
  let commonRulePassCount = 0
  let relaxedFallbackCount = 0
  let randomFallbackCount = 0
  const hitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
  const bestHitDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } as Record<number, number>
  let threePlusCount = 0
  let fourPlusCount = 0
  let fivePlusCount = 0
  let drawsWithPrize = 0
  const prizeCounts = emptyPrizeCounts()
  let baselineSets = 0
  let baselineMatches = 0
  let baselineDrawsWithPrize = 0
  const baselinePrizeCounts = emptyPrizeCounts()
  const rulePerf = new Map(SET_CONFIGS.map((config) => [config.id, {
    ruleId: config.id,
    label: config.label,
    generatedCount: 0,
    totalMatches: 0,
    commonRulePassCount: 0,
    relaxedFallbackCount: 0,
    randomFallbackCount: 0,
  }]))

  for (const target of targetDraws) {
    // 회차 번호 시드 → 진단 결과가 호출 시마다 흔들리지 않고 재현 가능
    const rng = createSeededRng(0x9e3779b9 ^ (target.drwNo ?? 0))
    const sets = buildGeneratedSets(results.filter(row => (row.drwNo ?? 0) < (target.drwNo ?? 0)), rng)
    const matchCounts = sets.map(set => countMatches(set.numbers, target))
    const bestMatch = Math.max(...matchCounts)

    for (let i = 0; i < sets.length; i++) {
      const matches = matchCounts[i]
      const meta = sets[i].meta
      const passedRules = meta?.passedRules ?? []
      const hasBonus = sets[i].numbers.includes(target.bnusNo ?? -1)
      const perf = meta?.ruleId ? rulePerf.get(meta.ruleId) : undefined

      totalSets += 1
      totalMatches += matches
      hitDistribution[matches] += 1

      if (perf) {
        perf.generatedCount += 1
        perf.totalMatches += matches
        if (passedRules.includes('common-rules')) perf.commonRulePassCount += 1
        if (passedRules.includes('fallback-set-rule-relaxed')) perf.relaxedFallbackCount += 1
        if (passedRules.includes('fallback-random')) perf.randomFallbackCount += 1
      }

      if (passedRules.includes('common-rules')) commonRulePassCount += 1
      if (passedRules.includes('fallback-set-rule-relaxed')) relaxedFallbackCount += 1
      if (passedRules.includes('fallback-random')) randomFallbackCount += 1
      if (matches >= 3) threePlusCount += 1
      if (matches >= 4) fourPlusCount += 1
      if (matches >= 5) fivePlusCount += 1
      if (matches === 5 && hasBonus) bonusHitCount += 1
      const tier = getPrizeTier(matches, hasBonus)
      if (tier !== null) prizeCounts[tier] += 1
    }

    bestMatchSum += bestMatch
    bestHitDistribution[bestMatch] += 1
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
  }

  return {
    algorithm: LOTTO_ALGORITHM_VERSION,
    evaluatedDraws: targetDraws.length,
    setsPerDraw: SET_CONFIGS.length,
    totalGeneratedSets: totalSets,
    averageMatchPerSet: Number((totalMatches / totalSets).toFixed(3)),
    averageBestMatchPerDraw: Number((bestMatchSum / targetDraws.length).toFixed(3)),
    atLeastOnePrizeRate: Number((drawsWithPrize / targetDraws.length * 100).toFixed(2)),
    prizeCounts,
    baseline: {
      totalSets: baselineSets,
      averageMatchPerSet: Number((baselineMatches / Math.max(baselineSets, 1)).toFixed(3)),
      atLeastOnePrizeRate: Number((baselineDrawsWithPrize / targetDraws.length * 100).toFixed(2)),
      prizeCounts: baselinePrizeCounts,
    },
    generationQuality: {
      commonRulePassRate: Number((commonRulePassCount / totalSets * 100).toFixed(2)),
      relaxedFallbackRate: Number((relaxedFallbackCount / totalSets * 100).toFixed(2)),
      randomFallbackRate: Number((randomFallbackCount / totalSets * 100).toFixed(2)),
    },
    setHitRate: {
      match3Plus: Number((threePlusCount / totalSets * 100).toFixed(2)),
      match4Plus: Number((fourPlusCount / totalSets * 100).toFixed(2)),
      match5Plus: Number((fivePlusCount / totalSets * 100).toFixed(2)),
      match5PlusBonus: Number((bonusHitCount / totalSets * 100).toFixed(2)),
    },
    hitDistribution,
    bestHitDistribution,
    ruleDiagnostics: {
      currentWeights: buildRuleWeights(results.slice(0, startIndex)),
      performance: Array.from(rulePerf.values()).map((entry) => ({
        ruleId: entry.ruleId,
        label: entry.label,
        generatedCount: entry.generatedCount,
        averageMatches: Number((entry.totalMatches / Math.max(entry.generatedCount, 1)).toFixed(3)),
        commonRulePassRate: Number((entry.commonRulePassCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
        relaxedFallbackRate: Number((entry.relaxedFallbackCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
        randomFallbackRate: Number((entry.randomFallbackCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
        actualRate: actualRateMap.get(entry.ruleId) ?? 0,
      })),
    },
  }
}

export async function runLottoBacktestFromDb(db: D1Database, lookback: number) {
  return runLottoBacktest(await getAllLottoBacktestRowsQuery(db), lookback)
}
