import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/users': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/cctv': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
});