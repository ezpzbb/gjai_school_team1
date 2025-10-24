import { Pool, PoolConnection } from 'mysql2/promise';
import { Favorite, FavoriteData } from './FavoriteModel';
import { FavoriteQueries } from './FavoriteQueries';

export class FavoriteTransaction {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    async createFavorite(favoriteData: FavoriteData): Promise<Favorite> {
        const connection: PoolConnection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(FavoriteQueries.createFavorite, [
                favoriteData.user_id,
                favoriteData.cctv_id
            ]);

            const insertId = (result as any).insertId;
            const [rows] = await connection.query(FavoriteQueries.getFavoriteByUserAndCctv, [
                favoriteData.user_id,
                favoriteData.cctv_id
            ]);

            await connection.commit();
            const row = (rows as any[])[0];
            return new Favorite(row.favorite_id, row.user_id, row.cctv_id, row.added_at);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async getFavoritesByUserId(user_id: number): Promise<Favorite[]> {
        const [rows] = await this.pool.query(FavoriteQueries.getFavoritesByUserId, [user_id]);
        return (rows as any[]).map(row => new Favorite(row.favorite_id, row.user_id, row.cctv_id, row.added_at));
    }

    async deleteFavorite(user_id: number, cctv_id: number): Promise<boolean> {
        const connection: PoolConnection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(FavoriteQueries.deleteFavorite, [user_id, cctv_id]);
            await connection.commit();

            return (result as any).affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}