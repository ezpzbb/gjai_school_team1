# 프론트엔드 Dockerfile
# 멀티 스테이지 빌드: 빌드 + Nginx 서빙

# Stage 1: 빌드
FROM node:18-alpine AS builder

WORKDIR /app

# package 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci && npm cache clean --force

# 소스 코드 복사
COPY . .

# 빌드 시 환경 변수 주입 (ARG로 받아서 ENV로 설정)
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_KAKAO_API_KEY
ARG VITE_API_BASE_URL
ARG VITE_WS_URL
ARG VITE_CAMERA_STREAM_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
ENV VITE_KAKAO_API_KEY=${VITE_KAKAO_API_KEY}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_CAMERA_STREAM_URL=${VITE_CAMERA_STREAM_URL}

# 빌드 실행
RUN npm run build

# Stage 2: Nginx 서빙
FROM nginx:alpine

# 빌드된 파일 복사
COPY --from=builder /app/.build /usr/share/nginx/html

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 포트 노출
EXPOSE 80

# 헬스 체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]

