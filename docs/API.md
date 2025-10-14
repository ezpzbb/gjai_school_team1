# API 문서

## 개요
CCTV 차량 모니터링 시스템의 API 문서입니다.

## 인증
- JWT 토큰 기반 인증
- Bearer 토큰 사용

## 엔드포인트

### 차량 관련
- GET /api/vehicles - 차량 목록 조회
- GET /api/vehicles/:id - 특정 차량 정보 조회
- GET /api/vehicles/stats - 차량 통계 조회

### 카메라 관련
- GET /api/cameras - 카메라 목록 조회
- GET /api/cameras/:id/stream - 카메라 스트림 조회
- POST /api/cameras/:id/settings - 카메라 설정 변경

### 관리자 관련
- POST /api/admin/approve - 탐지 결과 승인
- POST /api/admin/reject - 탐지 결과 거부
- GET /api/admin/pending - 승인 대기 목록 조회

## 웹소켓 이벤트

### 차량 탐지
- vehicle_detected - 새로운 차량 탐지
- detection_updated - 탐지 결과 업데이트

### 카메라 상태
- camera_status - 카메라 상태 변경
- stream_error - 스트림 오류 발생

### 관리자 알림
- admin_notification - 관리자 알림
- approval_required - 승인 요청
