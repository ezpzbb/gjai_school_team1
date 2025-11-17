import { io, Socket } from 'socket.io-client';
import { EventItem } from '../types/event';
import { NotificationData, AccidentNotificationData } from '../types/notification';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

class SocketService {
  private socket: Socket | null = null;
  private eventListeners: Map<string, Set<(events: EventItem[]) => void>> = new Map();
  private congestionAlertListeners: Set<(data: NotificationData) => void> = new Set();
  private accidentAlertListeners: Set<(data: AccidentNotificationData) => void> = new Set();

  /**
   * Socket 연결
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      // 이미 리스너가 등록되어 있다면 이벤트 룸에 입장하여 현재 이벤트 수신
      if (this.eventListeners.has('event-update')) {
        this.socket?.emit('join-events');
      }
      // 연결 시 자동으로 인증 시도
      const token = localStorage.getItem('token');
      if (token) {
        this.authenticate(token);
      }
    });

    this.socket.on('disconnect', () => {
      // 연결 해제됨
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // 이벤트 업데이트 수신
    this.socket.on('event-update', (events: EventItem[]) => {
      this.notifyListeners('event-update', events);
    });

    // 혼잡도 알림 수신
    this.socket.on('congestion-alert', (data: NotificationData) => {
      this.notifyCongestionListeners(data);
    });

    // 사고 알림 수신
    this.socket.on('accident-alert', (data: AccidentNotificationData) => {
      console.log('[Socket] accident-alert 이벤트 수신:', data);
      this.notifyAccidentListeners(data);
    });
  }

  /**
   * Socket 인증 (JWT 토큰으로 사용자 인증)
   */
  authenticate(token: string): void {
    if (this.socket?.connected) {
      this.socket.emit('authenticate', token);
    }
  }

  /**
   * Socket 연결 해제
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.emit('leave-events');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 이벤트 룸에 입장하고 현재 이벤트 수신
   */
  joinEvents(): void {
    if (this.socket?.connected) {
      this.socket.emit('join-events');
    }
  }

  /**
   * 이벤트 업데이트 리스너 등록
   */
  onEventUpdate(callback: (events: EventItem[]) => void): () => void {
    const listeners = this.eventListeners.get('event-update') || new Set();
    listeners.add(callback);
    this.eventListeners.set('event-update', listeners);

    // 연결이 되어있다면 이벤트 룸에 입장하여 현재 이벤트 수신
    if (this.socket?.connected) {
      this.joinEvents();
    }

    // 리스너 제거 함수 반환
    return () => {
      const set = this.eventListeners.get('event-update');
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.eventListeners.delete('event-update');
        }
      }
    };
  }

  /**
   * 리스너들에게 알림
   */
  private notifyListeners(event: string, data: EventItem[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * 혼잡도 알림 리스너 등록
   */
  onCongestionAlert(callback: (data: NotificationData) => void): void {
    this.congestionAlertListeners.add(callback);
  }

  /**
   * 혼잡도 알림 리스너 제거
   */
  offCongestionAlert(callback: (data: NotificationData) => void): void {
    this.congestionAlertListeners.delete(callback);
  }

  /**
   * 혼잡도 알림 리스너들에게 알림
   */
  private notifyCongestionListeners(data: NotificationData): void {
    this.congestionAlertListeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in congestion alert listener:', error);
      }
    });
  }

  /**
   * 사고 알림 리스너 등록
   */
  onAccidentAlert(callback: (data: AccidentNotificationData) => void): void {
    this.accidentAlertListeners.add(callback);
  }

  /**
   * 사고 알림 리스너 제거
   */
  offAccidentAlert(callback: (data: AccidentNotificationData) => void): void {
    this.accidentAlertListeners.delete(callback);
  }

  /**
   * 사고 알림 리스너들에게 알림
   */
  private notifyAccidentListeners(data: AccidentNotificationData): void {
    console.log(`[Socket] 사고 알림 리스너 호출 - 리스너 수: ${this.accidentAlertListeners.size}`);
    this.accidentAlertListeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('[Socket] 사고 알림 리스너 오류:', error);
      }
    });
  }

  /**
   * Socket 연결 상태 확인
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// 싱글톤 인스턴스
export const socketService = new SocketService();
