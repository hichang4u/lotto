# 로또 구매번호 관리 (구매 티켓 + 자동 당첨 확인) 설계

- 날짜: 2026-07-19
- 상태: 사용자 승인 대기
- 범위: 로또만 (연금복권은 검증 후 확장)

## 목적

추천번호 5세트를 실제 로또 구매용지처럼 한 장의 티켓으로 저장하고,
당첨번호 동기화 시 저장된 구매번호를 자동 판정하여 등수를 알려준다.
생성 당시의 알고리즘 정보(엔진 버전·규칙·가중치)를 함께 기록해
실전 데이터 기반 알고리즘 개선의 근거를 쌓는다.

## 확정된 결정

| 항목 | 결정 |
| --- | --- |
| 핵심 목적 | 당첨 자동 확인 (동기화 시 자동 판정 + 알림) |
| 적용 범위 | 로또만 먼저 |
| 저장 위치 | D1 + 익명 기기 ID (localStorage UUID) |
| 대상 회차 | 서버가 `MAX(drwNo)+1`로 자동 지정 |
| UI 배치 | 로또 페이지 내 섹션 (별도 페이지 없음) |
| 세트 선택 | 항상 5세트 전체를 한 티켓으로 저장 (부분 선택 없음) |
| 판정 주체 | 서버 (조회 API가 판정까지 계산해 반환) — 접근 A |
| 알고리즘 이력 | 티켓별 `algorithm`(엔진 버전) + 게임별 `rule_id`/`rule_weight` 저장 |

## 데이터 모델 (D1)

`backend/schema.sql`에 추가:

```sql
CREATE TABLE IF NOT EXISTS lotto_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id TEXT NOT NULL,      -- 한 번의 구매(5게임)를 묶는 UUID (서버 발급)
  device_id TEXT NOT NULL,      -- 익명 기기 ID (프론트 localStorage UUID)
  draw_no INTEGER NOT NULL,     -- 대상 회차 (저장 시점 서버 계산: MAX(drwNo)+1)
  game_index INTEGER NOT NULL,  -- 0~4 (A~E 게임)
  numbers TEXT NOT NULL,        -- "3,11,17,24,35,42" (오름차순 6개, 콤마 구분)
  rule_id TEXT,                 -- 생성 규칙 (예: 'zone-distribution')
  label TEXT,                   -- 세트 라벨 (예: '구간 분포형')
  algorithm TEXT,               -- 생성 엔진 버전 (예: 'v4.0')
  rule_weight REAL,             -- 생성 당시 해당 규칙 가중치
  created_at TEXT NOT NULL      -- ISO 8601
);
CREATE INDEX IF NOT EXISTS idx_purchases_device ON lotto_purchases(device_id, draw_no);
```

- 게임당 1행, 티켓당 5행.
- **매칭 키**: `lotto_purchases.draw_no` ↔ `lotto_history.drwNo`(PK).
  해당 회차 결과가 D1에 있으면 판정, 없으면 추첨 전(`pending`).

## 기기 ID

- 프론트 최초 방문 시 `crypto.randomUUID()` 생성 → localStorage 키 `lotto-device-id`.
- 상수는 `frontend/src/constants/index.ts`에 추가.
- 모든 구매 API 호출에 deviceId 포함. 서버는 device_id 불일치 데이터를 반환/삭제하지 않는다.

## API (Cloudflare Workers, route → service → query 레이어 준수)

### POST `/api/purchases`

요청:

```json
{
  "deviceId": "uuid",
  "algorithm": "v4.0",
  "games": [
    { "numbers": [3,11,17,24,35,42], "ruleId": "odd-balance", "label": "홀짝 균형형", "ruleWeight": 0.913 }
  ]
}
```

- 검증: games는 정확히 5개, 각 게임은 1~45 범위의 중복 없는 6개 숫자.
- 서버가 `ticket_id`(UUID) 발급, `draw_no = (SELECT MAX(drwNo) FROM lotto_history) + 1` 계산.
  `lotto_history`가 비어 있으면 400 에러(동기화 선행 필요 메시지).
- 응답: `{ "success": true, "ticketId": "uuid", "drawNo": 1182 }`

### GET `/api/purchases?deviceId=...`

- 해당 기기의 구매 전체를 `lotto_history` LEFT JOIN으로 조회.
  정렬: 회차 내림차순, 같은 회차 안에서는 저장 시각 내림차순.
- 게임별 판정 필드를 서버가 계산해 부착:
  - `matches`: 당첨번호 6개와의 일치 개수
  - `hasBonus`: 보너스 번호 포함 여부
  - `rank`: 1~5 (등수), 0 = 낙첨 — **백테스트의 `getPrizeTier(matches, hasBonus)` 재사용**
    (현재 `backend/src/services/lotto-backtest.ts` 내부 함수 → 공용 위치로 export)
  - `status`: `'pending'`(해당 회차 결과 없음) | `'judged'`(판정 완료)
- 응답 구조: 티켓 단위로 그룹핑.

```json
{
  "tickets": [
    {
      "ticketId": "uuid",
      "drawNo": 1182,
      "algorithm": "v4.0",
      "createdAt": "2026-07-19T…",
      "status": "judged",
      "draw": { "drwNo": 1182, "numbers": [/* 6개 */], "bnusNo": 7, "drwNoDate": "…" },
      "games": [
        { "gameIndex": 0, "numbers": [3,11,17,24,35,42], "ruleId": "odd-balance",
          "label": "홀짝 균형형", "ruleWeight": 0.913,
          "matches": 2, "hasBonus": false, "rank": 0 }
      ]
    }
  ]
}
```

- `pending` 티켓은 `draw: null`, 게임의 `matches`/`hasBonus`/`rank`는 null.

### DELETE `/api/purchases/:ticketId?deviceId=...`

- `ticket_id` + `device_id` 일치 행 전체(5행) 삭제.
- 응답: `{ "success": true }`. 일치 행이 없으면 404.

## UI 플로우 (로또 페이지)

1. **구매 버튼**: 추천 5세트가 화면에 생성된 상태에서만 추천 영역에
   "이 번호로 구매" 버튼 표시(세트 없으면 미표시/비활성).
   프론트는 생성 응답의 `algorithm` 값을 상태로 보관해 구매 시 전달한다
   (현재 `useLottoPage`는 이 값을 버리고 있음 → 보관하도록 수정).
2. **티켓 모달**: 실제 로또 용지처럼 A~E 5게임을 한 장에 표시.
   상단에 대상 회차("제 1182회 추첨") 표시. 대상 회차는 로드된 최신 회차 + 1로 프론트가 표시하되,
   저장 확정 값은 서버 계산 결과(`drawNo` 응답)를 따른다. 네오 브루탈리즘 스타일 유지.
3. **저장**: 모달의 "저장" 클릭 → confirm 알림창
   "제 1182회 추첨 대상으로 5게임을 저장할까요?" → 확인 시 POST →
   성공 토스트 "구매번호 저장 완료 (제 1182회)" → 모달 닫힘, 구매 기록 갱신.
4. **내 구매 기록 섹션**: 페이지 하단(풋터 위)에 회차별 최신순 티켓 목록.
   - 티켓 헤더: 회차, 저장일, 알고리즘 버전 배지, 상태 배지(추첨 전/판정 완료), 삭제 버튼.
   - 게임 행: A~E 라벨 + 번호 볼 6개 + 규칙 라벨 + 판정 배지(추첨 전/낙첨/N등).
   - 판정된 게임은 일치하는 볼만 원래 색으로, 불일치 볼은 흐리게(회색조 + 투명도) 표시.
     보너스 일치 볼에는 기존 `BonusBadge` 표시.
   - 삭제는 confirm 후 DELETE 호출.
5. **동기화 시 자동 확인**: "당첨번호 동기화" 성공 후 구매 기록을 재조회.
   직전 조회에서 `pending`이던 티켓이 `judged`로 바뀐 경우 토스트로 결과 요약:
   예) "제 1182회 구매번호 결과: 5등 1게임, 낙첨 4게임".
   당첨 게임이 하나도 없으면 "제 1182회 구매번호: 아쉽지만 모두 낙첨입니다."

## 엣지 케이스

- 같은 회차에 여러 티켓 저장 가능(중복 구매 허용).
- 생성 API 실패로 로컬 랜덤 폴백 세트가 표시된 경우에도 구매 저장 가능 —
  이때 `algorithm`/`ruleId`/`ruleWeight`는 null로 저장(프론트가 폴백 시 algorithm을 null로 전달).
- `lotto_history`가 빈 DB에서 POST → 400 + "먼저 당첨번호를 동기화해주세요."
- 존재하지 않는 deviceId로 GET → 빈 목록(에러 아님).
- 판정 기준: 3개 일치=5등, 4개=4등, 5개=3등, 5개+보너스=2등, 6개=1등 (백테스트와 동일 로직 재사용).

## 이번 범위에서 제외 (YAGNI)

- 연금복권 구매 관리 (로또 검증 후 확장)
- 세트 부분 선택 / 수동 번호 입력
- 알고리즘 성과 집계 대시보드 (데이터 축적이 선행 — 컬럼만 확보)
- 계정/기기 간 동기화
- 누적 수익률 계산

## 테스트/검증

- 백엔드: `npm run typecheck` 통과. 판정 로직(`getPrizeTier` 재사용) 및
  조회 응답 구성은 로컬 wrangler dev 환경에서 시나리오 검증
  (저장 → pending 확인 → 결과 존재 회차로 저장된 데이터 판정 확인 → 삭제).
- 프론트: 티켓 모달·구매 기록 섹션을 playwright(msedge 채널) 스크린샷으로
  데스크톱/모바일 폭 확인 — 기존 검증 방식과 동일.
- 프로덕션 D1 마이그레이션: `wrangler d1 execute`로 새 테이블 생성 후 배포.
