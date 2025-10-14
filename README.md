# CCTV 차량 모니터링 시스템

AI 모델을 활용한 실시간 차량 탐지 및 관리 시스템입니다.

## 주요 기능

- 🤖 **AI 차량 탐지**: 학습된 모델을 통한 실시간 차량 탐지 및 분류
- 📹 **CCTV 스트리밍**: 실시간 CCTV 영상 모니터링
- 👨‍💼 **관리자 승인**: AI 예측 결과에 대한 관리자 검토 및 승인
- 📊 **통계 분석**: 차량 유동성, 시간별 통계 등 다양한 분석
- 🔔 **실시간 알림**: 관리자에게 즉시 알림 전송
- 📱 **반응형 UI**: 모바일 및 데스크톱 지원

## 기술 스택

### Frontend
- React 18 + TypeScript
- Redux Toolkit (상태 관리)
- Socket.IO Client (실시간 통신)
- Chart.js (데이터 시각화)
- Vite (빌드 도구)

### Backend
- Node.js + Express + TypeScript
- Socket.IO (실시간 통신)
- MongoDB (데이터베이스)
- Node-Cron (스케줄링)
- JWT (인증)

### AI/ML
- ONNX Runtime (모델 추론)
- OpenCV (이미지 처리)
- Custom trained model (차량 탐지)

## 프로젝트 구조

```
gjai_school_team1/
├── frontend/          # React 프론트엔드
├── backend/           # Node.js 백엔드
├── shared/            # 공통 타입 및 유틸리티
├── docs/              # 문서
└── README.md
```

## 빠른 시작

자세한 설치 및 설정 방법은 [SETUP.md](docs/SETUP.md)를 참조하세요.

```bash
# 백엔드 실행
cd backend
npm install
npm run dev

# 프론트엔드 실행
cd frontend
npm install
npm run dev
```

## API 문서

API 사용법은 [API.md](docs/API.md)를 참조하세요.

## 시스템 아키텍처

시스템 구조에 대한 자세한 설명은 [ARCHITECTURE.md](docs/ARCHITECTURE.md)를 참조하세요.

## 라이선스

MIT License