import type { InsertPensionPurchaseParams, PensionPurchaseJoinedRow } from '../../types/pension'

export async function insertPensionPurchaseGamesQuery(db: D1Database, params: InsertPensionPurchaseParams) {
  const stmt = db.prepare(
    `INSERT INTO pension_purchases (ticket_id, device_id, draw_no, game_index, number, rule_id, label, algorithm, rule_weight, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  await db.batch(params.games.map((game, index) => stmt.bind(
    params.ticketId,
    params.deviceId,
    params.drawNo,
    index,
    game.number,
    game.ruleId ?? null,
    game.label ?? null,
    params.algorithm,
    game.ruleWeight ?? null,
    params.createdAt,
  )))
}

export async function getPensionPurchasesWithResultsQuery(db: D1Database) {
  const { results } = await db.prepare(
    `SELECT p.*, d.draw_date, d.winning_band, d.winning_number, d.bonus_number
     FROM pension_purchases p
     LEFT JOIN pension720_draws d ON d.draw_no = p.draw_no
     ORDER BY p.draw_no DESC, p.created_at DESC, p.game_index ASC`
  ).all<PensionPurchaseJoinedRow>()
  return results
}

export async function deletePensionPurchaseTicketQuery(db: D1Database, ticketId: string) {
  const result = await db.prepare(
    'DELETE FROM pension_purchases WHERE ticket_id = ?'
  ).bind(ticketId).run()
  return result.meta.changes ?? 0
}
