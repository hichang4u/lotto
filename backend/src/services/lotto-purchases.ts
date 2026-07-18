import { countMatches, getPrizeTier } from '../algorithms/lotto'
import {
  deletePurchaseTicketQuery,
  getLatestStoredLottoDrawNo,
  getPurchasesWithResultsQuery,
  insertPurchaseGamesQuery,
} from '../queries/lotto'
import type {
  PurchaseGameInput,
  PurchaseGameResult,
  PurchaseJoinedRow,
  PurchaseListSummary,
  PurchaseTicket,
  SavePurchaseInput,
  SavePurchaseSummary,
} from '../types/lotto'

const GAMES_PER_TICKET = 5

const ERROR_DEVICE_REQUIRED = 'deviceId가 필요합니다.'
const ERROR_GAME_COUNT = `게임은 정확히 ${GAMES_PER_TICKET}개여야 합니다.`
const ERROR_INVALID_NUMBERS = '각 게임은 1~45 범위의 중복 없는 숫자 6개여야 합니다.'
const ERROR_EMPTY_HISTORY = '먼저 당첨번호를 동기화해주세요.'
const ERROR_FIELD_TOO_LONG = '요청 필드 길이가 허용 범위를 초과했습니다.'

const DEVICE_ID_MAX_LENGTH = 64
const ALGORITHM_MAX_LENGTH = 100
const GAME_FIELD_MAX_LENGTH = 100

// 라우트에서 400 응답 판별용
export const PURCHASE_VALIDATION_ERRORS = [
  ERROR_DEVICE_REQUIRED,
  ERROR_GAME_COUNT,
  ERROR_INVALID_NUMBERS,
  ERROR_EMPTY_HISTORY,
  ERROR_FIELD_TOO_LONG,
]

function assertValidOptionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(ERROR_FIELD_TOO_LONG)
}

function assertValidGames(games: PurchaseGameInput[]) {
  if (!Array.isArray(games) || games.length !== GAMES_PER_TICKET) {
    throw new Error(ERROR_GAME_COUNT)
  }
  for (const game of games) {
    const numbers = game.numbers
    if (!Array.isArray(numbers) || numbers.length !== 6) throw new Error(ERROR_INVALID_NUMBERS)
    const unique = new Set(numbers)
    if (unique.size !== 6) throw new Error(ERROR_INVALID_NUMBERS)
    for (const num of numbers) {
      if (!Number.isInteger(num) || num < 1 || num > 45) throw new Error(ERROR_INVALID_NUMBERS)
    }
    assertValidOptionalString(game.ruleId, GAME_FIELD_MAX_LENGTH)
    assertValidOptionalString(game.label, GAME_FIELD_MAX_LENGTH)
  }
}

export async function savePurchaseTicket(db: D1Database, input: SavePurchaseInput): Promise<SavePurchaseSummary> {
  if (!input.deviceId || typeof input.deviceId !== 'string') throw new Error(ERROR_DEVICE_REQUIRED)
  if (input.deviceId.length > DEVICE_ID_MAX_LENGTH) throw new Error(ERROR_FIELD_TOO_LONG)
  assertValidOptionalString(input.algorithm, ALGORITHM_MAX_LENGTH)
  assertValidGames(input.games)

  const latestDrawNo = await getLatestStoredLottoDrawNo(db)
  if (latestDrawNo === 0) throw new Error(ERROR_EMPTY_HISTORY)

  const drawNo = latestDrawNo + 1
  const ticketId = crypto.randomUUID()

  await insertPurchaseGamesQuery(db, {
    ticketId,
    deviceId: input.deviceId,
    drawNo,
    algorithm: input.algorithm ?? null,
    createdAt: new Date().toISOString(),
    games: input.games.map((game) => ({
      ...game,
      numbers: [...game.numbers].sort((a, b) => a - b),
    })),
  })

  return { ticketId, drawNo }
}

function toGameResult(row: PurchaseJoinedRow): PurchaseGameResult {
  const numbers = row.numbers.split(',').map(Number)
  const judged = row.drwtNo1 !== null

  if (!judged) {
    return {
      gameIndex: row.game_index,
      numbers,
      ruleId: row.rule_id,
      label: row.label,
      ruleWeight: row.rule_weight,
      matches: null,
      hasBonus: null,
      rank: null,
    }
  }

  const matches = countMatches(numbers, {
    drwtNo1: row.drwtNo1 as number,
    drwtNo2: row.drwtNo2 as number,
    drwtNo3: row.drwtNo3 as number,
    drwtNo4: row.drwtNo4 as number,
    drwtNo5: row.drwtNo5 as number,
    drwtNo6: row.drwtNo6 as number,
  })
  const hasBonus = row.bnusNo !== null && numbers.includes(row.bnusNo)

  return {
    gameIndex: row.game_index,
    numbers,
    ruleId: row.rule_id,
    label: row.label,
    ruleWeight: row.rule_weight,
    matches,
    hasBonus,
    rank: getPrizeTier(matches, hasBonus) ?? 0,
  }
}

export async function listPurchaseTickets(db: D1Database, deviceId: string): Promise<PurchaseListSummary> {
  if (!deviceId) throw new Error(ERROR_DEVICE_REQUIRED)

  const rows = await getPurchasesWithResultsQuery(db, deviceId)
  const tickets: PurchaseTicket[] = []
  const byTicket = new Map<string, PurchaseTicket>()

  for (const row of rows) {
    let ticket = byTicket.get(row.ticket_id)
    if (!ticket) {
      const judged = row.drwtNo1 !== null
      ticket = {
        ticketId: row.ticket_id,
        drawNo: row.draw_no,
        algorithm: row.algorithm,
        createdAt: row.created_at,
        status: judged ? 'judged' : 'pending',
        draw: judged
          ? {
              drwNo: row.draw_no,
              numbers: [row.drwtNo1, row.drwtNo2, row.drwtNo3, row.drwtNo4, row.drwtNo5, row.drwtNo6] as number[],
              bnusNo: row.bnusNo as number,
              drwNoDate: row.drwNoDate as string,
            }
          : null,
        games: [],
      }
      byTicket.set(row.ticket_id, ticket)
      tickets.push(ticket)
    }
    ticket.games.push(toGameResult(row))
  }

  return { tickets }
}

export async function deletePurchaseTicket(db: D1Database, ticketId: string, deviceId: string) {
  if (!deviceId) throw new Error(ERROR_DEVICE_REQUIRED)
  const deleted = await deletePurchaseTicketQuery(db, ticketId, deviceId)
  return deleted > 0
}
