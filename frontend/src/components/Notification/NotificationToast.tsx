import React, { useEffect } from 'react';

interface NotificationToastProps {
  id: string;
  location: string;
  level: number;
  timestamp: Date;
  onClose: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  id,
  location,
  level,
  timestamp,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 5000); // 5초 후 자동 닫기

    return () => clearTimeout(timer);
  }, [id, onClose]);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLevelColor = (level: number) => {
    if (level >= 80) return 'bg-red-500';
    if (level >= 70) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getLevelText = (level: number) => {
    if (level >= 80) return '매우 혼잡';
    if (level >= 70) return '혼잡';
    return '보통';
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-3 min-w-[320px] max-w-[400px] border-l-4 border-blue-500 animate-slide-in-right"
      role="alert"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${getLevelColor(level)}`}></div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              혼잡도 알림
            </h4>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
            <span className="font-medium">{location}</span>
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            혼잡도: <span className="font-semibold">{level}%</span> ({getLevelText(level)})
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {formatTime(timestamp)}
          </p>
        </div>
        <button
          onClick={() => onClose(id)}
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

