# build stage
FROM node:20-alpine AS build
WORKDIR /app

# 패키지 설치 캐시 최적화
COPY package.json package-lock.json ./
RUN npm ci

# 소스와 ts 설정 복사 후 빌드
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# prod stage
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# 프로덕션 의존성만 설치
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npm dedupe \
 && npm prune --omit=dev \
 && npm cache clean --force

# 빌드 산출물만 전달
COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/server.js"]
