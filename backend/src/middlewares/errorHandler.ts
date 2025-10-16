import { Request, Response, NextFunction } from 'express';
import { isDevelopment } from '../config/environment';

// 커스텀 에러 클래스
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 에러 응답 인터페이스
interface ErrorResponse {
  error: {
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
    method: string;
    stack?: string;
    details?: any;
  };
}

// 에러 핸들러 미들웨어
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = '내부 서버 오류가 발생했습니다.';
  let isOperational = false;

  // AppError 인스턴스인 경우
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  }
  // TypeORM 에러인 경우
  else if (error.name === 'QueryFailedError') {
    statusCode = 400;
    message = '데이터베이스 쿼리 실행 중 오류가 발생했습니다.';
  }
  // 유효성 검사 에러인 경우
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = '입력 데이터가 유효하지 않습니다.';
  }
  // JWT 에러인 경우
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '유효하지 않은 토큰입니다.';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '토큰이 만료되었습니다.';
  }
  // Multer 에러인 경우 (파일 업로드)
  else if (error.name === 'MulterError') {
    statusCode = 400;
    message = '파일 업로드 중 오류가 발생했습니다.';
  }
  // SyntaxError인 경우 (JSON 파싱 에러)
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = '잘못된 JSON 형식입니다.';
  }

  // 에러 로깅
  if (isOperational) {
    console.warn(`Operational Error: ${message}`, {
      statusCode,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  } else {
    console.error(`Unexpected Error: ${error.message}`, {
      statusCode,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      stack: error.stack,
    });
  }

  // 에러 응답 생성
  const errorResponse: ErrorResponse = {
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  // 개발 환경에서는 스택 트레이스 포함
  if (isDevelopment && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // 개발 환경에서는 추가 세부 정보 포함
  if (isDevelopment && !isOperational) {
    errorResponse.error.details = {
      name: error.name,
      message: error.message,
    };
  }

  res.status(statusCode).json(errorResponse);
};

// 404 에러 핸들러
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new AppError(
    `경로를 찾을 수 없습니다: ${req.originalUrl}`,
    404
  );

  res.status(404).json({
    error: {
      message: error.message,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  });
};

// 비동기 에러 래퍼
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 유효성 검사 에러 생성 헬퍼
export const createValidationError = (message: string, field?: string): AppError => {
  const errorMessage = field ? `${field}: ${message}` : message;
  return new AppError(errorMessage, 400);
};

// 인증 에러 생성 헬퍼
export const createAuthError = (message: string = '인증이 필요합니다.'): AppError => {
  return new AppError(message, 401);
};

// 권한 에러 생성 헬퍼
export const createForbiddenError = (message: string = '접근 권한이 없습니다.'): AppError => {
  return new AppError(message, 403);
};

// 리소스 없음 에러 생성 헬퍼
export const createNotFoundError = (resource: string = '리소스'): AppError => {
  return new AppError(`${resource}를 찾을 수 없습니다.`, 404);
};

// 서버 에러 생성 헬퍼
export const createServerError = (message: string = '서버 오류가 발생했습니다.'): AppError => {
  return new AppError(message, 500, false);
};