# 연금복권 구매 — 대표 1세트 저장 + 조별 5줄 전개 개정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 구현된 연금복권 구매번호 기능을 "추천 4세트 저장 → 대표 1세트만 각조 구매로 저장"으로 축소하고, 구매 기록·모달을 1조~5조 5줄로 전개해 당첨 조 줄만 1등으로 표시한다.

**Architecture:** 백엔드는 검증 상수 하나(`PENSION_GAMES_PER_TICKET` 4 → 1)와 에러 문구만 바꾼다. 스키마·쿼리·판정 함수·API 응답 형태는 그대로 둔다. 조별 전개는 순수 표시 계층이므로 프론트가 `draw.winningBand`와 `game.suffixMatches`로 줄별 등수를 파생한다. 파생 로직은 `frontend/src/utils/pension-bands.ts` 한 곳에 두고 모달·기록이 공유한다.

**Tech Stack:** Cloudflare Workers(Hono) + D1, React 19 + Vite + Tailwind v4 (네오 브루탈리즘 유틸), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-07-26-pension-purchase-tracking-design.md` (2026-07-27 개정본)

**선행 상태:** 브랜치 `feat/pension-purchase-tracking`에 커밋 `bd8b060`~`4f31ddf`로 4세트 버전이 이미 구현되어 있다. 이 계획은 그 코드를 **수정**한다. 프로덕션 배포 전이라 D1 마이그레이션 부담은 없다.

## Global Constraints

- **저장 단위**: 티켓 1장 = 대표 추천 1세트 = DB 1행. `game_index`는 항상 `0`.
- **각조 해석 유지**: 저장 번호 하나 = 1~5조 5매. `PENSION_BANDS_PER_TICKET = 5`는 백엔드·프론트 양쪽에 그대로 둔다.
- **백엔드 응답 불변**: `prizeCounts`·`topRank`·`bonusMatched`·`suffixMatches` 계산과 JSON 형태를 바꾸지 않는다. 조별 등수는 프론트 파생이다.
- **스키마 불변**: `pension_purchases` 테이블·인덱스를 건드리지 않는다. 마이그레이션 없음.
- **줄별 등수 파생식**: `suffixMatches === 6` → `band === Number(winningBand) ? 1 : 2`. `1 <= suffixMatches <= 5` → `8 - suffixMatches`. `0` → 낙첨(`null`).
- **winningBand 방어**: `Number(winningBand)`가 `1`~`5`의 정수가 아니면 6자리 일치라도 1등 줄을 정할 수 없으므로 **5줄 모두 2등**으로 표시한다. 티켓 하단 합계는 API의 `prizeCounts`를 그대로 쓰므로 영향받지 않는다.
- **보너스**: 조와 무관하므로 `bonusMatched`가 `true`면 **5줄 모두**에 `보너스` 배지를 병기한다. 등수 배지와 함께 표시한다.
- **숫자 볼 강조**: 뒤에서부터 `suffixMatches`자리만 원색, 나머지는 `grayscale(1)` + `opacity 0.35`. 5줄 동일. 보너스 전장 일치 시 6자리 모두 원색.
- **사용자 노출 문구(그대로 사용)**: 구매 버튼 `이 번호로 구매` / confirm `제 {N}회 추첨 대상으로 이 번호를 각조 구매로 저장할까요?` / 저장 토스트 `구매번호 저장 완료 (제 {N}회)` / 삭제 confirm `이 구매 기록을 삭제할까요?` / 전낙첨 토스트 `제 {N}회 구매번호: 아쉽지만 모두 낙첨입니다.`
- **금액 문구**: `1번호 × 각조 5매 = 5,000원`.
- **구매 버튼 위치**: `FeaturedPensionRecommendationCard` **안**. 추천 섹션 하단의 기존 버튼은 제거한다.
- **스타일**: 기존 네오 브루탈리즘 유틸(`neo-card`, `neo-btn`, `neo-badge`, `neo-badge-compact`, `border-2 border-black`, hard shadow) 재사용. 숫자 볼은 `PensionDigitBall` 재사용, 새로 만들지 않는다.
- `tsconfig`의 `noUnusedLocals`가 전역 활성화 — 미사용 import/변수를 남기면 typecheck 실패.
- 모든 태스크 완료 조건에 루트 `npm run typecheck` 통과 포함.
- **테스트 프레임워크가 없다** — 검증은 wrangler dev(로컬 D1) 대상 curl 시나리오, typecheck, 브라우저 확인으로 수행한다. 새 테스트 프레임워크를 도입하지 말 것.
- 로또 구매 기능(`lotto_purchases`, `usePurchases`, `PurchaseTicketModal`, `PurchaseHistorySection`)은 **건드리지 않는다**.

---

## File Structure

**Backend (수정):**

- `backend/src/services/pension-purchases.ts` — `PENSION_GAMES_PER_TICKET` 상수와 에러 문구만 변경

**Frontend (생성):**

- `frontend/src/utils/pension-bands.ts` — 조별 전개·줄별 등수 파생 단일 소스

**Frontend (수정):**

- `frontend/src/components/pension/PensionPurchaseTicketModal.tsx` — 대표 1세트를 5조 5줄로
- `frontend/src/components/pension/PensionPurchaseHistorySection.tsx` — 게임 행 → 조 5행
- `frontend/src/components/pension/PensionCards.tsx` — 대표 카드에 구매 버튼 슬롯 추가
- `frontend/src/components/pension/PensionPage.tsx` — 대표 1세트만 저장, 섹션 하단 버튼 제거, 버튼을 대표 카드로 이동

**변경 없음:** `backend/schema.sql`, `backend/src/queries/pension/purchases.ts`, `backend/src/algorithms/pension.ts`, `backend/src/routes/pension.ts`, `backend/src/types/pension/purchases.ts`, `frontend/src/types/index.ts`, `frontend/src/hooks/usePensionPurchases.ts`, `frontend/src/hooks/usePensionPage.ts`

---

### Task 1: 백엔드 저장 단위를 1세트로 축소

**Files:**

- Modify: `backend/src/services/pension-purchases.ts:22` (상수), `:25` (에러 문구)

**Interfaces:**

- Consumes: 없음 (기존 코드 수정)
- Produces: `POST /api/pension/purchases`가 `games` 배열 원소 1개만 허용. 2개 이상이면 400 + `게임은 정확히 1개여야 합니다.`

- [ ] **Step 1: 상수 변경**

`backend/src/services/pension-purchases.ts`에서 다음 줄을

```ts
const PENSION_GAMES_PER_TICKET = 4
```

다음으로 교체:

```ts
// 각조 구매는 회차당 한도 5매를 모두 소진하므로 티켓당 번호는 하나뿐이다.
const PENSION_GAMES_PER_TICKET = 1
```

`ERROR_GAME_COUNT`는 이미 템플릿 리터럴(`` `게임은 정확히 ${PENSION_GAMES_PER_TICKET}개여야 합니다.` ``)이라 문구가 자동으로 따라간다 — 별도 수정 불필요.

- [ ] **Step 2: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 에러 없이 종료(출력 없음).

- [ ] **Step 3: 로컬 서버 기동**

Run (from `backend/`, 백그라운드): `npm run dev`

Expected: `Ready on http://localhost:8787`.

- [ ] **Step 4: 1개 저장 성공 확인**

Run:

```bash
curl -s -X POST http://localhost:8787/api/pension/purchases \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device","algorithm":"pension-multi-set-v3.0","games":[{"number":"604270","ruleId":"balanced-core","label":"균형형 추천","ruleWeight":1.412}]}'
```

Expected: `{"success":true,"ticketId":"<uuid>","drawNo":<최신회차+1>}`

- [ ] **Step 5: 2개 이상 거부 확인**

Run:

```bash
# 게임 2개 → 400
curl -s -X POST http://localhost:8787/api/pension/purchases \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test-device","games":[{"number":"604270"},{"number":"945893"}]}' \
  -w "\n%{http_code}\n"

# 게임 0개 → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8787/api/pension/purchases \
  -H "Content-Type: application/json" -d '{"deviceId":"test-device","games":[]}'
```

Expected: 첫 번째가 `{"error":"게임은 정확히 1개여야 합니다."}` + `400`, 두 번째가 `400`.

- [ ] **Step 6: 조회 형태 확인**

Run:

```bash
curl -s http://localhost:8787/api/pension/purchases
```

Expected: 티켓 1개, `games` 배열 길이 1, `gameIndex: 0`, `status: "pending"`.

- [ ] **Step 7: 정리 및 커밋**

저장한 티켓을 지운다(`<ticketId>`는 Step 4 응답값):

```bash
curl -s -X DELETE "http://localhost:8787/api/pension/purchases/<ticketId>"
```

```bash
git add backend/src/services/pension-purchases.ts
git commit -m "fix: 연금복권 구매 티켓을 대표 1세트만 저장하도록 축소"
```

---

### Task 2: 조별 전개 유틸 신설

**Files:**

- Create: `frontend/src/utils/pension-bands.ts`

**Interfaces:**

- Consumes: `PENSION_BANDS_PER_TICKET` (`frontend/src/constants`), 타입 `PensionPurchaseGameResult` (`frontend/src/types`)
- Produces (Task 3·4가 사용):
  - `PENSION_BAND_NUMBERS: number[]` — `[1, 2, 3, 4, 5]`
  - `PENSION_DIGIT_COLORS: string[]` — 자리별 링 색상 6개
  - `toSixDigits(value: string): string`
  - `deriveBandRank(game: PensionPurchaseGameResult, winningBand: string | null, band: number): number | null`
  - `PensionBandRow` 타입 — `{ band: number; digits: string[]; rank: number | null; bonus: boolean; judged: boolean; matchedFrom: number }`
  - `buildPensionBandRows(game: PensionPurchaseGameResult, winningBand: string | null): PensionBandRow[]`

- [ ] **Step 1: 유틸 파일 생성**

Create `frontend/src/utils/pension-bands.ts`:

```ts
import type { PensionPurchaseGameResult } from '../types';
import { PENSION_BANDS_PER_TICKET } from '../constants';

// 각조 구매의 조 번호 1~5
export const PENSION_BAND_NUMBERS = Array.from(
    { length: PENSION_BANDS_PER_TICKET },
    (_, index) => index + 1,
);

// 추천 카드와 동일한 자리별 링 색상 (1~6자리)
export const PENSION_DIGIT_COLORS = ['#e2502b', '#f07e26', '#f2c024', '#3379e3', '#9a6bd0', '#9aa3ad'];

export function toSixDigits(value: string) {
    return value.padStart(6, '0').slice(-6);
}

// 줄(조) 하나의 등수. 낙첨이거나 추첨 전이면 null.
// 6자리 전장 일치일 때만 조가 등수를 가른다 — 당첨 조가 1등, 나머지 4조가 2등.
// winningBand가 1~5 정수로 파싱되지 않으면 1등 줄을 특정할 수 없으므로 전부 2등으로 본다.
export function deriveBandRank(
    game: PensionPurchaseGameResult,
    winningBand: string | null,
    band: number,
): number | null {
    const suffixMatches = game.suffixMatches;
    if (suffixMatches === null || suffixMatches === 0) return null;
    if (suffixMatches < 6) return 8 - suffixMatches;

    const winner = Number(winningBand);
    if (!Number.isInteger(winner) || winner < 1 || winner > PENSION_BANDS_PER_TICKET) return 2;
    return band === winner ? 1 : 2;
}

export type PensionBandRow = {
    band: number;
    digits: string[];
    rank: number | null;
    bonus: boolean;
    judged: boolean;
    // 이 인덱스부터 끝까지가 일치한 자리 (원색 유지), 앞쪽은 회색조 처리
    matchedFrom: number;
};

export function buildPensionBandRows(
    game: PensionPurchaseGameResult,
    winningBand: string | null,
): PensionBandRow[] {
    const digits = toSixDigits(game.number).split('');
    const judged = game.suffixMatches !== null;
    const bonus = game.bonusMatched === true;
    // 보너스 전장 일치면 6자리 모두 맞은 것으로 보여준다
    const matchedFrom = bonus ? 0 : 6 - (game.suffixMatches ?? 0);

    return PENSION_BAND_NUMBERS.map(band => ({
        band,
        digits,
        rank: deriveBandRank(game, winningBand, band),
        bonus,
        judged,
        matchedFrom,
    }));
}
```

- [ ] **Step 2: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 에러 없음. 아직 아무도 import하지 않지만 `noUnusedLocals`는 모듈 export를 문제 삼지 않는다.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/utils/pension-bands.ts
git commit -m "feat: 연금복권 조별 전개·줄별 등수 파생 유틸 추가"
```

---

### Task 3: 티켓 모달을 대표 1세트 5조 전개로 교체

**Files:**

- Modify: `frontend/src/components/pension/PensionPurchaseTicketModal.tsx` (전체 교체)

**Interfaces:**

- Consumes (Task 2 산출물): `PENSION_BAND_NUMBERS`, `PENSION_DIGIT_COLORS`, `toSixDigits`
- Consumes (기존): `PensionDigitBall` (`./PensionNumberDisplay`), `PENSION_BANDS_PER_TICKET`·`PENSION_RULE_LABELS` (`../../constants`), 타입 `PensionRecommendationSet`
- Produces (Task 5가 사용): `PensionPurchaseTicketModal({ set, targetDrawNo, saving, onSave, onClose })` — prop이 `sets: PensionRecommendationSet[]`에서 **`set: PensionRecommendationSet`(단수)**로 바뀐다

- [ ] **Step 1: 모달 컴포넌트 전체 교체**

`frontend/src/components/pension/PensionPurchaseTicketModal.tsx`의 내용을 **전부** 다음으로 교체:

```tsx
import { X } from 'lucide-react';
import type { PensionRecommendationSet } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { PENSION_BAND_NUMBERS, PENSION_DIGIT_COLORS, toSixDigits } from '../../utils/pension-bands';
import { PensionDigitBall } from './PensionNumberDisplay';

const PRICE_PER_BAND = 1000;

// 각조 구매 용지처럼 대표 1세트를 1조~5조 5줄로 펼쳐 보여주는 모달
export function PensionPurchaseTicketModal({
    set,
    targetDrawNo,
    saving,
    onSave,
    onClose,
}: {
    set: PensionRecommendationSet;
    targetDrawNo: number;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}) {
    const digits = toSixDigits(set.number).split('');
    const ruleName = set.meta?.ruleId ? (PENSION_RULE_LABELS[set.meta.ruleId] ?? set.meta.ruleId) : set.label;
    const totalPrice = PENSION_BANDS_PER_TICKET * PRICE_PER_BAND;

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
                        <p className="mt-1 text-xs font-bold text-slate-600">{ruleName}</p>
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
                    {PENSION_BAND_NUMBERS.map(band => (
                        <div
                            key={band}
                            className="flex items-center gap-2 border-2 border-black bg-white rounded-xl px-3 py-2.5 shadow-[2px_2px_0px_0px_#000000] sm:gap-3"
                        >
                            <span className="w-9 shrink-0 text-center text-sm font-black text-black">
                                {band}조
                            </span>
                            <div className="flex flex-1 items-center justify-center gap-1 sm:gap-1.5">
                                {digits.map((digit, digitIndex) => (
                                    <PensionDigitBall
                                        key={`${band}-${digitIndex}`}
                                        value={digit}
                                        color={PENSION_DIGIT_COLORS[digitIndex]}
                                        size="sm"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <p className="mt-3 text-center text-[11px] font-bold text-slate-600">
                    1번호 × 각조 {PENSION_BANDS_PER_TICKET}매 = {totalPrice.toLocaleString('ko-KR')}원
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

- [ ] **Step 2: typecheck**

Run (from repo root): `npm run typecheck`

Expected: **실패한다.** `PensionPage.tsx`가 아직 `sets={...}`를 넘기고 있어 `sets` prop이 없다는 에러가 난다. Task 5에서 고친다. 에러가 `PensionPage.tsx`의 `sets` 관련 한 건인지만 확인하고 넘어간다.

- [ ] **Step 3: 커밋 보류**

이 태스크는 단독으로 typecheck를 통과하지 못하므로 커밋하지 않는다. Task 5에서 함께 커밋한다.

---

### Task 4: 구매 기록을 조 5행으로 교체

**Files:**

- Modify: `frontend/src/components/pension/PensionPurchaseHistorySection.tsx` (전체 교체)

**Interfaces:**

- Consumes (Task 2 산출물): `PENSION_DIGIT_COLORS`, `buildPensionBandRows`, 타입 `PensionBandRow`
- Consumes (기존): `PensionDigitBall`, `PENSION_BANDS_PER_TICKET`·`PENSION_RULE_LABELS` (`../../constants`), `formatDateTime` (`../../utils/format`), 타입 `PensionPurchaseTicket`
- Produces (Task 5가 사용): `PensionPurchaseHistorySection({ tickets, loading, onDelete })` — 시그니처 변경 없음

- [ ] **Step 1: 기록 섹션 전체 교체**

`frontend/src/components/pension/PensionPurchaseHistorySection.tsx`의 내용을 **전부** 다음으로 교체:

```tsx
import { Trash2 } from 'lucide-react';
import type { PensionPurchaseTicket } from '../../types';
import { PENSION_BANDS_PER_TICKET, PENSION_RULE_LABELS } from '../../constants';
import { formatDateTime } from '../../utils/format';
import { buildPensionBandRows, PENSION_DIGIT_COLORS, type PensionBandRow } from '../../utils/pension-bands';
import { PensionDigitBall } from './PensionNumberDisplay';

const PENSION_RANKS = [1, 2, 3, 4, 5, 6, 7];

// 티켓 하단 합계. API가 준 prizeCounts를 그대로 쓴다 (조별 파생과 별개).
function formatPensionPrize(prizeCounts: Record<number, number>) {
    return PENSION_RANKS
        .filter(rank => (prizeCounts[rank] ?? 0) > 0)
        .map(rank => `${rank}등 ${prizeCounts[rank]}매`)
        .join(' · ');
}

function PensionBandRankBadge({ row }: { row: PensionBandRow }) {
    if (!row.judged) {
        return <span className="neo-badge neo-badge-compact py-0.5 text-[10px]">추첨 전</span>;
    }

    return (
        <div className="flex flex-wrap items-center justify-end gap-1">
            {row.rank !== null && (
                <span className="neo-badge neo-badge-compact neo-badge-yellow py-0.5 text-[10px]">
                    {row.rank}등
                </span>
            )}
            {row.bonus && (
                <span className="neo-badge neo-badge-compact neo-badge-purple py-0.5 text-[10px]">보너스</span>
            )}
            {row.rank === null && !row.bonus && (
                <span className="neo-badge neo-badge-compact py-0.5 text-[10px] text-slate-500">낙첨</span>
            )}
        </div>
    );
}

function PensionBandRowView({ row }: { row: PensionBandRow }) {
    return (
        <div className="flex items-center gap-2 border-b border-slate-200 py-2 last:border-b-0 sm:gap-3">
            <span className="w-8 shrink-0 text-center text-xs font-black text-black sm:w-9 sm:text-sm">
                {row.band}조
            </span>
            <div className="flex flex-1 items-center gap-1 sm:gap-1.5">
                {row.digits.map((digit, index) => {
                    const matched = row.judged && index >= row.matchedFrom;
                    return (
                        <span
                            key={index}
                            className="inline-flex"
                            style={row.judged && !matched ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}
                        >
                            <PensionDigitBall value={digit} color={PENSION_DIGIT_COLORS[index]} size="sm" />
                        </span>
                    );
                })}
            </div>
            <div className="flex shrink-0 items-center justify-end">
                <PensionBandRankBadge row={row} />
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
    const game = ticket.games[0];
    if (!game) return null;

    const rows = buildPensionBandRows(game, ticket.draw?.winningBand ?? null);
    const ruleName = game.ruleId ? (PENSION_RULE_LABELS[game.ruleId] ?? game.ruleId) : game.label;
    const prizeText = game.prizeCounts ? formatPensionPrize(game.prizeCounts) : '';

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
                    {ruleName && <span className="neo-badge py-0.5 text-[10px]">{ruleName}</span>}
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
                {rows.map(row => (
                    <PensionBandRowView key={row.band} row={row} />
                ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-600">
                {ticket.status === 'judged' && ticket.draw ? (
                    <>
                        <span>당첨</span>
                        <span className="font-black text-black">
                            {ticket.draw.winningBand}조 {ticket.draw.winningNumber}
                        </span>
                        <span>· 보너스 {ticket.draw.bonusNumber}</span>
                        <span className="font-black text-black">
                            · {prizeText !== '' ? prizeText : '낙첨'}
                            {game.bonusMatched ? ` · 보너스 ${PENSION_BANDS_PER_TICKET}매` : ''}
                        </span>
                    </>
                ) : (
                    <span>추첨 후 자동으로 판정됩니다.</span>
                )}
            </div>
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
                {loading ? '구매 기록을 불러오는 중입니다.' : '저장된 구매번호가 없습니다. 대표 추천 카드에서 "이 번호로 구매"를 눌러보세요.'}
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

- [ ] **Step 2: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 여전히 Task 3의 `sets` prop 에러만 남는다. 이 파일에서 새 에러가 나오지 않는지 확인한다.

- [ ] **Step 3: 커밋 보류**

Task 5에서 함께 커밋한다.

---

### Task 5: 대표 카드에 구매 버튼 배치 + 페이지 배선

**Files:**

- Modify: `frontend/src/components/pension/PensionCards.tsx:67` (`FeaturedPensionRecommendationCard` 시그니처와 본문)
- Modify: `frontend/src/components/pension/PensionPage.tsx`

**Interfaces:**

- Consumes (Task 3·4 산출물): `PensionPurchaseTicketModal`(단수 `set` prop), `PensionPurchaseHistorySection`
- Produces: `FeaturedPensionRecommendationCard({ set, action })` — `action?: ReactNode` 슬롯 추가. 기존 호출부는 `action` 없이도 동작한다.

- [ ] **Step 1: 대표 카드에 action 슬롯 추가**

`frontend/src/components/pension/PensionCards.tsx`의 다음 줄을

```tsx
export function FeaturedPensionRecommendationCard({ set }: { set: PensionRecommendationSet }) {
```

다음으로 교체:

```tsx
export function FeaturedPensionRecommendationCard({
    set,
    action,
}: {
    set: PensionRecommendationSet;
    action?: ReactNode;
}) {
```

같은 파일 맨 위에 타입 import를 추가한다(기존 import 줄 위에):

```tsx
import type { ReactNode } from 'react';
```

- [ ] **Step 2: 대표 카드 안에 버튼 렌더링**

같은 파일에서 대표 카드의 숫자 볼 블록 — 아래 닫는 `</div>` 다음, 즉 `border-b-2 border-black pb-4` 컨테이너를 닫는 `</div>` **바로 앞**에 `action` 슬롯을 넣는다.

교체 전:

```tsx
                {/* 내측 숫자 볼 영역 — 한 줄(nowrap) 유지 */}
                <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[2px_2px_0px_0px_#000000]">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
                        <div className="shrink-0 px-1 text-sm font-black text-black sm:text-base">각조</div>
                        {set.number.split('').map((digit, index) => (
                            <PensionDigitBall key={`featured-${set.label}-${index}`} value={digit} color={RECOMMENDATION_COLORS[index]} size="sm" />
                        ))}
                    </div>
                </div>
            </div>
```

교체 후:

```tsx
                {/* 내측 숫자 볼 영역 — 한 줄(nowrap) 유지 */}
                <div className="flex flex-col items-stretch gap-3">
                    <div className="border-2 border-black bg-white rounded-xl px-4 py-4 shadow-[2px_2px_0px_0px_#000000]">
                        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
                            <div className="shrink-0 px-1 text-sm font-black text-black sm:text-base">각조</div>
                            {set.number.split('').map((digit, index) => (
                                <PensionDigitBall key={`featured-${set.label}-${index}`} value={digit} color={RECOMMENDATION_COLORS[index]} size="sm" />
                            ))}
                        </div>
                    </div>
                    {action}
                </div>
            </div>
```

- [ ] **Step 3: PensionPage 모달 prop을 단수로 변경**

`frontend/src/components/pension/PensionPage.tsx`에서 모달 렌더링 블록을

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

다음으로 교체 (대표 세트가 없으면 모달을 열 일이 없다):

```tsx
            {showTicketModal && featuredRecommendation && (
                <PensionPurchaseTicketModal
                    set={featuredRecommendation}
                    targetDrawNo={targetDrawNo}
                    saving={saving}
                    onSave={handleSavePurchase}
                    onClose={() => setShowTicketModal(false)}
                />
            )}
```

- [ ] **Step 4: 저장 핸들러를 대표 1세트만 보내도록 변경**

같은 파일의 `handleSavePurchase`를 다음으로 교체:

```tsx
    const handleSavePurchase = async () => {
        if (!featuredRecommendation) return;
        if (!window.confirm(`제 ${targetDrawNo}회 추첨 대상으로 이 번호를 각조 구매로 저장할까요?`)) return;
        const result = await savePurchase(pensionAlgorithm, [featuredRecommendation]);
        if (result) {
            onSyncMessage(`구매번호 저장 완료 (제 ${result.drawNo}회)`);
            setShowTicketModal(false);
        } else {
            onSyncError('구매번호 저장에 실패했습니다.');
        }
    };
```

- [ ] **Step 5: 섹션 하단 구매 버튼 제거**

같은 파일에서 아래 블록을 **통째로 삭제**한다:

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

- [ ] **Step 6: 대표 카드에 버튼 전달**

같은 파일의 대표 카드 렌더링을

```tsx
                    {featuredRecommendation && (
                        <div className="mb-4">
                            <FeaturedPensionRecommendationCard set={featuredRecommendation} />
                        </div>
                    )}
```

다음으로 교체:

```tsx
                    {featuredRecommendation && (
                        <div className="mb-4">
                            <FeaturedPensionRecommendationCard
                                set={featuredRecommendation}
                                action={
                                    <button
                                        type="button"
                                        onClick={() => setShowTicketModal(true)}
                                        disabled={maxDrawNo === 0}
                                        className="neo-btn neo-btn-purple inline-flex h-11 w-full items-center justify-center px-6 text-sm font-black disabled:opacity-60"
                                    >
                                        이 번호로 구매
                                    </button>
                                }
                            />
                        </div>
                    )}
```

- [ ] **Step 7: typecheck**

Run (from repo root): `npm run typecheck`

Expected: 에러 없이 종료. 실패하면 `noUnusedLocals` 위반(예: 더 이상 쓰지 않는 import)을 먼저 확인한다.

- [ ] **Step 8: 프론트 빌드**

Run (from `frontend/`): `npm run build`

Expected: `✓ built in ...` 성공.

- [ ] **Step 9: 커밋 (Task 3·4·5 함께)**

```bash
git add frontend/src/components/pension/PensionPurchaseTicketModal.tsx frontend/src/components/pension/PensionPurchaseHistorySection.tsx frontend/src/components/pension/PensionCards.tsx frontend/src/components/pension/PensionPage.tsx
git commit -m "feat: 대표 추천 카드에 구매 버튼 배치 및 구매 티켓·기록 1조~5조 전개"
```

---

### Task 6: 로컬 통합 검증

**Files:**

- 코드 변경 없음 (검증만)

**Interfaces:**

- Consumes: Task 1~5 전체.

- [ ] **Step 1: 개발 서버 기동**

Run (from repo root): `npm run dev`

Expected: backend `Ready on http://localhost:8787`, frontend `http://localhost:5173/`.

- [ ] **Step 2: 추첨 전 상태 확인 (브라우저)**

브라우저에서 `http://localhost:5173/` → 연금복권 탭:

1. "추천번호 생성" → 대표 추천 카드가 뜨고 그 **카드 안에** "이 번호로 구매" 버튼이 보인다. 추천 섹션 하단에는 버튼이 없다.
2. 버튼 클릭 → 모달에 `1조`~`5조` **5줄**, 5줄 모두 같은 6자리, 하단 `1번호 × 각조 5매 = 5,000원`
3. "저장" → confirm `제 N회 추첨 대상으로 이 번호를 각조 구매로 저장할까요?` → 확인 → 토스트 `구매번호 저장 완료 (제 N회)` → 모달 닫힘
4. "내 구매 기록" 섹션에 티켓 카드 1장, 그 안에 `1조`~`5조` 5줄, 5줄 모두 `추첨 전` 배지

- [ ] **Step 3: 1·2등 분리 확인 (핵심 검증)**

로컬 D1의 323회는 `winning_band=4`, `winning_number=604270`, `bonus_number=945893`이다.
저장된 번호를 당첨번호와 같게 맞추고 회차를 323으로 옮긴다.

Run (from `backend/`):

```bash
npx wrangler d1 execute lotto_db --local --command "UPDATE pension_purchases SET number = '604270', draw_no = 323;"
```

브라우저 새로고침 후 확인:

- **4조 줄에만 `1등` 배지**, 나머지 1·2·3·5조 줄은 `2등` 배지
- 5줄 모두 6자리가 원색(회색조 없음)
- 티켓 하단에 `당첨 4조 604270 · 보너스 945893 · 1등 1매 · 2등 4매`

323회 데이터가 다르면 아래로 실제 값을 확인하고 기대값을 맞춰 재검증한다:

```bash
npx wrangler d1 execute lotto_db --local --command "SELECT draw_no, winning_band, winning_number, bonus_number FROM pension720_draws WHERE draw_no = 323;"
```

- [ ] **Step 4: 보너스 확인**

Run (from `backend/`):

```bash
npx wrangler d1 execute lotto_db --local --command "UPDATE pension_purchases SET number = '945893';"
```

브라우저 새로고침 후 확인: 5줄 모두 `보너스` 배지 + `낙첨` 배지(등수 없음), 6자리 모두 원색, 하단에 `낙첨 · 보너스 5매`.

- [ ] **Step 5: 부분 일치 확인**

Run (from `backend/`):

```bash
npx wrangler d1 execute lotto_db --local --command "UPDATE pension_purchases SET number = '114270';"
```

브라우저 새로고침 후 확인: 5줄 모두 `4등` 배지, 뒤 4자리(`4270`)만 원색이고 앞 2자리(`11`)는 회색조 + 반투명, 하단에 `4등 5매`.

- [ ] **Step 6: 모바일 폭 확인 (390px)**

devtools에서 폭 390px로 전환해 확인:

- 모달의 `N조` + 숫자 볼 6개가 가로 스크롤 없이 한 줄에 들어간다
- 기록의 조 행에서 `N조` + 볼 6개 + 등수 배지가 겹치거나 넘치지 않는다
- 페이지 전체에 가로 스크롤이 생기지 않는다

넘친다면 조 라벨 폭(`w-8 sm:w-9`)을 줄이거나 볼 간격(`gap-1`)을 좁혀 대응한다. 새 컴포넌트를 만들지 말 것.

- [ ] **Step 7: 삭제 확인**

구매 기록 카드의 휴지통 버튼 클릭 → confirm `이 구매 기록을 삭제할까요?` → 확인 → 카드가 사라지고 빈 상태 안내(`저장된 구매번호가 없습니다. 대표 추천 카드에서 "이 번호로 구매"를 눌러보세요.`)가 표시된다.

- [ ] **Step 8: 커밋**

코드 변경이 없으면 커밋할 것이 없다. Step 6에서 폭 조정을 했다면:

```bash
git add frontend/src/components/pension/PensionPurchaseTicketModal.tsx frontend/src/components/pension/PensionPurchaseHistorySection.tsx
git commit -m "fix: 연금복권 구매 조 행 모바일(390px) 폭 조정"
```

---

### Task 7: 프로덕션 D1 마이그레이션 + 배포

**Files:**

- 코드 변경 없음 (운영 반영만)

**Interfaces:**

- Consumes: Task 1~6 전체.

> **사용자 승인 필요:** 이 태스크는 되돌리기 어려운 외부 작업이다. Task 6 브라우저 검증을 사용자가 확인한 뒤에만 실행한다.

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
