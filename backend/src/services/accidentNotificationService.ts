import { NotificationTransaction } from '../models/Notification/NotificationTransactions';
import { CongestionTransaction } from '../models/Congestion/CongestionTransactions';
import { AccidentNotificationTarget } from '../models/Notification/NotificationModel';
import { Server as SocketIOServer } from 'socket.io';
import db from '../config/db';
import { EventItem } from '../eventUpdater';
import { calculateDistance } from '../utils/distanceUtils';

export class AccidentNotificationService {
  private maxDistanceMeters: number;
  private notificationTransaction: NotificationTransaction;
  private congestionTransaction: CongestionTransaction;
  private io: SocketIOServer | null = null;

  constructor() {
    // 최대 거리 설정 (기본값: 200미터)
    this.maxDistanceMeters = Number(process.env.ACCIDENT_NOTIFICATION_MAX_DISTANCE) || 200;
    this.notificationTransaction = new NotificationTransaction(db);
    this.congestionTransaction = new CongestionTransaction(db);
  }

  /**
   * Socket.IO 인스턴스 설정
   */
  setSocketIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * 사고 이벤트 알림 발송
   * @param events 모든 이벤트 목록 (사고 이벤트만 필터링됨)
   */
  async sendAccidentNotifications(events: EventItem[]): Promise<void> {
    try {
      // 사고 이벤트만 필터링
      const accidentEvents = events.filter(
        (event) => event.eventType === '교통사고'
      );

      if (accidentEvents.length === 0) {
        console.log('사고 이벤트 없음 - 알림 발송 건너뜀');
        return;
      }

      console.log(`[사고 알림] 사고 이벤트 ${accidentEvents.length}건 발견 - 알림 처리 시작`);

      // 모든 사용자의 즐겨찾기 CCTV 조회 (사용자별로 그룹화)
      const userFavoriteCCTVs = await this.getAllUserFavoriteCCTVs();

      console.log(`[사고 알림] 즐겨찾기 CCTV 보유 사용자 수: ${userFavoriteCCTVs.size}`);

      if (userFavoriteCCTVs.size === 0) {
        console.log('[사고 알림] 즐겨찾기 CCTV 없음 - 알림 발송 건너뜀');
        return;
      }

      // 각 사고 이벤트에 대해 알림 대상 찾기
      const notificationTargets: AccidentNotificationTarget[] = [];

      for (const event of accidentEvents) {
        const eventLat = parseFloat(event.coordY);
        const eventLon = parseFloat(event.coordX);

        // 좌표 유효성 검사
        if (isNaN(eventLat) || isNaN(eventLon)) {
          console.warn(`[사고 알림] 사고 이벤트 ${event.id}의 좌표가 유효하지 않음`);
          continue;
        }

        // 각 사용자별로 가장 가까운 CCTV 찾기
        for (const [userId, cctvs] of userFavoriteCCTVs.entries()) {
          // 중복 알림 방지 체크 (사용자당 이벤트당 1개만)
          const alreadyNotified = await this.notificationTransaction.checkAccidentNotificationExists(
            event.id,
            userId
          );

          if (alreadyNotified) {
            console.log(`[사고 알림] 중복 알림 방지 - 사용자: ${userId}, 이벤트: ${event.id}`);
            continue;
          }

          // 200m 이내인 CCTV들 찾기
          const nearbyCCTVs: Array<{
            cctv: typeof cctvs[0];
            distance: number;
          }> = [];

          for (const cctv of cctvs) {
            const distance = calculateDistance(
              cctv.latitude,
              cctv.longitude,
              eventLat,
              eventLon
            );

            console.log(`[사고 알림] 거리 계산 - 사용자: ${userId}, CCTV(${cctv.cctv_id}): ${distance}m (최대: ${this.maxDistanceMeters}m)`);

            if (distance <= this.maxDistanceMeters) {
              nearbyCCTVs.push({ cctv, distance });
            }
          }

          // 가장 가까운 CCTV 찾기
          if (nearbyCCTVs.length === 0) {
            console.log(`[사고 알림] 200m 이내 CCTV 없음 - 사용자: ${userId}, 이벤트: ${event.id}`);
            continue;
          }

          // 거리순으로 정렬하여 가장 가까운 CCTV 선택
          nearbyCCTVs.sort((a, b) => a.distance - b.distance);
          const nearestCCTV = nearbyCCTVs[0];

          console.log(`[사고 알림] 가장 가까운 CCTV 선택 - 사용자: ${userId}, CCTV: ${nearestCCTV.cctv.location} (${nearestCCTV.distance}m)`);

          // 가장 가까운 CCTV의 최신 혼잡도 조회
          const latestCongestion = await this.congestionTransaction.getLatestCongestionByCctv(
            nearestCCTV.cctv.cctv_id
          );

          notificationTargets.push({
            user_id: userId,
            event_id: event.id,
            event_type: event.eventType,
            event_detail_type: event.eventDetailType,
            nearest_cctv_id: nearestCCTV.cctv.cctv_id,
            nearest_cctv_location: nearestCCTV.cctv.location,
            distance_meters: nearestCCTV.distance,
            latest_congestion_level: latestCongestion?.level ?? null,
            latest_congestion_timestamp: latestCongestion?.timestamp ?? null,
            timestamp: new Date(),
          });
        }
      }

      if (notificationTargets.length === 0) {
        console.log('알림 대상 없음 - 알림 발송 건너뜀');
        return;
      }

      console.log(`알림 대상 ${notificationTargets.length}건 발견 - 알림 발송 시작`);

      // 사용자별로 그룹화하여 알림 발송
      const userNotifications = new Map<number, any[]>();

      for (const target of notificationTargets) {
        try {
          // 알림 이력 저장
          await this.notificationTransaction.saveAccidentNotificationHistory({
            event_id: target.event_id,
            user_id: target.user_id,
            cctv_id: target.nearest_cctv_id,
            distance_meters: target.distance_meters,
            status: 'sent',
          });

          // 사용자별로 그룹화
          if (!userNotifications.has(target.user_id)) {
            userNotifications.set(target.user_id, []);
          }
          userNotifications.get(target.user_id)!.push({
            event_id: target.event_id,
            event_type: target.event_type,
            event_detail_type: target.event_detail_type,
            nearest_cctv_id: target.nearest_cctv_id,
            nearest_cctv_location: target.nearest_cctv_location,
            distance_meters: target.distance_meters,
            latest_congestion_level: target.latest_congestion_level,
            latest_congestion_timestamp: target.latest_congestion_timestamp,
            timestamp: target.timestamp,
          });
        } catch (error) {
          console.error(
            `[사고 알림] 이력 저장 실패 (event_id: ${target.event_id}, user_id: ${target.user_id}, cctv_id: ${target.nearest_cctv_id}):`,
            error
          );
          // 이력 저장 실패해도 알림은 발송 시도
        }
      }

      // Socket.IO로 알림 전송
      if (this.io) {
        for (const [userId, notifications] of userNotifications.entries()) {
          const roomName = `user-${userId}`;
          console.log(`[사고 알림] Socket.IO 전송 - 룸: ${roomName}, 알림 수: ${notifications.length}`);
          this.io.to(roomName).emit('accident-alert', {
            notifications,
            maxDistanceMeters: this.maxDistanceMeters,
          });
        }
        console.log(`[사고 알림] 발송 완료 - ${userNotifications.size}명의 사용자에게 전송`);
      } else {
        console.warn('[사고 알림] Socket.IO 인스턴스가 설정되지 않아 알림을 전송할 수 없습니다.');
      }
    } catch (error) {
      console.error('사고 알림 발송 실패:', error);
      throw error;
    }
  }

  /**
   * 모든 사용자의 즐겨찾기 CCTV 조회 (사용자별로 그룹화)
   * @returns Map<userId, cctvs[]>
   */
  private async getAllUserFavoriteCCTVs(): Promise<
    Map<
      number,
      Array<{
        cctv_id: number;
        location: string;
        latitude: number;
        longitude: number;
      }>
    >
  > {
    try {
      // 모든 사용자 조회 (간단한 방법: 즐겨찾기 테이블에서 DISTINCT user_id 조회)
      const [userRows] = await db.execute<any[]>(
        'SELECT DISTINCT user_id FROM Favorite'
      );

      const userFavoriteCCTVs = new Map<
        number,
        Array<{
          cctv_id: number;
          location: string;
          latitude: number;
          longitude: number;
        }>
      >();

      // 각 사용자별로 즐겨찾기 CCTV 조회
      for (const row of userRows) {
        const userId = row.user_id;
        const cctvs = await this.notificationTransaction.getUserFavoriteCCTVsWithCoords(
          userId
        );

        if (cctvs.length > 0) {
          userFavoriteCCTVs.set(userId, cctvs);
        }
      }

      return userFavoriteCCTVs;
    } catch (error) {
      console.error('즐겨찾기 CCTV 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 최대 거리 가져오기
   */
  getMaxDistanceMeters(): number {
    return this.maxDistanceMeters;
  }
}

export const accidentNotificationService = new AccidentNotificationService();

