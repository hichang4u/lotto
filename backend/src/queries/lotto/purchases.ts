import type { InsertPurchaseParams, PurchaseJoinedRow } from '../../types/lotto'

export async function insertPurchaseGamesQuery(db: D1Database, params: InsertPurchaseParams) {
  const stmt = db.prepare(
    `INSERT INTO lotto_purchases (ticket_id, device_id, draw_no, game_index, numbers, rule_id, label, algorithm, rule_weight, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  await db.batch(params.games.map((game, index) => stmt.bind(
    params.ticketId,
    params.deviceId,
    params.drawNo,
    index,
    game.numbers.join(','),
    game.ruleId ?? null,
    game.label ?? null,
    params.algorithm,
    game.ruleWeight ?? null,
    params.createdAt,
  )))
}

export async function getPurchasesWithResultsQuery(db: D1Database) {
  const { results } = await db.prepare(
    `SELECT p.*, h.drwNoDate, h.drwtNo1, h.drwtNo2, h.drwtNo3, h.drwtNo4, h.drwtNo5, h.drwtNo6, h.bnusNo
     FROM lotto_purchases p
     LEFT JOIN lotto_history h ON h.drwNo = p.draw_no
     ORDER BY p.draw_no DESC, p.created_at DESC, p.game_index ASC`
  ).all<PurchaseJoinedRow>()
  return results
}

export async function deletePurchaseTicketQuery(db: D1Database, ticketId: string) {
  const result = await db.prepare(
    'DELETE FROM lotto_purchases WHERE ticket_id = ?'
  ).bind(ticketId).run()
  return result.meta.changes ?? 0
}
