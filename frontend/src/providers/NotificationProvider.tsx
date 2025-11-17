import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { NotificationState, NotificationData, AccidentNotificationData } from '../types/notification';
import { socketService } from '../services/socket';
import { useAuth } from './AuthProvider';
import { filterNotificationsWithin2Hours, loadNotificationsFromStorage, saveNotificationsToStorage } from '../utils/notificationUtils';

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

  // 로컬 스토리지에서 알림 복원
  useEffect(() => {
    if (user?.user_id) {
      const loaded = loadNotificationsFromStorage(user.user_id);
      // 2시간 이내 알림만 필터링하여 복원
      const filtered = filterNotificationsWithin2Hours(loaded);
      setNotifications(filtered);
      // 복원된 알림 저장 (2시간 지난 것 제거)
      if (filtered.length !== loaded.length) {
        saveNotificationsToStorage(user.user_id, filtered);
      }
    }
  }, [user?.user_id]);

  // 알림 변경 시 로컬 스토리지에 저장 (초기 로드 제외, debounce 적용)
  const isInitialLoad = React.useRef(true);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    if (user?.user_id) {
      // 이전 타이머 취소
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // 500ms debounce로 저장 (빈번한 업데이트 방지)
      saveTimeoutRef.current = setTimeout(() => {
        saveNotificationsToStorage(user.user_id!, notifications);
      }, 500);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [notifications, user?.user_id]);

  // 알림 사운드 재생
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/notify.mp3');
      audio.volume = 0.5; // 볼륨 조절 (0.0 ~ 1.0)
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
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== id);
      // 로컬 스토리지도 업데이트
      if (user?.user_id) {
        saveNotificationsToStorage(user.user_id, filtered);
      }
      return filtered;
    });
  }, [user?.user_id]);

  // 토스트 알림 제거 (자동으로 사라질 때)
  const removeToastNotification = useCallback((id: string) => {
    setToastNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 모든 알림 제거
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setToastNotifications([]);
    // 로컬 스토리지도 비우기
    if (user?.user_id) {
      saveNotificationsToStorage(user.user_id, []);
    }
  }, [user?.user_id]);

  // 알림 읽음 처리
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      // 로컬 스토리지도 업데이트
      if (user?.user_id) {
        saveNotificationsToStorage(user.user_id, updated);
      }
      return updated;
    });
  }, [user?.user_id]);

  // 읽지 않은 알림 개수 계산 (드롭다운 알림 기준, 2시간 이내만)
  const unreadCount = useMemo(() => {
    return filterNotificationsWithin2Hours(notifications).filter((n) => !n.read).length;
  }, [notifications]);

  // 2시간 지난 알림 자동 삭제
  useEffect(() => {
    const checkAndRemoveOldNotifications = () => {
      setNotifications((prev) => {
        const filtered = filterNotificationsWithin2Hours(prev);
        // 로컬 스토리지도 업데이트
        if (user?.user_id && filtered.length !== prev.length) {
          saveNotificationsToStorage(user.user_id, filtered);
        }
        return filtered;
      });
    };

    // 즉시 실행
    checkAndRemoveOldNotifications();

    // 10분마다 체크
    const interval = setInterval(checkAndRemoveOldNotifications, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.user_id]);

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
          notification_type: 'congestion',
        });
      });
    };

    // 사고 알림 수신
    const handleAccidentAlert = (data: AccidentNotificationData) => {
      data.notifications.forEach((notification) => {
        addNotification({
          cctv_id: notification.nearest_cctv_id,
          event_id: notification.event_id,
          event_type: notification.event_type,
          event_detail_type: notification.event_detail_type,
          nearest_cctv_id: notification.nearest_cctv_id,
          nearest_cctv_location: notification.nearest_cctv_location,
          location: notification.nearest_cctv_location,
          distance_meters: notification.distance_meters,
          latest_congestion_level: notification.latest_congestion_level,
          latest_congestion_timestamp: notification.latest_congestion_timestamp 
            ? new Date(notification.latest_congestion_timestamp) 
            : null,
          timestamp: new Date(notification.timestamp),
          notification_type: 'accident',
        });
      });
    };

    socketService.onCongestionAlert(handleCongestionAlert);
    socketService.onAccidentAlert(handleAccidentAlert);

    return () => {
      socketService.offCongestionAlert(handleCongestionAlert);
      socketService.offAccidentAlert(handleAccidentAlert);
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

