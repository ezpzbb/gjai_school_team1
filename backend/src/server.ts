
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { initializeApp } from './app';
import { initializeDatabase, closeDatabase } from './config/db';
import { startCctvScheduler, stopCctvScheduler, startEventScheduler, stopEventScheduler } from './scheduler';
import { setupSocketHandlers } from './socket';

dotenv.config();

async function start() {
  try {
    // 데이터베이스 연결
    await initializeDatabase();

    // Express 앱 초기화
    const app = await initializeApp();

    // HTTP 서버 및 Socket.IO 설정
    const server = http.createServer(app);
    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
      },
    });

    // Socket.IO 이벤트 핸들러 설정
    setupSocketHandlers(io);

    // 서버 시작
    const PORT = process.env.PORT || 3002;
    server.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 시작되었습니다.`);
      console.log(`📍 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);

      // 스케줄러 시작
      startCctvScheduler();
      startEventScheduler();
    });
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('서버 종료 중...');
  stopCctvScheduler();
  stopEventScheduler();
  await closeDatabase();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('서버 종료 중...');
  stopCctvScheduler();
  stopEventScheduler();
  await closeDatabase();
  process.exit(0);
});

start();
