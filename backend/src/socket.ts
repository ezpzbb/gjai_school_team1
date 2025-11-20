import { Server as SocketIOServer } from "socket.io";
import { updateEventData, setEventUpdateCallback, getEvents, EventItem } from "./eventUpdater";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./utils/jwt";
import axios from "axios";
import { FrameCaptureService } from "./services/frameCaptureService";
import { pool } from "./config/db";
import { Pool } from "mysql2/promise";

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

// 프레임 캡처 서비스 인스턴스 (싱글톤)
let frameCaptureService: FrameCaptureService | null = null;

/**
 * Socket.IO 이벤트 핸들러 설정
 */
export function setupSocketHandlers(io: SocketIOServer, dbPool?: Pool): void {
  console.log("Socket.IO 이벤트 핸들러 설정 완료");

  // 프레임 캡처 서비스 초기화
  const poolToUse = dbPool || pool;
  if (!frameCaptureService) {
    frameCaptureService = new FrameCaptureService(poolToUse);
    console.log(`[Socket] 프레임 캡처 서비스 초기화 완료 (캡처 주기: ${process.env.FRAME_CAPTURE_INTERVAL || '5'}초)`);
  }

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

    // 분석 시작 요청
    socket.on("start-detection", async (cctvId: number) => {
      console.log(`[Socket] 클라이언트 ${socket.id}가 CCTV ${cctvId}에 대한 감지 시작 요청`);
      const vehicleRoom = `${VEHICLE_ROOM_PREFIX}${cctvId}`;
      socket.join(vehicleRoom);
      socket.join(`detection-${cctvId}`);
      
      // 프레임 캡처 서비스를 사용한 주기적 캡처 방식
      if (frameCaptureService) {
        try {
          await frameCaptureService.startCapture(cctvId);
          console.log(`[Socket] CCTV ${cctvId} 프레임 캡처 시작`);
        } catch (error: any) {
          console.error(`[Socket] 프레임 캡처 시작 실패: CCTV ${cctvId}`, error.message);
        }
      } else {
        // 프레임 캡처 서비스가 없으면 기존 스트리밍 방식 사용
        console.warn(`[Socket] 프레임 캡처 서비스가 초기화되지 않았습니다. 스트리밍 방식으로 전환합니다.`);
        const modelServerUrl = process.env.MODEL_SERVER_URL || "http://model:8000";
        try {
          const response = await axios.get(`${modelServerUrl}/view/mjpeg?cctv_id=${cctvId}`, {
            timeout: 2000,
            responseType: 'stream',
            validateStatus: (status) => status < 500,
          });
          console.log(`[Socket] 모델 서버에 분석 시작 요청 전송 성공: CCTV ${cctvId}`);
          response.data.destroy();
        } catch (error: any) {
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.warn(`[Socket] 모델 서버 연결 실패: CCTV ${cctvId}`, error.message);
          } else {
            console.error(`[Socket] 모델 서버 요청 실패: CCTV ${cctvId}`, error.message);
          }
        }
      }
      
      // vehicle 룸에 입장하여 vehicle-update 이벤트 수신 가능하도록 설정
      console.log(`[Socket] CCTV ${cctvId} 분석 시작 - vehicle 룸(${vehicleRoom})에 입장 완료`);
    });

    // 분석 중지 요청
    socket.on("stop-detection", (cctvId: number) => {
      console.log(`[Socket] 클라이언트 ${socket.id}가 CCTV ${cctvId}에 대한 감지 중지 요청`);
      const vehicleRoom = `${VEHICLE_ROOM_PREFIX}${cctvId}`;
      socket.leave(vehicleRoom);
      socket.leave(`detection-${cctvId}`);
      
      // 프레임 캡처 중지
      if (frameCaptureService) {
        frameCaptureService.stopCapture(cctvId);
      }
      
      console.log(`[Socket] CCTV ${cctvId} 분석 중지 - vehicle 룸(${vehicleRoom})에서 퇴장 완료`);
    });

    socket.on("disconnect", () => {
      console.log(`클라이언트 연결 해제됨: ${socket.id}`);
    });
  });
}
