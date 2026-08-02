import type { PensionRecommendationSet } from './models'

export type Pension720SyncSummary = {
  syncedCount: number
  latestDraw: number
  nextDrawNo: number
}

export type PensionGenerateSummary = {
  sets: PensionRecommendationSet[]
  featuredSet: PensionRecommendationSet | null
  algorithm: string
  rules: {
    sumRange: string
    oddCountRange: string
    minUniqueDigits: number
    noThreeConsecutive: boolean
    maxDuplicateCount: number
    setProfiles?: string[]
    fallback?: string[]
    portfolio?: string
  }
  ruleWeights?: Array<{
    ruleId: string
    label: string
    weight: number
    score: number
    passRate: number
    recentMatchRate: number
  }>
}

export type PensionBacktestSummary = {
  algorithm: string
  evaluatedDraws: number
  setsPerDraw: number
  totalGeneratedSets: number
  // 상금 구조와 동일한 "뒤에서부터 연속 일치" 자리수 기준 지표
  averageSuffixMatchPerSet: number
  averageBestSuffixMatchPerDraw: number
  // 회차당 최소 1개 당첨률(%) — 끝자리 다양화 효과가 드러나는 지표
  atLeastOnePrizeRate: number
  // 꼬리 일치 자리수(1~6) → 시뮬레이션 당첨 세트 수 (1=7등 … 6=2등 상당)
  prizeCounts: Record<number, number>
  // 완성된 4세트 중 통계 점수가 가장 높은 대표 1세트 성과
  featured: {
    totalSets: number
    averageSuffixMatchPerSet: number
    atLeastOnePrizeRate: number
    prizeCounts: Record<number, number>
  }
  // 대표 1세트와 동일한 표본 수의 순수 랜덤 대조군
  featuredBaseline: {
    totalSets: number
    averageSuffixMatchPerSet: number
    atLeastOnePrizeRate: number
    prizeCounts: Record<number, number>
  }
  // 같은 조건에서 순수 랜덤 세트가 낸 성적 (알고리즘 대비 기준선)
  baseline: {
    totalSets: number
    averageSuffixMatchPerSet: number
    atLeastOnePrizeRate: number
    prizeCounts: Record<number, number>
  }
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
      averageSuffixMatches: number
      suffix1PlusRate: number
      suffix2PlusRate: number
    }>
  }
}
