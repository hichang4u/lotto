# 로또 구매번호 관리 (구매 티켓 + 자동 당첨 확인) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 추천 5세트를 로또 구매용지 형태의 티켓으로 D1에 저장하고, 당첨번호 동기화 시 자동 판정하여 등수를 알려주는 기능.

**Architecture:** 백엔드는 기존 `route → service → query` 레이어를 따라 `lotto_purchases` 테이블 + API 3개(저장/조회/삭제)를 추가하고, 조회 API가 `lotto_history`와 LEFT JOIN하여 등수 판정까지 계산해 반환한다(판정 로직은 백테스트의 `getPrizeTier` 재사용). 프론트는 익명 기기 ID(localStorage UUID)로 자신의 기록을 식별하며, 티켓 모달·구매 기록 섹션·동기화 후 판정 알림을 로또 페이지에 추가한다.

**Tech Stack:** Cloudflare Workers(Hono) + D1, React + Vite + Tailwind v4 (네오 브루탈리즘 유틸 클래스), TypeScript strict + noUnusedLocals.

**Spec:** `docs/superpowers/specs/2026-07-19-lotto-purchase-tracking-design.md`

## Global Constraints

- 등수 판정 단일 소스: `getPrizeTier(matches, hasBonus)` — 3개=5등, 4개=4등, 5개=3등, 5개+보너스=2등, 6개=1등. 구매 판정과 백테스트가 같은 함수를 import해야 한다.
- 매칭 키: `lotto_purchases.draw_no` ↔ `lotto_history.drwNo`(PK). 대상 회차는 **서버가** `MAX(drwNo)+1`로 계산한다(클라이언트 값 무시).
- POST 검증: games는 정확히 5개, 각 게임은 1~45 범위 중복 없는 정수 6개. `lotto_history`가 비어 있으면 400 + `먼저 당첨번호를 동기화해주세요.`
- API 응답의 게임 `rank`: 1~5 = 등수, 0 = 낙첨, null = 추첨 전(pending). `status`는 `'pending' | 'judged'`.
- 정렬: 회차 내림차순 → 같은 회차 내 저장 시각 내림차순 → 게임 인덱스 오름차순.
- 서버는 `device_id` 불일치 데이터를 반환/삭제하지 않는다.
- 폴백(로컬 랜덤) 세트 구매 시 `algorithm`/`ruleId`/`ruleWeight`는 null.
- 사용자 노출 문구(그대로 사용): confirm `제 {N}회 추첨 대상으로 5게임을 저장할까요?` / 저장 토스트 `구매번호 저장 완료 (제 {N}회)` / 전낙첨 토스트 `제 {N}회 구매번호: 아쉽지만 모두 낙첨입니다.`
- 프론트 스타일: 기존 네오 브루탈리즘 유틸(`neo-card`, `neo-btn`, `neo-badge`, `border-3 border-black`, hard shadow) 재사용. Tailwind v4 문법.
- `tsconfig`의 `noUnusedLocals`가 전역 활성화 — 사용하지 않는 import/변수를 남기면 typecheck가 실패한다.
- 모든 태스크 완료 조건에 루트 `npm run typecheck` 통과 포함.
- 백엔드에 테스트 프레임워크가 없다 — 검증은 wrangler dev(로컬 D1) 대상 curl 시나리오와 typecheck로 수행한다. 새 테스트 프레임워크를 도입하지 말 것.

---

## File Structure

**Backend (생성):**

- `backend/src/types/lotto/purchases.ts` — 구매 관련 타입 전부
- `backend/src/queries/lotto/purchases.ts` — INSERT(batch) / JOIN 조회 / 삭제 쿼리
- `backend/src/services/lotto-purchases.ts` — 검증·회차 계산·판정·그룹핑 로직

**Backend (수정):**

- `backend/schema.sql` — `lotto_purchases` 테이블 + 인덱스
- `backend/src/algorithms/lotto.ts` — `getPrizeTier` 이동(export)
- `backend/src/services/lotto-backtest.ts` — 로컬 `getPrizeTier` 제거, import로 대체
- `backend/src/types/lotto/index.ts`, `backend/src/queries/lotto/index.ts`, `backend/src/services/lotto.ts` — re-export 추가
- `backend/src/routes/lotto.ts` — `/purchases` 라우트 3개

**Frontend (생성):**

- `frontend/src/utils/device.ts` — 기기 ID 발급/보관
- `frontend/src/hooks/usePurchases.ts` — 구매 목록/저장/삭제/동기화 후 판정 감지
- `frontend/src/components/lotto/PurchaseTicketModal.tsx` — A~E 티켓 모달
- `frontend/src/components/lotto/PurchaseHistorySection.tsx` — 내 구매 기록 섹션

**Frontend (수정):**

- `frontend/src/constants/index.ts` — `DEVICE_ID_STORAGE_KEY`
- `frontend/src/types/index.ts` — 구매 타입 미러링
- `frontend/src/hooks/useLottoPage.ts` — 생성 응답의 `algorithm` 보관·노출, `latestDrawNo` 노출
- `frontend/src/components/lotto/LottoPage.tsx` — 구매 버튼·모달·기록 섹션·동기화 알림 배선

---

### Task 1: D1 스키마 + 판정 함수 공용화 + 구매 타입/쿼리 (backend)

**Files:**

- Modify: `backend/schema.sql`
- Modify: `backend/src/algorithms/lotto.ts` (파일 끝에 함수 추가)
- Modify: `backend/src/services/lotto-backtest.ts:11-19` (로컬 `getPrizeTier` 제거)
- Create: `backend/src/types/lotto/purchases.ts`
- Modify: `backend/src/types/lotto/index.ts`
- Create: `backend/src/queries/lotto/purchases.ts`
- Modify: `backend/src/queries/lotto/index.ts`

**Interfaces:**

- Consumes: `PurchaseJoinedRow` 컬럼명은 `lotto_history` 실제 컬럼(`drwNoDate`, `drwtNo1`~`drwtNo6`, `bnusNo`)과 일치해야 함.
- Produces (Task 2가 사용):
  - `getPrizeTier(matches: number, hasBonus: boolean): number | null` — `algorithms/lotto.ts`에서 export
  - `insertPurchaseGamesQuery(db, params: InsertPurchaseParams): Promise<void>`
  - `getPurchasesWithResultsQuery(db, deviceId: string): Promise<PurchaseJoinedRow[]>`
  - `deletePurchaseTicketQuery(db, ticketId: string, deviceId: string): Promise<number>` (삭제된 행 수)
  - 타입: `PurchaseGameInput`, `SavePurchaseInput`, `InsertPurchaseParams`, `PurchaseJoinedRow`, `PurchaseGameResult`, `PurchaseTicket`, `PurchaseListSummary`, `SavePurchaseSummary`

- [ ] **Step 1: schema.sql에 테이블 추가**

`backend/schema.sql` 파일 끝에 추가:

```sql
CREATE TABLE IF NOT EXISTS lotto_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  draw_no INTEGER NOT NULL,
  game_index INTEGER NOT NULL,
  numbers TEXT NOT NULL,
  rule_id TEXT,
  label TEXT,
  algorithm TEXT,
  rule_weight REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_device ON lotto_purchases(device_id, draw_no);
```

- [ ] **Step 2: 로컬 D1에 스키마 적용**

Run: `cd backend && npm run init-db`
Expected: `Executed N commands` 형태의 성공 출력 (IF NOT EXISTS이므로 기존 테이블 무해).

- [ ] **Step 3: getPrizeTier를 algorithms/lotto.ts로 이동**

`backend/src/algorithms/lotto.ts` 파일 끝에 추가:

```ts
// 일치 수 + 보너스 → 등수 (해당 없으면 null). 백테스트와 구매 판정의 단일 소스.
export function getPrizeTier(matches: number, hasBonus: boolean): number | null {
  if (matches === 6) return 1
  if (matches === 5 && hasBonus) return 2
  if (matches === 5) return 3
  if (matches === 4) return 4
  if (matches === 3) return 5
  return null
}
```

`backend/src/services/lotto-backtest.ts`에서 로컬 정의(11~19행)를 삭제하고 import에 추가:

```ts
import { buildGeneratedSets, buildRuleWeights, countMatches, getPrizeTier, LOTTO_ALGORITHM_VERSION, SET_CONFIGS } from '../algorithms/lotto'
```

- [ ] **Step 4: 구매 타입 파일 생성**

`backend/src/types/lotto/purchases.ts`:

```ts
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
```

`backend/src/types/lotto/index.ts`에 추가:

```ts
export type {
  InsertPurchaseParams,
  PurchaseGameInput,
  PurchaseGameResult,
  PurchaseJoinedRow,
  PurchaseListSummary,
  PurchaseTicket,
  SavePurchaseInput,
  SavePurchaseSummary,
} from './purchases'
```

- [ ] **Step 5: 구매 쿼리 파일 생성**

`backend/src/queries/lotto/purchases.ts`:

```ts
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

export async function getPurchasesWithResultsQuery(db: D1Database, deviceId: string) {
  const { results } = await db.prepare(
    `SELECT p.*, h.drwNoDate, h.drwtNo1, h.drwtNo2, h.drwtNo3, h.drwtNo4, h.drwtNo5, h.drwtNo6, h.bnusNo
     FROM lotto_purchases p
     LEFT JOIN lotto_history h ON h.drwNo = p.draw_no
     WHERE p.device_id = ?
     ORDER BY p.draw_no DESC, p.created_at DESC, p.game_index ASC`
  ).bind(deviceId).all<PurchaseJoinedRow>()
  return results
}

export async function deletePurchaseTicketQuery(db: D1Database, ticketId: string, deviceId: string) {
  const result = await db.prepare(
    'DELETE FROM lotto_purchases WHERE ticket_id = ? AND device_id = ?'
  ).bind(ticketId, deviceId).run()
  return result.meta.changes ?? 0
}
```

`backend/src/queries/lotto/index.ts`에 추가:

```ts
export { deletePurchaseTicketQuery, getPurchasesWithResultsQuery, insertPurchaseGamesQuery } from './purchases'
```

- [ ] **Step 6: typecheck**

Run: `npm run typecheck` (루트에서)
Expected: PASS (오류 0). `lotto-backtest.ts`에서 getPrizeTier 미사용/미정의 오류가 없어야 함.

- [ ] **Step 7: Commit**

```bash
git add backend/schema.sql backend/src/algorithms/lotto.ts backend/src/services/lotto-backtest.ts backend/src/types/lotto/purchases.ts backend/src/types/lotto/index.ts backend/src/queries/lotto/purchases.ts backend/src/queries/lotto/index.ts
git commit -m "feat: 로또 구매번호 스키마·타입·쿼리 추가 및 getPrizeTier 공용화"
```

---

### Task 2: 구매 서비스 — 저장·조회(판정)·삭제 (backend)

**Files:**

- Create: `backend/src/services/lotto-purchases.ts`
- Modify: `backend/src/services/lotto.ts`

**Interfaces:**

- Consumes (Task 1): `getPrizeTier`, `countMatches`(기존, `countMatches(numbers: number[], target: DrawNumbersRow): number`), `getLatestStoredLottoDrawNo(db): Promise<number>`(빈 DB면 0), Task 1의 쿼리 3개와 타입들.
- Produces (Task 3이 사용):
  - `savePurchaseTicket(db: D1Database, input: SavePurchaseInput): Promise<SavePurchaseSummary>`
  - `listPurchaseTickets(db: D1Database, deviceId: string): Promise<PurchaseListSummary>`
  - `deletePurchaseTicket(db: D1Database, ticketId: string, deviceId: string): Promise<boolean>` (false = 일치 행 없음)
  - `PURCHASE_VALIDATION_ERRORS: string[]` — 라우트가 400 판별에 사용

- [ ] **Step 1: 서비스 파일 생성**

`backend/src/services/lotto-purchases.ts`:

```ts
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

// 라우트에서 400 응답 판별용
export const PURCHASE_VALIDATION_ERRORS = [
  ERROR_DEVICE_REQUIRED,
  ERROR_GAME_COUNT,
  ERROR_INVALID_NUMBERS,
  ERROR_EMPTY_HISTORY,
]

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
  }
}

export async function savePurchaseTicket(db: D1Database, input: SavePurchaseInput): Promise<SavePurchaseSummary> {
  if (!input.deviceId || typeof input.deviceId !== 'string') throw new Error(ERROR_DEVICE_REQUIRED)
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
```

- [ ] **Step 2: 서비스 배럴에 export 추가**

`backend/src/services/lotto.ts`에 추가:

```ts
export { deletePurchaseTicket, listPurchaseTickets, PURCHASE_VALIDATION_ERRORS, savePurchaseTicket } from './lotto-purchases'
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck` (루트)
Expected: PASS. 특히 `countMatches` 두 번째 인자가 `DrawNumbersRow`(bnusNo optional)와 호환되는지 확인 — 오류가 나면 `countMatches`의 실제 시그니처(`backend/src/algorithms/lotto.ts`)에 맞춰 target 객체 구성을 수정한다.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/lotto-purchases.ts backend/src/services/lotto.ts
git commit -m "feat: 구매 티켓 저장·판정 조회·삭제 서비스 구현"
```

---

### Task 3: 구매 API 라우트 + 로컬 시나리오 검증 (backend)

**Files:**

- Modify: `backend/src/routes/lotto.ts`

**Interfaces:**

- Consumes (Task 2): `savePurchaseTicket`, `listPurchaseTickets`, `deletePurchaseTicket`, `PURCHASE_VALIDATION_ERRORS`. 기존 `withRouteErrorHandling`, `notFound`.
- Produces (Task 4~6이 사용): HTTP API
  - `POST /api/purchases` body `{deviceId, algorithm, games:[{numbers, ruleId, label, ruleWeight}]}` → `{success: true, ticketId, drawNo}` / 검증 실패 400 `{error}`
  - `GET /api/purchases?deviceId=...` → `{tickets: PurchaseTicket[]}`
  - `DELETE /api/purchases/:ticketId?deviceId=...` → `{success: true}` / 404 `{error}`

- [ ] **Step 1: 라우트 추가**

`backend/src/routes/lotto.ts` — import 블록에 추가:

```ts
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
```

`app.post('/generate', ...)` 아래에 추가:

```ts
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
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck` (루트)
Expected: PASS.

- [ ] **Step 3: 로컬 검증 준비 — 판정 시나리오용 과거 회차 데이터 삽입**

wrangler dev는 로컬 D1을 사용한다. 판정 검증을 위해 이미 결과가 있는 회차(9999)와 그 이전 최신 회차를 만든다:

```bash
cd backend
npx wrangler d1 execute lotto_db --local --command "DELETE FROM lotto_purchases; INSERT OR REPLACE INTO lotto_history (drwNo, drwNoDate, drwtNo1, drwtNo2, drwtNo3, drwtNo4, drwtNo5, drwtNo6, bnusNo, firstWinamnt) VALUES (9999, '2026-07-18', 1, 2, 3, 4, 5, 6, 7, 0);"
```

Expected: 성공 출력. (drwNo 9999가 `MAX(drwNo)`가 되어, 저장하면 대상 회차 10000 = pending. 판정 검증은 Step 5에서 draw_no를 9999로 강제 업데이트하여 수행.)

- [ ] **Step 4: dev 서버 기동 후 저장/조회 pending 검증**

터미널 1: `cd backend && npm run dev` (포트 8787)
터미널 2:

```bash
curl -s -X POST http://localhost:8787/api/purchases -H "Content-Type: application/json" -d '{"deviceId":"test-device","algorithm":"v4.0","games":[{"numbers":[1,2,3,4,5,6],"ruleId":"odd-balance","label":"홀짝 균형형","ruleWeight":0.9},{"numbers":[7,8,9,10,11,12]},{"numbers":[13,14,15,16,17,18]},{"numbers":[19,20,21,22,23,24]},{"numbers":[25,26,27,28,29,30]}]}'
```

Expected: `{"success":true,"ticketId":"<uuid>","drawNo":10000}`

```bash
curl -s "http://localhost:8787/api/purchases?deviceId=test-device"
```

Expected: `tickets[0].status == "pending"`, `draw == null`, 게임 5개 모두 `matches/hasBonus/rank == null`.

검증(400) 케이스:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/api/purchases -H "Content-Type: application/json" -d '{"deviceId":"test-device","games":[{"numbers":[1,2,3,4,5,6]}]}'
```

Expected: `400`

- [ ] **Step 5: 판정(judged) 검증 — draw_no를 결과 있는 회차로 강제 변경**

```bash
npx wrangler d1 execute lotto_db --local --command "UPDATE lotto_purchases SET draw_no = 9999;"
curl -s "http://localhost:8787/api/purchases?deviceId=test-device"
```

Expected:

- `tickets[0].status == "judged"`, `draw.numbers == [1,2,3,4,5,6]`, `draw.bnusNo == 7`
- A게임 `[1,2,3,4,5,6]` → `matches: 6, rank: 1`
- B게임 `[7,8,9,10,11,12]` → `matches: 0, hasBonus: true, rank: 0`
- 나머지 게임 → `matches: 0, rank: 0`

삭제 검증 (위 조회 응답의 ticketId 사용):

```bash
curl -s -X DELETE "http://localhost:8787/api/purchases/<ticketId>?deviceId=other-device" -w "\n%{http_code}"   # 404 (device 불일치)
curl -s -X DELETE "http://localhost:8787/api/purchases/<ticketId>?deviceId=test-device" -w "\n%{http_code}"   # {"success":true} 200
curl -s "http://localhost:8787/api/purchases?deviceId=test-device"                                             # {"tickets":[]}
```

- [ ] **Step 6: 테스트 데이터 정리**

```bash
npx wrangler d1 execute lotto_db --local --command "DELETE FROM lotto_history WHERE drwNo = 9999; DELETE FROM lotto_purchases;"
```

Expected: 성공. dev 서버 종료.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/lotto.ts
git commit -m "feat: 구매번호 저장·조회·삭제 API 라우트 추가"
```

---

### Task 4: 프론트 기반 — 기기 ID·타입·usePurchases 훅·algorithm 보관 (frontend)

**Files:**

- Modify: `frontend/src/constants/index.ts`
- Create: `frontend/src/utils/device.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/hooks/useLottoPage.ts`
- Create: `frontend/src/hooks/usePurchases.ts`

**Interfaces:**

- Consumes (Task 3): HTTP API 3개.
- Produces (Task 5·6이 사용):
  - `getDeviceId(): string` (`utils/device.ts`)
  - 타입 `PurchaseGameResult`, `PurchaseTicket` (`types/index.ts`)
  - `useLottoPage()` 반환에 추가: `algorithm: string | null`, `latestDrawNo: number` (0 = 데이터 없음)
  - `usePurchases()` 반환:
    - `tickets: PurchaseTicket[]`, `purchasesLoading: boolean`, `saving: boolean`
    - `loadPurchases(): Promise<PurchaseTicket[]>`
    - `savePurchase(algorithm: string | null, sets: LottoSet[]): Promise<{ticketId: string; drawNo: number} | null>` (실패 시 null)
    - `deleteTicket(ticketId: string): Promise<boolean>`
    - `refreshAfterSync(): Promise<PurchaseTicket[]>` (직전 pending → 이번에 judged 된 티켓 목록)
  - `summarizeTicketResult(ticket: PurchaseTicket): string` (`usePurchases.ts`에서 export)

- [ ] **Step 1: 상수·기기 ID 유틸**

`frontend/src/constants/index.ts`의 스토리지 키 블록에 추가:

```ts
export const DEVICE_ID_STORAGE_KEY = 'lotto-device-id';
```

`frontend/src/utils/device.ts` 생성:

```ts
import { DEVICE_ID_STORAGE_KEY } from '../constants';

// 로그인 없이 이 브라우저의 구매 기록을 식별하는 익명 ID
export function getDeviceId(): string {
    const saved = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
}
```

- [ ] **Step 2: 프론트 타입 미러링**

`frontend/src/types/index.ts`의 `LottoSet` 아래에 추가:

```ts
export type PurchaseGameResult = {
    gameIndex: number;
    numbers: number[];
    ruleId: string | null;
    label: string | null;
    ruleWeight: number | null;
    matches: number | null;
    hasBonus: boolean | null;
    rank: number | null;
};

export type PurchaseTicket = {
    ticketId: string;
    drawNo: number;
    algorithm: string | null;
    createdAt: string;
    status: 'pending' | 'judged';
    draw: {
        drwNo: number;
        numbers: number[];
        bnusNo: number;
        drwNoDate: string;
    } | null;
    games: PurchaseGameResult[];
};
```

- [ ] **Step 3: useLottoPage에 algorithm·latestDrawNo 노출**

`frontend/src/hooks/useLottoPage.ts` 수정:

상태 추가 (`const [loading, setLoading] = useState(false);` 아래):

```ts
    const [algorithm, setAlgorithm] = useState<string | null>(null);
```

`generateNumbers`의 성공 경로(`setRuleWeights(...)` 다음 줄)에 추가:

```ts
            setAlgorithm(typeof data.algorithm === 'string' ? data.algorithm : null);
```

`generateNumbers`의 catch(폴백) 경로(`setRuleWeights([]);` 다음 줄)에 추가:

```ts
            setAlgorithm(null);
```

파생 상태 영역의 `const maxDrawNo = results[0]?.drwNo ?? 0;`는 이미 존재 — return 객체 state 부분에 추가:

```ts
        algorithm,
        latestDrawNo: maxDrawNo,
```

- [ ] **Step 4: usePurchases 훅 생성**

`frontend/src/hooks/usePurchases.ts`:

```ts
import { useState } from 'react';
import type { LottoSet, PurchaseTicket } from '../types';
import { API_URL } from '../constants';
import { getDeviceId } from '../utils/device';

// 판정 완료 티켓의 결과 요약 문구 (동기화 알림·기록 표시에 사용)
export function summarizeTicketResult(ticket: PurchaseTicket): string {
    const judged = ticket.games.filter(game => game.rank !== null);
    const rankCounts = new Map<number, number>();
    let lossCount = 0;
    for (const game of judged) {
        if (game.rank && game.rank >= 1) {
            rankCounts.set(game.rank, (rankCounts.get(game.rank) ?? 0) + 1);
        } else {
            lossCount += 1;
        }
    }

    if (rankCounts.size === 0) {
        return `제 ${ticket.drawNo}회 구매번호: 아쉽지만 모두 낙첨입니다.`;
    }

    const parts = [1, 2, 3, 4, 5]
        .filter(rank => (rankCounts.get(rank) ?? 0) > 0)
        .map(rank => `${rank}등 ${rankCounts.get(rank)}게임`);
    if (lossCount > 0) parts.push(`낙첨 ${lossCount}게임`);
    return `제 ${ticket.drawNo}회 구매번호 결과: ${parts.join(', ')}`;
}

export function usePurchases() {
    const [tickets, setTickets] = useState<PurchaseTicket[]>([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadPurchases = async (): Promise<PurchaseTicket[]> => {
        setPurchasesLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/purchases?deviceId=${encodeURIComponent(getDeviceId())}`);
            if (!res.ok) return tickets;
            const data = (await res.json()) as { tickets?: PurchaseTicket[] };
            const next = Array.isArray(data.tickets) ? data.tickets : [];
            setTickets(next);
            return next;
        } catch {
            return tickets;
        } finally {
            setPurchasesLoading(false);
        }
    };

    const savePurchase = async (algorithm: string | null, sets: LottoSet[]) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/purchases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: getDeviceId(),
                    algorithm,
                    games: sets.map(set => ({
                        numbers: set.numbers,
                        ruleId: set.meta?.ruleId ?? null,
                        label: set.label,
                        ruleWeight: set.meta?.ruleWeight ?? null,
                    })),
                }),
            });
            if (!res.ok) return null;
            const data = (await res.json()) as { ticketId: string; drawNo: number };
            await loadPurchases();
            return data;
        } catch {
            return null;
        } finally {
            setSaving(false);
        }
    };

    const deleteTicket = async (ticketId: string) => {
        try {
            const res = await fetch(
                `${API_URL}/api/purchases/${ticketId}?deviceId=${encodeURIComponent(getDeviceId())}`,
                { method: 'DELETE' },
            );
            if (!res.ok) return false;
            await loadPurchases();
            return true;
        } catch {
            return false;
        }
    };

    // 동기화 직후 호출: 이번 재조회로 pending → judged 로 바뀐 티켓들을 돌려준다
    const refreshAfterSync = async (): Promise<PurchaseTicket[]> => {
        const prevPending = new Set(
            tickets.filter(ticket => ticket.status === 'pending').map(ticket => ticket.ticketId),
        );
        const next = await loadPurchases();
        return next.filter(ticket => prevPending.has(ticket.ticketId) && ticket.status === 'judged');
    };

    return {
        tickets,
        purchasesLoading,
        saving,
        loadPurchases,
        savePurchase,
        deleteTicket,
        refreshAfterSync,
    };
}
```

- [ ] **Step 5: typecheck**

Run: `npm run typecheck` (루트)
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/constants/index.ts frontend/src/utils/device.ts frontend/src/types/index.ts frontend/src/hooks/useLottoPage.ts frontend/src/hooks/usePurchases.ts
git commit -m "feat: 기기 ID·구매 타입·usePurchases 훅 및 algorithm 상태 보관"
```

---

### Task 5: 티켓 모달 + 구매 버튼 (frontend)

**Files:**

- Create: `frontend/src/components/lotto/PurchaseTicketModal.tsx`
- Modify: `frontend/src/components/lotto/LottoPage.tsx`

**Interfaces:**

- Consumes (Task 4): `useLottoPage`의 `algorithm`, `latestDrawNo`; `usePurchases`의 `savePurchase`, `saving`, `loadPurchases`; 기존 `Ball`, `LOTTO_RULE_LABELS`.
- Produces (Task 6이 이어서 수정): `LottoPage` 내 `usePurchases()` 인스턴스와 모달 상태.

- [ ] **Step 1: 티켓 모달 컴포넌트 생성**

`frontend/src/components/lotto/PurchaseTicketModal.tsx`:

```tsx
import { X } from 'lucide-react';
import type { LottoSet } from '../../types';
import { LOTTO_RULE_LABELS } from '../../constants';
import { Ball } from '../ui/Ball';

const GAME_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// 실제 로또 구매용지처럼 A~E 5게임을 한 장으로 보여주는 모달
export function PurchaseTicketModal({
    sets,
    targetDrawNo,
    saving,
    onSave,
    onClose,
}: {
    sets: LottoSet[];
    targetDrawNo: number;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            role="dialog"
            aria-modal="true"
            aria-label="구매 티켓"
            onClick={onClose}
        >
            <div
                className="neo-card w-full max-w-lg bg-white px-5 py-6 sm:px-7"
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b-2 border-black pb-4">
                    <div>
                        <span className="neo-badge neo-badge-yellow">구매 티켓</span>
                        <h3 className="mt-2 text-xl font-black text-black sm:text-2xl">
                            제 {targetDrawNo}회 추첨
                        </h3>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                            아래 5게임이 한 장의 티켓으로 저장됩니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="neo-btn inline-flex h-9 w-9 items-center justify-center p-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-4 space-y-2.5">
                    {sets.map((set, index) => {
                        const ruleName = set.meta?.ruleId
                            ? (LOTTO_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId)
                            : set.label;
                        return (
                            <div
                                key={index}
                                className="flex items-center gap-2.5 border-2 border-black bg-white rounded-xl px-3 py-2.5 shadow-[2px_2px_0px_0px_#000000]"
                            >
                                <span className="w-6 shrink-0 text-center text-base font-black text-black">
                                    {GAME_LETTERS[index]}
                                </span>
                                <div className="flex flex-1 items-center justify-center gap-1.5">
                                    {set.numbers.map(num => (
                                        <Ball key={num} num={num} size="sm" />
                                    ))}
                                </div>
                                <span className="hidden shrink-0 text-[10px] font-bold text-slate-500 sm:block">
                                    {ruleName}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-black pt-4">
                    <button type="button" onClick={onClose} className="neo-btn inline-flex h-10 px-4 text-sm">
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="neo-btn neo-btn-primary inline-flex h-10 px-5 text-sm disabled:opacity-60"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: LottoPage에 구매 버튼·모달 배선**

`frontend/src/components/lotto/LottoPage.tsx` 수정:

import 추가:

```tsx
import { useState } from 'react';
import { usePurchases } from '../../hooks/usePurchases';
import { PurchaseTicketModal } from './PurchaseTicketModal';
```

훅 사용부 — `useLottoPage()` 구조분해에 `algorithm`, `latestDrawNo` 추가. 그 아래에:

```tsx
    const { savePurchase, saving } = usePurchases();
    const [showTicketModal, setShowTicketModal] = useState(false);
    const targetDrawNo = latestDrawNo + 1;

    const handleSavePurchase = async () => {
        if (!window.confirm(`제 ${targetDrawNo}회 추첨 대상으로 5게임을 저장할까요?`)) return;
        const result = await savePurchase(algorithm, sets);
        if (result) {
            onSyncMessage(`구매번호 저장 완료 (제 ${result.drawNo}회)`);
            setShowTicketModal(false);
        } else {
            onSyncError('구매번호 저장에 실패했습니다.');
        }
    };
```

(noUnusedLocals가 전역 활성화되어 있으므로 이 태스크에서는 구조분해에 `savePurchase`, `saving`만 포함한다. `tickets`·`purchasesLoading`·`loadPurchases`·`deleteTicket`·`refreshAfterSync`는 Task 6에서 구조분해를 확장하며 추가한다.)

추천 세트 목록(`sets.length > 0` 분기)의 `</div>`(세트 목록 닫는 태그) 바로 다음, 즉 세트 목록 아래에 구매 버튼 추가:

```tsx
                    {sets.length > 0 && (
                        <div className="mt-5 flex justify-center">
                            <button
                                type="button"
                                onClick={() => setShowTicketModal(true)}
                                disabled={latestDrawNo === 0}
                                className="neo-btn neo-btn-secondary inline-flex h-11 px-6 text-sm font-black disabled:opacity-60"
                            >
                                이 번호로 구매
                            </button>
                        </div>
                    )}
```

컴포넌트 return 최상단 `<div className="space-y-10 sm:space-y-12">` 내부 맨 앞(모달은 fixed라 위치 무관, 첫 자식으로)에:

```tsx
            {showTicketModal && (
                <PurchaseTicketModal
                    sets={sets}
                    targetDrawNo={targetDrawNo}
                    saving={saving}
                    onSave={handleSavePurchase}
                    onClose={() => setShowTicketModal(false)}
                />
            )}
```

- [ ] **Step 3: typecheck + 빌드**

Run: `npm run typecheck` (루트), 이어서 `cd frontend && npm run build`
Expected: 둘 다 PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/lotto/PurchaseTicketModal.tsx frontend/src/components/lotto/LottoPage.tsx
git commit -m "feat: 구매 티켓 모달 및 구매 버튼 추가"
```

---

### Task 6: 내 구매 기록 섹션 + 동기화 판정 알림 + 시각 검증 (frontend)

**Files:**

- Create: `frontend/src/components/lotto/PurchaseHistorySection.tsx`
- Modify: `frontend/src/components/lotto/LottoPage.tsx`

**Interfaces:**

- Consumes (Task 4·5): `usePurchases`의 `tickets`/`purchasesLoading`/`loadPurchases`/`deleteTicket`/`refreshAfterSync`, `summarizeTicketResult`; 기존 `Ball`, `BonusBadge`, `SectionCard`, `formatDateTime`, `LOTTO_RULE_LABELS`.
- Produces: 완성된 UI 플로우.

- [ ] **Step 1: 구매 기록 섹션 컴포넌트 생성**

`frontend/src/components/lotto/PurchaseHistorySection.tsx`:

```tsx
import { Trash2 } from 'lucide-react';
import type { PurchaseGameResult, PurchaseTicket } from '../../types';
import { LOTTO_RULE_LABELS } from '../../constants';
import { formatDateTime } from '../../utils/format';
import { Ball, BonusBadge } from '../ui/Ball';

const GAME_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// 게임별 판정 배지: 추첨 전 / N등 / 낙첨
function GameRankBadge({ game }: { game: PurchaseGameResult }) {
    if (game.rank === null) {
        return <span className="neo-badge py-0.5 text-[10px]">추첨 전</span>;
    }
    if (game.rank >= 1) {
        return <span className="neo-badge neo-badge-yellow py-0.5 text-[10px]">{game.rank}등</span>;
    }
    return <span className="neo-badge py-0.5 text-[10px] text-slate-500">낙첨</span>;
}

function PurchaseGameRow({ game, draw }: { game: PurchaseGameResult; draw: PurchaseTicket['draw'] }) {
    const judged = game.rank !== null && draw !== null;
    const ruleName = game.ruleId ? (LOTTO_RULE_LABELS[game.ruleId] ?? game.ruleId) : game.label;

    return (
        <div className="flex items-center gap-2.5 border-b border-slate-200 py-2 last:border-b-0">
            <span className="w-5 shrink-0 text-center text-sm font-black text-black">
                {GAME_LETTERS[game.gameIndex] ?? game.gameIndex + 1}
            </span>
            <div className="flex flex-1 items-center gap-1.5">
                {game.numbers.map(num => {
                    // 판정 완료 시: 일치 볼만 원래 색, 불일치 볼은 회색조 + 반투명
                    const matched = judged && draw.numbers.includes(num);
                    const bonusMatched = judged && !matched && draw.bnusNo === num;
                    return (
                        <span
                            key={num}
                            className="relative inline-flex"
                            style={judged && !matched && !bonusMatched ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}
                        >
                            <Ball num={num} size="sm" />
                            {bonusMatched && <BonusBadge compact />}
                        </span>
                    );
                })}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <GameRankBadge game={game} />
                {ruleName && <span className="hidden text-[10px] font-bold text-slate-500 sm:block">{ruleName}</span>}
            </div>
        </div>
    );
}

export function PurchaseTicketCard({
    ticket,
    onDelete,
}: {
    ticket: PurchaseTicket;
    onDelete: (ticketId: string) => void;
}) {
    return (
        <div className="neo-card bg-white px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-black">제 {ticket.drawNo}회</span>
                    {ticket.status === 'pending' ? (
                        <span className="neo-badge neo-badge-blue py-0.5 text-[10px]">추첨 전</span>
                    ) : (
                        <span className="neo-badge neo-badge-purple py-0.5 text-[10px]">판정 완료</span>
                    )}
                    {ticket.algorithm && (
                        <span className="neo-badge py-0.5 text-[10px]">{ticket.algorithm}</span>
                    )}
                </div>
                <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-bold text-slate-500">
                        {formatDateTime(new Date(ticket.createdAt))}
                    </span>
                    <button
                        type="button"
                        aria-label="티켓 삭제"
                        onClick={() => onDelete(ticket.ticketId)}
                        className="neo-btn inline-flex h-8 w-8 items-center justify-center p-0"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="mt-2">
                {ticket.games.map(game => (
                    <PurchaseGameRow key={game.gameIndex} game={game} draw={ticket.draw} />
                ))}
            </div>

            {ticket.status === 'judged' && ticket.draw && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-600">
                    <span>당첨번호</span>
                    <span className="font-black text-black">{ticket.draw.numbers.join(', ')}</span>
                    <span>+ 보너스 {ticket.draw.bnusNo}</span>
                </div>
            )}
        </div>
    );
}

export function PurchaseHistorySection({
    tickets,
    loading,
    onDelete,
}: {
    tickets: PurchaseTicket[];
    loading: boolean;
    onDelete: (ticketId: string) => void;
}) {
    if (tickets.length === 0) {
        return (
            <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-10 text-center text-sm font-bold text-slate-700 shadow-[2px_2px_0px_0px_#000]">
                {loading ? '구매 기록을 불러오는 중입니다.' : '저장된 구매번호가 없습니다. 추천 번호를 생성한 뒤 "이 번호로 구매"를 눌러보세요.'}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {tickets.map(ticket => (
                <PurchaseTicketCard key={ticket.ticketId} ticket={ticket} onDelete={onDelete} />
            ))}
        </div>
    );
}
```

- [ ] **Step 2: LottoPage에 섹션·초기 로드·동기화 알림 배선**

`frontend/src/components/lotto/LottoPage.tsx` 수정:

import 추가/변경:

```tsx
import { useEffect, useState } from 'react';
import { Info, Search, Sparkles, Ticket } from 'lucide-react';
import { usePurchases, summarizeTicketResult } from '../../hooks/usePurchases';
import { PurchaseHistorySection } from './PurchaseHistorySection';
```

Task 5의 `usePurchases` 구조분해를 전체로 확장:

```tsx
    const { savePurchase, saving, tickets, purchasesLoading, loadPurchases, deleteTicket, refreshAfterSync } = usePurchases();
```

초기 구매 기록 로드 (`handleSync` 정의 근처):

```tsx
    useEffect(() => {
        loadPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
```

`handleSync`를 동기화 후 판정 알림 포함으로 교체:

```tsx
    const handleSync = () => syncLatestResults(
        async (msg) => {
            onSyncMessage(msg);
            // 동기화로 새 회차가 들어왔다면 pending 티켓이 판정됐는지 확인해 알림
            const newlyJudged = await refreshAfterSync();
            if (newlyJudged.length > 0) {
                onSyncMessage(newlyJudged.map(summarizeTicketResult).join(' / '));
            }
        },
        onSyncError,
    );
```

티켓 삭제 핸들러 추가:

```tsx
    const handleDeleteTicket = async (ticketId: string) => {
        if (!window.confirm('이 구매 기록을 삭제할까요?')) return;
        const ok = await deleteTicket(ticketId);
        if (!ok) onSyncError('구매 기록 삭제에 실패했습니다.');
    };
```

백테스트 섹션(`</section>` — 백테스트 진단 섹션 닫는 태그)과 footer 사이에 새 섹션 추가:

```tsx
            {/* 내 구매 기록 섹션 */}
            <section>
                <SectionCard
                    title="내 구매 기록"
                    eyebrow="구매번호 관리"
                    icon={<Ticket className="h-5 w-5" />}
                >
                    <p className="mb-4 text-sm font-bold text-slate-700">
                        저장한 구매번호는 이 브라우저 기준으로 보관되며, 당첨번호 동기화 시 자동으로 판정됩니다.
                    </p>
                    <PurchaseHistorySection
                        tickets={tickets}
                        loading={purchasesLoading}
                        onDelete={handleDeleteTicket}
                    />
                </SectionCard>
            </section>
```

(`SectionCard`의 `action` prop은 optional이므로 생략하면 된다.)

- [ ] **Step 3: typecheck + 빌드**

Run: `npm run typecheck` (루트), `cd frontend && npm run build`
Expected: 둘 다 PASS.

- [ ] **Step 4: 로컬 E2E 시나리오 + 스크린샷 검증**

터미널 1: 루트에서 `npm run dev` (백엔드 8787 + 프론트 5173 동시 기동).

브라우저 수동 또는 playwright로:

1. `http://localhost:5173/lotto` 접속 → "추천 번호 생성" → "이 번호로 구매" 클릭 → 티켓 모달에 A~E 5게임 + "제 N회 추첨" 표시 확인.
2. 저장 → confirm 수락 → 토스트 "구매번호 저장 완료 (제 N회)" → 하단 "내 구매 기록"에 pending 티켓(추첨 전 배지) 표시 확인.
3. 스크린샷 (스크래치패드의 기존 `shot.js` 사용):

   ```bash
   node C:/Users/kbays/AppData/Local/Temp/claude/c--Project-lotto/68dacd75-4c81-4815-a758-d41377ae8f7b/scratchpad/shot.js http://localhost:5173/lotto lotto-purchase-desktop.png 1280 1600
   node C:/Users/kbays/AppData/Local/Temp/claude/c--Project-lotto/68dacd75-4c81-4815-a758-d41377ae8f7b/scratchpad/shot.js http://localhost:5173/lotto lotto-purchase-mobile.png 390 1600
   ```

   Expected: 데스크톱·모바일 모두 레이아웃 깨짐 없음(가로 스크롤 없음, 볼 한 줄 유지).

4. 판정 표시 검증: Task 3 Step 5와 같은 방식으로 로컬 D1에서 `UPDATE lotto_purchases SET draw_no = (SELECT MAX(drwNo) FROM lotto_history);` 실행 후 새로고침 → 판정 완료 배지·등수/낙첨 배지·불일치 볼 회색 처리·당첨번호 행 표시 확인. 확인 후 `DELETE FROM lotto_purchases;`로 정리.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/lotto/PurchaseHistorySection.tsx frontend/src/components/lotto/LottoPage.tsx
git commit -m "feat: 내 구매 기록 섹션 및 동기화 시 자동 판정 알림 추가"
```

---

### Task 7: 프로덕션 D1 마이그레이션 + 배포 (컨트롤러/메인 세션 전용)

이 태스크는 프로덕션 자격 증명이 필요하므로 서브에이전트가 아닌 메인 세션에서 수행한다.

- [ ] **Step 1: 프로덕션 D1에 스키마 적용**

```bash
cd backend && npm run init-db:remote
```

Expected: 성공 (`schema.sql` 전체가 `IF NOT EXISTS`라 기존 테이블·데이터에 무해). `.env.production`의 토큰이 필요하면 wrangler가 안내하는 방식으로 환경변수 주입.

적용 확인:

```bash
npx wrangler d1 execute lotto_db --remote --command "SELECT name FROM sqlite_master WHERE name = 'lotto_purchases';"
```

Expected: `lotto_purchases` 1행.

- [ ] **Step 2: push → 자동 배포 → 프로덕션 확인**

```bash
git push origin main
```

GitHub Actions deploy 성공 확인 후:

```bash
curl -s "https://lotto-analysis-backend.kbaysin.workers.dev/api/purchases?deviceId=smoke-test"
```

Expected: `{"tickets":[]}` (200).
