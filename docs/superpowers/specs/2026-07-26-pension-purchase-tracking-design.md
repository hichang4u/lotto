# 연금복권 구매번호 관리 (각조 구매 티켓 + 자동 당첨 확인) 설계

- 날짜: 2026-07-26
- 상태: 사용자 승인 완료
- 범위: 연금복권720+ (로또 구매번호 관리 기능의 연금복권 확장)
- 선행 스펙: `2026-07-19-lotto-purchase-tracking-design.md`

## 목적

연금복권 추천번호 4세트를 한 장의 티켓으로 저장하고, 당첨번호 동기화 시
저장된 구매번호를 자동 판정해 등수와 매수를 알려준다.
로또와 동일하게 생성 당시의 알고리즘 정보(엔진 버전·성향 규칙·가중치)를 함께 기록해
알고리즘 개선의 근거를 쌓는다.

## 확정된 결정

| 항목 | 결정 |
| --- | --- |
| 저장 형태 | 조 없이 6자리만 저장 = **각조(1~5조 전부) 구매**, 번호당 5매 |
| 저장 단위 | 추천 4세트 = 티켓 1장 (부분 선택 없음) |
| 판정 표기 | 등수별 **매수까지 집계** + 보너스 당첨 병기 |
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

## 데이터 모델 (D1)

`backend/schema.sql` 끝에 추가:

```sql
CREATE TABLE IF NOT EXISTS pension_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,      -- 한 번의 구매(4세트)를 묶는 UUID (서버 발급)
  device_id TEXT NOT NULL,      -- 익명 기기 ID (프론트 localStorage UUID)
  draw_no INTEGER NOT NULL,     -- 대상 회차 (저장 시점 서버 계산: MAX(draw_no)+1)
  game_index INTEGER NOT NULL,  -- 0~3 (A~D 게임)
  number TEXT NOT NULL,         -- "158204" (6자리 문자열, 각조 구매)
  rule_id TEXT,                 -- 생성 성향 (예: 'balanced-core')
  label TEXT,                   -- 세트 라벨 (예: '균형형 추천')
  algorithm TEXT,               -- 생성 엔진 버전 (예: 'pension-multi-set-v3.0')
  rule_weight REAL,             -- 생성 당시 해당 성향 가중치
  created_at TEXT NOT NULL      -- ISO 8601
);
CREATE INDEX IF NOT EXISTS idx_pension_purchases_device ON pension_purchases(device_id, draw_no);
```

- 게임당 1행, 티켓당 4행.
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
- `games`: 정확히 4개 (`PENSION_GAMES_PER_TICKET = 4` 상수)
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

- `ticket_id` 일치 행 전체(4행) 삭제. 응답 `{ "success": true }`, 없으면 404.

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
2. **티켓 모달**: A~D 4세트를 한 장으로. 헤더에 `제 N회 추첨` + `각조 구매` 배지,
   각 행은 `PensionDigitBall` 6개 + 성향 라벨.
   하단에 "4번호 × 각조 5매 = 20,000원" 안내. 네오 브루탈리즘 스타일 유지.
3. **저장**: "저장" 클릭 → confirm "제 N회 추첨 대상으로 4세트를 각조 구매로 저장할까요?"
   → POST → 토스트 "구매번호 저장 완료 (제 N회)" → 모달 닫힘, 기록 갱신.
4. **내 구매 기록 섹션**: 백테스트 섹션 아래에 회차별 최신순 티켓 목록.
   - 티켓 헤더: 회차, `각조 구매` 배지, 상태 배지(추첨 전/판정 완료), 알고리즘 배지, 저장일, 삭제 버튼.
   - 게임 행: A~D 라벨 + 6자리 볼 + 우측 판정 배지.
     판정 완료 시 **뒤에서부터 연속 일치한 자리만 원래 색**, 나머지는 회색조 + 반투명
     (로또 기록 행의 강조 방식과 동일한 처리).
   - 판정 배지: `1등 1매 · 2등 4매` / `5등 5매` / `낙첨` / `추첨 전`, 보너스 일치 시 `보너스 5매` 배지 추가.
   - 판정 완료 티켓 하단: `당첨 4조 604270 · 보너스 945893`.
   - 삭제는 confirm 후 DELETE.
5. **동기화 시 자동 확인**: 연금복권 "최신 결과 동기화" 성공 후 기록 재조회.
   직전에 `pending`이던 티켓이 `judged`로 바뀌면 토스트로 요약:
   예) "제 324회 구매번호 결과: 5등 5매, 7등 5매, 낙첨 2게임".
   당첨이 하나도 없으면 "제 324회 구매번호: 아쉽지만 모두 낙첨입니다."

## 엣지 케이스

- 같은 회차에 여러 티켓 저장 가능(중복 구매 허용).
- 한 티켓 안에서 세트 간 번호가 같아도 허용(추천 알고리즘상 사실상 발생하지 않음).
- `pension720_draws`가 빈 DB에서 POST → 400 + "먼저 당첨번호를 동기화해주세요."
- 저장된 번호가 앞자리 `0`으로 시작해도(`"045893"`) 문자열로 저장·비교하므로 손실 없음.
  판정 시에도 `padStart(6, '0')`로 정규화한다.
- 삭제된 티켓 재삭제 → 404.

## 이번 범위에서 제외 (YAGNI)

- 조 지정 구매 (특정 조만 구매)
- 수동 번호 입력
- 세트 부분 선택
- 당첨금 합계 / 누적 수익률 계산
- 알고리즘 성과 집계 대시보드 (컬럼만 확보)

## 테스트/검증

- `npm run typecheck` (frontend + backend) 통과.
- 로컬 wrangler dev 시나리오:
  1. 저장 → `pending` 확인
  2. `UPDATE pension_purchases SET draw_no = <결과 있는 회차>` → 판정 확인
  3. 6자리 전장 일치 케이스를 삽입해 `1등 1매 + 2등 4매` 확인
  4. `bonus_number`와 전장 일치하는 번호를 삽입해 `보너스 5매` 확인
  5. 삭제 → 404 재확인
- 프론트: playwright(msedge 채널)로 티켓 모달·구매 기록 섹션을
  데스크톱 및 모바일 390px 폭 스크린샷 확인.
- 프로덕션 D1 마이그레이션: `wrangler d1 execute lotto_db --remote --file=./schema.sql`
  (`schema.sql` 전체가 `IF NOT EXISTS`라 기존 데이터에 무해) 후 배포.
