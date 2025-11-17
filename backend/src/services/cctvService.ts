// 카메라 서비스 - CCTV API 연동 및 스트림 관리

import { Pool } from 'mysql2/promise';
import { CCTVTransaction } from '../models/Camera/CameraTransactions';
import { CCTV } from '../models/Camera/CameraModel';
import { CCTVStreamResolver, cctvStreamResolver } from './cctvStreamResolver';

export class CCTVService {
  private cctvTransaction: CCTVTransaction;
  private streamResolver: CCTVStreamResolver;

  constructor(dbPool: Pool, streamResolver: CCTVStreamResolver = cctvStreamResolver) {
    this.cctvTransaction = new CCTVTransaction(dbPool);
    this.streamResolver = streamResolver;
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

  async getCCTVStream(cctvId: number): Promise<{ cctv: CCTV; streamUrl: string }> {
    try {
      const cctv = await this.cctvTransaction.getCCTVById(cctvId);
      if (!cctv) {
        throw new Error('해당 CCTV 정보를 찾을 수 없습니다.');
      }

      if (!cctv.api_endpoint) {
        throw new Error('해당 CCTV의 API 엔드포인트가 설정되어 있지 않습니다.');
      }

      const streamUrl = await this.streamResolver.resolve(cctv.api_endpoint);
      return { cctv, streamUrl };
    } catch (error) {
      throw new Error(`Failed to resolve CCTV stream: ${(error as Error).message}`);
    }
  }
}
