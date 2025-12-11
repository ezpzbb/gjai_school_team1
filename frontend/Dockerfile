# --- Build Stage ---
    FROM node:20-alpine AS build
    WORKDIR /app
    
    # 🔥 1) build ARG 받아오기
    ARG VITE_KAKAO_API_KEY
    
    # 🔥 2) ENV로 Vite가 읽을 수 있게 전달
    ENV VITE_KAKAO_API_KEY=$VITE_KAKAO_API_KEY
    
    COPY package.json package-lock.json* ./
    RUN npm ci
    
    COPY . .
    RUN npm run build
    
    # --- Runtime Stage ---
    FROM node:20-alpine AS runtime
    WORKDIR /app
    
    RUN npm install -g serve
    
    COPY --from=build /app/dist ./dist
    
    EXPOSE 3000
    CMD ["serve", "-s", "dist", "-l", "3000"]
    