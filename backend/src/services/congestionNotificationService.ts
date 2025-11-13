import { NotificationTransaction } from '../models/Notification/NotificationTransactions';
import { NotificationTarget } from '../models/Notification/NotificationModel';
import { Server as SocketIOServer } from 'socket.io';
import db from '../config/db';

export class CongestionNotificationService {
  private threshold: number;
  private checkIntervalMinutes: number;
  private notificationTransaction: NotificationTransaction;
  private io: SocketIOServer | null = null;

  constructor() {
    this.threshold = Number(process.env.CONGESTION_THRESHOLD) || 70;
    this.checkIntervalMinutes = Number(process.env.CONGESTION_CHECK_INTERVAL) || 5;
    this.notificationTransaction = new NotificationTransaction(db);
  }

  /**
   * Socket.IO 인스턴스 설정
   */
  setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * 혼잡도 알림 발송 대상 조회
   * 즐겨찾기한 CCTV의 혼잡도가 임계값 이상인 경우 조회
   */
  async getNotificationTargets(): Promise<NotificationTarget[]> {
    return await this.notificationTransaction.getNotificationTargets(
      this.threshold,
      this.checkIntervalMinutes
    );
  }

  /**
   * 특정 혼잡도 데이터에 대한 알림 발송 대상 조회 (즉시 알림용)
   */
  async getNotificationTargetsForCongestion(
    congestionId: number,
    cctvId: number,
    level: number
  ): Promise<NotificationTarget[]> {
    // 임계값 미만이면 알림 대상 없음
    if (level < this.threshold) {
      return [];
    }

    return await this.notificationTransaction.getNotificationTargetsForCongestion(
      congestionId,
      cctvId,
      this.threshold
    );
  }

  /**
   * 알림 발송 이력 저장
   */
  async saveNotificationHistory(
    congestionId: number,
    userId: number,
    cctvId: number,
    status: 'sent' | 'failed' = 'sent'
  ): Promise<void> {
    await this.notificationTransaction.saveNotificationHistory({
      congestion_id: congestionId,
      user_id: userId,
      cctv_id: cctvId,
      status,
    });
  }

  /**
   * 알림 발송 처리 (스케줄러용 - 현재 사용 안 함)
   * DB 삽입 시 즉시 알림으로 전환되어 더 이상 사용하지 않음
   * @deprecated 즉시 알림 방식으로 전환됨
   */
  async processNotifications(): Promise<NotificationTarget[]> {
    try {
      const targets = await this.getNotificationTargets();
      
      if (targets.length === 0) {
        return [];
      }

      // 알림 이력 저장
      for (const target of targets) {
        await this.saveNotificationHistory(
          target.congestion_id,
          target.user_id,
          target.cctv_id,
          'sent'
        );
      }

      return targets;
    } catch (error) {
      console.error('혼잡도 알림 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 즉시 알림 발송 (혼잡도 데이터 삽입 시 호출)
   */
  async sendImmediateNotification(
    congestionId: number,
    cctvId: number,
    level: number
  ): Promise<void> {
    try {
      // 임계값 미만이면 알림 발송 안 함
      if (level < this.threshold) {
        return;
      }

      // 알림 발송 대상 조회
      const targets = await this.getNotificationTargetsForCongestion(
        congestionId,
        cctvId,
        level
      );

      if (targets.length === 0) {
        return;
      }

      // 알림 이력 저장 및 Socket.IO로 전송
      const userNotifications = new Map<number, any[]>();

      for (const target of targets) {
        // 알림 이력 저장
        await this.saveNotificationHistory(
          target.congestion_id,
          target.user_id,
          target.cctv_id,
          'sent'
        );

        // 사용자별로 그룹화
        if (!userNotifications.has(target.user_id)) {
          userNotifications.set(target.user_id, []);
        }
        userNotifications.get(target.user_id)!.push({
          congestion_id: target.congestion_id,
          cctv_id: target.cctv_id,
          level: target.level,
          location: target.location,
          timestamp: target.timestamp,
        });
      }

      // Socket.IO로 즉시 전송
      if (this.io) {
        for (const [userId, notifications] of userNotifications.entries()) {
          this.io.to(`user-${userId}`).emit('congestion-alert', {
            notifications,
            threshold: this.threshold,
          });
        }
      } else {
        console.warn('Socket.IO 인스턴스가 설정되지 않아 즉시 알림을 전송할 수 없습니다.');
      }
    } catch (error) {
      console.error('즉시 혼잡도 알림 발송 실패:', error);
      throw error;
    }
  }

  /**
   * 임계값 가져오기
   */
  getThreshold(): number {
    return this.threshold;
  }
}

export const congestionNotificationService = new CongestionNotificationService();
