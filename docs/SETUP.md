# 설치 및 설정 가이드

## 필요 조건
- Node.js 18.0.0 이상
- MongoDB 5.0 이상
- Python 3.8 이상 (AI 모델용)

## 설치 방법

### 1. 저장소 클론
```bash
git clone <repository-url>
cd gjai_school_team1
```

### 2. 백엔드 설정
```bash
cd backend
npm install
cp .env.example .env
# .env 파일 수정
npm run build
npm run dev
```

### 3. 프론트엔드 설정
```bash
cd frontend
npm install
cp .env.example .env
# .env 파일 수정
npm run dev
```

### 4. 데이터베이스 설정
- MongoDB 설치 및 실행
- 환경 변수에 MONGODB_URI 설정

### 5. AI 모델 설정
- 학습된 모델을 backend/models/ 폴더에 배치
- 환경 변수에 MODEL_PATH 설정

## 환경 변수

### 백엔드 (.env)
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/vehicle_monitoring
JWT_SECRET=your_secret_key
CCTV_API_URL=your_cctv_api_url
CCTV_API_KEY=your_api_key
MODEL_PATH=./models/vehicle_detection_model.onnx
```

### 프론트엔드 (.env)
```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_CAMERA_STREAM_URL=http://localhost:3001/stream
```

## 실행
```bash
# 백엔드 실행
cd backend && npm run dev

# 프론트엔드 실행
cd frontend && npm run dev
```
