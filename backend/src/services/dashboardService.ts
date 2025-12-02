import { Pool } from 'mysql2/promise';
import { FrameTransaction } from '../models/Frame/FrameTransactions';
import { CongestionTransaction } from '../models/Congestion/CongestionTransactions';
import { DetectionTransaction } from '../models/Detection/DetectionTransactions';
import { StatisticsTransaction } from '../models/Statistics/StatisticsTransactions';
import { logger } from '../utils/logger';
import {
  AnalyzedTimeRange,
} from '../models/Frame/FrameModel';
import {
  CongestionDataPoint,
} from '../models/Congestion/CongestionModel';
import {
  DetectionStatistics,
} from '../models/Detection/DetectionModel';
import {
  VehicleStatisticsByType,
} from '../models/Statistics/StatisticsModel';

export class DashboardService {
  private frameTransaction: FrameTransaction;
  private congestionTransaction: CongestionTransaction;
  private detectionTransaction: DetectionTransaction;
  private statisticsTransaction: StatisticsTransaction;

  constructor(pool: Pool) {
    this.frameTransaction = new FrameTransaction(pool);
    this.congestionTransaction = new CongestionTransaction(pool);
    this.detectionTransaction = new DetectionTransaction(pool);
    this.statisticsTransaction = new StatisticsTransaction(pool);
  }

  /**
   * 분석 완료 시간대 조회
   */
  async getAnalyzedTimeRanges(cctvId: number): Promise<AnalyzedTimeRange[]> {
    try {
      return await this.frameTransaction.getAnalyzedTimeRanges(cctvId);
    } catch (error) {
      logger.error('DashboardService: 분석 완료 시간대 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 혼잡도 데이터 조회
   */
  async getCongestionData(
    cctvId: number,
    startTime: Date,
    endTime: Date
  ): Promise<CongestionDataPoint[]> {
    try {
      return await this.congestionTransaction.getCongestionData(
        cctvId,
        startTime,
        endTime
      );
    } catch (error) {
      logger.error('DashboardService: 혼잡도 데이터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 차량 통계 데이터 조회 (차량 유형별)
   */
  async getVehicleStatistics(
    cctvId: number,
    startTime: Date,
    endTime: Date
  ): Promise<VehicleStatisticsByType[]> {
    try {
      return await this.statisticsTransaction.getVehicleStatistics(
        cctvId,
        startTime,
        endTime
      );
    } catch (error) {
      logger.error('DashboardService: 차량 통계 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 객체 유형별 통계 조회
   */
  async getDetectionStatistics(
    cctvId: number,
    startTime: Date,
    endTime: Date
  ): Promise<DetectionStatistics[]> {
    try {
      return await this.detectionTransaction.getDetectionStatistics(
        cctvId,
        startTime,
        endTime
      );
    } catch (error) {
      logger.error('DashboardService: 감지 통계 조회 실패:', error);
      throw error;
    }
  }
}

