import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { Pool, createPool } from "mysql2/promise";
import { setupCCTVRoutes } from "./routes/cctvRoutes";
import userRoutes from "./routes/UserRoutes";
import favoriteRoutes from "./routes/FavoriteRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import congestionRoutes from "./routes/congestionRoutes";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { setupDetectionRoutes } from "./routes/detectionRoutes";
// ITS CCTV 업데이트는 제거됨 (경찰청 UTIC API로 전환)

export const initializeApp = async (): Promise<Express> => {
  const app: Express = express();

  // 데이터베이스 연결 풀 설정
  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USERNAME || "your_username",
    password: process.env.DB_PASSWORD || "your_password",
    database: process.env.DB_NAME || "your_database",
    connectionLimit: 10,
  };
  const dbPool: Pool = createPool(dbConfig);

  // CORS 설정: 다중 origin 지원
  // 환경 변수에서 여러 origin을 쉼표로 구분하여 받을 수 있음
  // 예: CORS_ORIGIN=http://localhost:5173,https://example.com,https://app.example.com
  const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()) : ["http://localhost:5173"];

  app.use(
    cors({
      origin: (origin, callback) => {
        // origin이 없으면 (같은 도메인 요청 등) 허용
        if (!origin) {
          return callback(null, true);
        }
        // 허용된 origin 목록에 있으면 허용
        if (corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        // 개발 환경에서는 모든 origin 허용 (선택사항)
        if (process.env.NODE_ENV === "development") {
          return callback(null, true);
        }
        // 그 외의 경우 거부
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "http://localhost:3002"],
        },
      },
    })
  );
  app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

  // Rate limiting 설정
  // 로그인 엔드포인트: 보안을 위해 엄격한 제한 (15분에 20회)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 20, // 15분에 20회 로그인 시도 허용
    message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 분석 엔드포인트: 실시간 분석을 위한 관대한 제한
  // 최대 4개 CCTV × 초당 1 FPS × 60초 = 1분에 240개 요청
  // 여유를 두고 1분에 300개로 설정 (초당 약 5개)
  const detectionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1분
    max: 300, // 1분에 300개 요청 허용 (초당 약 5개)
    message: "분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // detection 엔드포인트가 아니면 이 limiter 적용 안 함
      return !(req.path === "/api/detection" || req.path === "/api/detection/image");
    },
  });

  // 일반 API: 개발과 프로덕션 모두 고려한 적절한 제한 (15분에 300회)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15분
      max: 300, // 15분에 300개 요청 허용 (초당 약 0.33개)
      message: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // 로그인 엔드포인트는 별도 처리
        if (req.path === "/api/users/login") return true;
        // 분석 엔드포인트는 별도 limiter 적용
        if (req.path === "/api/detection" || req.path === "/api/detection/image") return true;
        // 정적 파일 (이미지 등)은 rate limit 제외
        if (req.path.startsWith("/api/uploads/")) return true;
        return false;
      },
    })
  );

  // 분석 엔드포인트에 별도 limiter 적용
  app.use(detectionLimiter);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // CORS 헤더를 추가하는 미들웨어 (정적 파일용)
  const corsHeaders = (req: Request, res: Response, next: Function) => {
    const origin = req.headers.origin;
    if (origin && (corsOrigins.includes(origin) || process.env.NODE_ENV === "development")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (!origin || process.env.NODE_ENV === "development") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  };

  // 프레임 이미지 정적 파일 서빙 (CORS 헤더 포함)
  const framesPath = path.resolve(__dirname, "../uploads/frames");
  app.use("/api/uploads/frames", corsHeaders, express.static(framesPath));

  // 정적 파일 제공 (CORS 헤더 포함)
  const uploadsPath = path.resolve(__dirname, "../uploads");
  app.use("/api/uploads", corsHeaders, express.static(uploadsPath));

  // 데이터베이스 풀을 앱에 저장 (라우트에서 사용)
  app.set("dbPool", dbPool);

  // API 라우트
  // 로그인 엔드포인트에만 별도 rate limit 적용
  app.use("/api/users/login", loginLimiter);
  app.use("/api/users", userRoutes);
  app.use("/api", setupCCTVRoutes(dbPool));
  app.use("/api", setupDetectionRoutes(dbPool)); // 모델 결과 값 라우터 추가
  app.use("/api/favorites", favoriteRoutes(dbPool));
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/congestion", congestionRoutes);
  app.use("/api/dashboard", dashboardRoutes(dbPool));

  // 기본 엔드포인트
  app.get("/", (_req: Request, res: Response) => {
    res.send("Hello from Express with WebSocket!");
  });

  // 헬스 체크 엔드포인트 (Docker 헬스 체크용)
  app.get("/health", async (_req: Request, res: Response) => {
    try {
      // 데이터베이스 연결 상태 확인
      const [result] = await dbPool.execute("SELECT 1 as health");
      res.status(200).json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(503).json({
        status: "error",
        database: "disconnected",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ITS CCTV 업데이트 엔드포인트는 제거됨 (경찰청 UTIC API로 전환)

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
