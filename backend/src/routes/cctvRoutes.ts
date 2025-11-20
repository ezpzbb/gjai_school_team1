import { Router, Request, Response } from "express";
import { Pool } from "mysql2/promise";
import { CCTVService } from "../services/cctvService";

const router = Router();

export const setupCCTVRoutes = (dbPool: Pool): Router => {
  const cctvService = new CCTVService(dbPool);

  router.get("/cctv/locations", async (req: Request, res: Response) => {
    try {
      console.log("CCTVRoutes: Handling /api/cctv/locations request", {
        method: req.method,
        url: req.originalUrl,
      });
      const cctvLocations = await cctvService.getCCTVLocations();
      console.log("CCTVRoutes: CCTV locations fetched:", cctvLocations);
      res.status(200).json({
        success: true,
        data: cctvLocations,
      });
    } catch (error: any) {
      console.error("CCTVRoutes: Error in /api/cctv/locations:", {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: `Failed to fetch CCTV locations: ${error.message}`,
      });
    }
  });

  router.get("/cctv/search", async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      console.log("CCTVRoutes: Handling /api/cctv/search request", {
        method: req.method,
        url: req.originalUrl,
        query: query,
      });

      if (!query || query.trim() === "") {
        return res.status(200).json({
          success: true,
          data: [],
        });
      }

      const cctvLocations = await cctvService.searchCCTVLocations(query);
      console.log("CCTVRoutes: CCTV search results:", cctvLocations);
      res.status(200).json({
        success: true,
        data: cctvLocations,
      });
    } catch (error: any) {
      console.error("CCTVRoutes: Error in /api/cctv/search:", {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: `Failed to search CCTV locations: ${error.message}`,
      });
    }
  });

  router.get("/cctv/:cctvId/stream", async (req: Request, res: Response) => {
    const cctvId = Number(req.params.cctvId);
    if (Number.isNaN(cctvId)) {
      return res.status(400).json({
        success: false,
        message: "유효한 CCTV ID를 입력해주세요.",
      });
    }

    try {
      console.log("CCTVRoutes: Handling /api/cctv/:id/stream request", {
        method: req.method,
        url: req.originalUrl,
        cctvId,
      });
      const result = await cctvService.getCCTVStream(cctvId);
      res.status(200).json({
        success: true,
        data: {
          cctv: result.cctv,
          streamUrl: result.streamUrl,
          cachedUntil: new Date(Date.now() + Number(process.env.CCTV_STREAM_CACHE_TTL || 5 * 60 * 1000)).toISOString(),
        },
      });
    } catch (error: any) {
      console.error("CCTVRoutes: Error resolving CCTV stream", {
        message: error.message,
        stack: error.stack,
      });
      res.status(502).json({
        success: false,
        message: error.message || "CCTV 스트림을 불러오지 못했습니다.",
      });
    }
  });

  return router;
};
