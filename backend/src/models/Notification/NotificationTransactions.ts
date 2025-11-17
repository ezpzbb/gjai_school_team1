import { Pool, RowDataPacket } from 'mysql2/promise';
import { NotificationQueries } from './NotificationQueries';
import {
  NotificationTarget,
  NotificationHistoryInput,
  AccidentNotificationHistoryInput,
} from './NotificationModel';

export class NotificationTransaction {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * 혼잡도 알림 발송 대상 조회
   */
  async getNotificationTargets(
    threshold: number,
    checkIntervalMinutes: number
  ): Promise<NotificationTarget[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        NotificationQueries.GET_NOTIFICATION_TARGETS,
        [threshold, checkIntervalMinutes]
      );

      return rows.map((row) => ({
        user_id: row.user_id,
        cctv_id: row.cctv_id,
        congestion_id: row.congestion_id,
        level: row.level,
        location: row.location,
        timestamp: row.timestamp,
      }));
    } catch (error) {
      console.error('혼잡도 알림 대상 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 알림 발송 이력 저장
   */
  async saveNotificationHistory(
    input: NotificationHistoryInput
  ): Promise<void> {
    try {
      await this.pool.execute(NotificationQueries.SAVE_NOTIFICATION_HISTORY, [
        input.congestion_id,
        input.user_id,
        input.cctv_id,
        input.status,
      ]);
    } catch (error) {
      console.error('알림 이력 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 혼잡도 데이터에 대한 알림 발송 대상 조회 (즉시 알림용)
   */
  async getNotificationTargetsForCongestion(
    congestionId: number,
    cctvId: number,
    threshold: number
  ): Promise<NotificationTarget[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        NotificationQueries.GET_NOTIFICATION_TARGETS_FOR_CONGESTION,
        [congestionId, cctvId, threshold]
      );

      return rows.map((row) => ({
        user_id: row.user_id,
        cctv_id: row.cctv_id,
        congestion_id: row.congestion_id,
        level: row.level,
        location: row.location,
        timestamp: row.timestamp,
      }));
    } catch (error) {
      console.error('혼잡도 알림 대상 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자별 즐겨찾기 CCTV 조회 (위도/경도 포함)
   */
  async getUserFavoriteCCTVsWithCoords(userId: number): Promise<
    Array<{
      user_id: number;
      cctv_id: number;
      location: string;
      latitude: number;
      longitude: number;
    }>
  > {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        NotificationQueries.GET_USER_FAVORITE_CCTVS_WITH_COORDS,
        [userId]
      );

      return rows.map((row) => ({
        user_id: row.user_id,
        cctv_id: row.cctv_id,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
      }));
    } catch (error) {
      console.error('즐겨찾기 CCTV 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사고 이벤트 알림 이력 저장
   */
  async saveAccidentNotificationHistory(
    input: AccidentNotificationHistoryInput
  ): Promise<void> {
    try {
      await this.pool.execute(
        NotificationQueries.SAVE_ACCIDENT_NOTIFICATION_HISTORY,
        [
          input.event_id,
          input.user_id,
          input.cctv_id,
          input.distance_meters,
          input.status,
        ]
      );
    } catch (error) {
      console.error('사고 알림 이력 저장 실패:', error);
      throw error;
    }
  }

  /**
   * 사고 이벤트 알림 중복 체크 (사용자당 이벤트당 1개만)
   */
  async checkAccidentNotificationExists(
    eventId: string,
    userId: number
  ): Promise<boolean> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        NotificationQueries.CHECK_ACCIDENT_NOTIFICATION_EXISTS,
        [eventId, userId]
      );

      return rows.length > 0;
    } catch (error) {
      console.error('사고 알림 중복 체크 실패:', error);
      throw error;
    }
  }

  /**
   * CCTV의 최신 혼잡도 조회
   */
  async getLatestCongestionByCCTV(cctvId: number): Promise<{
    congestion_id: number;
    level: number;
    timestamp: Date;
  } | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        NotificationQueries.GET_LATEST_CONGESTION_BY_CCTV,
        [cctvId]
      );

      if (rows.length === 0) {
        return null;
      }

      return {
        congestion_id: rows[0].congestion_id,
        level: rows[0].level,
        timestamp: rows[0].timestamp,
      };
    } catch (error) {
      console.error('최신 혼잡도 조회 실패:', error);
      throw error;
    }
  }
}

