import dotenv from 'dotenv';
import { Secret } from 'jsonwebtoken';

dotenv.config();

export const JWT_SECRET: string = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '24h';
export const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface JwtPayload {
  user_id: number;
  username: string;
  email: string;
}

// Express Request 타입 확장
declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}