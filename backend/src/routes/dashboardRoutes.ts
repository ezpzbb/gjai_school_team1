import express, { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import { DashboardService } from '../services/dashboardService';
import { authenticateJWT } from '../middlewares/User';
import { logger } from '../utils/logger';

const router = express.Router();

export const dashboardRoutes = (pool: Pool) => {
  const dashboardService = new DashboardService(pool);

  /**
   * GET /api/dashboard/cctv/:cctvId/analyzed-time-ranges
   * 분석 완료된 시간대 목록 조회
   */
  router.get(
    '/cctv/:cctvId/analyzed-time-ranges',
    authenticateJWT,
    async (req: Request, res: Response) => {
      try {
        const cctvId = parseInt(req.params.cctvId);
        if (isNaN(cctvId)) {
          return res.status(400).json({
            success: false,
            message: '유효하지 않은 CCTV ID입니다.',
          });
        }

        const timeRanges = await dashboardService.getAnalyzedTimeRanges(cctvId);

        res.status(200).json({
          success: true,
          data: {
            cctv_id: cctvId,
            timeRanges,
          },
        });
      } catch (error: any) {
        logger.error('DashboardRoutes: 분석 완료 시간대 조회 실패:', error);
        res.status(500).json({
          success: false,
          message: `분석 완료 시간대 조회 실패: ${error.message}`,
        });
      }
    }
  );

  /**
   * GET /api/dashboard/cctv/:cctvId/congestion
   * 혼잡도 데이터 조회
   * 쿼리 파라미터: startTime, endTime (ISO 8601 형식)
   */
  router.get(
    '/cctv/:cctvId/congestion',
    authenticateJWT,
    async (req: Request, res: Response) => {
      try {
        const cctvId = parseInt(req.params.cctvId);
        if (isNaN(cctvId)) {
          return res.status(400).json({
            success: false,
            message: '유효하지 않은 CCTV ID입니다.',
          });
        }

        const startTimeStr = req.query.startTime as string;
        const endTimeStr = req.query.endTime as string;

        if (!startTimeStr || !endTimeStr) {
          return res.status(400).json({
            success: false,
            message: 'startTime과 endTime은 필수입니다.',
          });
        }

        const startTime = new Date(startTimeStr);
        const endTime = new Date(endTimeStr);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          return res.status(400).json({
            success: false,
            message: '유효하지 않은 날짜 형식입니다.',
          });
        }

        if (startTime >= endTime) {
          return res.status(400).json({
            success: false,
            message: 'startTime은 endTime보다 이전이어야 합니다.',
          });
        }

        const congestionData = await dashboardService.getCongestionData(
          cctvId,
          startTime,
          endTime
        );

        res.status(200).json({
          success: true,
          data: congestionData,
        });
      } catch (error: any) {
        logger.error('DashboardRoutes: 혼잡도 데이터 조회 실패:', error);
        res.status(500).json({
          success: false,
          message: `혼잡도 데이터 조회 실패: ${error.message}`,
        });
      }
    }
  );

  /**
   * GET /api/dashboard/cctv/:cctvId/vehicles
   * 차량 통계 데이터 조회
   * 쿼리 파라미터: startTime, endTime (ISO 8601 형식)
   */
  router.get(
    '/cctv/:cctvId/vehicles',
    authenticateJWT,
    async (req: Request, res: Response) => {
      try {
        const cctvId = parseInt(req.params.cctvId);
        if (isNaN(cctvId)) {
          return res.status(400).json({
            success: false,
            message: '유효하지 않은 CCTV ID입니다.',
          });
        }

        const startTimeStr = req.query.startTime as string;
        const endTimeStr = req.query.endTime as string;

        if (!startTimeStr || !endTimeStr) {
          return res.status(400).json({
            success: false,
            message: 'startTime과 endTime은 필수입니다.',
          });
        }

        const startTime = new Date(startTimeStr);
        const endTime = new Date(endTimeStr);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          return res.status(400).json({
            success: false,
            message: '유효하지 않은 날짜 형식입니다.',
          });
        }

        if (startTime >= endTime) {
          return res.status(400).json({
            success: false,
            message: 'startTime은 endTime보다 이전이어야 합니다.',
          });
        }

        const vehicleData = await dashboardService.getVehicleStatistics(
          cctvId,
          startTime,
          endTime
        );

        res.status(200).json({
          success: true,
          data: vehicleData,
        });
      } catch (error: any) {
        logger.error('DashboardRoutes: 차량 통계 조회 실패:', error);
        res.status(500).json({
          success: false,
          message: `차량 통계 조회 실패: ${error.message}`,
        });
      }
    }
  );

  /**
   * GET /api/dashboard/cctv/:cctvId/detections
   * 객체 유형별 통계 조회
   * 쿼리 파라미터: startTime, endTime (ISO 8601 형식)
   */
  router.get(
    '/cctv/:cctvId/detections',
    authenticateJWT,
    async (req: Request, res: Response) => {
      try {
        const cctvId = parseInt(req.params.cctvId);
        if (isNaN(cctvId)) {
          return res.status(400).json({
            success: false,
            message: '유효하지 않은 CCTV ID입니다.',
          });
        }

        const startTimeStr = req.query.startTime as string;
        const endTimeStr = req.query.endTime as string;

        if (!startTimeStr || !endTimeStr) {
          return res.status(400).json({
            success: false,
            message: 'startTime과 endTime은 필수입니다.',
          });
        }

        const startTime = new Date(startTimeStr);
        const endTime = new Date(endTimeStr);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          return res.status(400).json({
            success: false,
            message: '유효하지 않은 날짜 형식입니다.',
          });
        }

        if (startTime >= endTime) {
          return res.status(400).json({
            success: false,
            message: 'startTime은 endTime보다 이전이어야 합니다.',
          });
        }

        const detectionData = await dashboardService.getDetectionStatistics(
          cctvId,
          startTime,
          endTime
        );

        res.status(200).json({
          success: true,
          data: detectionData,
        });
      } catch (error: any) {
        logger.error('DashboardRoutes: 감지 통계 조회 실패:', error);
        res.status(500).json({
          success: false,
          message: `감지 통계 조회 실패: ${error.message}`,
        });
      }
    }
  );

  return router;
};

