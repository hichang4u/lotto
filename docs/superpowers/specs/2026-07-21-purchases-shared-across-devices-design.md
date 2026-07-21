# 구매 기록 기기 구분 없이 전체 조회 — 설계 스펙

- 날짜: 2026-07-21
- 상태: 승인됨 (사용자 선택: "기기 구분 없이 전부 조회")

## 배경 / 문제

구매 기록은 브라우저 localStorage의 익명 기기 ID(UUID)로 구분된다.
크롬에서 저장한 기록이 엣지에서는 다른 기기 ID로 조회되어 보이지 않는다.
데이터 자체는 Cloudflare D1(원격)에 정상 저장되어 있으므로, "누구의 기록인지"
필터가 문제다. 이 앱은 개인용이므로 기기 구분을 없애고 D1의 모든 기록을
어느 브라우저에서든 보이게 한다.

## 결정 사항

- `GET /api/purchases` — deviceId 필터 제거, 모든 티켓 반환 (정렬 기존 유지:
  회차 내림차순 → 저장시각 내림차순 → 게임 인덱스 오름차순)
- `DELETE /api/purchases/:ticketId` — device_id 일치 조건 제거, ticketId만으로 삭제
- `POST /api/purchases` — 변경 없음. deviceId는 "어느 브라우저에서 저장했는지"
  기록용 메타데이터로 계속 저장 (필수 검증도 유지)
- DB 스키마·기존 데이터 변경 없음

## 변경 파일

| 파일 | 변경 |
|---|---|
| `backend/src/queries/lotto/purchases.ts` | 조회·삭제 쿼리에서 device_id 조건 제거 |
| `backend/src/services/lotto-purchases.ts` | `listPurchaseTickets`, `deletePurchaseTicket`에서 deviceId 파라미터 제거 |
| `backend/src/routes/lotto.ts` | GET/DELETE 라우트에서 deviceId 쿼리 파싱 제거 |
| `frontend/src/hooks/usePurchases.ts` | 조회·삭제 요청 URL에서 deviceId 쿼리 제거 (저장 시에는 유지) |

## 트레이드오프 (사용자 인지 완료)

사이트·API가 공개 URL이므로 주소를 아는 누구든 기록을 조회·삭제할 수 있다.
개인용 앱이라 수용하기로 결정. 추후 필요 시 공유 비밀코드 방식으로 보강 가능.

## 검증

1. 타입체크 (`tsc --noEmit` 백엔드·프런트)
2. 로컬 wrangler dev로 저장 → deviceId 없이 조회 → 삭제 라운드트립
3. 배포 후 실서버에서 임의의 다른 deviceId 관점(쿼리 미전달)으로 기존
   크롬 티켓이 조회되는지 확인
