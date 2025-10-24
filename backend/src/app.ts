// Express 앱 설정 - 미들웨어, 라우트, 소켓 설정

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { Pool, createPool } from 'mysql2/promise';
import { setupCCTVRoutes } from './routes/cctvRoutes';
import userRoutes from './routes/UserRoutes';

export const initializeApp = async (): Promise<Express> => {
  const app: Express = express();

  // 데이터베이스 연결 풀 설정
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USERNAME || 'your_username',
    password: process.env.DB_PASSWORD || 'your_password',
    database: process.env.DB_NAME || 'your_database',
    connectionLimit: 10,
  };
  const dbPool: Pool = createPool(dbConfig);

  // 미들웨어
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    })
  );
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
  app.use('/api', setupCCTVRoutes(dbPool));

  // 기본 엔드포인트
  app.get('/', (_req: Request, res: Response) => {
    res.send('Hello from Express with WebSocket!');
  });

  // 에러 핸들링 미들웨어
  app.use((err: Error, req: Request, res: Response, next: Function) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: `Server error: ${err.message}`,
    });
  });

  return app;
};
