
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { initializeApp } from './app';
import { initializeDatabase, closeDatabase } from './config/db';
// ITS CCTV 스케줄러는 제거됨 (경찰청 UTIC API로 전환)
import { startEventScheduler, stopEventScheduler, startCongestionNotificationScheduler, stopCongestionNotificationScheduler } from './scheduler';
import { setupSocketHandlers } from './socket';
import { congestionNotificationService } from './services/congestionNotificationService';

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

    // 혼잡도 알림 서비스에 Socket.IO 인스턴스 설정
    congestionNotificationService.setSocketIO(io);

    // 서버 시작
    const PORT = process.env.PORT || 3002;
    server.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 시작되었습니다.`);
      console.log(`📍 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);

      // 스케줄러 시작 (ITS CCTV는 제거, 이벤트만 유지)
      startEventScheduler();
      // 혼잡도 알림 스케줄러 시작
      startCongestionNotificationScheduler(io);
    });
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('서버 종료 중...');
  stopEventScheduler();
  stopCongestionNotificationScheduler();
  await closeDatabase();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('서버 종료 중...');
  stopEventScheduler();
  stopCongestionNotificationScheduler();
  await closeDatabase();
  process.exit(0);
});

start();
