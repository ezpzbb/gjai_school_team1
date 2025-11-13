import { Pool, RowDataPacket } from 'mysql2/promise';
import { NotificationQueries } from './NotificationQueries';
import { NotificationTarget, NotificationHistoryInput } from './NotificationModel';

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
}

