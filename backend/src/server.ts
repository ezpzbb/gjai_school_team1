import 'reflect-metadata'; // TypeORM 데코레이터 지원
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// 설정 및 유틸리티 import
import { env, isDevelopment } from './config/environment';
import { initializeDatabase, closeDatabase } from './config/database';
import { errorHandler } from './middlewares/errorHandler';

class Server {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true, // 기본값으로 true 설정
      },
    });
  }

  /**
   * 미들웨어 설정
   */
  private setupMiddlewares(): void {
    // 보안 미들웨어
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS 설정
    this.app.use(cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // 자격 증명 포함 요청 허용
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // 요청 로깅
    this.app.use(morgan(isDevelopment ? 'dev' : 'combined')); // logger.stream 제거

    // Rate Limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 100, // 최대 100 요청
      message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body 파싱
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  /**
   * 라우트 설정
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        version: '1.0.0',
      });
    });

    // API 라우트 (추후 구현)
    // this.app.use('/api/auth', authRoutes);
    // this.app.use('/api/vehicles', vehicleRoutes);
    // this.app.use('/api/cameras', cameraRoutes);
    // this.app.use('/api/admin', adminRoutes);

    // 404 핸들러
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `경로를 찾을 수 없습니다: ${req.originalUrl}`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Socket.IO 설정
   */
  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      console.log(`클라이언트 연결됨: ${socket.id}`);

      // 방 입장
      socket.on('join-room', (room: string) => {
        socket.join(room);
        console.log(`클라이언트 ${socket.id}가 방 ${room}에 입장했습니다.`);
      });

      // 방 퇴장
      socket.on('leave-room', (room: string) => {
        socket.leave(room);
        console.log(`클라이언트 ${socket.id}가 방 ${room}에서 퇴장했습니다.`);
      });

      // 연결 해제
      socket.on('disconnect', () => {
        console.log(`클라이언트 연결 해제됨: ${socket.id}`);
      });
    });
  }

  /**
   * 서버 시작
   */
  public async start(): Promise<void> {
    try {
      // 데이터베이스 연결
      await initializeDatabase();

      // 미들웨어 설정
      this.setupMiddlewares();

      // 라우트 설정
      this.setupRoutes();

      // Socket.IO 설정
      this.setupSocketIO();

      // 에러 핸들러 (라우트 설정 후에 배치)
      this.app.use(errorHandler);

      // 서버 시작
      this.server.listen(env.PORT, () => {
        console.log(`🚀 서버가 포트 ${env.PORT}에서 시작되었습니다.`);
        console.log(`📍 환경: ${env.NODE_ENV}`);
        console.log(`🌐 CORS Origin: ${env.CORS_ORIGIN}`);
      });

    } catch (error) {
      console.error('서버 시작 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 서버 종료
   */
  public async stop(): Promise<void> {
    try {
      console.log('서버 종료 중...');
      
      // 데이터베이스 연결 종료
      await closeDatabase();
      
      // HTTP 서버 종료
      this.server.close(() => {
        console.log('서버가 정상적으로 종료되었습니다.');
        process.exit(0);
      });
    } catch (error) {
      console.error('서버 종료 중 오류 발생:', error);
      process.exit(1);
    }
  }

  /**
   * Socket.IO 인스턴스 반환
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}

// 서버 인스턴스 생성 및 시작
const server = new Server();

// Graceful shutdown 처리
process.on('SIGTERM', () => server.stop());
process.on('SIGINT', () => server.stop());

// 서버 시작
server.start().catch((error) => {
  console.error('서버 시작 실패:', error);
  process.exit(1);
});

export default server;