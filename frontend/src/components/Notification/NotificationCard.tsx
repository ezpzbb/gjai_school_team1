import React, { useMemo } from 'react';
import { NotificationState } from '../../types/notification';
import {
  formatRelativeTime,
  getLevelTextColor,
  getLevelBgColor,
  getLevelBorderColor,
  getNotificationDotColor,
  getNotificationBorderColor,
} from '../../utils/notificationHelpers';

interface NotificationCardProps {
  notification: NotificationState;
  onClose: (id: string) => void;
  onClick: (notification: NotificationState) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onClose,
  onClick,
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    // X 버튼 클릭이 아닐 때만 onClick 실행
    if ((e.target as HTMLElement).closest('.close-button')) {
      return;
    }
    onClick(notification);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(notification.id);
  };

  // 메모이제이션으로 불필요한 재계산 방지
  const borderColor = useMemo(() => getNotificationBorderColor(notification), [notification]);
  const dotColor = useMemo(() => getNotificationDotColor(notification), [notification]);

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative p-4 rounded-lg border cursor-pointer transition-all
        ${notification.read 
          ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' 
          : `bg-white dark:bg-gray-800 ${borderColor} shadow-sm`
        }
        ${notification.read ? '' : 'hover:shadow-md'}
      `}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={handleClose}
        className="close-button absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="알림 닫기"
      >
        <svg
          className="w-4 h-4 text-gray-500 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* 읽지 않은 알림 표시 */}
      {!notification.read && (
        <div className={`absolute top-3 left-3 w-2 h-2 rounded-full ${dotColor}`}></div>
      )}

      {/* 알림 내용 */}
      <div className={notification.read ? 'pl-0' : 'pl-4'}>
        {notification.notification_type === 'accident' ? (
          // 사고 알림 표시
          <>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-red-600 dark:text-red-400 text-sm">
                🚨 사고 알림
              </h3>
            </div>
            <div className="mb-2">
              <p className="text-sm text-gray-900 dark:text-gray-100 mb-1">
                <span className="font-medium">{notification.event_type}</span>
                {notification.event_detail_type && (
                  <span className="text-gray-600 dark:text-gray-400 ml-1">
                    ({notification.event_detail_type})
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                가장 가까운 CCTV: <span className="font-medium">{notification.nearest_cctv_location || notification.location}</span>
                {notification.distance_meters && (
                  <span className="ml-1">(약 {notification.distance_meters}m)</span>
                )}
              </p>
              {notification.latest_congestion_level !== null && notification.latest_congestion_level !== undefined && (
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${getLevelTextColor(notification.latest_congestion_level)} ${getLevelBgColor(notification.latest_congestion_level)}`}
                  >
                    최신 혼잡도 {notification.latest_congestion_level}%
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(notification.timestamp)}
            </p>
          </>
        ) : (
          // 혼잡도 알림 표시
          <>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {notification.location}
              </h3>
            </div>
            <div className="flex items-center gap-2 mb-2">
              {notification.level && (
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getLevelTextColor(notification.level)} ${getLevelBgColor(notification.level)}`}
                >
                  혼잡도 {notification.level}%
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(notification.timestamp)}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationCard;

