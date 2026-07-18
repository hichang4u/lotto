import {
  buildPensionRecommendations,
  buildPensionRuleWeights,
  PENSION_ALGORITHM_VERSION,
} from '../algorithms/pension'
import { createSeededRng } from '../algorithms/statistics'
import { getAllPensionBacktestRowsQuery } from '../queries/pension/results'
import type { PensionBacktestRow } from '../types/pension/models'
import type { PensionBacktestSummary } from '../types/pension/summaries'

const MIN_PENSION_BACKTEST_DRAWS = 30
const MIN_PENSION_TRAINING_DRAWS = 20

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

function emptyPrizeCounts(): Record<number, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
}

export function runPensionBacktest(rows: PensionBacktestRow[], lookback: number): PensionBacktestSummary {
  if (rows.length < MIN_PENSION_BACKTEST_DRAWS) {
    throw new Error('연금복권 백테스트에 필요한 데이터가 부족합니다.')
  }

  const startIndex = Math.max(MIN_PENSION_TRAINING_DRAWS, rows.length - lookback)
  const targetRows = rows.slice(startIndex)
  const numbersAsc = rows.map((row) => row.winning_number)

  let totalSets = 0
  let totalSuffixMatches = 0
  let bestSuffixMatchSum = 0
  let drawsWithPrize = 0
  const prizeCounts = emptyPrizeCounts()

  let baselineSets = 0
  let baselineSuffixMatches = 0
  let baselineDrawsWithPrize = 0
  const baselinePrizeCounts = emptyPrizeCounts()

  const rulePerf = new Map<string, {
    ruleId: string
    label: string
    generatedCount: number
    totalSuffixMatches: number
    suffix1PlusCount: number
    suffix2PlusCount: number
  }>()

  for (let targetIndex = startIndex; targetIndex < rows.length; targetIndex += 1) {
    const target = rows[targetIndex]
    // 라이브 생성과 동일하게 "해당 회차 직전까지의 이력, 최신순"으로 학습
    const historyNumbers = numbersAsc.slice(0, targetIndex).reverse()
    // 회차 번호를 시드로 사용 → 진단 결과가 호출 시마다 흔들리지 않고 재현 가능
    const rng = createSeededRng(0x9e3779b9 ^ target.draw_no)

    const sets = buildPensionRecommendations(historyNumbers, rng)
    const matchCounts = sets.map((set) => longestSuffixMatch(set.number, target.winning_number))
    const bestMatch = Math.max(...matchCounts)

    for (let index = 0; index < sets.length; index += 1) {
      const set = sets[index]
      const matches = matchCounts[index]
      const ruleId = set.meta.ruleId ?? 'unknown'
      const perf = rulePerf.get(ruleId) ?? {
        ruleId,
        label: set.label,
        generatedCount: 0,
        totalSuffixMatches: 0,
        suffix1PlusCount: 0,
        suffix2PlusCount: 0,
      }

      perf.generatedCount += 1
      perf.totalSuffixMatches += matches
      if (matches >= 1) perf.suffix1PlusCount += 1
      if (matches >= 2) perf.suffix2PlusCount += 1
      rulePerf.set(ruleId, perf)

      totalSets += 1
      totalSuffixMatches += matches
      if (matches >= 1) prizeCounts[matches] += 1
    }

    bestSuffixMatchSum += bestMatch
    if (bestMatch >= 1) drawsWithPrize += 1

    // 랜덤 대조군: 같은 회차에 같은 개수의 순수 랜덤 세트를 같은 RNG 흐름으로 생성
    let baselineBestMatch = 0
    for (let index = 0; index < sets.length; index += 1) {
      const randomNumber = Array.from({ length: 6 }, () => Math.floor(rng() * 10)).join('')
      const matches = longestSuffixMatch(randomNumber, target.winning_number)
      baselineSets += 1
      baselineSuffixMatches += matches
      if (matches > baselineBestMatch) baselineBestMatch = matches
      if (matches >= 1) baselinePrizeCounts[matches] += 1
    }
    if (baselineBestMatch >= 1) baselineDrawsWithPrize += 1
  }

  return {
    algorithm: PENSION_ALGORITHM_VERSION,
    evaluatedDraws: targetRows.length,
    setsPerDraw: targetRows.length === 0 ? 0 : totalSets / targetRows.length,
    totalGeneratedSets: totalSets,
    averageSuffixMatchPerSet: Number((totalSuffixMatches / totalSets).toFixed(3)),
    averageBestSuffixMatchPerDraw: Number((bestSuffixMatchSum / targetRows.length).toFixed(3)),
    // 회차당 최소 1개 당첨률(%) — 끝자리 다양화의 효과가 드러나는 핵심 지표
    atLeastOnePrizeRate: Number((drawsWithPrize / targetRows.length * 100).toFixed(2)),
    prizeCounts,
    baseline: {
      totalSets: baselineSets,
      averageSuffixMatchPerSet: Number((baselineSuffixMatches / Math.max(baselineSets, 1)).toFixed(3)),
      atLeastOnePrizeRate: Number((baselineDrawsWithPrize / targetRows.length * 100).toFixed(2)),
      prizeCounts: baselinePrizeCounts,
    },
    ruleDiagnostics: {
      currentWeights: buildPensionRuleWeights(numbersAsc.slice().reverse()),
      performance: Array.from(rulePerf.values()).map((entry) => ({
        ruleId: entry.ruleId,
        label: entry.label,
        generatedCount: entry.generatedCount,
        averageSuffixMatches: Number((entry.totalSuffixMatches / Math.max(entry.generatedCount, 1)).toFixed(3)),
        suffix1PlusRate: Number((entry.suffix1PlusCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
        suffix2PlusRate: Number((entry.suffix2PlusCount / Math.max(entry.generatedCount, 1) * 100).toFixed(2)),
      })),
    },
  }
}

export async function runPensionBacktestFromDb(db: D1Database, lookback: number) {
  return runPensionBacktest(await getAllPensionBacktestRowsQuery(db), lookback)
}
