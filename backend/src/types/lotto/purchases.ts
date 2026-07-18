export type PurchaseGameInput = {
  numbers: number[]
  ruleId?: string | null
  label?: string | null
  ruleWeight?: number | null
}

export type SavePurchaseInput = {
  deviceId: string
  algorithm?: string | null
  games: PurchaseGameInput[]
}

export type InsertPurchaseParams = {
  ticketId: string
  deviceId: string
  drawNo: number
  algorithm: string | null
  createdAt: string
  games: PurchaseGameInput[]
}

export type PurchaseJoinedRow = {
  id: number
  ticket_id: string
  device_id: string
  draw_no: number
  game_index: number
  numbers: string
  rule_id: string | null
  label: string | null
  algorithm: string | null
  rule_weight: number | null
  created_at: string
  drwNoDate: string | null
  drwtNo1: number | null
  drwtNo2: number | null
  drwtNo3: number | null
  drwtNo4: number | null
  drwtNo5: number | null
  drwtNo6: number | null
  bnusNo: number | null
}

export type PurchaseGameResult = {
  gameIndex: number
  numbers: number[]
  ruleId: string | null
  label: string | null
  ruleWeight: number | null
  matches: number | null
  hasBonus: boolean | null
  rank: number | null
}

export type PurchaseTicket = {
  ticketId: string
  drawNo: number
  algorithm: string | null
  createdAt: string
  status: 'pending' | 'judged'
  draw: {
    drwNo: number
    numbers: number[]
    bnusNo: number
    drwNoDate: string
  } | null
  games: PurchaseGameResult[]
}

export type PurchaseListSummary = {
  tickets: PurchaseTicket[]
}

export type SavePurchaseSummary = {
  ticketId: string
  drawNo: number
}
