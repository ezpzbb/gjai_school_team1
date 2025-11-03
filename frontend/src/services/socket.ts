import { io, Socket } from 'socket.io-client';
import { EventItem } from '../types/event';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

class SocketService {
  private socket: Socket | null = null;
  private eventListeners: Map<string, Set<(events: EventItem[]) => void>> = new Map();

  /**
   * Socket 연결
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      // 이벤트 룸 입장
      this.socket?.emit('join-events');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // 이벤트 업데이트 수신
    this.socket.on('event-update', (events: EventItem[]) => {
      console.log('Received event-update:', events.length);
      this.notifyListeners('event-update', events);
    });
  }

  /**
   * Socket 연결 해제
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.emit('leave-events');
      this.socket.disconnect();
      this.socket = null;
      console.log('Socket disconnected');
    }
  }

  /**
   * 이벤트 업데이트 리스너 등록
   */
  onEventUpdate(callback: (events: EventItem[]) => void): () => void {
    const listeners = this.eventListeners.get('event-update') || new Set();
    listeners.add(callback);
    this.eventListeners.set('event-update', listeners);

    // 연결이 되어있다면 즉시 현재 이벤트 요청 (서버에서 자동으로 전송됨)
    if (this.socket?.connected) {
      // 서버에서 join-events 시 자동으로 전송하므로 여기서는 추가 작업 불필요
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
   * Socket 연결 상태 확인
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// 싱글톤 인스턴스
export const socketService = new SocketService();
