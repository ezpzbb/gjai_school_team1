import React, { useEffect, useRef, useState } from "react";
import { VehicleDetectionItem } from "../../types/vehicle";

interface WsMessage {
  timestamp: number;
  image: string;
  detections: VehicleDetectionItem[];
  roiPolygon: [number, number][] | null;
  error?: string; // 서버에서 error 필드
}

interface LiveModelViewerProps {
  cctvId: number;
}

const LiveModelViewer: React.FC<LiveModelViewerProps> = ({ cctvId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const retryDelayRef = useRef<number>(1000); // ms, 1초 시작
  const countdownTimerRef = useRef<number | null>(null);
  const [nextRetrySec, setNextRetrySec] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/model/view/ws?cctv_id=${cctvId}`;

    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted || wsRef.current) return; // 이미 연결되어 있으면 재접속 안 함

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // 연결되면 에러/지연 초기화
        setLastError(null);
        setNextRetrySec(null);
        retryDelayRef.current = 1000;

        // 카운트다운 타이머 정리
        if (countdownTimerRef.current !== null) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        const data: WsMessage = JSON.parse(event.data);

        // 서버에서 에러 메시지를 보내온 경우
        if (data.error) {
          setLastError(data.error);
          // 바로 재연결하지 않고, 연결만 닫고 종료
          ws.close();
          return;
        }

        if (!data.image || !data.detections) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // raw frame 그리기
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // ROI 폴리곤 오버레이
          if (data.roiPolygon && data.roiPolygon.length >= 3) {
            ctx.save();
            ctx.strokeStyle = "lime";
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            data.roiPolygon.forEach(([x, y], idx) => {
              if (idx === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
          }

          // detections + trackId 기준 박스/라벨 그리기
          ctx.font = "12px sans-serif";
          ctx.textBaseline = "top";

          data.detections.forEach((det) => {
            const [x1, y1, x2, y2] = det.bbox;
            const w = x2 - x1;
            const h = y2 - y1;

            // 중점 좌표
            const cx = x1 + w / 2;
            const cy = y1 + h / 2;

            const idPrefix = det.trackId != null ? `ID:${det.trackId} ` : "";
            const label = `${idPrefix}${det.cls} ${(det.conf * 100).toFixed(1)}%`;

            // trackId별로 색상 차별화 (간단 예시)
            const baseColor = det.trackId ?? 0;
            const r = 50 + ((baseColor * 73) % 205);
            const g = 80 + ((baseColor * 41) % 175);
            const b = 120 + ((baseColor * 29) % 135);
            const strokeColor = `rgb(${r},${g},${b})`;

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y1, w, h);

            const paddingX = 4;
            const paddingY = 2;
            const textWidth = ctx.measureText(label).width;
            const labelHeight = 12 + paddingY * 2;
            const labelTop = y1 - labelHeight < 0 ? 0 : y1 - labelHeight;

            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(x1, labelTop, textWidth + paddingX * 2, labelHeight);
            ctx.fillStyle = "white";
            ctx.fillText(label, x1 + paddingX, labelTop + paddingY);
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = "red"; // 원하는 색
            ctx.fill();
            ctx.closePath();
          });
        };
        img.src = data.image;
      };

      ws.onerror = (e) => {
        console.error("LiveModelViewer WebSocket error:", e);
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (isUnmounted) return;

        // 에러나 비정상 종료 시에만 재연결 시도 (백오프)
        const delay = Math.min(retryDelayRef.current, 30000); // 최대 30초
        let remainingMs = delay;
        setNextRetrySec(Math.ceil(remainingMs / 1000));

        if (countdownTimerRef.current !== null) {
          clearInterval(countdownTimerRef.current);
        }
        countdownTimerRef.current = window.setInterval(() => {
          remainingMs -= 1000;
          if (remainingMs <= 0) {
            if (countdownTimerRef.current !== null) {
              clearInterval(countdownTimerRef.current);
              countdownTimerRef.current = null;
            }
            setNextRetrySec(null);
            connect(); // 다시 연결
          } else {
            setNextRetrySec(Math.ceil(remainingMs / 1000));
          }
        }, 1000);

        retryDelayRef.current = Math.min(delay * 2, 30000);
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (countdownTimerRef.current !== null) {
        clearTimeout(countdownTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [cctvId]);

  return (
    <>
      {lastError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "16px",
            color: "#ffe4e6",
            fontSize: "14px",
            fontWeight: 600,
            background: "linear-gradient(180deg, rgba(127, 29, 29, 0.75) 0%, rgba(127, 29, 29, 0.6) 50%, rgba(127, 29, 29, 0.75) 100%)",
            border: "1px solid rgba(248, 113, 113, 0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {lastError} (잠시 후 자동 재시도)
        </div>
      )}
      {nextRetrySec !== null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "16px",
            color: "#ffe4e6",
            fontSize: "14px",
            fontWeight: 600,
            background: "linear-gradient(180deg, rgba(127, 29, 29, 0.75) 0%, rgba(127, 29, 29, 0.6) 50%, rgba(127, 29, 29, 0.75) 100%)",
            border: "1px solid rgba(248, 113, 113, 0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          재연결까지 약 {nextRetrySec}초 대기 중...
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
          display: "block",
        }}
      />
    </>
  );
};

export default LiveModelViewer;
