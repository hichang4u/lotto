import { Hono } from 'hono'
import {
  deletePensionPurchaseTicket,
  generatePensionSets,
  getPensionResultByDrawNo,
  getRecentPensionResults,
  listPensionPurchaseTickets,
  PENSION_PURCHASE_VALIDATION_ERRORS,
  runPensionBacktestFromDb,
  savePensionPurchaseTicket,
  syncPensionResults,
} from '../services/pension'
import type { Bindings } from '../types/app'
import { notFound, withRouteErrorHandling } from '../utils/route-handler'

export function createPensionRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/sync', withRouteErrorHandling(async (c) => {
      const requestedLimit = Number(c.req.query('limit') ?? 0)
      const safeLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 100)
        : 0

      const result = await syncPensionResults(c.env.DB, safeLimit)
      return c.json({ success: true, ...result })
    }, {
      logLabel: 'Error in /api/pension/sync',
      errorBody: (message) => ({ success: false, error: message }),
    }))

  app.get('/results', withRouteErrorHandling(async (c) => {
      const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
      const drawNo = c.req.query('drawNo')

      if (drawNo) {
        const row = await getPensionResultByDrawNo(c.env.DB, Number(drawNo))

        if (!row) {
          return notFound(c, '해당 연금복권 회차 데이터가 없습니다.')
        }

        return c.json(row)
      }

      return c.json(await getRecentPensionResults(c.env.DB, limit))
    }))

  app.post('/generate', withRouteErrorHandling(async (c) => {
      return c.json(await generatePensionSets(c.env.DB))
    }))

  app.get('/generate/backtest', withRouteErrorHandling(async (c) => {
      const lookback = Math.min(Math.max(Number(c.req.query('draws') ?? 100), 20), 240)
      return c.json(await runPensionBacktestFromDb(c.env.DB, lookback))
    }, {
      errorStatus: (_error, message) => message === '연금복권 백테스트에 필요한 데이터가 부족합니다.' ? 400 : 500,
    }))

  app.post('/purchases', withRouteErrorHandling(async (c) => {
      let body
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: '요청 본문이 올바르지 않습니다.' }, 400)
      }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return c.json({ error: '요청 본문이 올바르지 않습니다.' }, 400)
      }
      const result = await savePensionPurchaseTicket(c.env.DB, body)
      return c.json({ success: true, ...result })
    }, {
      errorStatus: (_error, message) => PENSION_PURCHASE_VALIDATION_ERRORS.includes(message) ? 400 : 500,
    }))

  app.get('/purchases', withRouteErrorHandling(async (c) => {
      return c.json(await listPensionPurchaseTickets(c.env.DB))
    }, {
      errorStatus: (_error, message) => PENSION_PURCHASE_VALIDATION_ERRORS.includes(message) ? 400 : 500,
    }))

  app.delete('/purchases/:ticketId', withRouteErrorHandling(async (c) => {
      const removed = await deletePensionPurchaseTicket(c.env.DB, c.req.param('ticketId'))
      if (!removed) return notFound(c, '해당 구매 기록이 없습니다.')
      return c.json({ success: true })
    }, {
      errorStatus: (_error, message) => PENSION_PURCHASE_VALIDATION_ERRORS.includes(message) ? 400 : 500,
    }))

  return app
}
