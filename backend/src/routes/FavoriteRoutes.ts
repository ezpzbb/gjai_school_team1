import express, { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import { FavoriteService } from '../services/FavoriteService';
import { FavoriteData } from '../models/Favorites/FavoriteModel';
import { authenticateJWT } from '../middlewares/User'; // User.ts에서 가져옴

const router = express.Router();

export const favoriteRoutes = (pool: Pool) => {
  const favoriteService = new FavoriteService(pool);

  // 즐겨찾기 추가
  router.post('/', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const favoriteData: FavoriteData = { ...req.body, user_id: (req as any).user.user_id };
      const favorite = await favoriteService.addFavorite(favoriteData);
      res.status(201).json(favorite);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // 사용자별 즐겨찾기 목록 조회
  router.get('/user/me', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user_id = (req as any).user.user_id;
      const favorites = await favoriteService.getUserFavorites(user_id);
      res.status(200).json(favorites);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // 즐겨찾기 삭제
  router.delete('/me/:cctv_id', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const user_id = (req as any).user.user_id;
      const cctv_id = parseInt(req.params.cctv_id);
      if (isNaN(cctv_id)) {
        throw new Error('유효하지 않은 cctv_id입니다.');
      }
      const success = await favoriteService.removeFavorite(user_id, cctv_id);
      if (success) {
        res.status(204).send();
      } else {
        res.status(404).json({ error: '즐겨찾기를 찾을 수 없습니다.' });
      }
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  return router;
};

export default favoriteRoutes;