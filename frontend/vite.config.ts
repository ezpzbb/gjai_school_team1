import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/users': {
        // '/api/users'로 요청을 받아 백엔드의 '/api/users'로 그대로 전달
        target: 'http://localhost:3001',
        changeOrigin: true,
        // rewrite 제거 또는 명시적으로 유지
      },
    },
  },
});