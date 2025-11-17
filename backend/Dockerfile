# 백엔드 Dockerfile
# Node.js 18 Alpine 기반 (경량화)

# Stage 1: 의존성 설치
FROM node:18-alpine AS dependencies

WORKDIR /app

# package 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: 실행 환경
FROM node:18-alpine

WORKDIR /app

# 프로덕션 의존성 복사
COPY --from=dependencies /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# 개발 의존성 설치 (ts-node, typescript 등)
RUN npm install --only=development

# 업로드 디렉토리 생성
RUN mkdir -p Uploads

# 포트 노출
EXPOSE 3002

# 헬스 체크 설정 (wget 설치 필요)
RUN apk add --no-cache wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

# 환경 변수 설정 (기본값, 네이버 클라우드에서 오버라이드)
ENV NODE_ENV=production
ENV PORT=3002

# 서버 시작
CMD ["npm", "start"]

