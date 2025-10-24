import { Pool } from 'mysql2/promise';
import { Favorite, FavoriteData } from '../models/Favorites/FavoriteModel';
import { FavoriteTransaction } from '../models/Favorites/FavoriteTransactions';

export class FavoriteService {
    private favoriteTransaction: FavoriteTransaction;

    constructor(pool: Pool) {
        this.favoriteTransaction = new FavoriteTransaction(pool);
    }

    async addFavorite(favoriteData: FavoriteData): Promise<Favorite> {
        try {
            const favorite = Favorite.validate(favoriteData);
            return await this.favoriteTransaction.createFavorite(favorite);
        } catch (error) {
            throw new Error(`즐겨찾기 추가 실패: ${(error as Error).message}`);
        }
    }

    async getUserFavorites(user_id: number): Promise<Favorite[]> {
        try {
            return await this.favoriteTransaction.getFavoritesByUserId(user_id);
        } catch (error) {
            throw new Error(`즐겨찾기 조회 실패: ${(error as Error).message}`);
        }
    }

    async removeFavorite(user_id: number, cctv_id: number): Promise<boolean> {
        try {
            return await this.favoriteTransaction.deleteFavorite(user_id, cctv_id);
        } catch (error) {
            throw new Error(`즐겨찾기 삭제 실패: ${(error as Error).message}`);
        }
    }
}