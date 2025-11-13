import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { NotificationState, NotificationData } from '../types/notification';
import { socketService } from '../services/socket';
import { useAuth } from './AuthProvider';

interface NotificationContextType {
  notifications: NotificationState[];
  addNotification: (notification: Omit<NotificationState, 'id' | 'read'>) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationState[]>([]);
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

  // 알림 추가
  const addNotification = useCallback((notification: Omit<NotificationState, 'id' | 'read'>) => {
    const newNotification: NotificationState = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random()}`,
      read: false,
    };

    setNotifications((prev) => [...prev, newNotification]);
    playNotificationSound();
  }, [playNotificationSound]);

  // 알림 제거
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 모든 알림 제거
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
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
        addNotification,
        removeNotification,
        clearAllNotifications,
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

