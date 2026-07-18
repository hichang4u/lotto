import type { GeneratedSet, LottoResultRecord } from './models'

export type LottoSyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrwNo: number
  debug: LottoResultRecord | null
}

export type LottoBacktestSummary = {
  algorithm: string
  evaluatedDraws: number
  setsPerDraw: number
  totalGeneratedSets: number
  averageMatchPerSet: number
  averageBestMatchPerDraw: number
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
  generationQuality: {
    commonRulePassRate: number
    relaxedFallbackRate: number
    randomFallbackRate: number
  }
  setHitRate: {
    match3Plus: number
    match4Plus: number
    match5Plus: number
    match5PlusBonus: number
  }
  hitDistribution: Record<number, number>
  bestHitDistribution: Record<number, number>
  ruleDiagnostics: {
    currentWeights: Array<{
      ruleId: string
      label: string
      weight: number
      score: number
      passRate: number
      recentMatchRate: number
    }>
    performance: Array<{
      ruleId: string
      label: string
      generatedCount: number
      averageMatches: number
      commonRulePassRate: number
      relaxedFallbackRate: number
      randomFallbackRate: number
      actualRate: number
    }>
  }
}

export type LottoHotNumber = {
  num: number
  count: number
}

export type LottoGenerateSummary = {
  sets: GeneratedSet[]
  algorithm: string
  ruleWeights?: Array<{
    ruleId: string
    label: string
    weight: number
    score: number
    passRate: number
    recentMatchRate: number
  }>
}
