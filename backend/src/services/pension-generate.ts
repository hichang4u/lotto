import {
  buildPensionRuleWeights,
  buildPensionRecommendations,
  PENSION_ALGORITHM_VERSION,
  PENSION_RULES,
} from '../algorithms/pension'
import { getRecentPensionWinningNumbersQuery } from '../queries/pension/results'
import type { PensionGenerateSummary } from '../types/pension'

export async function generatePensionSets(db: D1Database): Promise<PensionGenerateSummary> {
  // 감쇠 가중치가 사실상 전체 이력을 활용하도록 넉넉히 조회 (반감기 52회 기준 400회 이전 비중은 0.5% 미만, 최신순 정렬 유지)
  const historyRows = await getRecentPensionWinningNumbersQuery(db, 400)
  const historyNumbers = historyRows.map((row) => row.winning_number).filter(Boolean)

  return {
    sets: buildPensionRecommendations(historyNumbers),
    algorithm: PENSION_ALGORITHM_VERSION,
    rules: PENSION_RULES,
    ruleWeights: buildPensionRuleWeights(historyNumbers),
  }
}
