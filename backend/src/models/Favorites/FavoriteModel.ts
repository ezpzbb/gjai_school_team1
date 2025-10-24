export interface FavoriteData {
    favorite_id?: number;
    user_id: number;
    cctv_id: number;
    added_at?: Date | string;
}

export class Favorite {
    favorite_id?: number;
    user_id: number;
    cctv_id: number;
    added_at: Date;

    constructor(favorite_id: number | undefined, user_id: number, cctv_id: number, added_at?: Date | string) {
        this.favorite_id = favorite_id;
        this.user_id = user_id;
        this.cctv_id = cctv_id;
        this.added_at = added_at ? new Date(added_at) : new Date();
    }

    static validate(favoriteData: FavoriteData): Favorite {
        if (!favoriteData.user_id || !favoriteData.cctv_id) {
            throw new Error('user_id와 cctv_id는 필수입니다.');
        }
        return new Favorite(
            favoriteData.favorite_id,
            favoriteData.user_id,
            favoriteData.cctv_id,
            favoriteData.added_at
        );
    }
}