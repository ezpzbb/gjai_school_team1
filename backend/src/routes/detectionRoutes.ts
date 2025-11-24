import { Router, Request, Response } from "express";
import { Pool } from "mysql2/promise";
import { VehicleUpdatePayload } from "../services/detectionService";
import { CongestionTransaction } from "../models/Congestion/CongestionTransactions";
import { congestionNotificationService } from "../services/congestionNotificationService";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getSocketIO, VEHICLE_ROOM_PREFIX } from "../socket";

/**
 * 차량 수를 기반으로 혼잡도 레벨 계산 (0-100)
 * 혼잡도 70 이상이 되려면 차량 수가 40대 이상이어야 함
 */
function calculateCongestionLevel(vehicleCount: number): number {
  if (vehicleCount === 0) return 0;
  if (vehicleCount <= 10) return 20;
  if (vehicleCount <= 20) return 40;
  if (vehicleCount <= 30) return 60;
  if (vehicleCount <= 39) return 70;
  if (vehicleCount <= 50) return 80;
  return 100; // 51대 이상
}

export const setupDetectionRoutes = (dbPool: Pool): Router => {
  const router = Router();
  const congestionTransaction = new CongestionTransaction(dbPool);

  // 분석 완료 이미지 저장 엔드포인트
  const upload = multer({ storage: multer.memoryStorage() });
  
  // CCTV당 최대 프레임 수 (환경변수 또는 기본값 50)
  const MAX_FRAMES_PER_CCTV = parseInt(process.env.MAX_FRAMES_PER_CCTV || '50', 10);
  
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
        
        // FIFO 로직: 특정 CCTV의 프레임 수가 MAX_FRAMES_PER_CCTV를 초과하면 가장 오래된 프레임의 이미지 파일만 삭제
        // 레코드는 유지하여 차트 데이터(detection, congestion, statistics)를 보존
        // image_path가 NOT NULL이므로 특수 플래그 값 '__DELETED__'를 사용하여 삭제된 이미지를 표시
        const DELETED_FLAG = '__DELETED__';
        const [countRows] = await conn.query<any[]>(
          `SELECT COUNT(*) as count FROM frame 
           WHERE cctv_id = ? AND image_path IS NOT NULL AND image_path != '' AND image_path != ?`,
          [cctvId, DELETED_FLAG]
        );
        const frameCount = countRows[0].count;
        
        if (frameCount > MAX_FRAMES_PER_CCTV) {
          const excessCount = frameCount - MAX_FRAMES_PER_CCTV;
          // 가장 오래된 프레임 조회 (실제 이미지가 있는 것만, 삭제 플래그 제외)
          const [oldestFrames] = await conn.query<any[]>(
            `SELECT frame_id, image_path FROM frame 
             WHERE cctv_id = ? AND image_path IS NOT NULL AND image_path != '' AND image_path != ?
             ORDER BY timestamp ASC LIMIT ?`,
            [cctvId, DELETED_FLAG, excessCount]
          );
          
          for (const oldFrame of oldestFrames) {
            if (oldFrame.image_path && oldFrame.image_path !== DELETED_FLAG) {
              try {
                // 파일명 추출 (상대 경로에서)
                const filename = path.basename(oldFrame.image_path);
                const oldFilePath = path.join(__dirname, '../../uploads/frames', filename);
                
                // 파일이 존재하면 삭제
                if (fs.existsSync(oldFilePath)) {
                  fs.unlinkSync(oldFilePath);
                  console.log(`[Detection] 오래된 프레임 파일 삭제: ${oldFilePath}`);
                }
              } catch (fileError: any) {
                console.warn(`[Detection] 프레임 파일 삭제 실패 (무시): ${fileError.message}`);
              }
            }
            
            // DB 레코드는 유지하되 image_path를 삭제 플래그로 표시
            // 레코드를 유지하여 detection, congestion, statistics 데이터 보존 (차트 데이터 유지)
            await conn.query(
              `UPDATE frame SET image_path = ? WHERE frame_id = ?`,
              [DELETED_FLAG, oldFrame.frame_id]
            );
            console.log(`[Detection] 오래된 프레임 이미지 삭제 표시: Frame ${oldFrame.frame_id} (레코드 유지하여 차트 데이터 보존)`);
          }
          
          console.log(`[Detection] FIFO 정리 완료: CCTV ${cctvId}, ${excessCount}개 프레임 이미지 삭제 (현재 이미지: ${frameCount - excessCount}개, 전체 레코드 유지)`);
        }
        
        await conn.commit();
        console.log(`[Detection] 분석 완료 이미지 저장: Frame ${frameId}, path: ${relativePath}`);
        
        // Socket.IO로 분석 완료 이미지 브로드캐스트 (이미지 데이터 직접 전송)
        const io = getSocketIO();
        if (io) {
          try {
            // 이미지 파일을 읽어서 Base64로 인코딩
            const imageBuffer = fs.readFileSync(filePath);
            const imageBase64 = imageBuffer.toString('base64');
            const imageData = `data:image/jpeg;base64,${imageBase64}`;
            
            const room = `${VEHICLE_ROOM_PREFIX}${cctvId}`;
            
            io.to(room).emit("analyzed-image", {
              cctvId,
              frameId,
              imagePath: relativePath,
              imageUrl: `${process.env.API_URL || 'http://localhost:3002'}${relativePath}`, // 하위 호환성 유지
              imageData, // Base64 인코딩된 이미지 데이터
              timestamp: Date.now(),
            });
            console.log(`[Detection] 분석 완료 이미지 브로드캐스트: CCTV ${cctvId}, Frame ${frameId}, Size: ${imageBuffer.length} bytes`);
          } catch (error: any) {
            console.error(`[Detection] 이미지 파일 읽기 실패: ${filePath}`, error.message);
            // 이미지 읽기 실패 시 URL만 전송 (하위 호환성)
            const room = `${VEHICLE_ROOM_PREFIX}${cctvId}`;
            const apiUrl = process.env.API_URL || 'http://localhost:3002';
            const fullImageUrl = `${apiUrl}${relativePath}`;
            
            io.to(room).emit("analyzed-image", {
              cctvId,
              frameId,
              imagePath: relativePath,
              imageUrl: fullImageUrl,
              timestamp: Date.now(),
            });
            console.log(`[Detection] 분석 완료 이미지 브로드캐스트 (URL만): CCTV ${cctvId}, Frame ${frameId}, URL: ${fullImageUrl}`);
          }
        } else {
          console.warn(`[Detection] Socket.IO 인스턴스가 없어 이미지를 브로드캐스트할 수 없습니다.`);
        }
        
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

        // detection 테이블에 저장 및 detection_id 수집
        const insertSql = `
          INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text)
          VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)
        `;

        const detectionIds: number[] = [];
        const vehicleTypes = ['car', 'truck', 'bus', '승용차', '트럭', '버스'];

        for (const det of detections) {
          const bboxText = JSON.stringify(det.bbox || []);
          const [result] = await conn.query(insertSql, [
            actualFrameId, // 올바른 frame_id 사용
            det.conf,
            bboxText,
            tsSec,
            det.cls, // object_text로 저장
          ]);
          
          const insertId = (result as any).insertId;
          if (insertId) {
            detectionIds.push(insertId);
          }
        }

        // 각 detection에 대해 statistics 생성 (같은 트랜잭션 내에서)
        const statisticsInsertSql = `
          INSERT INTO statistics (detection_id, object_count, vehicle_total)
          VALUES (?, ?, ?)
        `;

        for (let i = 0; i < detectionIds.length; i++) {
          const detectionId = detectionIds[i];
          const det = detections[i];
          
          // 차량 여부 확인
          const isVehicle = vehicleTypes.includes(det.cls);
          
          await conn.query(statisticsInsertSql, [
            detectionId,
            1, // object_count: 각 detection은 객체 1개
            isVehicle ? 1 : 0, // vehicle_total: 차량이면 1, 아니면 0
          ]);
        }

        // 차량 수 계산 (car, truck, bus만 차량으로 간주)
        const vehicleCount = detections.filter(
          (det) => vehicleTypes.includes(det.cls)
        ).length;

        // 혼잡도 계산 및 저장
        const congestionLevel = calculateCongestionLevel(vehicleCount);
        const frameTimestamp = new Date(tsSec * 1000);
        
        // actualFrameId가 확실히 존재하는 경우에만 혼잡도 저장
        let congestionId: number | null = null;
        if (actualFrameId !== undefined) {
          const congestion = await congestionTransaction.createCongestion({
            frame_id: actualFrameId,
            level: congestionLevel,
            timestamp: frameTimestamp,
            calculated_at: new Date(),
          });
          congestionId = congestion.congestion_id;
        }

        await conn.commit();
        console.log(
          `[Detection] CCTV ${cctvId}, Frame ${actualFrameId}: ${detections.length}개 객체 감지 저장 완료 (차량: ${vehicleCount}대, 혼잡도: ${congestionLevel}, Statistics: ${detectionIds.length}개 생성)`
        );

        // 혼잡도가 임계값 이상이면 즉시 알림 발송 (트랜잭션 커밋 후 비동기로 처리)
        const threshold = congestionNotificationService.getThreshold();
        if (congestionId !== null && congestionLevel >= threshold) {
          setImmediate(async () => {
            try {
              await congestionNotificationService.sendImmediateNotification(
                congestionId!,
                cctvId,
                congestionLevel
              );
              console.log(
                `[Detection] 혼잡도 알림 발송: CCTV ${cctvId}, 혼잡도 ${congestionLevel} (임계값: ${threshold}), Congestion ID ${congestionId}`
              );
            } catch (error: any) {
              console.error('혼잡도 알림 발송 실패:', error);
              // 알림 실패해도 데이터 저장은 성공한 것으로 처리
            }
          });
        }
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
