import { AppDataSource } from '../config/database';
import { Repository, EntityTarget, ObjectLiteral } from 'typeorm';

// 데이터베이스 유틸리티 클래스
export class DatabaseUtils {
  /**
   * 특정 엔티티의 리포지토리를 가져오는 헬퍼 함수
   */
  static getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    if (!AppDataSource.isInitialized) {
      throw new Error('데이터베이스가 초기화되지 않았습니다.');
    }
    return AppDataSource.getRepository(entity);
  }

  /**
   * 데이터베이스 연결 상태 확인
   */
  static isConnected(): boolean {
    return AppDataSource.isInitialized;
  }

  /**
   * 트랜잭션 실행 헬퍼 함수
   */
  static async runInTransaction<T>(
    operation: (manager: any) => Promise<T>
  ): Promise<T> {
    return await AppDataSource.transaction(operation);
  }

  /**
   * 쿼리 빌더 가져오기
   */
  static createQueryBuilder() {
    if (!AppDataSource.isInitialized) {
      throw new Error('데이터베이스가 초기화되지 않았습니다.');
    }
    return AppDataSource.createQueryBuilder();
  }

  /**
   * 커스텀 쿼리 실행
   */
  static async query(sql: string, parameters?: any[]): Promise<any> {
    if (!AppDataSource.isInitialized) {
      throw new Error('데이터베이스가 초기화되지 않았습니다.');
    }
    return await AppDataSource.query(sql, parameters);
  }

  /**
   * 데이터베이스 통계 정보 가져오기
   */
  static async getDatabaseStats(): Promise<{
    connectionCount: number;
    isConnected: boolean;
    host: string;
    database: string;
  }> {
    try {
      const connectionCount = 0; // MySQL 드라이버에서는 pool 정보 접근 방식이 다름
      
      const options = AppDataSource.options as any;
      
      return {
        connectionCount,
        isConnected: AppDataSource.isInitialized,
        host: options.host || 'unknown',
        database: options.database || 'unknown',
      };
    } catch (error) {
      console.error('데이터베이스 통계 조회 실패:', error);
      return {
        connectionCount: 0,
        isConnected: false,
        host: 'unknown',
        database: 'unknown',
      };
    }
  }

  /**
   * 데이터베이스 연결 테스트
   */
  static async testConnection(): Promise<boolean> {
    try {
      await AppDataSource.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('데이터베이스 연결 테스트 실패:', error);
      return false;
    }
  }
}

// 편의 함수들
export const getRepository = DatabaseUtils.getRepository;
export const isConnected = DatabaseUtils.isConnected;
export const runInTransaction = DatabaseUtils.runInTransaction;
export const createQueryBuilder = DatabaseUtils.createQueryBuilder;
export const query = DatabaseUtils.query;