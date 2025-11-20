import React, { useEffect, useRef } from "react";
import { VehicleDetectionItem } from "../../types/vehicle";

interface WsMessage {
  timestamp: number;
  image: string;
  detections: VehicleDetectionItem[];
  roiPolygon: [number, number][] | null;
}

interface LiveModelViewerProps {
  cctvId: number;
}

const LiveModelViewer: React.FC<LiveModelViewerProps> = ({ cctvId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/model/view/ws?cctv_id=${cctvId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data: WsMessage = JSON.parse(event.data);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // (선택) 서버에서 이미 그렸지만, 클라이언트에서 다시 그리고 싶다면:
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "top";

        data.detections.forEach((det) => {
          const [x1, y1, x2, y2] = det.bbox;
          const w = x2 - x1;
          const h = y2 - y1;

          ctx.strokeStyle = "yellow";
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, y1, w, h);

          const label = `${det.cls} ${(det.conf * 100).toFixed(1)}%`;
          const paddingX = 4;
          const paddingY = 2;
          const textWidth = ctx.measureText(label).width;
          const labelHeight = 12 + paddingY * 2;
          const labelTop = y1 - labelHeight < 0 ? 0 : y1 - labelHeight;

          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(x1, labelTop, textWidth + paddingX * 2, labelHeight);
          ctx.fillStyle = "white";
          ctx.fillText(label, x1 + paddingX, labelTop + paddingY);
        });

        // ROI 폴리곤 클라이언트에서 다시 그리고 싶으면 여기서 data.roiPolygon 사용
      };
      img.src = data.image;
    };

    ws.onerror = (e) => {
      console.error("LiveModelViewer WebSocket error:", e);
    };

    return () => {
      ws.close();
    };
  }, [cctvId]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        display: "block",
      }}
    />
  );
};

export default LiveModelViewer;
