import { io, Socket } from "socket.io-client";
import { EventItem } from "../types/event";
import { NotificationData, AccidentNotificationData } from "../types/notification";
import { VehicleUpdatePayload } from "../types/vehicle";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3002";

class SocketService {
  private socket: Socket | null = null;
  private eventListeners: Map<string, Set<(events: EventItem[]) => void>> = new Map();
  private congestionAlertListeners: Set<(data: NotificationData) => void> = new Set();
  private accidentAlertListeners: Set<(data: AccidentNotificationData) => void> = new Set();

  /**
   * Socket 연결
   */
  connect(): void {
    console.log(`[Socket] connect 호출, 현재 연결 상태: ${this.socket?.connected}, URL: ${SOCKET_URL}`);
    if (this.socket?.connected) {
      console.log('[Socket] 이미 연결되어 있습니다.');
      return;
    }

    console.log('[Socket] 새로운 Socket 연결 시작...');
    this.socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log('[Socket] 연결 성공!', { socketId: this.socket?.id });
      // 이미 리스너가 등록되어 있다면 이벤트 룸에 입장하여 현재 이벤트 수신
      if (this.eventListeners.has("event-update")) {
        this.socket?.emit("join-events");
      }
      // 연결 시 자동으로 인증 시도
      const token = localStorage.getItem("token");
      if (token) {
        console.log('[Socket] 인증 토큰으로 인증 시도...');
        this.authenticate(token);
      } else {
        console.warn('[Socket] 인증 토큰이 없습니다.');
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log('[Socket] 연결 해제됨:', reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[Socket] 연결 오류:", error);
    });

    // 이벤트 업데이트 수신
    this.socket.on("event-update", (events: EventItem[]) => {
      this.notifyListeners("event-update", events);
    });

    // 혼잡도 알림 수신
    this.socket.on("congestion-alert", (data: NotificationData) => {
      this.notifyCongestionListeners(data);
    });

    // 사고 알림 수신
    this.socket.on("accident-alert", (data: AccidentNotificationData) => {
      console.log("[Socket] accident-alert 이벤트 수신:", data);
      this.notifyAccidentListeners(data);
    });
  }

  /**
   * Socket 인증 (JWT 토큰으로 사용자 인증)
   */
  authenticate(token: string): void {
    if (this.socket?.connected) {
      this.socket.emit("authenticate", token);
    }
  }

  /**
   * Socket 연결 해제
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.emit("leave-events");
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 이벤트 룸에 입장하고 현재 이벤트 수신
   */
  joinEvents(): void {
    if (this.socket?.connected) {
      this.socket.emit("join-events");
    }
  }

  /**
   * 이벤트 업데이트 리스너 등록
   */
  onEventUpdate(callback: (events: EventItem[]) => void): () => void {
    const listeners = this.eventListeners.get("event-update") || new Set();
    listeners.add(callback);
    this.eventListeners.set("event-update", listeners);

    // 연결이 되어있다면 이벤트 룸에 입장하여 현재 이벤트 수신
    if (this.socket?.connected) {
      this.joinEvents();
    }

    // 리스너 제거 함수 반환
    return () => {
      const set = this.eventListeners.get("event-update");
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.eventListeners.delete("event-update");
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
          console.error("Error in event listener:", error);
        }
      });
    }
  }

  // HLS와 Canvas 오버레이로 실시간 표시를 위해 추가 -> 영상에 메타 데이터 삽입
  private vehicleListeners: Map<number, Set<(payload: VehicleUpdatePayload) => void>> = new Map();

  onVehicleUpdate(cctvId: number, callback: (payload: VehicleUpdatePayload) => void): () => void {
    if (!this.socket) this.connect();
    const listeners = this.vehicleListeners.get(cctvId) || new Set();
    listeners.add(callback);
    this.vehicleListeners.set(cctvId, listeners);

    if (this.socket?.connected) {
      this.socket.emit("join-vehicle", cctvId);
    }

    this.socket?.on("vehicle-update", (payload: VehicleUpdatePayload) => {
      if (payload.cctvId !== cctvId) return;
      const set = this.vehicleListeners.get(cctvId);
      if (!set) return;
      set.forEach((fn) => fn(payload));
    });

    return () => {
      const set = this.vehicleListeners.get(cctvId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.vehicleListeners.delete(cctvId);
          this.socket?.emit("leave-vehicle", cctvId);
        }
      }
    };
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
        console.error("Error in congestion alert listener:", error);
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
        console.error("[Socket] 사고 알림 리스너 오류:", error);
      }
    });
  }

  /**
   * 분석 시작 요청
   */
  startDetection(cctvId: number): void {
    console.log(`[Socket] startDetection 호출: CCTV ${cctvId}, 연결 상태: ${this.socket?.connected}`);
    
    if (!this.socket) {
      console.log('[Socket] Socket이 없습니다. 연결을 시작합니다...');
      this.connect();
      // 연결 후 이벤트 전송을 위해 잠시 대기
      setTimeout(() => {
        if (this.socket?.connected) {
          console.log(`[Socket] 연결 완료, 분석 시작 요청 전송: CCTV ${cctvId}`);
          this.socket.emit("start-detection", cctvId);
          console.log(`[Socket] 분석 시작 요청 전송 완료: CCTV ${cctvId}`);
        } else {
          // 연결이 완료될 때까지 대기
          const checkConnection = () => {
            if (this.socket?.connected) {
              console.log(`[Socket] 연결 완료, 분석 시작 요청 전송: CCTV ${cctvId}`);
              this.socket.emit("start-detection", cctvId);
              console.log(`[Socket] 분석 시작 요청 전송 완료: CCTV ${cctvId}`);
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        }
      }, 100);
    } else if (!this.socket.connected) {
      console.log('[Socket] Socket이 연결되지 않았습니다. 연결을 기다립니다...');
      this.connect();
      // 연결 후 이벤트 전송
      const checkConnection = () => {
        if (this.socket?.connected) {
          console.log(`[Socket] 연결 완료, 분석 시작 요청 전송: CCTV ${cctvId}`);
          this.socket.emit("start-detection", cctvId);
          console.log(`[Socket] 분석 시작 요청 전송 완료: CCTV ${cctvId}`);
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      checkConnection();
    } else {
      console.log(`[Socket] Socket이 연결되어 있습니다. 분석 시작 요청 전송: CCTV ${cctvId}`);
      this.socket.emit("start-detection", cctvId);
      console.log(`[Socket] 분석 시작 요청 전송 완료: CCTV ${cctvId}`);
    }
  }

  /**
   * 분석 중지 요청
   */
  stopDetection(cctvId: number): void {
    console.log(`[Socket] stopDetection 호출: CCTV ${cctvId}, 연결 상태: ${this.socket?.connected}`);
    if (this.socket?.connected) {
      this.socket.emit("stop-detection", cctvId);
      console.log(`[Socket] 분석 중지 요청 전송 완료: CCTV ${cctvId}`);
    } else {
      console.warn(`[Socket] Socket이 연결되지 않아 분석 중지 요청을 전송할 수 없습니다: CCTV ${cctvId}`);
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
