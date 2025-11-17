import express, { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import { congestionNotificationService } from '../services/congestionNotificationService';

const router = express.Router();

/**
 * 혼잡도 데이터 삽입 및 즉시 알림 발송
 */
router.post('/', async (req: Request, res: Response) => {
  const pool: Pool = req.app.get('dbPool');
  
  try {
    const { frame_id, level, timestamp, calculated_at } = req.body;

    if (!frame_id || level === undefined) {
      return res.status(400).json({
        success: false,
        message: 'frame_id와 level은 필수입니다.',
      });
    }

    // 혼잡도 데이터 삽입
    const query = `
      INSERT INTO congestion (frame_id, level, timestamp, calculated_at)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      frame_id,
      level,
      timestamp || new Date(),
      calculated_at || new Date(),
    ]);

    const congestionId = (result as any).insertId;

    // 프레임에서 CCTV ID 조회
    const [frameRows] = await pool.execute<any[]>(
      'SELECT cctv_id FROM frame WHERE frame_id = ?',
      [frame_id]
    );

    if (frameRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '프레임을 찾을 수 없습니다.',
      });
    }

    const cctvId = frameRows[0].cctv_id;

    // 즉시 알림 발송 (비동기로 처리하여 응답 지연 방지)
    congestionNotificationService
      .sendImmediateNotification(congestionId, cctvId, level)
      .catch((error) => {
        console.error('즉시 알림 발송 실패:', error);
        // 알림 실패해도 데이터 삽입은 성공한 것으로 처리
      });

    res.status(201).json({
      success: true,
      message: '혼잡도 데이터가 저장되었습니다.',
      data: {
        congestion_id: congestionId,
        frame_id,
        cctv_id: cctvId,
        level,
      },
    });
  } catch (error: any) {
    console.error('혼잡도 데이터 삽입 실패:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;

