
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { initializeApp } from './app';
import { initializeDatabase, closeDatabase } from './config/db';

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

    // Socket.IO 설정
    io.on('connection', (socket) => {
      console.log(`클라이언트 연결됨: ${socket.id}`);

      socket.on('join-room', (room: string) => {
        socket.join(room);
        console.log(`클라이언트 ${socket.id}가 방 ${room}에 입장했습니다.`);
      });

      socket.on('leave-room', (room: string) => {
        socket.leave(room);
        console.log(`클라이언트 ${socket.id}가 방 ${room}에서 퇴장했습니다.`);
      });

      socket.on('disconnect', () => {
        console.log(`클라이언트 연결 해제됨: ${socket.id}`);
      });
    });

    // 서버 시작
    const PORT = process.env.PORT || 3002;
    server.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 시작되었습니다.`);
      console.log(`📍 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    });
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('서버 종료 중...');
  await closeDatabase();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('서버 종료 중...');
  await closeDatabase();
  process.exit(0);
});

start();
