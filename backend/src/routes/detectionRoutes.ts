import { Router, Request, Response } from "express";
import { VehicleUpdatePayload } from "../services/detectionService";

export const setupDetectionRoutes = (): Router => {
  const router = Router();

  router.post("/detection", (req: Request, res: Response) => {
    try {
      const { cctvId, timestamp, detections, roiPolygon } = req.body as VehicleUpdatePayload;

      if (!cctvId || !Array.isArray(detections)) {
        return res.status(400).json({ success: false, message: "invalid payload" });
      }

      const tsSec = typeof timestamp === "number" ? timestamp : Date.now() / 1000;

      // DB 저장 없이, 실시간 시각화용 소켓 브로드캐스트만
      if (globalThis.vehicleUpdateCallback) {
        globalThis.vehicleUpdateCallback({
          cctvId,
          timestamp: tsSec,
          detections,
          roiPolygon,
        });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error("vehicle/analysis error", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
