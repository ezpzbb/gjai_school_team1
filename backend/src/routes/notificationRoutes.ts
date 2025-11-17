import express, { Request, Response } from 'express';
import { authenticateJWT } from '../middlewares/User';
import { congestionNotificationService } from '../services/congestionNotificationService';

const router = express.Router();

/**
 * 즉시 알림 테스트 (관리자용)
 * 스케줄러를 기다리지 않고 즉시 알림 발송
 */
router.post('/test', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const targets = await congestionNotificationService.processNotifications();
    
    if (targets.length === 0) {
      return res.status(200).json({
        success: true,
        message: '알림 발송 대상이 없습니다.',
        targets: [],
      });
    }

    // Socket.IO 인스턴스가 필요하므로 여기서는 데이터만 반환
    res.status(200).json({
      success: true,
      message: `알림 발송 대상 ${targets.length}건 발견`,
      targets: targets,
    });
  } catch (error: any) {
    console.error('알림 테스트 실패:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 알림 발송 대상 조회
 */
router.get('/targets', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const targets = await congestionNotificationService.getNotificationTargets();
    
    res.status(200).json({
      success: true,
      count: targets.length,
      targets: targets,
    });
  } catch (error: any) {
    console.error('알림 대상 조회 실패:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * 이미 삽입된 혼잡도 데이터에 대해 즉시 알림 발송
 * SQL로 직접 삽입한 경우 사용
 */
router.post('/send/:congestionId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const congestionId = parseInt(req.params.congestionId);
    const { cctv_id, level } = req.body;

    // 파라미터 검증
    if (isNaN(congestionId) || congestionId <= 0) {
      return res.status(400).json({
        success: false,
        message: '유효한 congestion_id가 필요합니다.',
      });
    }

    if (!cctv_id || cctv_id === undefined || level === undefined || level === null) {
      return res.status(400).json({
        success: false,
        message: 'cctv_id와 level은 필수입니다.',
        received: { cctv_id, level },
      });
    }

    // 숫자로 변환
    const cctvId = Number(cctv_id);
    const congestionLevel = Number(level);

    if (isNaN(cctvId) || isNaN(congestionLevel)) {
      return res.status(400).json({
        success: false,
        message: 'cctv_id와 level은 숫자여야 합니다.',
      });
    }

    // 즉시 알림 발송
    await congestionNotificationService.sendImmediateNotification(
      congestionId,
      cctvId,
      congestionLevel
    );

    res.status(200).json({
      success: true,
      message: '알림이 발송되었습니다.',
      data: {
        congestion_id: congestionId,
        cctv_id: cctvId,
        level: congestionLevel,
      },
    });
  } catch (error: any) {
    console.error('알림 발송 실패:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


export default router;

