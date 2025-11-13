import { NotificationState } from '../types/notification';

/**
 * 24시간을 밀리초로 변환한 상수
 */
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * 알림이 24시간 이내인지 확인
 */
export const isNotificationWithin24Hours = (notification: NotificationState): boolean => {
  const now = Date.now();
  const notificationTime = notification.timestamp.getTime();
  return now - notificationTime < TWENTY_FOUR_HOURS_MS;
};

/**
 * 알림 목록에서 24시간 이내 알림만 필터링
 */
export const filterNotificationsWithin24Hours = (
  notifications: NotificationState[]
): NotificationState[] => {
  return notifications.filter(isNotificationWithin24Hours);
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
 * 알림 목록을 24시간 이내만 필터링하고 최신순으로 정렬
 */
export const getSortedRecentNotifications = (
  notifications: NotificationState[]
): NotificationState[] => {
  return sortNotificationsByDate(filterNotificationsWithin24Hours(notifications));
};

