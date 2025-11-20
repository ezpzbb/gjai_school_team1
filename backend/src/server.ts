
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { initializeApp } from './app';
import { initializeDatabase, closeDatabase, pool } from './config/db';
// ITS CCTV 스케줄러는 제거됨 (경찰청 UTIC API로 전환)
// 혼잡도 알림 스케줄러는 제거됨 (DB 삽입 시 즉시 알림으로 전환)
import { startEventScheduler, stopEventScheduler } from './scheduler';
import { setupSocketHandlers } from './socket';
import { congestionNotificationService } from './services/congestionNotificationService';
import { accidentNotificationService } from './services/accidentNotificationService';

dotenv.config();

async function start() {
  try {
    // 데이터베이스 연결
    await initializeDatabase();

    // Express 앱 초기화
    const app = await initializeApp();

    // HTTP 서버 및 Socket.IO 설정
    const server = http.createServer(app);
    // Socket.IO CORS 설정: 다중 origin 지원
    const corsOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : ['http://localhost:5173'];
    
    const io = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          // origin이 없으면 허용
          if (!origin) {
            return callback(null, true);
          }
          // 허용된 origin 목록에 있으면 허용
          if (corsOrigins.includes(origin)) {
            return callback(null, true);
          }
          // 개발 환경에서는 모든 origin 허용 (선택사항)
          if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
          }
          // 그 외의 경우 거부
          callback(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
      },
    });

    // Socket.IO 이벤트 핸들러 설정 (DB 풀 전달)
    setupSocketHandlers(io, pool);

    // 알림 서비스에 Socket.IO 인스턴스 설정
    congestionNotificationService.setSocketIO(io);
    accidentNotificationService.setSocketIO(io);

    // 서버 시작
    const PORT = Number(process.env.PORT) || 3002;
    const HOST = process.env.HOST || '0.0.0.0'; // Docker 컨테이너에서 모든 인터페이스에 바인딩
    server.listen(PORT, HOST, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 시작되었습니다.`);
      console.log(`📍 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);

      // 스케줄러 시작 (ITS CCTV는 제거, 이벤트만 유지)
      // 혼잡도 알림은 DB 삽입 시 즉시 발송되므로 스케줄러 불필요
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
  stopEventScheduler();
  await closeDatabase();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('서버 종료 중...');
  stopEventScheduler();
  await closeDatabase();
  process.exit(0);
});

start();
