import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

// 환경 변수 타입 정의
interface EnvironmentConfig {
  // 서버 설정
  PORT: number;
  NODE_ENV: string;
  
  // 데이터베이스 설정
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_TEST_NAME: string;
  
  // JWT 설정
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  
  // CORS 설정
  CORS_ORIGIN: string;
  CORS_CREDENTIALS: boolean;
}

// 환경 변수 검증 함수
function validateEnvVar(value: string | undefined, name: string, defaultValue?: string): string {
  if (!value && !defaultValue) {
    throw new Error(`환경 변수 ${name}이 설정되지 않았습니다.`);
  }
  return value || defaultValue!;
}

function validateNumberEnvVar(value: string | undefined, name: string, defaultValue?: number): number {
  if (!value && defaultValue === undefined) {
    throw new Error(`환경 변수 ${name}이 설정되지 않았습니다.`);
  }
  if (value) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`환경 변수 ${name}이 유효한 숫자가 아닙니다: ${value}`);
    }
    return num;
  }
  return defaultValue!;
}

function validateBooleanEnvVar(value: string | undefined, name: string, defaultValue?: boolean): boolean {
  if (!value && defaultValue === undefined) {
    throw new Error(`환경 변수 ${name}이 설정되지 않았습니다.`);
  }
  if (value) {
    return value.toLowerCase() === 'true';
  }
  return defaultValue!;
}

// 환경 변수 로드 및 검증
export const env: EnvironmentConfig = {
  // 서버 설정
  PORT: validateNumberEnvVar(process.env.PORT, 'PORT', 5000), // 백엔드 포트
  NODE_ENV: validateEnvVar(process.env.NODE_ENV, 'NODE_ENV', 'development'),
  
  // 데이터베이스 설정
  DB_HOST: validateEnvVar(process.env.DB_HOST, 'DB_HOST', 'localhost'),
  DB_PORT: validateNumberEnvVar(process.env.DB_PORT, 'DB_PORT', 3306),
  DB_USERNAME: validateEnvVar(process.env.DB_USERNAME, 'DB_USERNAME', 'root'),
  DB_PASSWORD: validateEnvVar(process.env.DB_PASSWORD, 'DB_PASSWORD', ''),
  DB_NAME: validateEnvVar(process.env.DB_NAME, 'DB_NAME', 'new_schema'),
  DB_TEST_NAME: validateEnvVar(process.env.DB_TEST_NAME, 'DB_TEST_NAME', 'vehicle_monitoring_test'),
  
  // JWT 설정
  JWT_SECRET: validateEnvVar(process.env.JWT_SECRET, 'JWT_SECRET', 'your-super-secret-jwt-key-change-this-in-production'),
  JWT_EXPIRES_IN: validateEnvVar(process.env.JWT_EXPIRES_IN, 'JWT_EXPIRES_IN', '24h'),
  JWT_REFRESH_EXPIRES_IN: validateEnvVar(process.env.JWT_REFRESH_EXPIRES_IN, 'JWT_REFRESH_EXPIRES_IN', '7d'),
  
  // CORS 설정
  CORS_ORIGIN: validateEnvVar(process.env.CORS_ORIGIN, 'CORS_ORIGIN', 'http://localhost:3001'), // 프론트엔드 URL
  CORS_CREDENTIALS: validateBooleanEnvVar(process.env.CORS_CREDENTIALS, 'CORS_CREDENTIALS', true),
};

// 개발 환경 확인
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// 환경 변수 검증 완료 로그
if (isDevelopment) {
  console.log('✅ 환경 변수 로드 완료');
  console.log(`📍 서버 포트: ${env.PORT}`);
  console.log(`🗄️  데이터베이스: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  console.log(`🌐 CORS Origin: ${env.CORS_ORIGIN}`);
  console.log(`🌍 환경: ${env.NODE_ENV}`);
}