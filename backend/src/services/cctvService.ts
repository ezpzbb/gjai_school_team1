// 카메라 서비스 - CCTV API 연동 및 스트림 관리

import { Pool } from 'mysql2/promise';
import { CCTVTransaction } from '../models/Camera/CameraTransactions';
import { CCTV } from '../models/Camera/CameraModel';

export class CCTVService {
  private cctvTransaction: CCTVTransaction;

  constructor(dbPool: Pool) {
    this.cctvTransaction = new CCTVTransaction(dbPool);
  }

  async getCCTVLocations(): Promise<CCTV[]> {
    try {
      const cctvLocations = await this.cctvTransaction.getAllCCTVLocations();
      return cctvLocations;
    } catch (error) {
      throw new Error(`Service error: ${(error as Error).message}`);
    }
  }

  async searchCCTVLocations(keyword: string): Promise<CCTV[]> {
    try {
      const cctvLocations = await this.cctvTransaction.searchCCTVLocations(keyword);
      return cctvLocations;
    } catch (error) {
      throw new Error(`Service error: ${(error as Error).message}`);
    }
  }
}
