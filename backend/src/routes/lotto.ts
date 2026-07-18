import { Hono } from 'hono'
import {
  deletePurchaseTicket,
  generateLottoSetsFromDb,
  getHotNumbersFromDb,
  getLottoResultByDrawNo,
  getRecentLottoResults,
  listPurchaseTickets,
  PURCHASE_VALIDATION_ERRORS,
  runLottoBacktestFromDb,
  savePurchaseTicket,
  syncLatestLottoResults,
} from '../services/lotto'
import type { Bindings } from '../types/app'
import { notFound, withRouteErrorHandling } from '../utils/route-handler'

export function createLottoRoutes() {
  const app = new Hono<{ Bindings: Bindings }>()

  app.post('/sync', withRouteErrorHandling(async (c) => {
      const result = await syncLatestLottoResults(c.env.DB)
      return c.json({ success: true, ...result })
    }, {
      errorBody: (message) => ({ success: false, error: message }),
    }))

  app.get('/results', withRouteErrorHandling(async (c) => {
      const limit = Math.min(Number(c.req.query('limit') ?? 10), 50)
      const drwNo = c.req.query('drwNo')

      if (drwNo) {
        const row = await getLottoResultByDrawNo(c.env.DB, Number(drwNo))
        if (!row) return notFound(c, '해당 회차 데이터가 없습니다.')
        return c.json(row)
      }

      return c.json(await getRecentLottoResults(c.env.DB, limit))
    }))

  app.get('/stats/hot', withRouteErrorHandling(async (c) => {
      return c.json(await getHotNumbersFromDb(c.env.DB))
    }))

  app.get('/generate/backtest', withRouteErrorHandling(async (c) => {
      const lookback = Math.min(Math.max(Number(c.req.query('draws') ?? 100), 20), 300)

      return c.json(await runLottoBacktestFromDb(c.env.DB, lookback))
    }, {
      errorStatus: (_error, message) => message === '백테스트에 필요한 데이터가 부족합니다.' ? 400 : 500,
    }))

  app.post('/generate', withRouteErrorHandling(async (c) => {
      return c.json(await generateLottoSetsFromDb(c.env.DB))
    }))

  app.post('/purchases', withRouteErrorHandling(async (c) => {
      const body = await c.req.json()
      const result = await savePurchaseTicket(c.env.DB, body)
      return c.json({ success: true, ...result })
    }, {
      errorStatus: (_error, message) => PURCHASE_VALIDATION_ERRORS.includes(message) ? 400 : 500,
    }))

  app.get('/purchases', withRouteErrorHandling(async (c) => {
      const deviceId = c.req.query('deviceId') ?? ''
      return c.json(await listPurchaseTickets(c.env.DB, deviceId))
    }, {
      errorStatus: (_error, message) => PURCHASE_VALIDATION_ERRORS.includes(message) ? 400 : 500,
    }))

  app.delete('/purchases/:ticketId', withRouteErrorHandling(async (c) => {
      const deviceId = c.req.query('deviceId') ?? ''
      const removed = await deletePurchaseTicket(c.env.DB, c.req.param('ticketId'), deviceId)
      if (!removed) return notFound(c, '해당 구매 기록이 없습니다.')
      return c.json({ success: true })
    }, {
      errorStatus: (_error, message) => PURCHASE_VALIDATION_ERRORS.includes(message) ? 400 : 500,
    }))

  return app
}
