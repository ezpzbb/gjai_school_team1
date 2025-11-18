import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { cctvQueries } from '../Camera/CameraQueries';
import { CCTV } from '../Camera/CameraModel';
import dotenv from 'dotenv';

dotenv.config();

export class CCTVTransaction {
  private dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
  }

  /**
   * CCTV 테이블 초기화 및 자동 데이터 임포트
   * @param connection 데이터베이스 연결
   */
  async initializeCCTVTable(connection: PoolConnection): Promise<void> {
    try {
      // CCTV 테이블 생성 (IF NOT EXISTS로 안전하게 처리)
      console.log('📋 CCTV 테이블 초기화 중...');
      await connection.execute(cctvQueries.CREATE_TABLE);
      console.log('✅ CCTV 테이블 초기화 완료');
      
      // CCTV 테이블이 비어있는지 확인
      const [countResult] = await connection.execute<RowDataPacket[]>(
        cctvQueries.COUNT_CCTV
      );
      const cctvCount = countResult[0]?.count || 0;
      
      // CCTV가 없으면 자동 임포트 실행
      if (cctvCount === 0) {
        console.log('📦 CCTV 테이블이 비어있습니다. 자동 임포트를 시작합니다...');
        try {
          // importUticCctv의 main 함수를 동적으로 import
          // 경로: backend/src/models/Camera -> backend/src/importUticCctv
          const { main: importCctvData } = await import('../../importUticCctv');
          
          // 라이브러리 모드로 실행 (pool.end() 호출 안 함)
          await importCctvData({ isStandalone: false });
          
          console.log('✅ CCTV 자동 임포트 완료');
        } catch (importError: any) {
          // 임포트 실패해도 백엔드 시작은 계속 진행
          console.warn('⚠️  CCTV 자동 임포트 실패:', importError?.message || importError);
          console.warn('   백엔드는 정상 시작되지만, CCTV 데이터는 수동으로 임포트해야 합니다.');
          console.warn('   수동 임포트: npm run import:cctv 또는 ts-node src/importUticCctv.ts');
        }
      } else {
        console.log(`✅ CCTV 데이터 확인 완료 (${cctvCount}개)`);
      }
    } catch (error) {
      console.error('❌ CCTV 테이블 초기화 실패:', error);
      throw error;
    }
  }

  async getAllCCTVLocations(): Promise<CCTV[]> {
    try {
      console.log('CCTVTransaction: Imported cctvQueries:', cctvQueries);
      console.log('CCTVTransaction: Executing query:', cctvQueries.getAllCCTVLocations);
      const [rows] = await this.dbPool.query(cctvQueries.getAllCCTVLocations);
      console.log('CCTVTransaction: Raw query result:', rows);
      const cctvLocations = rows as CCTV[];
      console.log('CCTVTransaction: Mapped CCTV locations:', cctvLocations);
      return cctvLocations;
    } catch (error: any) {
      console.error('CCTVTransaction: DB query error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
      throw new Error(`Failed to fetch CCTV locations: ${error.message}`);
    }
  }

  async getCCTVById(cctvId: number): Promise<CCTV | null> {
    try {
      const [rows] = await this.dbPool.query(cctvQueries.getCCTVById, [cctvId]);
      const record = (rows as CCTV[])[0];
      return record ?? null;
    } catch (error: any) {
      console.error('CCTVTransaction: getCCTVById error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
      throw new Error(`Failed to fetch CCTV(${cctvId}): ${error.message}`);
    }
  }

  async searchCCTVLocations(keyword: string): Promise<CCTV[]> {
    try {
      if (!keyword || keyword.trim() === '') {
        return [];
      }
      
      const searchKeyword = `%${keyword.trim()}%`;
      const startsWithKeyword = `${keyword.trim()}%`;
      const query = cctvQueries.searchCCTVLocations(keyword);
      
      console.log('CCTVTransaction: Searching CCTV with keyword:', keyword);
      console.log('CCTVTransaction: Executing search query:', query);
      
      const [rows] = await this.dbPool.query(query, [
        searchKeyword,      // LIKE '%keyword%'
        startsWithKeyword,  // ORDER BY - starts with keyword (priority 1)
        searchKeyword,      // ORDER BY - contains keyword (priority 2)
      ]);
      
      console.log('CCTVTransaction: Search result:', rows);
      const cctvLocations = rows as CCTV[];
      return cctvLocations;
    } catch (error: any) {
      console.error('CCTVTransaction: Search query error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
      throw new Error(`Failed to search CCTV locations: ${error.message}`);
    }
  }
}