# 시스템 아키텍처

## 전체 구조
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│ - Dashboard     │    │ - API Server    │    │ - CCTV API      │
│ - Camera View   │    │ - WebSocket     │    │ - AI Model      │
│ - Management    │    │ - AI Service    │    │ - Database      │
│ - Settings      │    │ - Admin Service │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 컴포넌트 설명

### 프론트엔드
- **React + TypeScript**: UI 프레임워크
- **Redux Toolkit**: 상태 관리
- **Socket.IO Client**: 실시간 통신
- **Chart.js**: 데이터 시각화

### 백엔드
- **Express.js**: REST API 서버
- **Socket.IO**: 실시간 통신
- **MongoDB**: 데이터 저장소
- **Node-Cron**: 스케줄링 작업

### 외부 서비스
- **CCTV API**: 실시간 영상 스트림
- **AI Model**: 차량 탐지 및 분류
- **MongoDB**: 데이터베이스

## 데이터 흐름
1. CCTV API에서 영상 스트림 수신
2. AI 모델이 영상에서 차량 탐지
3. 탐지 결과를 데이터베이스에 저장
4. 관리자에게 알림 전송
5. 관리자가 결과 검토 및 승인/거부
6. 프론트엔드에 실시간 업데이트 전송

## 주요 기능
- 실시간 차량 탐지 및 분류
- 관리자 승인 워크플로우
- 차량 통계 및 분석
- CCTV 스트림 모니터링
- 알림 시스템
