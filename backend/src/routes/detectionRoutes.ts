import { Router, Request, Response } from "express";
import { Pool } from "mysql2/promise";
import { VehicleUpdatePayload } from "../services/detectionService";
import { CongestionTransaction } from "../models/Congestion/CongestionTransactions";
import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * 차량 수를 기반으로 혼잡도 레벨 계산 (0-100)
 */
function calculateCongestionLevel(vehicleCount: number): number {
  if (vehicleCount === 0) return 0;
  if (vehicleCount <= 5) return 20;
  if (vehicleCount <= 10) return 40;
  if (vehicleCount <= 15) return 60;
  if (vehicleCount <= 20) return 80;
  return 100; // 21개 이상
}

export const setupDetectionRoutes = (dbPool: Pool): Router => {
  const router = Router();
  const congestionTransaction = new CongestionTransaction(dbPool);

  // 분석 완료 이미지 저장 엔드포인트
  const upload = multer({ storage: multer.memoryStorage() });
  
  router.post("/detection/image", upload.single('image'), async (req: Request, res: Response) => {
    try {
      const file = (req as any).file;
      const frameId = parseInt((req as any).body.frame_id);
      
      if (!file || !frameId || isNaN(frameId)) {
        return res.status(400).json({ success: false, message: "image and frame_id are required" });
      }
      
      const conn = await dbPool.getConnection();
      try {
        await conn.beginTransaction();
        
        // 프레임 정보 조회
        const [frameRows] = await conn.query<any[]>(
          `SELECT cctv_id, timestamp FROM frame WHERE frame_id = ?`,
          [frameId]
        );
        
        if (frameRows.length === 0) {
          throw new Error(`Frame ${frameId} not found`);
        }
        
        const cctvId = frameRows[0].cctv_id;
        
        // 분석 완료 이미지 저장
        const filename = `cctv_${cctvId}_${frameId}_analyzed.jpg`;
        const filePath = path.join(__dirname, '../../uploads/frames', filename);
        const relativePath = `/api/uploads/frames/${filename}`;
        
        // 디렉토리 생성
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, file.buffer);
        
        // DB에 프레임 이미지 경로 업데이트
        await conn.query(
          `UPDATE frame SET image_path = ? WHERE frame_id = ?`,
          [relativePath, frameId]
        );
        
        await conn.commit();
        console.log(`[Detection] 분석 완료 이미지 저장: Frame ${frameId}, path: ${relativePath}`);
        res.json({ success: true, image_path: relativePath });
      } catch (err: any) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err: any) {
      console.error("detection/image error", err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.post("/detection", async (req: Request, res: Response) => {
    try {
      const { cctvId, frameId, timestamp, detections, roiPolygon } = req.body as VehicleUpdatePayload;

      if (!cctvId || !Array.isArray(detections)) {
        return res.status(400).json({ success: false, message: "invalid payload" });
      }

      const tsSec = typeof timestamp === "number" ? timestamp : Date.now() / 1000;

      const conn = await dbPool.getConnection();
      try {
        await conn.beginTransaction();

        // frameId가 없으면 가장 최근 프레임 찾기 (하위 호환성)
        let actualFrameId = frameId;
        if (!actualFrameId) {
          const [frameRows] = await conn.query<any[]>(
            `SELECT frame_id FROM frame WHERE cctv_id = ? ORDER BY timestamp DESC LIMIT 1`,
            [cctvId]
          );
          if (frameRows.length > 0) {
            actualFrameId = frameRows[0].frame_id;
          } else {
            throw new Error(`CCTV ${cctvId}에 대한 프레임을 찾을 수 없습니다.`);
          }
        }

        // detection 테이블에 저장
        const insertSql = `
          INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text)
          VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)
        `;

        for (const det of detections) {
          const bboxText = JSON.stringify(det.bbox || []);
          await conn.query(insertSql, [
            actualFrameId, // 올바른 frame_id 사용
            det.conf,
            bboxText,
            tsSec,
            det.cls, // object_text로 저장
          ]);
        }

        // 차량 수 계산 (car, truck, bus만 차량으로 간주)
        const vehicleCount = detections.filter(
          (det) => det.cls === "car" || det.cls === "truck" || det.cls === "bus" || det.cls === "승용차" || det.cls === "트럭" || det.cls === "버스"
        ).length;

        // 혼잡도 계산 및 저장
        const congestionLevel = calculateCongestionLevel(vehicleCount);
        const frameTimestamp = new Date(tsSec * 1000);
        
        // actualFrameId가 확실히 존재하는 경우에만 혼잡도 저장
        if (actualFrameId !== undefined) {
          await congestionTransaction.createCongestion({
            frame_id: actualFrameId,
            level: congestionLevel,
            timestamp: frameTimestamp,
            calculated_at: new Date(),
          });
        }

        await conn.commit();
        console.log(
          `[Detection] CCTV ${cctvId}, Frame ${actualFrameId}: ${detections.length}개 객체 감지 저장 완료 (차량: ${vehicleCount}대, 혼잡도: ${congestionLevel})`
        );
      } catch (err: any) {
        await conn.rollback();
        throw err;
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
