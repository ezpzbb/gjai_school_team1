import { Router, Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import { CCTVService } from '../services/cctvService';

const router = Router();

export const setupCCTVRoutes = (dbPool: Pool): Router => {
  const cctvService = new CCTVService(dbPool);

  router.get('/cctv/locations', async (req: Request, res: Response) => {
    try {
      console.log('CCTVRoutes: Handling /api/cctv/locations request', {
        method: req.method,
        url: req.originalUrl,
      });
      const cctvLocations = await cctvService.getCCTVLocations();
      console.log('CCTVRoutes: CCTV locations fetched:', cctvLocations);
      res.status(200).json({
        success: true,
        data: cctvLocations,
      });
    } catch (error: any) {
      console.error('CCTVRoutes: Error in /api/cctv/locations:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: `Failed to fetch CCTV locations: ${error.message}`,
      });
    }
  });

  return router;
};