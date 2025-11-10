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

  async getCCTVById(cctvId: number): Promise<CCTV | null> {
    try {
      const [rows] = await this.dbPool.query(cctvQueries.getCCTVById, [cctvId]);
      const record = (rows as CCTV[])[0];
      return record ?? null;
    } catch (error: any) {
      console.error('CCTVTransaction: getCCTVById error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
      throw new Error(`Failed to fetch CCTV(${cctvId}): ${error.message}`);
    }
  }

  async searchCCTVLocations(keyword: string): Promise<CCTV[]> {
    try {
      if (!keyword || keyword.trim() === '') {
        return [];
      }
      
      const searchKeyword = `%${keyword.trim()}%`;
      const startsWithKeyword = `${keyword.trim()}%`;
      const query = cctvQueries.searchCCTVLocations(keyword);
      
      console.log('CCTVTransaction: Searching CCTV with keyword:', keyword);
      console.log('CCTVTransaction: Executing search query:', query);
      
      const [rows] = await this.dbPool.query(query, [
        searchKeyword,      // LIKE '%keyword%'
        startsWithKeyword,  // ORDER BY - starts with keyword (priority 1)
        searchKeyword,      // ORDER BY - contains keyword (priority 2)
      ]);
      
      console.log('CCTVTransaction: Search result:', rows);
      const cctvLocations = rows as CCTV[];
      return cctvLocations;
    } catch (error: any) {
      console.error('CCTVTransaction: Search query error:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sql: error.sql,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
      });
      throw new Error(`Failed to search CCTV locations: ${error.message}`);
    }
  }
}