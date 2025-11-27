# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

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