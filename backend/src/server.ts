import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { initializeDatabase, closeDatabase } from './config/db';



import userRoutes from './routes/UserRoutes';
import cctvRouter from './routes/cctvRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  },
});

// 미들웨어
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100,
    message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 제공
const uploadsPath = path.resolve(__dirname, '../Uploads');
app.use('/api/uploads', express.static(uploadsPath));

// API 라우트
app.use('/api/users', userRoutes);
app.use('/api', cctvRouter);

// 기본 엔드포인트
app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from Express with WebSocket!');
});

// Socket.IO 설정
function setupSocket(server: http.Server): SocketIOServer {
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
  return io;
}

// 서버 시작
async function start() {
  try {
    // 데이터베이스 연결
    await initializeDatabase();

    // Socket.IO 설정
    setupSocket(server);

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
  server.close(() => {
    console.log('서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});
process.on('SIGINT', async () => {
  console.log('서버 종료 중...');
  await closeDatabase();
  server.close(() => {
    console.log('서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});

start();