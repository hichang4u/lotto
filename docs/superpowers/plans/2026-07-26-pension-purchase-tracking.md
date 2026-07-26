# 연금복권 구매번호 관리 (각조 티켓 저장 + 자동 판정) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연금복권 추천 4세트를 "각조(1~5조 전부) 구매" 티켓 한 장으로 D1에 저장하고, 당첨번호 동기화 시 등수별 매수까지 자동 판정해 알려주는 기능.

**Architecture:** 백엔드는 기존 `route → service → query` 레이어를 따라 `pension_purchases` 테이블 + API 3개(저장/조회/삭제)를 추가하고, 조회 API가 `pension720_draws`와 LEFT JOIN하여 판정까지 계산해 반환한다(판정 로직은 백테스트의 `longestSuffixMatch`를 `algorithms/pension.ts`로 공용화해 재사용). 프론트는 로또 구매 기능과 병렬 구조로 `usePensionPurchases` 훅 + 전용 모달/기록 섹션을 만들어 연금복권 페이지에 배선한다.

**Tech Stack:** Cloudflare Workers(Hono) + D1, React 19 + Vite + Tailwind v4 (네오 브루탈리즘 유틸 클래스), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-07-26-pension-purchase-tracking-design.md`

## Global Constraints

- **각조 구매 모델**: 저장하는 6자리 번호 하나는 "1~5조 전부 구매 = 5매"를 의미한다. 등수 판정은 항상 매수 단위로 집계한다.
- **판정 단일 소스**: `longestSuffixMatch(picked, winning)` + `getPensionPrizeCounts(suffixMatches)` — 두 함수 모두 `backend/src/algorithms/pension.ts`에 두고, 구매 판정과 백테스트가 같은 함수를 import해야 한다.
- **등수 매핑**: 끝자리 연속 일치 6 → `{1등: 1매, 2등: 4매}`, 1~5 → `{(8 - 일치자리수)등: 5매}` (5→3등, 4→4등, 3→5등, 2→6등, 1→7등), 0 → 낙첨(`{}`).
- **보너스**: 저장 번호가 `bonus_number` 6자리와 전장 일치하면 `보너스 5매`. 등수 판정과 **독립적으로 병기**한다(둘 다 표시).
- **매칭 키**: `pension_purchases.draw_no` ↔ `pension720_draws.draw_no`(PK). 대상 회차는 **서버가** `getLatestStoredPensionDrawNo() + 1`로 계산한다(클라이언트 값 무시).
- **POST 검증**: `games`는 정확히 4개, 각 `number`는 `/^\d{6}$/`. `pension720_draws`가 비어 있으면 400 + `먼저 당첨번호를 동기화해주세요.`
- **API 응답**: 게임의 `suffixMatches`/`prizeCounts`/`bonusMatched`/`topRank`는 추첨 전이면 전부 `null`. `topRank`는 가장 높은(숫자가 작은) 등수, 낙첨이면 `0`. `status`는 `'pending' | 'judged'`.
- **정렬**: `draw_no DESC, created_at DESC, game_index ASC`.
- **조회/삭제는 기기 구분 없이 전체** (로또 현행과 동일). `device_id`는 저장만 하고 필터링에 쓰지 않는다.
- **기기 ID**: 새 키를 만들지 말고 `frontend/src/utils/device.ts`의 `getDeviceId()`(`DEVICE_ID_STORAGE_KEY`)를 그대로 재사용한다.
- **사용자 노출 문구(그대로 사용)**: confirm `제 {N}회 추첨 대상으로 4세트를 각조 구매로 저장할까요?` / 저장 토스트 `구매번호 저장 완료 (제 {N}회)` / 삭제 confirm `이 구매 기록을 삭제할까요?` / 전낙첨 토스트 `제 {N}회 구매번호: 아쉽지만 모두 낙첨입니다.`
- **프론트 스타일**: 기존 네오 브루탈리즘 유틸(`neo-card`, `neo-btn`, `neo-badge`, `neo-badge-compact`, `border-3 border-black`, hard shadow) 재사용. 숫자 볼은 `PensionDigitBall`(`frontend/src/components/pension/PensionNumberDisplay.tsx`)을 재사용하고 새로 만들지 않는다.
- `tsconfig`의 `noUnusedLocals`가 전역 활성화 — 사용하지 않는 import/변수를 남기면 typecheck가 실패한다.
- 모든 태스크 완료 조건에 루트 `npm run typecheck` 통과 포함.
- **테스트 프레임워크가 없다** — 검증은 wrangler dev(로컬 D1) 대상 curl 시나리오와 typecheck, 브라우저 확인으로 수행한다. 새 테스트 프레임워크를 도입하지 말 것.
- 로또 구매 기능(`lotto_purchases`, `usePurchases`, `PurchaseTicketModal`, `PurchaseHistorySection`)은 **건드리지 않는다**. 공용 추상화로 묶지 말 것.

---

## File Structure

**Backend (생성):**

- `backend/src/types/pension/purchases.ts` — 연금 구매 관련 타입 전부
- `backend/src/queries/pension/purchases.ts` — INSERT(batch) / JOIN 조회 / 삭제 쿼리
- `backend/src/services/pension-purchases.ts` — 검증·회차 계산·판정·그룹핑 로직

**Backend (수정):**

- `backend/schema.sql` — `pension_purchases` 테이블 + 인덱스
- `backend/src/algorithms/pension.ts` — `longestSuffixMatch` 이관 + `getPensionPrizeCounts`/`getPensionTopRank`/`PENSION_BANDS_PER_TICKET` 신설
- `backend/src/services/pension-backtest.ts` — 로컬 `longestSuffixMatch` 제거, import로 대체
- `backend/src/types/pension/index.ts`, `backend/src/queries/pension/index.ts`, `backend/src/services/pension.ts` — re-export 추가
- `backend/src/routes/pension.ts` — `/purchases` 라우트 3개

**Frontend (생성):**

- `frontend/src/hooks/usePensionPurchases.ts` — 목록/저장/삭제/동기화 후 판정 감지 + 결과 요약
- `frontend/src/components/pension/PensionPurchaseTicketModal.tsx` — A~D 티켓 모달
- `frontend/src/components/pension/PensionPurchaseHistorySection.tsx` — 내 구매 기록 섹션

**Frontend (수정):**

- `frontend/src/constants/index.ts` — `PENSION_BANDS_PER_TICKET`
- `frontend/src/types/index.ts` — 연금 구매 타입 미러링
- `frontend/src/hooks/usePensionPage.ts` — 생성 응답의 `algorithm` 보관·노출, `maxDrawNo` 노출
- `frontend/src/components/pension/PensionPage.tsx` — 구매 버튼·모달·기록 섹션·동기화 알림 배선

---

### Task 1: D1 스키마 + 판정 함수 공용화 + 구매 타입/쿼리 (backend)

**Files:**

- Modify: `backend/schema.sql` (파일 끝에 추가)
- Modify: `backend/src/algorithms/pension.ts` (파일 끝에 추가)
- Modify: `backend/src/services/pension-backtest.ts:14-26` (로컬 `longestSuffixMatch` 제거)
- Create: `backend/src/types/pension/purchases.ts`
- Modify: `backend/src/types/pension/index.ts`
- Create: `backend/src/queries/pension/purchases.ts`
- Modify: `backend/src/queries/pension/index.ts`

**Interfaces:**

- Consumes: `pension720_draws` 실제 컬럼명 — `draw_no`, `draw_date`, `winning_band`, `winning_number`, `bonus_number`. `winning_number`와 `bonus_number`는 6자리 문자열(예: `"604270"`, `"945893"`), `winning_band`는 한 자리 문자열(예: `"4"`).
- Produces (Task 2가 사용):
  - `PENSION_BANDS_PER_TICKET: 5` — `algorithms/pension.ts`에서 export
  - `longestSuffixMatch(picked: string, winning: string): number` — `algorithms/pension.ts`에서 export
  - `getPensionPrizeCounts(suffixMatches: number): Record<number, number>`
  - `getPensionTopRank(prizeCounts: Record<number, number>): number`
  - `insertPensionPurchaseGamesQuery(db: D1Database, params: InsertPensionPurchaseParams): Promise<void>`
  - `getPensionPurchasesWithResultsQuery(db: D1Database): Promise<PensionPurchaseJoinedRow[]>`
  - `deletePensionPurchaseTicketQuery(db: D1Database, ticketId: string): Promise<number>` (삭제된 행 수)
  - 타입: `PensionPurchaseGameInput`, `SavePensionPurchaseInput`, `InsertPensionPurchaseParams`, `PensionPurchaseJoinedRow`, `PensionPurchaseGameResult`, `PensionPurchaseTicket`, `PensionPurchaseListSummary`, `SavePensionPurchaseSummary`

- [ ] **Step 1: schema.sql에 테이블 추가**

`backend/schema.sql` 파일 끝에 추가:

```sql

CREATE TABLE IF NOT EXISTS pension_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  draw_no INTEGER NOT NULL,
  game_index INTEGER NOT NULL,
  number TEXT NOT NULL,
  rule_id TEXT,
  label TEXT,
  algorithm TEXT,
  rule_weight REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pension_purchases_device ON pension_purchases(device_id, draw_no);
```

- [ ] **Step 2: 로컬 D1에 스키마 적용**

Run (from `backend/`): `npm run init-db`

Expected: `Executed N commands` 형태의 성공 출력. `schema.sql` 전체가 `IF NOT EXISTS`라 기존 테이블·데이터에 무해하다.

- [ ] **Step 3: 테이블 생성 확인**

Run (from `backend/`):

```bash
npx wrangler d1 execute lotto_db --local --command "SELECT name FROM sqlite_master WHERE name IN ('pension_purchases','idx_pension_purchases_device');"
```

Expected: `pension_purchases`와 `idx_pension_purchases_device` 두 행이 나온다.

- [ ] **Step 4: 판정 함수를 algorithms/pension.ts로 이관·추가**

`backend/src/algorithms/pension.ts` 파일 **끝에** 추가:

```ts
// 각조 구매 = 1~5조 전부 구매. 번호 하나당 5매를 보유한 것으로 판정한다.
export const PENSION_BANDS_PER_TICKET = 5

// 연금복권720+ 상금은 "뒤에서부터 연속 일치"로 결정된다 (끝 1자리=7등 … 6자리 전체=2등, 조까지=1등)
export function longestSuffixMatch(picked: string, winning: string) {
  const left = picked.padStart(6, '0').slice(-6)
  const right = winning.padStart(6, '0').slice(-6)

  let matches = 0
  for (let index = 5; index >= 0; index -= 1) {
    if (left[index] !== right[index]) break
    matches += 1
  }

  return matches
}

// 각조(5매) 기준 등수별 당첨 매수.
// 6자리 전장 일치면 당첨 조 1매가 1등, 나머지 4조가 2등. 1~5자리는 조와 무관하므로 5매 모두 당첨.
export function getPensionPrizeCounts(suffixMatches: number): Record<number, number> {
  if (suffixMatches >= 6) return { 1: 1, 2: PENSION_BANDS_PER_TICKET - 1 }
  if (suffixMatches >= 1) return { [8 - suffixMatches]: PENSION_BANDS_PER_TICKET }
  return {}
}

// 가장 높은 등수(숫자가 작을수록 높음). 낙첨이면 0.
export function getPensionTopRank(prizeCounts: Record<number, number>) {
  const ranks = Object.keys(prizeCounts).map(Number)
  return ranks.length === 0 ? 0 : Math.min(...ranks)
}
```

- [ ] **Step 5: pension-backtest.ts의 로컬 정의 제거**

`backend/src/services/pension-backtest.ts`의 상단 import를 다음으로 교체:

```ts
import {
  buildPensionRecommendations,
  buildPensionRuleWeights,
  longestSuffixMatch,
  PENSION_ALGORITHM_VERSION,
} from '../algorithms/pension'
```

그리고 같은 파일 14~26행의 주석 + `longestSuffixMatch` 함수 정의 블록을 **통째로 삭제**한다 (아래 블록):

```ts
// 연금복권720+ 상금은 "뒤에서부터 연속 일치"로 결정된다 (끝 1자리=7등 … 6자리 전체=2등, 조까지=1등)
export function longestSuffixMatch(picked: string, winning: string) {
  const left = picked.padStart(6, '0').slice(-6)
  const right = winning.padStart(6, '0').slice(-6)

  let matches = 0
  for (let index = 5; index >= 0; index -= 1) {
    if (left[index] !== right[index]) break
    matches += 1
  }

  return matches
}
```

`longestSuffixMatch`의 기존 외부 사용처는 없다(같은 파일 내 69·103행에서만 호출) — 삭제 후 import로 대체되므로 그대로 동작한다.

- [ ] **Step 6: 타입 파일 생성**

Create `backend/src/types/pension/purchases.ts`:

```ts
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
```

- [ ] **Step 7: 타입 배럴에 re-export 추가**

`backend/src/types/pension/index.ts` 파일 끝에 추가:

```ts
export type {
  InsertPensionPurchaseParams,
  PensionPurchaseGameInput,
  PensionPurchaseGameResult,
  PensionPurchaseJoinedRow,
  PensionPurchaseListSummary,
  PensionPurchaseTicket,
  SavePensionPurchaseInput,
  SavePensionPurchaseSummary,
} from './purchases'
```

- [ ] **Step 8: 쿼리 파일 생성**

Create `backend/src/queries/pension/purchases.ts`:

```ts
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
```

- [ ] **Step 9: 쿼리 배럴에 re-export 추가**

`backend/src/queries/pension/index.ts` 파일 끝에 추가:

```ts
export {
  deletePensionPurchaseTicketQuery,
  getPensionPurchasesWithResultsQuery,
  insertPensionPurchaseGamesQuery,
} from './purchases'
```

- [ ] **Step 10: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 에러 없이 종료(출력 없음). 실패하면 `noUnusedLocals` 위반이나 오타를 먼저 확인한다.

- [ ] **Step 11: 커밋**

```bash
git add backend/schema.sql backend/src/algorithms/pension.ts backend/src/services/pension-backtest.ts backend/src/types/pension/purchases.ts backend/src/types/pension/index.ts backend/src/queries/pension/purchases.ts backend/src/queries/pension/index.ts
git commit -m "feat: 연금복권 구매번호 스키마·타입·쿼리 추가 및 판정 함수 공용화"
```

---

### Task 2: 구매 서비스 + API 라우트 (backend)

**Files:**

- Create: `backend/src/services/pension-purchases.ts`
- Modify: `backend/src/services/pension.ts`
- Modify: `backend/src/routes/pension.ts`

**Interfaces:**

- Consumes (Task 1 산출물): `PENSION_BANDS_PER_TICKET`, `longestSuffixMatch`, `getPensionPrizeCounts`, `getPensionTopRank` (from `../algorithms/pension`); `insertPensionPurchaseGamesQuery`, `getPensionPurchasesWithResultsQuery`, `deletePensionPurchaseTicketQuery`, `getLatestStoredPensionDrawNo` (from `../queries/pension`); Task 1의 타입 전부.
- Produces (Task 3·4가 사용하는 HTTP 계약):
  - `POST /api/pension/purchases` → `{ success: true, ticketId: string, drawNo: number }`
  - `GET /api/pension/purchases` → `{ tickets: PensionPurchaseTicket[] }`
  - `DELETE /api/pension/purchases/:ticketId` → `{ success: true }` 또는 404 `{ error: '해당 구매 기록이 없습니다.' }`
  - `savePensionPurchaseTicket`, `listPensionPurchaseTickets`, `deletePensionPurchaseTicket`, `PENSION_PURCHASE_VALIDATION_ERRORS` — `services/pension.ts`에서 re-export

- [ ] **Step 1: 서비스 파일 생성**

Create `backend/src/services/pension-purchases.ts`:

```ts
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
```

- [ ] **Step 2: 서비스 배럴에 re-export 추가**

`backend/src/services/pension.ts` 파일 끝에 추가:

```ts
export {
  deletePensionPurchaseTicket,
  listPensionPurchaseTickets,
  PENSION_PURCHASE_VALIDATION_ERRORS,
  savePensionPurchaseTicket,
} from './pension-purchases'
```

- [ ] **Step 3: 라우트 추가**

`backend/src/routes/pension.ts`의 import 블록을 다음으로 교체:

```ts
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
```

그리고 `return app` 바로 위에 라우트 3개를 추가:

```ts
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
```

- [ ] **Step 4: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 에러 없음.

- [ ] **Step 5: 로컬 서버 기동**

Run (from `backend/`, 별도 터미널/백그라운드): `npm run dev`

Expected: `Ready on http://localhost:8787` 출력.

- [ ] **Step 6: 저장 → pending 확인**

Run:

```bash
curl -s -X POST http://localhost:8787/api/pension/purchases \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device","algorithm":"pension-multi-set-v3.0","games":[{"number":"604270","ruleId":"balanced-core","label":"균형형 추천","ruleWeight":1.412},{"number":"945893"},{"number":"114270"},{"number":"111111"}]}'
```

Expected: `{"success":true,"ticketId":"<uuid>","drawNo":<최신회차+1>}`

Run:

```bash
curl -s http://localhost:8787/api/pension/purchases
```

Expected: 티켓 1개, `"status":"pending"`, `"draw":null`, 각 게임의 `suffixMatches`/`prizeCounts`/`bonusMatched`/`topRank`가 모두 `null`.

- [ ] **Step 7: 검증 실패 케이스 확인**

Run:

```bash
# 게임 3개 → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8787/api/pension/purchases \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device","games":[{"number":"123456"},{"number":"234567"},{"number":"345678"}]}'

# 5자리 번호 → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8787/api/pension/purchases \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device","games":[{"number":"12345"},{"number":"234567"},{"number":"345678"},{"number":"456789"}]}'

# 배열 본문 → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8787/api/pension/purchases \
  -H "Content-Type: application/json" -d '[]'
```

Expected: `400` 세 번.

- [ ] **Step 8: 판정 확인 (323회 기준)**

Step 6에서 저장한 4개 번호는 로컬 D1의 323회(`winning_band=4`, `winning_number=604270`, `bonus_number=945893`) 기준으로 각각 6/0/4/0자리 일치하도록 고른 값이다.

Run (from `backend/`):

```bash
npx wrangler d1 execute lotto_db --local --command "UPDATE pension_purchases SET draw_no = 323;"
curl -s http://localhost:8787/api/pension/purchases
```

Expected:

- 티켓 `"status":"judged"`, `draw`가 `{"drawNo":323,"winningBand":"4","winningNumber":"604270","bonusNumber":"945893","drawDate":"…"}`
- 게임 A(`604270`): `suffixMatches: 6`, `prizeCounts: {"1":1,"2":4}`, `topRank: 1`, `bonusMatched: false`
- 게임 B(`945893`): `suffixMatches: 0`, `prizeCounts: {}`, `topRank: 0`, `bonusMatched: true` ← 보너스 케이스
- 게임 C(`114270`): `suffixMatches: 4`, `prizeCounts: {"4":5}`, `topRank: 4`, `bonusMatched: false`
- 게임 D(`111111`): `suffixMatches: 0`, `prizeCounts: {}`, `topRank: 0`, `bonusMatched: false` ← 낙첨

로컬 D1의 323회 데이터가 다르면 아래로 실제 값을 확인하고 기대값을 맞춰 재검증한다:

```bash
npx wrangler d1 execute lotto_db --local --command "SELECT draw_no, winning_band, winning_number, bonus_number FROM pension720_draws WHERE draw_no = 323;"
```

- [ ] **Step 9: 삭제 확인**

Run (`<ticketId>`는 Step 6 응답값):

```bash
curl -s -X DELETE "http://localhost:8787/api/pension/purchases/<ticketId>" -w "\n%{http_code}\n"
curl -s -X DELETE "http://localhost:8787/api/pension/purchases/<ticketId>" -w "\n%{http_code}\n"
curl -s http://localhost:8787/api/pension/purchases
```

Expected: 첫 번째 `{"success":true}` + `200`, 두 번째 `{"error":"해당 구매 기록이 없습니다."}` + `404`, 마지막 `{"tickets":[]}`.

- [ ] **Step 10: 커밋**

```bash
git add backend/src/services/pension-purchases.ts backend/src/services/pension.ts backend/src/routes/pension.ts
git commit -m "feat: 연금복권 구매 티켓 저장·판정 조회·삭제 API 추가"
```

---

### Task 3: 프론트 타입 + 구매 훅 + 페이지 훅 확장

**Files:**

- Modify: `frontend/src/constants/index.ts`
- Modify: `frontend/src/types/index.ts` (파일 끝, `PageKey` 위에 추가)
- Create: `frontend/src/hooks/usePensionPurchases.ts`
- Modify: `frontend/src/hooks/usePensionPage.ts`

**Interfaces:**

- Consumes: Task 2의 HTTP 계약 3개. `API_URL`, `getDeviceId()`(`frontend/src/utils/device.ts`).
- Produces (Task 4가 사용):
  - `PENSION_BANDS_PER_TICKET: 5` — `frontend/src/constants/index.ts`에서 export
  - 타입 `PensionPurchaseGameResult`, `PensionPurchaseTicket` — `frontend/src/types/index.ts`
  - `usePensionPurchases()` → `{ tickets: PensionPurchaseTicket[], purchasesLoading: boolean, saving: boolean, loadPurchases: () => Promise<PensionPurchaseTicket[]>, savePurchase: (algorithm: string | null, sets: PensionRecommendationSet[]) => Promise<{ ticketId: string; drawNo: number } | null>, deleteTicket: (ticketId: string) => Promise<boolean>, refreshAfterSync: () => Promise<PensionPurchaseTicket[]> }`
  - `summarizePensionTicketResult(ticket: PensionPurchaseTicket): string`
  - `usePensionPage()` 반환에 `pensionAlgorithm: string | null`, `maxDrawNo: number` 추가

- [ ] **Step 1: 상수 추가**

`frontend/src/constants/index.ts`의 `PENSION_RULE_LABELS` 선언 **위에** 추가:

```ts
// 각조 구매 = 1~5조 전부. 번호 하나당 5매.
export const PENSION_BANDS_PER_TICKET = 5;
```

- [ ] **Step 2: 프론트 타입 추가**

`frontend/src/types/index.ts`의 `export type PageKey` 선언 **위에** 추가:

```ts
export type PensionPurchaseGameResult = {
    gameIndex: number;
    number: string;
    ruleId: string | null;
    label: string | null;
    ruleWeight: number | null;
    suffixMatches: number | null;
    prizeCounts: Record<number, number> | null;
    bonusMatched: boolean | null;
    topRank: number | null;
};

export type PensionPurchaseTicket = {
    ticketId: string;
    drawNo: number;
    algorithm: string | null;
    createdAt: string;
    status: 'pending' | 'judged';
    draw: {
        drawNo: number;
        winningBand: string;
        winningNumber: string;
        bonusNumber: string;
        drawDate: string;
    } | null;
    games: PensionPurchaseGameResult[];
};
```

- [ ] **Step 3: 구매 훅 생성**

Create `frontend/src/hooks/usePensionPurchases.ts`:

```ts
import { useState } from 'react';
import type { PensionPurchaseTicket, PensionRecommendationSet } from '../types';
import { API_URL, PENSION_BANDS_PER_TICKET } from '../constants';
import { getDeviceId } from '../utils/device';

const PENSION_RANKS = [1, 2, 3, 4, 5, 6, 7];

// 판정 완료 티켓의 결과 요약 문구 (동기화 알림에 사용). 각조 구매이므로 매수 단위로 집계한다.
export function summarizePensionTicketResult(ticket: PensionPurchaseTicket): string {
    const rankCounts = new Map<number, number>();
    let bonusCount = 0;
    let lossCount = 0;

    for (const game of ticket.games) {
        if (game.prizeCounts === null) continue;
        const ranks = Object.keys(game.prizeCounts).map(Number);
        for (const rank of ranks) {
            rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + game.prizeCounts[rank]);
        }
        if (game.bonusMatched) bonusCount += PENSION_BANDS_PER_TICKET;
        if (ranks.length === 0 && !game.bonusMatched) lossCount += 1;
    }

    const parts = PENSION_RANKS
        .filter(rank => (rankCounts.get(rank) ?? 0) > 0)
        .map(rank => `${rank}등 ${rankCounts.get(rank)}매`);
    if (bonusCount > 0) parts.push(`보너스 ${bonusCount}매`);

    if (parts.length === 0) {
        return `제 ${ticket.drawNo}회 구매번호: 아쉽지만 모두 낙첨입니다.`;
    }
    if (lossCount > 0) parts.push(`낙첨 ${lossCount}게임`);
    return `제 ${ticket.drawNo}회 구매번호 결과: ${parts.join(', ')}`;
}

export function usePensionPurchases() {
    const [tickets, setTickets] = useState<PensionPurchaseTicket[]>([]);
    const [purchasesLoading, setPurchasesLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadPurchases = async (): Promise<PensionPurchaseTicket[]> => {
        setPurchasesLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/pension/purchases`);
            if (!res.ok) return tickets;
            const data = (await res.json()) as { tickets?: PensionPurchaseTicket[] };
            const next = Array.isArray(data.tickets) ? data.tickets : [];
            setTickets(next);
            return next;
        } catch {
            return tickets;
        } finally {
            setPurchasesLoading(false);
        }
    };

    const savePurchase = async (algorithm: string | null, sets: PensionRecommendationSet[]) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/pension/purchases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: getDeviceId(),
                    algorithm,
                    games: sets.map(set => ({
                        number: set.number,
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
            const res = await fetch(`${API_URL}/api/pension/purchases/${ticketId}`, { method: 'DELETE' });
            if (!res.ok) return false;
            await loadPurchases();
            return true;
        } catch {
            return false;
        }
    };

    // 동기화 직후 호출: 이번 재조회로 pending → judged 로 바뀐 티켓들을 돌려준다
    const refreshAfterSync = async (): Promise<PensionPurchaseTicket[]> => {
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

- [ ] **Step 4: usePensionPage에 algorithm 상태 추가**

`frontend/src/hooks/usePensionPage.ts`에서 `pensionBacktestLoading` 상태 선언 아래에 추가:

```ts
    const [pensionAlgorithm, setPensionAlgorithm] = useState<string | null>(null);
```

`generatePensionNumbers` 함수를 다음으로 교체 (현재 응답의 `algorithm`을 버리고 있으므로 보관하도록 변경):

```ts
    const generatePensionNumbers = async () => {
        setPensionGenerateLoading(true);
        setPensionRecommendations([]);
        setPensionRuleWeights([]);
        setPensionAlgorithm(null);
        try {
            const res = await fetch(`${API_URL}/api/pension/generate`, { method: 'POST' });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPensionRecommendations(Array.isArray(data.sets) ? data.sets : []);
            setPensionRuleWeights(Array.isArray(data.ruleWeights) ? data.ruleWeights : []);
            setPensionAlgorithm(typeof data.algorithm === 'string' ? data.algorithm : null);
        } catch {
            setPensionRecommendations([]);
            setPensionRuleWeights([]);
            setPensionAlgorithm(null);
        } finally {
            setPensionGenerateLoading(false);
        }
    };
```

- [ ] **Step 5: usePensionPage 반환값 확장**

같은 파일의 `return { ... }` 블록에서 `pensionBacktestLoading,` 아래에 추가:

```ts
        pensionAlgorithm,
        maxDrawNo,
```

(`maxDrawNo`는 이미 파일 내 파생 상태로 계산되어 있다 — 새로 만들지 말고 그대로 노출한다.)

- [ ] **Step 6: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/constants/index.ts frontend/src/types/index.ts frontend/src/hooks/usePensionPurchases.ts frontend/src/hooks/usePensionPage.ts
git commit -m "feat: 연금복권 구매 훅·타입 추가 및 생성 알고리즘 버전 보관"
```

---

### Task 4: 티켓 모달 + 구매 기록 섹션 + 페이지 배선

**Files:**

- Create: `frontend/src/components/pension/PensionPurchaseTicketModal.tsx`
- Create: `frontend/src/components/pension/PensionPurchaseHistorySection.tsx`
- Modify: `frontend/src/components/pension/PensionPage.tsx`

**Interfaces:**

- Consumes (Task 3 산출물): `usePensionPurchases()`, `summarizePensionTicketResult()`, `PENSION_BANDS_PER_TICKET`, 타입 `PensionPurchaseTicket`/`PensionPurchaseGameResult`, `usePensionPage()`의 `pensionAlgorithm`·`maxDrawNo`.
- Consumes (기존): `PensionDigitBall` (`./PensionNumberDisplay`), `PENSION_RULE_LABELS` (`../../constants`), `formatDateTime` (`../../utils/format`), `SectionCard` (`../ui/SectionCard`).
- Produces:
  - `PensionPurchaseTicketModal({ sets, targetDrawNo, saving, onSave, onClose })`
  - `PensionPurchaseHistorySection({ tickets, loading, onDelete })`

- [ ] **Step 1: 티켓 모달 컴포넌트 생성**

Create `frontend/src/components/pension/PensionPurchaseTicketModal.tsx`:

```tsx
import { X } from 'lucide-react';
import type { PensionRecommendationSet } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { PensionDigitBall } from './PensionNumberDisplay';

const GAME_LETTERS = ['A', 'B', 'C', 'D'];
// 추천 카드와 동일한 자리별 링 색상 (1~6자리)
const DIGIT_COLORS = ['#e2502b', '#f07e26', '#f2c024', '#3379e3', '#9a6bd0', '#9aa3ad'];
const PRICE_PER_BAND = 1000;

// 연금복권 구매용지처럼 A~D 4세트를 한 장으로 보여주는 모달
export function PensionPurchaseTicketModal({
    sets,
    targetDrawNo,
    saving,
    onSave,
    onClose,
}: {
    sets: PensionRecommendationSet[];
    targetDrawNo: number;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    const totalPrice = sets.length * PENSION_BANDS_PER_TICKET * PRICE_PER_BAND;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            role="dialog"
            aria-modal="true"
            aria-label="연금복권 구매 티켓"
            onClick={onClose}
        >
            <div
                className="neo-card w-full max-w-lg bg-white px-5 py-6 sm:px-7"
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b-2 border-black pb-4">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="neo-badge neo-badge-yellow">구매 티켓</span>
                            <span className="neo-badge neo-badge-purple">각조 구매</span>
                        </div>
                        <h3 className="mt-2 text-xl font-black text-black sm:text-2xl">
                            제 {targetDrawNo}회 추첨
                        </h3>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                            아래 {sets.length}세트가 한 장의 티켓으로 저장됩니다.
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
                            ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId)
                            : set.label;
                        return (
                            <div
                                key={`${set.label}-${set.number}`}
                                className="flex items-center gap-1.5 border-2 border-black bg-white rounded-xl px-3 py-2.5 shadow-[2px_2px_0px_0px_#000000] sm:gap-2.5"
                            >
                                <span className="w-5 shrink-0 text-center text-base font-black text-black">
                                    {GAME_LETTERS[index] ?? index + 1}
                                </span>
                                <span className="shrink-0 text-[10px] font-black text-slate-500 sm:text-xs">각조</span>
                                <div className="flex flex-1 items-center justify-center gap-1 sm:gap-1.5">
                                    {set.number.padStart(6, '0').slice(-6).split('').map((digit, digitIndex) => (
                                        <PensionDigitBall
                                            key={`${set.label}-${digitIndex}`}
                                            value={digit}
                                            color={DIGIT_COLORS[digitIndex]}
                                            size="sm"
                                        />
                                    ))}
                                </div>
                                <span className="hidden shrink-0 text-[10px] font-bold text-slate-500 sm:block">
                                    {ruleName}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <p className="mt-3 text-center text-[11px] font-bold text-slate-600">
                    {sets.length}번호 × 각조 {PENSION_BANDS_PER_TICKET}매 = {totalPrice.toLocaleString('ko-KR')}원
                </p>

                <div className="mt-5 flex items-center justify-end gap-2 border-t-2 border-black pt-4">
                    <button type="button" onClick={onClose} className="neo-btn inline-flex h-10 px-4 text-sm">
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="neo-btn neo-btn-purple inline-flex h-10 px-5 text-sm disabled:opacity-60"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: 구매 기록 섹션 컴포넌트 생성**

Create `frontend/src/components/pension/PensionPurchaseHistorySection.tsx`:

```tsx
import { Trash2 } from 'lucide-react';
import type { PensionPurchaseGameResult, PensionPurchaseTicket } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { formatDateTime } from '../../utils/format';
import { PensionDigitBall } from './PensionNumberDisplay';

const GAME_LETTERS = ['A', 'B', 'C', 'D'];
const DIGIT_COLORS = ['#e2502b', '#f07e26', '#f2c024', '#3379e3', '#9a6bd0', '#9aa3ad'];
const PENSION_RANKS = [1, 2, 3, 4, 5, 6, 7];

// 각조 구매이므로 등수별 매수로 표기: "1등 1매 · 2등 4매", "5등 5매"
function formatPensionPrize(prizeCounts: Record<number, number>) {
    return PENSION_RANKS
        .filter(rank => (prizeCounts[rank] ?? 0) > 0)
        .map(rank => `${rank}등 ${prizeCounts[rank]}매`)
        .join(' · ');
}

function PensionGameRankBadge({ game }: { game: PensionPurchaseGameResult }) {
    if (game.prizeCounts === null) {
        return <span className="neo-badge neo-badge-compact py-0.5 text-[10px]">추첨 전</span>;
    }

    const prizeText = formatPensionPrize(game.prizeCounts);
    const isLoss = prizeText === '' && !game.bonusMatched;

    return (
        <div className="flex flex-wrap items-center justify-end gap-1">
            {prizeText !== '' && (
                <span className="neo-badge neo-badge-compact neo-badge-yellow py-0.5 text-[10px]">{prizeText}</span>
            )}
            {game.bonusMatched && (
                <span className="neo-badge neo-badge-compact neo-badge-purple py-0.5 text-[10px]">
                    보너스 {PENSION_BANDS_PER_TICKET}매
                </span>
            )}
            {isLoss && (
                <span className="neo-badge neo-badge-compact py-0.5 text-[10px] text-slate-500">낙첨</span>
            )}
        </div>
    );
}

function PensionPurchaseGameRow({ game }: { game: PensionPurchaseGameResult }) {
    const judged = game.suffixMatches !== null;
    const ruleName = game.ruleId ? (PENSION_RULE_LABELS[game.ruleId] ?? game.ruleId) : game.label;
    const digits = game.number.padStart(6, '0').slice(-6).split('');
    // 뒤에서부터 연속 일치한 자리만 원래 색. 보너스 전장 일치면 6자리 모두 일치로 본다.
    const matchedFrom = game.bonusMatched ? 0 : 6 - (game.suffixMatches ?? 0);

    return (
        <div className="flex items-center gap-1.5 border-b border-slate-200 py-2 last:border-b-0 sm:gap-2.5">
            <span className="w-4 shrink-0 text-center text-xs font-black text-black sm:w-5 sm:text-sm">
                {GAME_LETTERS[game.gameIndex] ?? game.gameIndex + 1}
            </span>
            <span className="hidden shrink-0 text-[10px] font-black text-slate-500 sm:block">각조</span>
            <div className="flex flex-1 items-center gap-1 sm:gap-1.5">
                {digits.map((digit, index) => {
                    const matched = judged && index >= matchedFrom;
                    return (
                        <span
                            key={index}
                            className="inline-flex"
                            style={judged && !matched ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}
                        >
                            <PensionDigitBall value={digit} color={DIGIT_COLORS[index]} size="sm" />
                        </span>
                    );
                })}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
                <PensionGameRankBadge game={game} />
                {ruleName && <span className="hidden text-[10px] font-bold text-slate-500 sm:block">{ruleName}</span>}
            </div>
        </div>
    );
}

export function PensionPurchaseTicketCard({
    ticket,
    onDelete,
}: {
    ticket: PensionPurchaseTicket;
    onDelete: (ticketId: string) => void;
}) {
    return (
        <div className="neo-card bg-white px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-black">제 {ticket.drawNo}회</span>
                    <span className="neo-badge neo-badge-purple py-0.5 text-[10px]">각조 구매</span>
                    {ticket.status === 'pending' ? (
                        <span className="neo-badge neo-badge-blue py-0.5 text-[10px]">추첨 전</span>
                    ) : (
                        <span className="neo-badge py-0.5 text-[10px]">판정 완료</span>
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
                    <PensionPurchaseGameRow key={game.gameIndex} game={game} />
                ))}
            </div>

            {ticket.status === 'judged' && ticket.draw && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-600">
                    <span>당첨</span>
                    <span className="font-black text-black">
                        {ticket.draw.winningBand}조 {ticket.draw.winningNumber}
                    </span>
                    <span>· 보너스 {ticket.draw.bonusNumber}</span>
                </div>
            )}
        </div>
    );
}

export function PensionPurchaseHistorySection({
    tickets,
    loading,
    onDelete,
}: {
    tickets: PensionPurchaseTicket[];
    loading: boolean;
    onDelete: (ticketId: string) => void;
}) {
    if (tickets.length === 0) {
        return (
            <div className="border-2 border-dashed border-slate-300 bg-white/70 rounded-xl px-4 py-10 text-center text-sm font-bold text-slate-700 shadow-[2px_2px_0px_0px_#000]">
                {loading ? '구매 기록을 불러오는 중입니다.' : '저장된 구매번호가 없습니다. 추천번호를 생성한 뒤 "이 번호로 구매"를 눌러보세요.'}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {tickets.map(ticket => (
                <PensionPurchaseTicketCard key={ticket.ticketId} ticket={ticket} onDelete={onDelete} />
            ))}
        </div>
    );
}
```

- [ ] **Step 3: PensionPage import·훅 배선**

`frontend/src/components/pension/PensionPage.tsx` 상단 import 블록을 다음으로 교체:

```tsx
import { useEffect, useState } from 'react';
import { Info, Search, Sparkles, Ticket } from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import { usePensionPage } from '../../hooks/usePensionPage';
import { usePensionPurchases, summarizePensionTicketResult } from '../../hooks/usePensionPurchases';
import { PENSION_RULE_LABELS } from '../../constants';
import { SectionCard } from '../ui/SectionCard';
import { RuleWeightCard } from '../lotto/RuleCards';
import { PensionResultCard } from './PensionResultCard';
import { PensionPurchaseTicketModal } from './PensionPurchaseTicketModal';
import { PensionPurchaseHistorySection } from './PensionPurchaseHistorySection';
import {
    FeaturedPensionRecommendationCard,
    PensionRecommendationCard,
    PensionRulePerformanceCard,
} from './PensionCards';
```

`usePensionPage()` 구조분해에 두 값을 추가한다 — `pensionBacktestLoading,` 아래에:

```tsx
        pensionAlgorithm,
        maxDrawNo,
```

- [ ] **Step 4: PensionPage 상태·핸들러 추가**

`const featuredRecommendation = pensionRecommendations[0] ?? null;` 아래의 `const handleSync = ...` 줄을 다음 블록으로 **교체**:

```tsx
    const {
        tickets,
        purchasesLoading,
        saving,
        loadPurchases,
        savePurchase,
        deleteTicket,
        refreshAfterSync,
    } = usePensionPurchases();
    const [showTicketModal, setShowTicketModal] = useState(false);
    const targetDrawNo = maxDrawNo + 1;

    useEffect(() => {
        loadPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSavePurchase = async () => {
        if (!window.confirm(`제 ${targetDrawNo}회 추첨 대상으로 ${pensionRecommendations.length}세트를 각조 구매로 저장할까요?`)) return;
        const result = await savePurchase(pensionAlgorithm, pensionRecommendations);
        if (result) {
            onSyncMessage(`구매번호 저장 완료 (제 ${result.drawNo}회)`);
            setShowTicketModal(false);
        } else {
            onSyncError('구매번호 저장에 실패했습니다.');
        }
    };

    const handleDeleteTicket = async (ticketId: string) => {
        if (!window.confirm('이 구매 기록을 삭제할까요?')) return;
        const ok = await deleteTicket(ticketId);
        if (!ok) onSyncError('구매 기록 삭제에 실패했습니다.');
    };

    const handleSync = () => syncLatestPensionResults(
        async (msg) => {
            onSyncMessage(msg);
            // 동기화로 새 회차가 들어왔다면 pending 티켓이 판정됐는지 확인해 알림
            const newlyJudged = await refreshAfterSync();
            if (newlyJudged.length > 0) {
                onSyncMessage(newlyJudged.map(summarizePensionTicketResult).join(' / '));
            }
        },
        onSyncError,
    );
```

- [ ] **Step 5: 모달 렌더링 추가**

`return (` 바로 다음 줄의 `<div className="space-y-10 sm:space-y-12">` 안 **맨 앞에** 추가:

```tsx
            {showTicketModal && (
                <PensionPurchaseTicketModal
                    sets={pensionRecommendations}
                    targetDrawNo={targetDrawNo}
                    saving={saving}
                    onSave={handleSavePurchase}
                    onClose={() => setShowTicketModal(false)}
                />
            )}
```

- [ ] **Step 6: 구매 버튼 추가**

추천번호 생성 `SectionCard` 안, 추천 세트 목록 그리드(또는 빈 상태 안내)를 렌더링하는 `)}` 블록 **바로 뒤**(= `</SectionCard>` 바로 앞)에 추가:

```tsx
                    {pensionRecommendations.length > 0 && (
                        <div className="mt-5 flex justify-center">
                            <button
                                type="button"
                                onClick={() => setShowTicketModal(true)}
                                disabled={maxDrawNo === 0}
                                className="neo-btn neo-btn-secondary inline-flex h-11 px-6 text-sm font-black disabled:opacity-60"
                            >
                                이 번호로 구매
                            </button>
                        </div>
                    )}
```

- [ ] **Step 7: 구매 기록 섹션 추가**

백테스트 성향 진단 `</section>` **바로 뒤**, 최상위 `</div>` 앞에 추가:

```tsx
            {/* 내 구매 기록 섹션 */}
            <section>
                <SectionCard
                    title="내 구매 기록"
                    eyebrow="구매번호 관리"
                    icon={<Ticket className="h-5 w-5" />}
                >
                    <p className="mb-4 text-sm font-bold text-slate-700">
                        저장한 번호는 1~5조 전부(각조 5매) 구매로 판정되며, 당첨번호 동기화 시 자동으로 확인됩니다.
                    </p>
                    <PensionPurchaseHistorySection
                        tickets={tickets}
                        loading={purchasesLoading}
                        onDelete={handleDeleteTicket}
                    />
                </SectionCard>
            </section>
```

- [ ] **Step 8: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 에러 없음. `formatDateTime`이 `PensionPage.tsx`에서 여전히 사용 중인지 확인(동기화 상태 문구에서 사용) — `noUnusedLocals` 위반이 나면 미사용 import를 제거한다.

- [ ] **Step 9: 브라우저 확인 (데스크톱)**

Run: 루트에서 `npm run dev` (backend 8787 + frontend 동시 기동)

브라우저에서 `/pension` 접속 후:

1. "추천번호 생성" → 4세트 표시 → "이 번호로 구매" 버튼 노출 확인
2. 버튼 클릭 → 모달에 A~D 4행, 각 행에 `각조` + 숫자 볼 6개, 하단 `4번호 × 각조 5매 = 20,000원` 확인
3. "저장" → confirm 문구 `제 N회 추첨 대상으로 4세트를 각조 구매로 저장할까요?` → 확인 → 토스트 `구매번호 저장 완료 (제 N회)` → 모달 닫힘
4. "내 구매 기록" 섹션에 `제 N회` + `각조 구매` + `추첨 전` 배지 티켓 카드 표시 확인

- [ ] **Step 10: 판정 표시 확인**

Run (from `backend/`):

```bash
npx wrangler d1 execute lotto_db --local --command "UPDATE pension_purchases SET draw_no = (SELECT MAX(draw_no) FROM pension720_draws);"
```

브라우저 새로고침 후 확인:

- 티켓 배지가 `판정 완료`로 바뀐다
- 각 게임 행에서 뒤에서부터 연속 일치한 자리만 원래 색, 나머지는 회색조+반투명
- 당첨된 게임에 `N등 5매` 배지, 낙첨 게임에 `낙첨` 배지
- 카드 하단에 `당첨 {조}조 {번호} · 보너스 {번호}` 표시

1·2등과 보너스 표시를 실제로 보려면 Task 2 Step 8의 번호(`604270`, `945893`)를 D1에 직접 넣어 확인한다:

```bash
npx wrangler d1 execute lotto_db --local --command "UPDATE pension_purchases SET number = '604270' WHERE game_index = 0; UPDATE pension_purchases SET number = '945893' WHERE game_index = 1; UPDATE pension_purchases SET draw_no = 323;"
```

Expected: A행 `1등 1매 · 2등 4매`(6자리 모두 원래 색), B행 `보너스 5매`(6자리 모두 원래 색).

- [ ] **Step 11: 모바일 폭 확인 (390px)**

브라우저 devtools에서 폭 390px로 전환해 확인:

- 티켓 모달의 각 행이 가로 스크롤 없이 한 줄에 들어간다
- 구매 기록의 게임 행에서 숫자 볼 6개 + 판정 배지가 겹치거나 넘치지 않는다 (배지는 필요 시 두 줄로 감싸짐)
- `1등 1매 · 2등 4매`처럼 긴 배지에서도 페이지 가로 스크롤이 생기지 않는다

넘친다면 게임 행의 배지 컨테이너를 `max-w-[110px]`로 제한하거나 `각조` 라벨의 `sm:block`을 유지한 채 볼 간격(`gap-1`)을 줄여 대응한다. 새 컴포넌트를 만들지 말 것.

- [ ] **Step 12: 삭제 확인**

구매 기록 카드의 휴지통 버튼 클릭 → confirm `이 구매 기록을 삭제할까요?` → 확인 → 카드가 사라지고 빈 상태 안내가 표시되는지 확인.

- [ ] **Step 13: 커밋**

```bash
git add frontend/src/components/pension/PensionPurchaseTicketModal.tsx frontend/src/components/pension/PensionPurchaseHistorySection.tsx frontend/src/components/pension/PensionPage.tsx
git commit -m "feat: 연금복권 구매 티켓 모달·구매 기록 섹션 추가"
```

---

### Task 5: 프로덕션 D1 마이그레이션 + 배포

**Files:**

- 코드 변경 없음 (운영 반영만)

**Interfaces:**

- Consumes: Task 1~4 전체.

- [ ] **Step 1: 원격 D1에 스키마 적용**

Run (from `backend/`): `npm run init-db:remote`

Expected: 성공. `schema.sql` 전체가 `IF NOT EXISTS`라 기존 테이블·데이터에 무해하다. 토큰이 필요하면 wrangler가 안내하는 방식으로 환경변수를 주입한다.

- [ ] **Step 2: 원격 테이블 생성 확인**

Run (from `backend/`):

```bash
npx wrangler d1 execute lotto_db --remote --command "SELECT name FROM sqlite_master WHERE name = 'pension_purchases';"
```

Expected: `pension_purchases` 한 행.

- [ ] **Step 3: 배포**

Run (from repo root): `npm run deploy`

Expected: backend·frontend 배포 성공.

- [ ] **Step 4: 프로덕션 스모크 테스트**

Run:

```bash
curl -s "https://lotto-analysis-backend.kbaysin.workers.dev/api/pension/purchases"
```

Expected: `{"tickets":[]}` (또는 기존 기록). 500이 나오면 Step 1의 마이그레이션이 적용되지 않은 것이다.

- [ ] **Step 5: 커밋**

코드 변경이 없으면 커밋할 것이 없다. 배포 과정에서 설정 파일이 바뀐 경우에만:

```bash
git add -A
git commit -m "chore: 연금복권 구매번호 테이블 프로덕션 반영"
```
