// src/scheduler.ts
// ITS CCTV 업데이트는 제거됨 (경찰청 UTIC API로 전환)
// ITS 이벤트 업데이트는 유지
import { updateEventData } from './eventUpdater';
import { congestionNotificationService } from './services/congestionNotificationService';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const CONGESTION_CHECK_INTERVAL = (Number(process.env.CONGESTION_CHECK_INTERVAL) || 5) * 60 * 1000;

let eventIntervalId: NodeJS.Timeout | null = null;
let congestionCheckIntervalId: NodeJS.Timeout | null = null;

export function startEventScheduler(): void {
  if (eventIntervalId) return;

  console.log('이벤트 스케줄러 시작: 즉시 실행 + 15분 간격');
  updateEventData();

  eventIntervalId = setInterval(() => {
    console.log('15분 경과 → 경찰청 이벤트 자동 업데이트 시작');
    updateEventData();
  }, FIFTEEN_MINUTES);
}

export function startCongestionNotificationScheduler(io: any): void {
  if (congestionCheckIntervalId) return;

  console.log(`혼잡도 알림 스케줄러 시작: 즉시 실행 + ${CONGESTION_CHECK_INTERVAL / 1000 / 60}분 간격`);
  
  // 즉시 실행
  checkAndSendCongestionNotifications(io);

  congestionCheckIntervalId = setInterval(() => {
    checkAndSendCongestionNotifications(io);
  }, CONGESTION_CHECK_INTERVAL);
}

async function checkAndSendCongestionNotifications(io: any): Promise<void> {
  try {
    const targets = await congestionNotificationService.processNotifications();
    
    if (!targets || targets.length === 0) {
      return;
    }

    // 사용자별로 그룹화하여 Socket.IO로 전송
    const userNotifications = new Map<number, any[]>();
    
    for (const target of targets) {
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

    // 각 사용자에게 알림 전송
    for (const [userId, notifications] of userNotifications.entries()) {
      io.to(`user-${userId}`).emit('congestion-alert', {
        notifications,
        threshold: congestionNotificationService.getThreshold(),
      });
      console.log(`혼잡도 알림 전송: 사용자 ${userId}, ${notifications.length}건`);
    }
  } catch (error) {
    console.error('혼잡도 알림 체크 실패:', error);
  }
}

export function stopEventScheduler(): void {
  if (eventIntervalId) {
    clearInterval(eventIntervalId);
    eventIntervalId = null;
    console.log('이벤트 스케줄러 중지됨');
  }
}

export function stopCongestionNotificationScheduler(): void {
  if (congestionCheckIntervalId) {
    clearInterval(congestionCheckIntervalId);
    congestionCheckIntervalId = null;
    console.log('혼잡도 알림 스케줄러 중지됨');
  }
}