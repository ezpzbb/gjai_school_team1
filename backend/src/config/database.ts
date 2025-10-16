import { DataSource } from 'typeorm';
import { env } from './environment';

// TypeORM 데이터 소스 설정
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  synchronize: env.NODE_ENV === 'development', // 개발 환경에서만 자동 동기화
  logging: env.NODE_ENV === 'development', // 개발 환경에서만 쿼리 로깅
  entities: [
    // 엔티티 파일들이 위치할 경로 (추후 구현)
    'src/models/**/*.ts'
  ],
  migrations: [
    // 마이그레이션 파일들이 위치할 경로 (추후 구현)
    'src/migrations/**/*.ts'
  ],
  subscribers: [
    // 구독자 파일들이 위치할 경로 (추후 구현)
    'src/subscribers/**/*.ts'
  ],
  // 연결 풀 설정
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
  },
  // SSL 설정 (운영 환경에서 필요시)
  ssl: env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
});

// 데이터베이스 연결 초기화 함수
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔄 데이터베이스 연결 중...');
    
    await AppDataSource.initialize();
    
    console.log('✅ 데이터베이스 연결 성공');
    console.log(`📍 데이터베이스: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
    
    // 개발 환경에서 마이그레이션 실행
    if (env.NODE_ENV === 'development') {
      console.log('🔄 데이터베이스 스키마 동기화 중...');
      await AppDataSource.synchronize();
      console.log('✅ 데이터베이스 스키마 동기화 완료');
    }
    
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    throw error;
  }
}

// 데이터베이스 연결 종료 함수
export async function closeDatabase(): Promise<void> {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ 데이터베이스 연결 종료');
    }
  } catch (error) {
    console.error('❌ 데이터베이스 연결 종료 실패:', error);
    throw error;
  }
}

// 데이터베이스 연결 상태 확인 함수
export function isDatabaseConnected(): boolean {
  return AppDataSource.isInitialized;
}

// 데이터베이스 연결 상태 가져오기
export function getDatabaseStatus(): {
  isConnected: boolean;
  host: string;
  port: number;
  database: string;
} {
  return {
    isConnected: AppDataSource.isInitialized,
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
  };
}