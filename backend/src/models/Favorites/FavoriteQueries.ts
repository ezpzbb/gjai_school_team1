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
    `,

    CREATE_TABLE: `
        CREATE TABLE IF NOT EXISTS Favorite (
            favorite_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            cctv_id INT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
            FOREIGN KEY (cctv_id) REFERENCES cctv(cctv_id) ON DELETE CASCADE,
            UNIQUE KEY unique_favorite (user_id, cctv_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,

    CHECK_TABLE_EXISTS: `
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Favorite'
    `,
} as const;