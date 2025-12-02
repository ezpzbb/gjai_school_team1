import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { StatisticsQueries } from './StatisticsQueries';
import { Statistics, StatisticsInput, VehicleStatisticsPoint, VehicleStatisticsByType } from './StatisticsModel';
import { convertToISO8601, convertToMySQLDateTime } from '../../utils/dateConverter';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export class StatisticsTransaction {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Statistics 테이블 초기화
   */
  async initializeStatisticsTable(connection: PoolConnection): Promise<void> {
    try {
      // Statistics 테이블 생성 (IF NOT EXISTS로 안전하게 처리)
      console.log('📋 Statistics 테이블 초기화 중...');
      await connection.execute(StatisticsQueries.CREATE_TABLE);
      console.log('✅ Statistics 테이블 초기화 완료');
    } catch (error) {
      console.error('❌ Statistics 테이블 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * ID로 통계 조회
   */
  async getStatisticsById(statisticsId: number): Promise<Statistics | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        StatisticsQueries.GET_BY_ID,
        [statisticsId]
      );
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToStatistics(rows[0]);
    } catch (error) {
      console.error('Statistics 조회 실패:', error);
      throw error;
    }
  }

  /**
   * Detection ID로 통계 조회
   */
  async getStatisticsByDetectionId(detectionId: number): Promise<Statistics | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        StatisticsQueries.GET_BY_DETECTION_ID,
        [detectionId]
      );
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToStatistics(rows[0]);
    } catch (error) {
      console.error('Statistics 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 통계 생성
   */
  async createStatistics(input: StatisticsInput): Promise<Statistics> {
    try {
      const [result] = await this.pool.execute(
        StatisticsQueries.CREATE,
        [input.detection_id, input.object_count, input.vehicle_total]
      );
      const insertId = (result as any).insertId;
      const statistics = await this.getStatisticsById(insertId);
      if (!statistics) {
        throw new Error('통계 생성 후 조회 실패');
      }
      return statistics;
    } catch (error) {
      console.error('Statistics 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 차량 통계 데이터 조회 (대시보드용, 차량 유형별)
   */
  async getVehicleStatistics(
    cctvId: number,
    startTime: Date,
    endTime: Date
  ): Promise<VehicleStatisticsByType[]> {
    try {
      // MySQL이 이해할 수 있는 형식으로 변환 (YYYY-MM-DD HH:MM:SS)
      const startTimeStr = convertToMySQLDateTime(startTime);
      const endTimeStr = convertToMySQLDateTime(endTime);
      
      logger.debug('getVehicleStatistics 쿼리 파라미터:', {
        cctvId,
        startTime: startTimeStr,
        endTime: endTimeStr,
      });
      
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        StatisticsQueries.GET_VEHICLE_STATISTICS,
        [cctvId, startTimeStr, endTimeStr]
      );
      
      logger.debug('getVehicleStatistics 쿼리 결과:', {
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
          // object_text를 한글로 변환 (car -> 승용차, truck -> 트럭, bus -> 버스)
          let objectText = String(row.object_text || '');
          if (objectText === 'car') objectText = '승용차';
          else if (objectText === 'truck') objectText = '트럭';
          else if (objectText === 'bus') objectText = '버스';
          
          return {
            timestamp,
            object_text: objectText,
            count: Number(row.count) || 0,
          };
        } catch (error) {
          logger.error('차량 통계 타임스탬프 변환 오류:', error, { timestamp: row.timestamp });
          throw error;
        }
      });
    } catch (error: any) {
      logger.error('차량 통계 조회 실패:', error);
      // 테이블이 없거나 데이터가 없는 경우 빈 배열 반환
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        logger.warn('Statistics 테이블이 없거나 필드 오류 - 빈 배열 반환');
        return [];
      }
      throw error;
    }
  }

  /**
   * DB 행을 Statistics 객체로 변환
   */
  private mapRowToStatistics(row: RowDataPacket): Statistics {
    return {
      statistics_id: row.statistics_id,
      detection_id: row.detection_id,
      object_count: row.object_count,
      vehicle_total: row.vehicle_total,
    };
  }
}

