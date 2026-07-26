# 연금복권 구매번호 관리 (각조 구매 티켓 + 자동 당첨 확인) 설계

- 날짜: 2026-07-26
- 개정: 2026-07-27 — 저장 단위를 4세트 → **대표 1세트**로 축소, 구매 기록을 **1~5조 5줄로 전개**
- 상태: 사용자 승인 완료
- 범위: 연금복권720+ (로또 구매번호 관리 기능의 연금복권 확장)
- 선행 스펙: `2026-07-19-lotto-purchase-tracking-design.md`

## 목적

연금복권 대표 추천번호 1세트를 각조(1~5조) 구매 티켓으로 저장하고, 당첨번호 동기화 시
저장된 구매번호를 자동 판정해 조별 등수를 알려준다.
로또와 동일하게 생성 당시의 알고리즘 정보(엔진 버전·성향 규칙·가중치)를 함께 기록해
알고리즘 개선의 근거를 쌓는다.

## 확정된 결정

| 항목 | 결정 |
| --- | --- |
| 저장 형태 | 조 없이 6자리만 저장 = **각조(1~5조 전부) 구매**, 번호당 5매 |
| 저장 단위 | **대표 추천 1세트 = 티켓 1장** (각조 구매가 회차당 한도 5매를 모두 소진하므로 번호는 하나만) |
| 대표 세트 | `buildPensionRecommendations`가 반환하는 첫 세트 (= 이력 가중치 1위 성향). 백테스트 실측 성과는 반영하지 않음 — 별도 과제 |
| 기록 표시 | 저장된 번호를 **1조~5조 5줄로 전개** |
| 판정 표기 | **줄(=조) 단위 등수**. 6자리 전장 일치 시 당첨 조 줄만 1등, 나머지 4줄 2등 |
| 대상 회차 | 서버가 `MAX(draw_no) + 1`로 자동 지정 |
| 저장 위치 | D1 + 익명 기기 ID (localStorage UUID) |
| 조회/삭제 범위 | 기기 구분 없이 전체 (로또 현행과 동일, `device_id`는 기록 목적으로만 저장) |
| 판정 주체 | 서버 (조회 API가 판정까지 계산해 반환) |
| UI 배치 | 연금복권 페이지 내 섹션 (별도 페이지 없음) |
| 코드 구조 | 로또 구조를 병렬 미러링 (공용 추상화하지 않음) |

### 각조 구매를 선택한 이유

연금복권720+의 1등은 `조(1~5) + 6자리` 일치로 결정된다.
현재 추천 알고리즘(`pension-multi-set-v3.0`)은 통계적 근거가 있는 6자리만 생성하고
조는 생성하지 않는다. 6자리만 저장하고 이를 "각조 구매"로 해석하면
조를 임의 생성하지 않으면서도 1등 판정까지 가능하다.

### 대표 1세트만 저장하는 이유

연금복권720+는 회차당 최대 5매를 살 수 있고, 각조 구매는 한 번호를 1~5조에 각 1매씩
사는 것이라 그것만으로 5매 한도를 모두 쓴다. 즉 **각조로 사면 번호는 하나뿐**이다.
추천 4세트를 모두 저장하면 실제로는 살 수 없는 조합(20매)을 기록하게 되므로,
대표 추천 1세트만 저장해 실제 구매 가능한 형태와 일치시킨다.
나머지 3세트는 추천 화면에서 계속 볼 수 있고, 저장 대상만 아니다.

### 조별 5줄 전개를 선택한 이유

각조 구매의 실물 용지는 `1조 158204 / 2조 158204 / … / 5조 158204`처럼 5줄로 인쇄된다.
한 줄에 `각조`로 압축하면 1등과 2등이 왜 갈리는지가 드러나지 않는다.
5줄로 펼치면 **당첨 조 줄만 1등, 나머지 4줄이 2등**이라는 규칙이 화면에서 그대로 읽힌다.

## 판정 규칙

`longestSuffixMatch(number, winning_number)`로 뒤에서부터 연속 일치 자리수(0~6)를 구한 뒤,
각조 5매 기준으로 등수별 매수를 집계한다.

| 끝자리 연속 일치 | 각조 5매 판정 |
| --- | --- |
| 6자리 (전장) | **1등 1매 + 2등 4매** (당첨 조 1매가 1등, 나머지 4조가 2등) |
| 5자리 | 3등 5매 |
| 4자리 | 4등 5매 |
| 3자리 | 5등 5매 |
| 2자리 | 6등 5매 |
| 1자리 | 7등 5매 |
| 0자리 | 낙첨 |

- 1~5자리 구간의 등수는 `rank = 8 - suffixMatches`로 계산한다.
- **보너스**: 저장 번호가 `bonus_number` 6자리와 전장 일치하면 **보너스 5매**.
  보너스는 당첨번호와 별개로 추첨되므로 등수 당첨과 중복 발생할 수 있고
  (예: 당첨번호 끝 3자리 일치 + 보너스번호 전장 일치),
  이 경우 `5등 5매 · 보너스 5매`처럼 **함께 표시**한다.
- `winning_number`와 `bonus_number`는 서로 다르므로 보너스 전장 일치와
  1·2등이 동시에 발생할 수는 없다.

### 조별 줄 단위 판정 (표시 계층)

API는 위 표대로 티켓 전체의 `prizeCounts`(등수→매수)를 그대로 반환하고,
프론트가 `draw.winningBand`와 `suffixMatches`로 줄별 등수를 파생한다.
백엔드 판정 로직·응답 형태는 바꾸지 않는다.

| 상황 | 1조 | 2조 | 3조 | 4조 | 5조 |
| --- | --- | --- | --- | --- | --- |
| 추첨 전 | 추첨 전 | 추첨 전 | 추첨 전 | 추첨 전 | 추첨 전 |
| 6자리 일치, 당첨 조 = 4 | 2등 | 2등 | 2등 | **1등** | 2등 |
| 3자리 일치 | 5등 | 5등 | 5등 | 5등 | 5등 |
| 0자리 일치 | 낙첨 | 낙첨 | 낙첨 | 낙첨 | 낙첨 |
| 보너스 전장 일치 | 보너스 | 보너스 | 보너스 | 보너스 | 보너스 |

- 보너스는 조와 무관하게 6자리만 맞으면 되므로 **5줄 모두**에 병기한다.
- 숫자 볼의 회색조 강조(뒤에서부터 일치한 자리만 원색)는 5줄이 동일하다.
- 줄별 등수 파생식: `suffixMatches === 6`이면 `조 === Number(winningBand) ? 1 : 2`,
  `1 <= suffixMatches <= 5`면 `8 - suffixMatches`, `0`이면 낙첨.

## 데이터 모델 (D1)

`backend/schema.sql` 끝에 추가:

```sql
CREATE TABLE IF NOT EXISTS pension_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,      -- 한 번의 구매를 묶는 UUID (서버 발급)
  device_id TEXT NOT NULL,      -- 익명 기기 ID (프론트 localStorage UUID)
  draw_no INTEGER NOT NULL,     -- 대상 회차 (저장 시점 서버 계산: MAX(draw_no)+1)
  game_index INTEGER NOT NULL,  -- 항상 0 (대표 1세트). 컬럼은 로또 구조와 맞추기 위해 유지
  number TEXT NOT NULL,         -- "158204" (6자리 문자열, 각조 구매)
  rule_id TEXT,                 -- 생성 성향 (예: 'balanced-core')
  label TEXT,                   -- 세트 라벨 (예: '균형형 추천')
  algorithm TEXT,               -- 생성 엔진 버전 (예: 'pension-multi-set-v3.0')
  rule_weight REAL,             -- 생성 당시 해당 성향 가중치
  created_at TEXT NOT NULL      -- ISO 8601
);
CREATE INDEX IF NOT EXISTS idx_pension_purchases_device ON pension_purchases(device_id, draw_no);
```

- 티켓당 1행(대표 1세트). 조별 5줄은 화면에서만 전개하며 DB에 5행을 넣지 않는다 —
  조는 저장 대상이 아니고 5매는 "각조 구매"라는 해석에서 나오는 값이기 때문이다.
- **매칭 키**: `pension_purchases.draw_no` ↔ `pension720_draws.draw_no`(PK).
  해당 회차 결과가 D1에 있으면 판정, 없으면 추첨 전(`pending`).
- 기기 ID는 로또와 동일한 `frontend/src/utils/device.ts`의 `getDeviceId()`
  (localStorage 키 `DEVICE_ID_STORAGE_KEY`)를 그대로 재사용한다. 새 키를 만들지 않는다.

## 백엔드 구조

로또와 동일한 `route → service → query` 레이어를 따르고, 파일도 병렬로 신설한다.

| 파일 | 내용 |
| --- | --- |
| `backend/src/algorithms/pension.ts` | `longestSuffixMatch` 이관 + `getPensionPrizeCounts(suffixMatches)` 신설 |
| `backend/src/services/pension-backtest.ts` | 로컬 `longestSuffixMatch` 정의 제거 → `algorithms/pension`에서 import |
| `backend/src/types/pension/purchases.ts` | 신설 (입력/행/응답 타입) |
| `backend/src/types/pension/index.ts` | purchases 타입 re-export 추가 |
| `backend/src/queries/pension/purchases.ts` | 신설 (insert / joined select / delete) |
| `backend/src/queries/pension/index.ts` | purchases 쿼리 re-export 추가 |
| `backend/src/services/pension-purchases.ts` | 신설 (검증·저장·판정·삭제) |
| `backend/src/services/pension.ts` | purchases 서비스 re-export 추가 |
| `backend/src/routes/pension.ts` | `/purchases` POST·GET·DELETE 추가 |

`longestSuffixMatch`는 현재 `services/pension-backtest.ts`에만 있고 외부 사용처가 없다.
로또에서 `getPrizeTier`를 `algorithms/lotto.ts`로 공용화한 것과 동일한 패턴으로
`algorithms/pension.ts`로 옮긴다.

### 검증 규칙

로또(`lotto-purchases.ts`)의 상수·에러 문구 구조를 그대로 따른다.

- `deviceId`: 필수 문자열, 최대 64자
- `algorithm`: 선택, 최대 100자
- `games`: 정확히 1개 (`PENSION_GAMES_PER_TICKET = 1` 상수)
- `games[].number`: `0-9`로만 이루어진 정확히 6자 문자열
- `games[].ruleId` / `label`: 선택, 각 최대 100자
- `games[].ruleWeight`: 선택, 유한 수
- `pension720_draws`가 비어 있으면 400 + "먼저 당첨번호를 동기화해주세요."
- 400 판별용 `PENSION_PURCHASE_VALIDATION_ERRORS` 배열을 export (로또와 동일 방식)

## API

### POST `/api/pension/purchases`

요청:

```json
{
  "deviceId": "uuid",
  "algorithm": "pension-multi-set-v3.0",
  "games": [
    { "number": "158204", "ruleId": "balanced-core", "label": "균형형 추천", "ruleWeight": 1.412 }
  ]
}
```

- 서버가 `ticket_id`(UUID) 발급, `draw_no = MAX(draw_no) + 1` 계산.
  회차 조회는 기존 `getLatestStoredPensionDrawNo`(빈 DB면 `0` 반환)를 재사용한다.
- 요청 본문이 JSON이 아니거나 `null`/배열이면 400 (로또 라우트와 동일 처리).
- 응답: `{ "success": true, "ticketId": "uuid", "drawNo": 325 }`

### GET `/api/pension/purchases`

- `pension720_draws` LEFT JOIN으로 전체 티켓 조회.
  정렬: `draw_no DESC, created_at DESC, game_index ASC`.
- 응답:

```json
{
  "tickets": [
    {
      "ticketId": "uuid",
      "drawNo": 323,
      "algorithm": "pension-multi-set-v3.0",
      "createdAt": "2026-07-26T…",
      "status": "judged",
      "draw": {
        "drawNo": 323,
        "winningBand": "4",
        "winningNumber": "604270",
        "bonusNumber": "945893",
        "drawDate": "2026-07-23"
      },
      "games": [
        {
          "gameIndex": 0,
          "number": "158204",
          "ruleId": "balanced-core",
          "label": "균형형 추천",
          "ruleWeight": 1.412,
          "suffixMatches": 2,
          "prizeCounts": { "6": 5 },
          "bonusMatched": false,
          "topRank": 6
        }
      ]
    }
  ]
}
```

- `pending` 티켓은 `draw: null`, 게임의 `suffixMatches`/`prizeCounts`/`bonusMatched`/`topRank`는 `null`.
- `topRank`는 `prizeCounts`의 최소 등수(가장 높은 등수), 낙첨이면 `0`.
- `prizeCounts` 키는 등수(1~7), 값은 매수. 낙첨이면 빈 객체 `{}`.

### DELETE `/api/pension/purchases/:ticketId`

- `ticket_id` 일치 행 전체(1행) 삭제. 응답 `{ "success": true }`, 없으면 404.

## 프론트엔드

| 파일 | 내용 |
| --- | --- |
| `frontend/src/types/index.ts` | `PensionPurchaseTicket` / `PensionPurchaseGameResult` 등 추가 |
| `frontend/src/hooks/usePensionPage.ts` | generate 응답의 `algorithm`을 상태로 보관 (현재 버리고 있음) |
| `frontend/src/hooks/usePensionPurchases.ts` | 신설 |
| `frontend/src/components/pension/PensionPurchaseTicketModal.tsx` | 신설 |
| `frontend/src/components/pension/PensionPurchaseHistorySection.tsx` | 신설 |
| `frontend/src/components/pension/PensionPage.tsx` | 구매 버튼 + 기록 섹션 + 동기화 후 판정 알림 |

### UI 플로우

1. **구매 버튼**: 추천 세트가 생성된 상태에서만 추천 섹션 하단에 "이 번호로 구매" 표시.
   최신 회차를 아직 못 불러온 상태(`maxDrawNo === 0`)면 비활성.
   저장 대상은 **대표 추천 1세트**(`pensionRecommendations[0]`)다.
2. **티켓 모달**: 대표 1세트를 `1조`~`5조` 5줄로 전개. 헤더에 `제 N회 추첨` + `각조 구매` 배지,
   각 줄은 조 라벨 + `PensionDigitBall` 6개(5줄 모두 같은 번호).
   하단에 "1번호 × 각조 5매 = 5,000원" 안내와 성향 라벨. 네오 브루탈리즘 스타일 유지.
3. **저장**: "저장" 클릭 → confirm "제 N회 추첨 대상으로 이 번호를 각조 구매로 저장할까요?"
   → POST → 토스트 "구매번호 저장 완료 (제 N회)" → 모달 닫힘, 기록 갱신.
4. **내 구매 기록 섹션**: 백테스트 섹션 아래에 회차별 최신순 티켓 목록.
   - 티켓 헤더: 회차, `각조 구매` 배지, 상태 배지(추첨 전/판정 완료), 알고리즘 배지, 저장일, 삭제 버튼.
   - **조 행 5개**: `1조`~`5조` 라벨 + 6자리 볼 + 우측 판정 배지.
     판정 완료 시 **뒤에서부터 연속 일치한 자리만 원래 색**, 나머지는 회색조 + 반투명
     (로또 기록 행의 강조 방식과 동일한 처리). 5줄 모두 같은 강조가 적용된다.
   - 줄별 판정 배지: `1등` / `2등` / `5등` / `낙첨` / `추첨 전`,
     보너스 전장 일치 시 5줄 모두에 `보너스` 배지 추가.
   - 티켓 하단 요약: `제 N회 · 1등 1매 · 2등 4매`처럼 등수별 매수 합계를 한 줄로.
   - 판정 완료 티켓 하단: `당첨 4조 604270 · 보너스 945893`.
   - 삭제는 confirm 후 DELETE.
   - 성향 라벨은 티켓 헤더에 한 번만 표시한다(줄마다 반복하지 않는다).
5. **동기화 시 자동 확인**: 연금복권 "최신 결과 동기화" 성공 후 기록 재조회.
   직전에 `pending`이던 티켓이 `judged`로 바뀌면 토스트로 요약:
   예) "제 324회 구매번호 결과: 5등 5매".
   당첨이 하나도 없으면 "제 324회 구매번호: 아쉽지만 모두 낙첨입니다."

## 엣지 케이스

- 같은 회차에 여러 티켓 저장 가능(중복 구매 허용). 실제 한도(5매)를 넘는 저장도 막지 않는다 —
  기록 목적이므로 사용자가 여러 번 눌러 저장하는 것을 제한하지 않는다.
- `winning_band`가 `"1"`~`"5"` 밖의 값이거나 숫자로 파싱되지 않으면
  6자리 전장 일치라도 어느 줄이 1등인지 정할 수 없다. 이 경우 5줄 모두 2등으로 표시한다
  (티켓 하단 합계는 API의 `prizeCounts`를 그대로 쓰므로 `1등 1매 · 2등 4매`로 유지된다).
- `pension720_draws`가 빈 DB에서 POST → 400 + "먼저 당첨번호를 동기화해주세요."
- 저장된 번호가 앞자리 `0`으로 시작해도(`"045893"`) 문자열로 저장·비교하므로 손실 없음.
  판정 시에도 `padStart(6, '0')`로 정규화한다.
- 삭제된 티켓 재삭제 → 404.

## 이번 범위에서 제외 (YAGNI)

- 조 지정 구매 (특정 조만 구매)
- 수동 번호 입력
- A~D 중 사용자가 저장할 세트를 고르는 UI (대표 1세트 고정)
- 대표 선정에 백테스트 실측 성과를 반영하는 알고리즘 개선 (별도 과제)
- 5매 한도 초과 저장 차단
- 당첨금 합계 / 누적 수익률 계산
- 알고리즘 성과 집계 대시보드 (컬럼만 확보)

## 테스트/검증

- `npm run typecheck` (frontend + backend) 통과.
- 로컬 wrangler dev 시나리오:
  1. 저장 → `pending` 확인
  2. `games` 2개 이상 POST → 400 확인
  3. `UPDATE pension_purchases SET draw_no = <결과 있는 회차>` → 판정 확인
  4. 6자리 전장 일치 케이스를 삽입해 `1등 1매 + 2등 4매` 확인
  5. `bonus_number`와 전장 일치하는 번호를 삽입해 `보너스 5매` 확인
  6. 삭제 → 404 재확인
- 프론트: 브라우저에서 티켓 모달·구매 기록 섹션을 데스크톱 및 모바일 390px 폭으로 확인.
  특히 6자리 전장 일치 시 **당첨 조 줄에만 1등 배지**가 붙는지 확인한다
  (로컬 323회 = `winning_band 4`, `winning_number 604270` → 4조 줄만 1등).
- 프로덕션 D1 마이그레이션: `wrangler d1 execute lotto_db --remote --file=./schema.sql`
  (`schema.sql` 전체가 `IF NOT EXISTS`라 기존 데이터에 무해) 후 배포.
