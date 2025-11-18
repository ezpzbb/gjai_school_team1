# Docker Compose 사용 가이드

## 빠른 시작

### 0. 사전 준비사항

**⚠️ 중요: Docker Desktop이 실행 중이어야 합니다!**

```bash
# Docker Desktop이 실행 중인지 확인
docker ps

# 오류가 발생하면 Docker Desktop을 실행하세요
# Windows: 시작 메뉴에서 "Docker Desktop" 실행
```

### 1. 환경 변수 설정

```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 열어서 필요한 값들을 수정하세요
# 특히 DB_PASSWORD, JWT_SECRET, DB_NAME 등은 반드시 수정해야 합니다
```

### 2. Docker Compose로 실행

```bash
# 서비스 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 특정 서비스 로그만 확인
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 3. 서비스 중지

```bash
# 서비스 중지 (컨테이너 유지)
docker-compose stop

# 서비스 중지 및 컨테이너 제거
docker-compose down

# 볼륨까지 제거하려면
docker-compose down -v
```

## 빌드 및 재시작

```bash
# 이미지 재빌드 후 실행
docker-compose up -d --build

# 특정 서비스만 재빌드
docker-compose build backend
docker-compose up -d backend
```

## 환경 변수 설정

### 프로덕션 환경 (네이버 클라우드)

`.env` 파일 예시:
```env
BACKEND_PORT=3002
FRONTEND_PORT=80
DB_HOST=your_db_host.ncloud.com
DB_USERNAME=your_db_user
DB_PASSWORD=your_secure_password
DB_NAME=your_database
NODE_ENV=production
JWT_SECRET=your_very_secure_jwt_secret_key
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
# CCTV API 설정 (경찰청 UTIC API)
CCTV_KEY=your_cctv_api_key_here
# 또는 CCTV_API_KEY=your_cctv_api_key_here
VITE_API_URL=https://api.your-domain.com
VITE_SOCKET_URL=https://api.your-domain.com
VITE_KAKAO_API_KEY=your_kakao_api_key_here
DEBUG=false
```

## 네트워크 및 서비스 접근

### 로컬 테스트 시
- **프론트엔드**: http://localhost (또는 설정한 FRONTEND_PORT)
- **백엔드 API**: http://localhost:3002 (또는 설정한 BACKEND_PORT)
- **백엔드 헬스 체크**: http://localhost:3002/health

### 네이버 클라우드 배포 시
- **프론트엔드**: https://your-domain.com (실제 도메인)
- **백엔드 API**: https://api.your-domain.com (실제 도메인)
- **백엔드 헬스 체크**: https://api.your-domain.com/health

## 문제 해결

### 포트가 이미 사용 중인 경우

`.env` 파일에서 포트를 변경하세요:
```env
BACKEND_PORT=3003
FRONTEND_PORT=8080
```

### 데이터베이스 연결 오류

1. `.env` 파일의 DB 설정 확인
2. 데이터베이스가 실행 중인지 확인
3. 방화벽 설정 확인 (네이버 클라우드의 경우)

### CORS 오류

`.env` 파일의 `CORS_ORIGIN`에 프론트엔드 도메인을 추가하세요:
```env
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
```

## 네이버 클라우드 배포 시 주의사항

1. **환경 변수**: 네이버 클라우드 콘솔에서 환경 변수를 설정하거나, `.env` 파일을 안전하게 관리하세요
2. **데이터베이스**: 네이버 클라우드 데이터베이스 호스트를 사용하세요
3. **CORS**: 프로덕션 도메인을 `CORS_ORIGIN`에 추가하세요
4. **보안**: `JWT_SECRET`은 반드시 강력한 랜덤 문자열로 설정하세요
5. **포트**: 네이버 클라우드 로드밸런서 설정에 맞게 포트를 조정하세요

