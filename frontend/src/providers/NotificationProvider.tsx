import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { NotificationState, NotificationData } from '../types/notification';
import { socketService } from '../services/socket';
import { useAuth } from './AuthProvider';
import { filterNotificationsWithin24Hours } from '../utils/notificationUtils';

interface NotificationContextType {
  notifications: NotificationState[]; // 드롭다운 알림 (확인용)
  toastNotifications: NotificationState[]; // 토스트 알림 (표시용)
  addNotification: (notification: Omit<NotificationState, 'id' | 'read'>) => void;
  removeNotification: (id: string) => void; // 드롭다운 알림 제거
  removeToastNotification: (id: string) => void; // 토스트 알림 제거
  clearAllNotifications: () => void;
  markAsRead: (id: string) => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]); // 드롭다운 알림 (확인용)
  const [toastNotifications, setToastNotifications] = useState<NotificationState[]>([]); // 토스트 알림 (표시용)
  const { isLoggedIn, user } = useAuth();

  // 알림 사운드 재생
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/alert.mp3');
      audio.volume = 0.3; // 볼륨 조절 (0.0 ~ 1.0)
      audio.play().catch((error) => {
        console.warn('알림 사운드 재생 실패:', error);
      });
    } catch (error) {
      console.warn('알림 사운드 파일을 찾을 수 없습니다:', error);
    }
  }, []);

  // 알림 추가 (토스트와 드롭다운 모두에 추가)
  const addNotification = useCallback((notification: Omit<NotificationState, 'id' | 'read'>) => {
    const newNotification: NotificationState = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random()}`,
      read: false,
    };

    // 드롭다운 알림에 추가 (확인용)
    setNotifications((prev) => [...prev, newNotification]);
    // 토스트 알림에 추가 (표시용)
    setToastNotifications((prev) => [...prev, newNotification]);
    playNotificationSound();
  }, [playNotificationSound]);

  // 드롭다운 알림 제거 (사용자가 X 버튼으로 삭제)
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 토스트 알림 제거 (자동으로 사라질 때)
  const removeToastNotification = useCallback((id: string) => {
    setToastNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 모든 알림 제거
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setToastNotifications([]);
  }, []);

  // 알림 읽음 처리
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // 읽지 않은 알림 개수 계산 (드롭다운 알림 기준, 24시간 이내만)
  const unreadCount = useMemo(() => {
    return filterNotificationsWithin24Hours(notifications).filter((n) => !n.read).length;
  }, [notifications]);

  // 24시간 지난 알림 자동 삭제
  useEffect(() => {
    const checkAndRemoveOldNotifications = () => {
      setNotifications((prev) => filterNotificationsWithin24Hours(prev));
    };

    // 즉시 실행
    checkAndRemoveOldNotifications();

    // 1시간마다 체크
    const interval = setInterval(checkAndRemoveOldNotifications, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Socket.IO 이벤트 리스너 설정
  useEffect(() => {
    if (!isLoggedIn || !user) {
      return;
    }

    // Socket 연결 및 인증
    socketService.connect();
    const token = localStorage.getItem('token');
    if (token) {
      socketService.authenticate(token);
    }

    // 혼잡도 알림 수신
    const handleCongestionAlert = (data: NotificationData) => {
      data.notifications.forEach((notification) => {
        addNotification({
          congestion_id: notification.congestion_id,
          cctv_id: notification.cctv_id,
          level: notification.level,
          location: notification.location,
          timestamp: new Date(notification.timestamp),
        });
      });
    };

    socketService.onCongestionAlert(handleCongestionAlert);

    return () => {
      socketService.offCongestionAlert(handleCongestionAlert);
    };
  }, [isLoggedIn, user, addNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        toastNotifications,
        addNotification,
        removeNotification,
        removeToastNotification,
        clearAllNotifications,
        markAsRead,
        unreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;

