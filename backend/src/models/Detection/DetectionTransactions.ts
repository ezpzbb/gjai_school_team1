import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { DetectionQueries } from './DetectionQueries';
import { Detection, DetectionInput, DetectionStatistics } from './DetectionModel';
import { convertToMySQLDateTime } from '../../utils/dateConverter';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export class DetectionTransaction {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Detection 테이블 초기화
   */
  async initializeDetectionTable(connection: PoolConnection): Promise<void> {
    try {
      // Detection 테이블 생성 (IF NOT EXISTS로 안전하게 처리)
      logger.info('📋 Detection 테이블 초기화 중...');
      await connection.execute(DetectionQueries.CREATE_TABLE);
      logger.info('✅ Detection 테이블 초기화 완료');
    } catch (error) {
      logger.error('❌ Detection 테이블 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * ID로 감지 조회
   */
  async getDetectionById(detectionId: number): Promise<Detection | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        DetectionQueries.GET_BY_ID,
        [detectionId]
      );
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToDetection(rows[0]);
    } catch (error) {
      logger.error('Detection 조회 실패:', error);
      throw error;
    }
  }

  /**
   * Frame ID로 감지 목록 조회
   */
  async getDetectionsByFrameId(frameId: number): Promise<Detection[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        DetectionQueries.GET_BY_FRAME_ID,
        [frameId]
      );
      return rows.map((row) => this.mapRowToDetection(row));
    } catch (error) {
      logger.error('Detection 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 감지 생성
   */
  async createDetection(input: DetectionInput): Promise<Detection> {
    try {
      const detectedAt = input.detected_at || new Date();
      const [result] = await this.pool.execute(
        DetectionQueries.CREATE,
        [input.frame_id, input.confidence, input.bounding_box, detectedAt, input.object_text]
      );
      const insertId = (result as any).insertId;
      const detection = await this.getDetectionById(insertId);
      if (!detection) {
        throw new Error('감지 생성 후 조회 실패');
      }
      return detection;
    } catch (error) {
      logger.error('Detection 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 객체 유형별 통계 조회 (대시보드용)
   */
  async getDetectionStatistics(
    cctvId: number,
    startTime: Date,
    endTime: Date
  ): Promise<DetectionStatistics[]> {
    try {
      // MySQL이 이해할 수 있는 형식으로 변환 (YYYY-MM-DD HH:MM:SS)
      const startTimeStr = convertToMySQLDateTime(startTime);
      const endTimeStr = convertToMySQLDateTime(endTime);
      
      logger.debug('getDetectionStatistics 쿼리 파라미터:', {
        cctvId,
        startTime: startTimeStr,
        endTime: endTimeStr,
      });
      
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        DetectionQueries.GET_DETECTION_STATISTICS,
        [cctvId, startTimeStr, endTimeStr]
      );
      
      logger.debug('getDetectionStatistics 쿼리 결과:', {
        rowCount: rows.length,
        firstRow: rows[0] || null,
      });
      
      // 데이터가 없으면 빈 배열 반환
      if (!rows || rows.length === 0) {
        return [];
      }
      
      return rows.map((row) => ({
        object_text: String(row.object_text || ''),
        count: Number(row.count) || 0,
        percentage: row.percentage ? Number(row.percentage) : undefined,
      }));
    } catch (error: any) {
      logger.error('감지 통계 조회 실패:', error);
      // 테이블이 없거나 데이터가 없는 경우 빈 배열 반환
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR') {
        logger.warn('Detection 테이블이 없거나 필드 오류 - 빈 배열 반환');
        return [];
      }
      throw error;
    }
  }

  /**
   * DB 행을 Detection 객체로 변환
   */
  private mapRowToDetection(row: RowDataPacket): Detection {
    return {
      detection_id: row.detection_id,
      frame_id: row.frame_id,
      confidence: row.confidence,
      bounding_box: row.bounding_box,
      detected_at: row.detected_at,
      object_text: row.object_text,
    };
  }
}

