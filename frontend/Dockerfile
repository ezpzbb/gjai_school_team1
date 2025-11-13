# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# run stage
FROM nginx:1.27-alpine
COPY --chown=nginx:nginx --from=build /app/dist /usr/share/nginx/html
# 기본 nginx 설정 사용. 라우팅을 위해 SPA fallback이 필요하면 nginx.conf 추가.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]