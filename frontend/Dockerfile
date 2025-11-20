# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# 빌드 시점에 환경변수 전달
ARG VITE_KAKAO_API_KEY
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_KAKAO_API_KEY=$VITE_KAKAO_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

# node에서 서빙
FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci 
# --omit=dev

# 빌드 결과 복사
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["npm", "run", "preview"]