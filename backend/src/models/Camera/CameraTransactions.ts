import { Pool } from 'mysql2/promise';
import { cctvQueries } from '../Camera/CameraQueries';
import { CCTV } from '../Camera/CameraModel';

export class CCTVTransaction {
  private dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
  }

  async getAllCCTVLocations(): Promise<CCTV[]> {
    try {
      console.log('CCTVTransaction: Imported cctvQueries:', cctvQueries);
      console.log('CCTVTransaction: Executing query:', cctvQueries.getAllCCTVLocations);
      const [rows] = await this.dbPool.query(cctvQueries.getAllCCTVLocations);
      console.log('CCTVTransaction: Raw query result:', rows);
      const cctvLocations = rows as CCTV[];
      console.log('CCTVTransaction: Mapped CCTV locations:', cctvLocations);
      return cctvLocations;
    } catch (error: any) {
      console.error('CCTVTransaction: DB query error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
      throw new Error(`Failed to fetch CCTV locations: ${error.message}`);
    }
  }
}