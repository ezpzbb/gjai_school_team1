// 차량 관련 API 라우트 정의 -> 모델 예측 값 클래스명, 정확도 저장, 동시에 실시간 브로드캐스트 역할
import { Router, Request, Response } from "express";
import { Pool } from "mysql2/promise";

export const setupDetectionRoutes = (dbPool: Pool): Router => {
  const router = Router();

  router.post("/detection", async (req: Request, res: Response) => {
    try {
      const { cctvId, timestamp, detections, roiPolygon } = req.body;

      if (!cctvId || !Array.isArray(detections)) {
        return res.status(400).json({ success: false, message: "invalid payload" });
      }

      const conn = await dbPool.getConnection();
      try {
        await conn.beginTransaction();

        // db에는 cls/conf/bb/time 저장
        const insertSql = "INSERT INTO detection (frame_id, class_name, confidence, bounding_box, detected_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))";

        for (const det of detections) {
          await conn.query(insertSql, [cctvId, det.cls, det.conf, timestamp || Date.now() / 1000]);
        }

        await conn.commit();
      } finally {
        conn.release();
      }

      // WebSocket(추후 front 오버레이용)에 보내기 위해,
      // socket.ts 에서 사용할 수 있도록 콜백 호출 (아래 2-3 참고)
      if (globalThis.vehicleUpdateCallback) {
        globalThis.vehicleUpdateCallback({
          cctvId,
          timestamp,
          detections,
          roiPolygon,
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("detection", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
