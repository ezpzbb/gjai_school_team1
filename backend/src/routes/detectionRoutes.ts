import { Router, Request, Response } from "express";
import { Pool } from "mysql2/promise";
import { VehicleUpdatePayload } from "../services/detectionService";

export const setupDetectionRoutes = (dbPool: Pool): Router => {
  const router = Router();

  router.post("/detection", async (req: Request, res: Response) => {
    try {
      const { cctvId, timestamp, detections, roiPolygon } = req.body as VehicleUpdatePayload;

      if (!cctvId || !Array.isArray(detections)) {
        return res.status(400).json({ success: false, message: "invalid payload" });
      }

      const tsSec = typeof timestamp === "number" ? timestamp : Date.now() / 1000;

      const conn = await dbPool.getConnection();
      try {
        await conn.beginTransaction();

        // 예: detection 테이블에 cls/conf만 저장 (bbox는 선택)
        const insertSql = `
          INSERT INTO detection (frame_id, class_name, confidence, bounding_box, detected_at)
          VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))
        `;

        for (const det of detections) {
          const bboxText = JSON.stringify(det.bbox || []);
          await conn.query(insertSql, [
            cctvId, // frame_id 자리: 현재 구조에서는 cctvId를 FK처럼 사용
            det.cls,
            det.conf,
            bboxText,
            tsSec,
          ]);
        }

        await conn.commit();
      } finally {
        conn.release();
      }

      // 실시간 브로드캐스트
      if (globalThis.vehicleUpdateCallback) {
        globalThis.vehicleUpdateCallback({
          cctvId,
          timestamp: tsSec,
          detections,
          roiPolygon,
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("vehicle/analysis error", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
