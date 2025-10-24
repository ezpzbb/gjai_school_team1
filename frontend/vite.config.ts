import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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