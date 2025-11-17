import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public', // public 폴더를 정적 파일 서빙용으로 명시
  build: {
    outDir: '.build',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002', // 모든 /api 요청을 3002로 프록시
        changeOrigin: true,
        secure: false,
      },
    },
  },
});