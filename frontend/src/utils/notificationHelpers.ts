import { NotificationState } from '../types/notification';

/**
 * 시간 포맷팅 (상대 시간)
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR');
};

/**
 * 시간 포맷팅 (시:분)
 */
export const formatTime = (date: Date): string => {
  return new Date(date).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 혼잡도 레벨에 따른 텍스트 색상 클래스
 */
export const getLevelTextColor = (level: number): string => {
  if (level >= 90) return 'text-red-600 dark:text-red-400';
  if (level >= 80) return 'text-orange-600 dark:text-orange-400';
  if (level >= 70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-600 dark:text-gray-400';
};

/**
 * 혼잡도 레벨에 따른 배경 색상 클래스
 */
export const getLevelBgColor = (level: number): string => {
  if (level >= 90) return 'bg-red-100 dark:bg-red-900/30';
  if (level >= 80) return 'bg-orange-100 dark:bg-orange-900/30';
  if (level >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-gray-100 dark:bg-gray-900/30';
};

/**
 * 혼잡도 레벨에 따른 테두리 색상 클래스
 */
export const getLevelBorderColor = (level: number): string => {
  if (level >= 90) return 'border-red-500 dark:border-red-600';
  if (level >= 80) return 'border-orange-500 dark:border-orange-600';
  if (level >= 70) return 'border-yellow-500 dark:border-yellow-600';
  return 'border-blue-200 dark:border-blue-800';
};

/**
 * 혼잡도 레벨에 따른 점 색상 클래스 (Toast용)
 */
export const getLevelColor = (level: number): string => {
  if (level >= 90) return 'bg-red-500';
  if (level >= 80) return 'bg-orange-500';
  if (level >= 70) return 'bg-yellow-500';
  return 'bg-gray-500';
};

/**
 * 혼잡도 레벨에 따른 점 색상 클래스 (Card용)
 */
export const getLevelDotColor = (level: number): string => {
  if (level >= 90) return 'bg-red-500';
  if (level >= 80) return 'bg-orange-500';
  if (level >= 70) return 'bg-yellow-500';
  return 'bg-blue-500';
};

/**
 * 혼잡도 레벨에 따른 텍스트 설명
 */
export const getLevelText = (level: number): string => {
  if (level >= 90) return '매우 혼잡';
  if (level >= 80) return '혼잡';
  if (level >= 70) return '주의';
  return '보통';
};

/**
 * 알림 카드의 테두리 색상 클래스 결정
 */
export const getNotificationBorderColor = (notification: NotificationState): string => {
  if (notification.notification_type === 'accident') {
    return 'border-black dark:border-black';
  }
  if (notification.level) {
    return getLevelBorderColor(notification.level);
  }
  return 'border-blue-200 dark:border-blue-800';
};

/**
 * 알림 카드의 점 색상 클래스 결정
 */
export const getNotificationDotColor = (notification: NotificationState): string => {
  if (notification.notification_type === 'accident') {
    return 'bg-black dark:bg-black';
  }
  if (notification.level) {
    return getLevelDotColor(notification.level);
  }
  return 'bg-blue-500';
};

