import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { CongestionQueries } from './CongestionQueries';
import { Congestion, CongestionInput, CongestionDataPoint } from './CongestionModel';
import { convertToISO8601, convertToMySQLDateTime } from '../../utils/dateConverter';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export class CongestionTransaction {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Congestion 테이블 초기화
   */
  async initializeCongestionTable(connection: PoolConnection): Promise<void> {
    try {
      // Congestion 테이블 생성 (IF NOT EXISTS로 안전하게 처리)
      console.log('📋 Congestion 테이블 초기화 중...');
      await connection.execute(CongestionQueries.CREATE_TABLE);
      console.log('✅ Congestion 테이블 초기화 완료');
    } catch (error) {
      console.error('❌ Congestion 테이블 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * ID로 혼잡도 조회
   */
  async getCongestionById(congestionId: number): Promise<Congestion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        CongestionQueries.GET_BY_ID,
        [congestionId]
      );
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToCongestion(rows[0]);
    } catch (error) {
      console.error('Congestion 조회 실패:', error);
      throw error;
    }
  }

  /**
   * Frame ID로 혼잡도 조회
   */
  async getCongestionByFrameId(frameId: number): Promise<Congestion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        CongestionQueries.GET_BY_FRAME_ID,
        [frameId]
      );
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToCongestion(rows[0]);
    } catch (error) {
      console.error('Congestion 조회 실패:', error);
      throw error;
    }
  }

  /**
   * CCTV의 최신 혼잡도 조회
   */
  async getLatestCongestionByCctv(cctvId: number): Promise<Congestion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        CongestionQueries.GET_LATEST_BY_CCTV,
        [cctvId]
      );
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToCongestion(rows[0]);
    } catch (error) {
      console.error('최신 Congestion 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 혼잡도 생성
   */
  async createCongestion(input: CongestionInput): Promise<Congestion> {
    try {
      const timestamp = input.timestamp || new Date();
      const calculatedAt = input.calculated_at || new Date();
      const [result] = await this.pool.execute(
        CongestionQueries.CREATE,
        [input.frame_id, input.level, timestamp, calculatedAt]
      );
      const insertId = (result as any).insertId;
      const congestion = await this.getCongestionById(insertId);
      if (!congestion) {
        throw new Error('혼잡도 생성 후 조회 실패');
      }
      return congestion;
    } catch (error) {
      console.error('Congestion 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 혼잡도 데이터 조회 (대시보드용)
   */
  async getCongestionData(
    cctvId: number,
    startTime: Date,
    endTime: Date
  ): Promise<CongestionDataPoint[]> {
    try {
      // MySQL이 이해할 수 있는 형식으로 변환 (YYYY-MM-DD HH:MM:SS)
      const startTimeStr = convertToMySQLDateTime(startTime);
      const endTimeStr = convertToMySQLDateTime(endTime);
      
      logger.debug('getCongestionData 쿼리 파라미터:', {
        cctvId,
        startTime: startTimeStr,
        endTime: endTimeStr,
        startTimeISO: startTime.toISOString(),
        endTimeISO: endTime.toISOString(),
      });
      
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        CongestionQueries.GET_CONGESTION_DATA,
        [cctvId, startTimeStr, endTimeStr]
      );
      
      logger.debug('getCongestionData 쿼리 결과:', {
        rowCount: rows.length,
        firstRow: rows[0] || null,
      });
      
      // 데이터가 없으면 빈 배열 반환
      if (!rows || rows.length === 0) {
        return [];
      }
      
      return rows.map((row) => {
        try {
          const timestamp = convertToISO8601(row.timestamp);
          return {
            timestamp,
            level: Number(row.level) || 0,
          };
        } catch (error) {
          logger.error('혼잡도 데이터 타임스탬프 변환 오류:', error, { timestamp: row.timestamp });
          throw error;
        }
      });
    } catch (error: any) {
      logger.error('혼잡도 데이터 조회 실패:', error);
      // 테이블이 없거나 데이터가 없는 경우 빈 배열 반환
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        logger.warn('Congestion 테이블이 없거나 필드 오류 - 빈 배열 반환');
        return [];
      }
      throw error;
    }
  }

  /**
   * DB 행을 Congestion 객체로 변환
   */
  private mapRowToCongestion(row: RowDataPacket): Congestion {
    return {
      congestion_id: row.congestion_id,
      frame_id: row.frame_id,
      timestamp: row.timestamp,
      level: row.level,
      calculated_at: row.calculated_at,
    };
  }
}

