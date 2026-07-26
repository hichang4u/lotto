export type PensionPurchaseGameInput = {
  number: string
  ruleId?: string | null
  label?: string | null
  ruleWeight?: number | null
}

export type SavePensionPurchaseInput = {
  deviceId: string
  algorithm?: string | null
  games: PensionPurchaseGameInput[]
}

export type InsertPensionPurchaseParams = {
  ticketId: string
  deviceId: string
  drawNo: number
  algorithm: string | null
  createdAt: string
  games: PensionPurchaseGameInput[]
}

// p.* + pension720_draws 조인 컬럼. draw_no는 양쪽에 있으므로 조인 측은 선택하지 않는다.
export type PensionPurchaseJoinedRow = {
  id: number
  ticket_id: string
  device_id: string
  draw_no: number
  game_index: number
  number: string
  rule_id: string | null
  label: string | null
  algorithm: string | null
  rule_weight: number | null
  created_at: string
  draw_date: string | null
  winning_band: string | null
  winning_number: string | null
  bonus_number: string | null
}

export type PensionPurchaseGameResult = {
  gameIndex: number
  number: string
  ruleId: string | null
  label: string | null
  ruleWeight: number | null
  // 추첨 전이면 아래 4개는 모두 null
  suffixMatches: number | null
  prizeCounts: Record<number, number> | null
  bonusMatched: boolean | null
  topRank: number | null
}

export type PensionPurchaseTicket = {
  ticketId: string
  drawNo: number
  algorithm: string | null
  createdAt: string
  status: 'pending' | 'judged'
  draw: {
    drawNo: number
    winningBand: string
    winningNumber: string
    bonusNumber: string
    drawDate: string
  } | null
  games: PensionPurchaseGameResult[]
}

export type PensionPurchaseListSummary = {
  tickets: PensionPurchaseTicket[]
}

export type SavePensionPurchaseSummary = {
  ticketId: string
  drawNo: number
}
