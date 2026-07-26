import {
  getPensionPrizeCounts,
  getPensionTopRank,
  longestSuffixMatch,
} from '../algorithms/pension'
import {
  deletePensionPurchaseTicketQuery,
  getLatestStoredPensionDrawNo,
  getPensionPurchasesWithResultsQuery,
  insertPensionPurchaseGamesQuery,
} from '../queries/pension'
import type {
  PensionPurchaseGameInput,
  PensionPurchaseGameResult,
  PensionPurchaseJoinedRow,
  PensionPurchaseListSummary,
  PensionPurchaseTicket,
  SavePensionPurchaseInput,
  SavePensionPurchaseSummary,
} from '../types/pension'

const PENSION_GAMES_PER_TICKET = 4

const ERROR_DEVICE_REQUIRED = 'deviceId가 필요합니다.'
const ERROR_GAME_COUNT = `게임은 정확히 ${PENSION_GAMES_PER_TICKET}개여야 합니다.`
const ERROR_INVALID_NUMBER = '각 게임은 0~9 숫자 6자리 문자열이어야 합니다.'
const ERROR_EMPTY_HISTORY = '먼저 당첨번호를 동기화해주세요.'
const ERROR_FIELD_TOO_LONG = '요청 필드 길이가 허용 범위를 초과했습니다.'

const DEVICE_ID_MAX_LENGTH = 64
const ALGORITHM_MAX_LENGTH = 100
const GAME_FIELD_MAX_LENGTH = 100

const PENSION_NUMBER_PATTERN = /^[0-9]{6}$/

// 라우트에서 400 응답 판별용
export const PENSION_PURCHASE_VALIDATION_ERRORS = [
  ERROR_DEVICE_REQUIRED,
  ERROR_GAME_COUNT,
  ERROR_INVALID_NUMBER,
  ERROR_EMPTY_HISTORY,
  ERROR_FIELD_TOO_LONG,
]

function assertValidOptionalString(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(ERROR_FIELD_TOO_LONG)
}

function assertValidPensionGames(games: PensionPurchaseGameInput[]) {
  if (!Array.isArray(games) || games.length !== PENSION_GAMES_PER_TICKET) {
    throw new Error(ERROR_GAME_COUNT)
  }
  for (const game of games) {
    if (typeof game?.number !== 'string' || !PENSION_NUMBER_PATTERN.test(game.number)) {
      throw new Error(ERROR_INVALID_NUMBER)
    }
    assertValidOptionalString(game.ruleId, GAME_FIELD_MAX_LENGTH)
    assertValidOptionalString(game.label, GAME_FIELD_MAX_LENGTH)
    if (game.ruleWeight !== undefined && game.ruleWeight !== null && !Number.isFinite(game.ruleWeight)) {
      throw new Error(ERROR_FIELD_TOO_LONG)
    }
  }
}

export async function savePensionPurchaseTicket(
  db: D1Database,
  input: SavePensionPurchaseInput,
): Promise<SavePensionPurchaseSummary> {
  if (!input.deviceId || typeof input.deviceId !== 'string') throw new Error(ERROR_DEVICE_REQUIRED)
  if (input.deviceId.length > DEVICE_ID_MAX_LENGTH) throw new Error(ERROR_FIELD_TOO_LONG)
  assertValidOptionalString(input.algorithm, ALGORITHM_MAX_LENGTH)
  assertValidPensionGames(input.games)

  const latestDrawNo = await getLatestStoredPensionDrawNo(db)
  if (latestDrawNo === 0) throw new Error(ERROR_EMPTY_HISTORY)

  const drawNo = latestDrawNo + 1
  const ticketId = crypto.randomUUID()

  await insertPensionPurchaseGamesQuery(db, {
    ticketId,
    deviceId: input.deviceId,
    drawNo,
    algorithm: input.algorithm ?? null,
    createdAt: new Date().toISOString(),
    games: input.games,
  })

  return { ticketId, drawNo }
}

function normalizeSixDigits(value: string) {
  return value.padStart(6, '0').slice(-6)
}

function toPensionGameResult(row: PensionPurchaseJoinedRow): PensionPurchaseGameResult {
  const base = {
    gameIndex: row.game_index,
    number: row.number,
    ruleId: row.rule_id,
    label: row.label,
    ruleWeight: row.rule_weight,
  }

  if (row.winning_number === null) {
    return { ...base, suffixMatches: null, prizeCounts: null, bonusMatched: null, topRank: null }
  }

  const suffixMatches = longestSuffixMatch(row.number, row.winning_number)
  const prizeCounts = getPensionPrizeCounts(suffixMatches)
  const bonusMatched = row.bonus_number !== null
    && normalizeSixDigits(row.number) === normalizeSixDigits(row.bonus_number)

  return {
    ...base,
    suffixMatches,
    prizeCounts,
    bonusMatched,
    topRank: getPensionTopRank(prizeCounts),
  }
}

export async function listPensionPurchaseTickets(db: D1Database): Promise<PensionPurchaseListSummary> {
  const rows = await getPensionPurchasesWithResultsQuery(db)
  const tickets: PensionPurchaseTicket[] = []
  const byTicket = new Map<string, PensionPurchaseTicket>()

  for (const row of rows) {
    let ticket = byTicket.get(row.ticket_id)
    if (!ticket) {
      const judged = row.winning_number !== null
      ticket = {
        ticketId: row.ticket_id,
        drawNo: row.draw_no,
        algorithm: row.algorithm,
        createdAt: row.created_at,
        status: judged ? 'judged' : 'pending',
        draw: judged
          ? {
              drawNo: row.draw_no,
              winningBand: row.winning_band as string,
              winningNumber: row.winning_number as string,
              bonusNumber: row.bonus_number as string,
              drawDate: row.draw_date as string,
            }
          : null,
        games: [],
      }
      byTicket.set(row.ticket_id, ticket)
      tickets.push(ticket)
    }
    ticket.games.push(toPensionGameResult(row))
  }

  return { tickets }
}

export async function deletePensionPurchaseTicket(db: D1Database, ticketId: string) {
  const deleted = await deletePensionPurchaseTicketQuery(db, ticketId)
  return deleted > 0
}
