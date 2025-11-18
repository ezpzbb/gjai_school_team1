import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { FrameQueries } from './FrameQueries';
import { Frame, FrameInput, AnalyzedTimeRange } from './FrameModel';
import { convertToISO8601 } from '../../utils/dateConverter';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export class FrameTransaction {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Frame 테이블 초기화
   */
  async initializeFrameTable(connection: PoolConnection): Promise<void> {
    try {
      // Frame 테이블 생성 (IF NOT EXISTS로 안전하게 처리)
      console.log('📋 Frame 테이블 초기화 중...');
      await connection.execute(FrameQueries.CREATE_TABLE);
      console.log('✅ Frame 테이블 초기화 완료');
    } catch (error) {
      console.error('❌ Frame 테이블 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * ID로 프레임 조회
   */
  async getFrameById(frameId: number): Promise<Frame | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        FrameQueries.GET_BY_ID,
        [frameId]
      );
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToFrame(rows[0]);
    } catch (error) {
      console.error('Frame 조회 실패:', error);
      throw error;
    }
  }

  /**
   * CCTV ID로 프레임 목록 조회
   */
  async getFramesByCctvId(cctvId: number): Promise<Frame[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        FrameQueries.GET_BY_CCTV_ID,
        [cctvId]
      );
      return rows.map((row) => this.mapRowToFrame(row));
    } catch (error) {
      console.error('Frame 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * CCTV ID와 시간 범위로 프레임 목록 조회
   */
  async getFramesByTimeRange(
    cctvId: number,
    startTime: Date,
    endTime: Date
  ): Promise<Frame[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        FrameQueries.GET_BY_CCTV_AND_TIME_RANGE,
        [cctvId, startTime, endTime]
      );
      return rows.map((row) => this.mapRowToFrame(row));
    } catch (error) {
      console.error('Frame 시간 범위 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 프레임 생성
   */
  async createFrame(input: FrameInput): Promise<Frame> {
    try {
      const timestamp = input.timestamp || new Date();
      const [result] = await this.pool.execute(
        FrameQueries.CREATE,
        [input.cctv_id, timestamp, input.image_path]
      );
      const insertId = (result as any).insertId;
      const frame = await this.getFrameById(insertId);
      if (!frame) {
        throw new Error('프레임 생성 후 조회 실패');
      }
      return frame;
    } catch (error) {
      console.error('Frame 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 프레임 삭제
   */
  async deleteFrame(frameId: number): Promise<boolean> {
    try {
      const [result] = await this.pool.execute(
        FrameQueries.DELETE_BY_ID,
        [frameId]
      );
      return (result as any).affectedRows > 0;
    } catch (error) {
      logger.error('Frame 삭제 실패:', error);
      throw error;
    }
  }

  /**
   * 분석 완료 시간대 조회 (대시보드용)
   */
  async getAnalyzedTimeRanges(cctvId: number): Promise<AnalyzedTimeRange[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        FrameQueries.GET_ANALYZED_TIME_RANGES,
        [cctvId]
      );
      
      // 데이터가 없으면 빈 배열 반환
      if (!rows || rows.length === 0) {
        return [];
      }
      
      return rows.map((row) => {
        try {
          // DATE_FORMAT 결과를 ISO 8601 형식으로 변환
          const startTime = convertToISO8601(row.start_time);
          
          // end_time을 애플리케이션 레벨에서 계산 (start_time + 1시간)
          const startDate = new Date(startTime);
          const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1시간
          const endTime = endDate.toISOString();
          
          return {
            start: startTime,
            end: endTime,
            frame_count: Number(row.frame_count) || 0,
            congestion_count: Number(row.congestion_count) || 0,
            detection_count: Number(row.detection_count) || 0,
            statistics_count: Number(row.statistics_count) || 0,
          };
        } catch (dateError: any) {
          logger.error('날짜 변환 오류:', dateError, { start_time: row.start_time, type: typeof row.start_time });
          throw new Error(`날짜 변환 실패: ${row.start_time} - ${dateError.message}`);
        }
      });
    } catch (error: any) {
      logger.error('분석 완료 시간대 조회 실패:', error);
      logger.debug('Error stack:', error.stack);
      // SQL 오류인 경우 상세 정보 로깅
      if (error.code) {
        logger.debug('SQL Error Code:', error.code);
        logger.debug('SQL Error Message:', error.sqlMessage || error.message);
        logger.debug('SQL Query:', FrameQueries.GET_ANALYZED_TIME_RANGES);
        logger.debug('Query Parameters:', [cctvId]);
      }
      // 데이터가 없는 경우 빈 배열 반환 (테이블이 없거나 데이터가 없는 경우)
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        logger.warn('테이블이 없거나 필드 오류 - 빈 배열 반환');
        return [];
      }
      // 더 자세한 에러 정보를 포함하여 throw
      const enhancedError = new Error(`분석 완료 시간대 조회 실패: ${error.message || error}`);
      (enhancedError as any).code = error.code;
      (enhancedError as any).sqlMessage = error.sqlMessage;
      throw enhancedError;
    }
  }

  /**
   * DB 행을 Frame 객체로 변환
   */
  private mapRowToFrame(row: RowDataPacket): Frame {
    return {
      frame_id: row.frame_id,
      cctv_id: row.cctv_id,
      timestamp: row.timestamp,
      image_path: row.image_path,
    };
  }
}

