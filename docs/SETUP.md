# 설치 및 설정 가이드

## 필요 조건
- Node.js 18.0.0 이상
- MySQL 8.0 이상
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
# .env 파일 생성 (아래 환경 변수 섹션 참조)
npm run build
npm run dev
```

### 3. 프론트엔드 설정
```bash
cd frontend
npm install
npm run dev
```

### 4. 데이터베이스 설정
- MySQL 설치 및 실행
- 데이터베이스 생성:
  ```sql
  CREATE DATABASE vehicle_monitoring;
  CREATE DATABASE vehicle_monitoring_test;
  ```
- 환경 변수에 데이터베이스 연결 정보 설정

### 5. AI 모델 설정
- 학습된 모델을 backend/models/ 폴더에 배치
- 환경 변수에 MODEL_PATH 설정

## 환경 변수

### 백엔드 (.env 파일 생성)
`backend` 폴더에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# 서버 설정
PORT=3001
NODE_ENV=development

# 데이터베이스 설정 (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your-mysql-password
DB_NAME=vehicle_monitoring
DB_TEST_NAME=vehicle_monitoring_test

# JWT 설정
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# AI 서비스 설정 (추후 구현)
OPENAI_API_KEY=your-openai-api-key-here

# 카메라 설정
CAMERA_STREAM_URL=rtsp://localhost:8554/stream
DETECTION_THRESHOLD=0.5

# CORS 설정
CORS_ORIGIN=http://localhost:3000
CORS_CREDENTIALS=true

# 파일 업로드 설정
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# 로그 설정
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Redis 설정 (세션 관리용)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# 이메일 설정 (알림용)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 관리자 기본 계정
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

### 프론트엔드 (.env 파일 생성)
`frontend` 폴더에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
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

## 데이터베이스 마이그레이션
TypeORM을 사용하므로 엔티티가 생성되면 자동으로 테이블이 생성됩니다.

## 트러블슈팅

### MySQL 연결 오류
1. MySQL 서버가 실행 중인지 확인
2. 데이터베이스가 생성되었는지 확인
3. 사용자 권한이 올바른지 확인
4. 포트 번호가 올바른지 확인 (기본: 3306)

### 환경 변수 오류
1. `.env` 파일이 `backend` 폴더에 있는지 확인
2. 환경 변수 이름이 정확한지 확인
3. 따옴표 없이 값만 입력했는지 확인

### 포트 충돌
1. 3001 포트가 사용 중인지 확인: `netstat -ano | findstr :3001`
2. 다른 포트로 변경: `.env` 파일에서 `PORT=3002` 등으로 수정
