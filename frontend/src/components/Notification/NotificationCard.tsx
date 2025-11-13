import React from 'react';
import { NotificationState } from '../../types/notification';

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

  const formatTime = (date: Date) => {
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

  const getLevelColor = (level: number) => {
    if (level >= 80) return 'text-red-600 dark:text-red-400';
    if (level >= 70) return 'text-orange-600 dark:text-orange-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  const getLevelBgColor = (level: number) => {
    if (level >= 80) return 'bg-red-100 dark:bg-red-900/30';
    if (level >= 70) return 'bg-orange-100 dark:bg-orange-900/30';
    return 'bg-yellow-100 dark:bg-yellow-900/30';
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        relative p-4 rounded-lg border cursor-pointer transition-all
        ${notification.read 
          ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700' 
          : 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 shadow-sm'
        }
        hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700
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
        <div className="absolute top-3 left-3 w-2 h-2 bg-blue-500 rounded-full"></div>
      )}

      {/* 알림 내용 */}
      <div className={notification.read ? 'pl-0' : 'pl-4'}>
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            {notification.location}
          </h3>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span
            className={`
              px-2 py-1 rounded text-xs font-semibold
              ${getLevelColor(notification.level)} ${getLevelBgColor(notification.level)}
            `}
          >
            혼잡도 {notification.level}%
          </span>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatTime(notification.timestamp)}
        </p>
      </div>
    </div>
  );
};

export default NotificationCard;

