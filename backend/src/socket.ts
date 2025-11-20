import { Server as SocketIOServer } from "socket.io";
import { updateEventData, setEventUpdateCallback, getEvents, EventItem } from "./eventUpdater";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./utils/jwt";

// 이벤트 룸 이름
const EVENT_ROOM = "events";
const VEHICLE_ROOM_PREFIX = "vehicle-";

export interface VehicleUpdatePayload {
  cctvId: number;
  timestamp: number;
  detections: {
    cls: string;
    conf: number;
    bbox: [number, number, number, number];
  }[];
  roiPolygon: [number, number][] | null;
}

// 전역 콜백 등록을 위한 래퍼
declare global {
  // eslint-disable-next-line no-var
  var vehicleUpdateCallback: ((payload: VehicleUpdatePayload) => void) | undefined;
}

/**
 * Socket.IO 이벤트 핸들러 설정
 */
export function setupSocketHandlers(io: SocketIOServer): void {
  console.log("Socket.IO 이벤트 핸들러 설정 완료");

  // 이벤트 업데이트 시 클라이언트에 전송
  setEventUpdateCallback((events: EventItem[]) => {
    io.to(EVENT_ROOM).emit("event-update", events);
    console.log(`이벤트 업데이트 전송: ${events.length}개`);
  });

  // 차량 업데이트 콜백 등록 (detectionRoutes.ts에서 호출됨)
  globalThis.vehicleUpdateCallback = (payload: VehicleUpdatePayload) => {
    const room = `${VEHICLE_ROOM_PREFIX}${payload.cctvId}`;
    io.to(room).emit("vehicle-update", payload);
    console.log(`차량 업데이트 전송: CCTV ${payload.cctvId}, 감지 수: ${payload.detections.length}`);
  };

  io.on("connection", (socket) => {
    console.log(`클라이언트 연결됨: ${socket.id}`);

    // JWT 토큰으로 사용자 인증 및 룸 입장
    socket.on("authenticate", (token: string) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        const userId = decoded.user_id;

        // 사용자별 룸 입장
        socket.join(`user-${userId}`);
        console.log(`사용자 ${userId} (${socket.id}) 인증 완료 및 룸 입장`);
      } catch (error) {
        console.error("Socket 인증 실패:", error);
        socket.disconnect();
      }
    });

    // 이벤트 룸 입장
    socket.on("join-events", () => {
      socket.join(EVENT_ROOM);
      console.log(`클라이언트 ${socket.id}가 이벤트 룸에 입장했습니다.`);

      // 즉시 현재 이벤트 목록 전송
      const events = getEvents();
      socket.emit("event-update", events);
      console.log(`현재 이벤트 ${events.length}개 전송`);
    });

    // 이벤트 룸 퇴장
    socket.on("leave-events", () => {
      socket.leave(EVENT_ROOM);
      console.log(`클라이언트 ${socket.id}가 이벤트 룸에서 퇴장했습니다.`);
    });

    // 기존 룸 관련 이벤트 (호환성 유지)
    socket.on("join-room", (room: string) => {
      socket.join(room);
      console.log(`클라이언트 ${socket.id}가 방 ${room}에 입장했습니다.`);
    });

    socket.on("leave-room", (room: string) => {
      socket.leave(room);
      console.log(`클라이언트 ${socket.id}가 방 ${room}에서 퇴장했습니다.`);
    });

    socket.on("join-vehicle", (cctvId: number) => {
      const room = `${VEHICLE_ROOM_PREFIX}${cctvId}`;
      socket.join(room);
      console.log(`client ${socket.id} joined vehicle room ${room}`);
    });

    socket.on("leave-vehicle", (cctvId: number) => {
      const room = `${VEHICLE_ROOM_PREFIX}${cctvId}`;
      socket.leave(room);
      console.log(`client ${socket.id} left vehicle room ${room}`);
    });

    socket.on("disconnect", () => {
      console.log(`클라이언트 연결 해제됨: ${socket.id}`);
    });
  });
}
