import React, { useEffect, useMemo } from 'react';
import { NotificationState } from '../../types/notification';
import {
  formatTime,
  getLevelColor,
  getLevelBorderColor,
  getLevelText,
  getNotificationDotColor,
} from '../../utils/notificationHelpers';

interface NotificationToastProps {
  notification: NotificationState;
  onClose: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 5000); // 5초 후 자동 닫기

    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const isAccidentNotification = notification.notification_type === 'accident';
  
  // 메모이제이션으로 불필요한 재계산 방지
  const borderColor = useMemo(() => {
    if (isAccidentNotification) return 'border-black dark:border-black';
    if (notification.level) return getLevelBorderColor(notification.level);
    return 'border-blue-500';
  }, [isAccidentNotification, notification.level]);
  
  const dotColor = useMemo(() => {
    if (isAccidentNotification) return 'bg-black dark:bg-black';
    if (notification.level) return getLevelColor(notification.level);
    return 'bg-blue-500';
  }, [isAccidentNotification, notification.level]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-3 min-w-[320px] max-w-[400px] border-l-4 ${borderColor} animate-slide-in-right`}
      role="alert"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isAccidentNotification ? (
            // 사고 알림 표시
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${dotColor}`}></div>
                <h4 className="font-semibold text-red-600 dark:text-red-400">
                  🚨 사고 알림
                </h4>
              </div>
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
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  최신 혼잡도: <span className="font-semibold">{notification.latest_congestion_level}%</span> ({getLevelText(notification.latest_congestion_level)})
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {formatTime(notification.timestamp)}
              </p>
            </>
          ) : (
            // 혼잡도 알림 표시
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${dotColor}`}></div>
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  혼잡도 알림
                </h4>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                <span className="font-medium">{notification.location}</span>
              </p>
              {notification.level && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  혼잡도: <span className="font-semibold">{notification.level}%</span> ({getLevelText(notification.level)})
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {formatTime(notification.timestamp)}
              </p>
            </>
          )}
        </div>
        <button
          onClick={() => onClose(notification.id)}
          className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="닫기"
        >
          <svg
            className="w-5 h-5"
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
      </div>
    </div>
  );
};

export default NotificationToast;

