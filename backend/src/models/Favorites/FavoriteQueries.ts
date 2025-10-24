export const FavoriteQueries = {
    createFavorite: `
        INSERT INTO Favorite (user_id, cctv_id)
        VALUES (?, ?)
    `,

    getFavoritesByUserId: `
        SELECT favorite_id, user_id, cctv_id, added_at
        FROM Favorite
        WHERE user_id = ?
    `,

    getFavoriteByUserAndCctv: `
        SELECT favorite_id, user_id, cctv_id, added_at
        FROM Favorite
        WHERE user_id = ? AND cctv_id = ?
    `,

    deleteFavorite: `
        DELETE FROM Favorite
        WHERE user_id = ? AND cctv_id = ?
    `
} as const;