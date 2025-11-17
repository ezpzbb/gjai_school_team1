// 사용자 쿼리 - 사용자 관련 데이터베이스 쿼리 함수들 (조회, 검색, 필터링)

export const UserQueries = {
    FIND_BY_IDENTIFIER: 'SELECT * FROM User WHERE username = ? OR email = ? LIMIT 1',
    FIND_BY_USERNAME: 'SELECT * FROM User WHERE username = ? LIMIT 1',
    FIND_BY_EMAIL: 'SELECT * FROM User WHERE email = ? LIMIT 1',
    CREATE_USER: 'INSERT INTO User (username, password, email) VALUES (?, ?, ?)',
    CREATE_TABLE: `
        CREATE TABLE IF NOT EXISTS User (
          user_id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    CHECK_TABLE_EXISTS: `
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'User'
    `,
    COUNT_USERS: 'SELECT COUNT(*) as count FROM User',
};
