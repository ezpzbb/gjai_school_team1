import { NotificationState } from '../types/notification';

/**
 * 2시간을 밀리초로 변환한 상수
 */
export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * 알림이 2시간 이내인지 확인
 */
export const isNotificationWithin2Hours = (notification: NotificationState): boolean => {
  const now = Date.now();
  const notificationTime = notification.timestamp.getTime();
  return now - notificationTime < TWO_HOURS_MS;
};

/**
 * 알림 목록에서 2시간 이내 알림만 필터링
 */
export const filterNotificationsWithin2Hours = (
  notifications: NotificationState[]
): NotificationState[] => {
  return notifications.filter(isNotificationWithin2Hours);
};

/**
 * 알림 목록을 최신순으로 정렬
 */
export const sortNotificationsByDate = (
  notifications: NotificationState[]
): NotificationState[] => {
  return [...notifications].sort((a, b) => {
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
};

/**
 * 알림 목록을 2시간 이내만 필터링하고 최신순으로 정렬
 */
export const getSortedRecentNotifications = (
  notifications: NotificationState[]
): NotificationState[] => {
  return sortNotificationsByDate(filterNotificationsWithin2Hours(notifications));
};

/**
 * 로컬 스토리지에서 알림 목록 불러오기
 */
export const loadNotificationsFromStorage = (userId: number): NotificationState[] => {
  try {
    const key = `notifications_${userId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('알림 데이터 형식이 올바르지 않습니다.');
      return [];
    }
    
    // Date 객체 복원
    return parsed.map((n: any) => ({
      ...n,
      timestamp: new Date(n.timestamp),
      latest_congestion_timestamp: n.latest_congestion_timestamp 
        ? new Date(n.latest_congestion_timestamp) 
        : null,
    }));
  } catch (error) {
    console.error('알림 로드 실패:', error);
    return [];
  }
};

/**
 * 로컬 스토리지에 알림 목록 저장
 */
export const saveNotificationsToStorage = (userId: number, notifications: NotificationState[]): void => {
  try {
    const key = `notifications_${userId}`;
    const data = JSON.stringify(notifications);
    
    // 로컬 스토리지 용량 제한 체크 (약 5MB)
    if (data.length > 5 * 1024 * 1024) {
      console.warn('알림 데이터가 너무 큽니다. 오래된 알림을 삭제합니다.');
      // 최신 100개만 유지
      const recentNotifications = notifications.slice(0, 100);
      localStorage.setItem(key, JSON.stringify(recentNotifications));
      return;
    }
    
    localStorage.setItem(key, data);
  } catch (error: any) {
    // QuotaExceededError 처리
    if (error.name === 'QuotaExceededError') {
      console.warn('로컬 스토리지 용량 초과. 오래된 알림을 삭제합니다.');
      const recentNotifications = notifications.slice(0, 50);
      try {
        localStorage.setItem(key, JSON.stringify(recentNotifications));
      } catch (retryError) {
        console.error('알림 저장 재시도 실패:', retryError);
      }
    } else {
      console.error('알림 저장 실패:', error);
    }
  }
};

