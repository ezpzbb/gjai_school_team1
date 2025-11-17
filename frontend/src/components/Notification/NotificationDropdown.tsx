import React, { useRef, useEffect, useMemo } from 'react';
import { useNotification } from '../../providers/NotificationProvider';
import NotificationCard from './NotificationCard';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../providers/DataProvider';
import { getSortedRecentNotifications } from '../../utils/notificationUtils';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, markAsRead, removeNotification } = useNotification();
  const navigate = useNavigate();
  const { cctvLocations } = useData();

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 알림 카드 클릭 핸들러
  const handleNotificationClick = (notification: { cctv_id: number; id: string; nearest_cctv_id?: number }) => {
    // 읽음 처리
    markAsRead(notification.id);

    // 알림 삭제 (사용자가 확인했으므로)
    removeNotification(notification.id);

    // CCTV ID 결정 (사고 알림의 경우 nearest_cctv_id 사용)
    const targetCctvId = notification.nearest_cctv_id || notification.cctv_id;

    // CCTV 정보 찾기
    const cctv = cctvLocations.find((c) => c.cctv_id === targetCctvId);
    if (!cctv) {
      return;
    }

    // favorite 페이지로 이동 (쿼리 파라미터로 CCTV ID와 확대 여부 전달)
    // FavoritePage에서 focusAndExpandCCTV를 호출하여 처리
    navigate(`/favorite?cctv_id=${targetCctvId}&expand=true`);

    // 드롭다운 닫기
    onClose();
  };

  // 알림 목록을 최신순으로 정렬하고 24시간 지난 알림 제외
  const sortedNotifications = useMemo(() => {
    return getSortedRecentNotifications(notifications);
  }, [notifications]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden flex flex-col"
    >
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
          알림
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {sortedNotifications.length}개
        </span>
      </div>

      {/* 알림 목록 */}
      <div className="overflow-y-auto flex-1">
        {sortedNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            알림이 없습니다
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {sortedNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onClose={removeNotification}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;

