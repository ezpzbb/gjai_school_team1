# build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (cache optimized)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source & tsconfig and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# prod stage
FROM node:20-alpine AS prod
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# FFmpeg for frame extraction
RUN apk add --no-cache ffmpeg

# Copy production deps
COPY cctv_data.xlsx /app/cctv_data.xlsx
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npm dedupe \
 && npm prune --omit=dev \
 && npm cache clean --force

# Copy built files
COPY --from=build /app/dist ./dist

# 🔥 IMPORTANT: copy certificates
# backend/certs → /app/certs
COPY certs ./certs

# Optional: tell Node where the cert is stored
ENV UTIC_CA_PATH=/app/certs/utic.pem

EXPOSE 3002
CMD ["node", "dist/server.js"]
