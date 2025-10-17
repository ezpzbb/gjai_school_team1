// 사용자 쿼리 - 사용자 관련 데이터베이스 쿼리 함수들 (조회, 검색, 필터링)


export const UserQueries = {
    FIND_BY_IDENTIFIER: 'SELECT * FROM User WHERE username = ? OR email = ? LIMIT 1',
    FIND_BY_USERNAME: 'SELECT * FROM User WHERE username = ? LIMIT 1',
    FIND_BY_EMAIL: 'SELECT * FROM User WHERE email = ? LIMIT 1',
    CREATE_USER: 'INSERT INTO User (username, password, email) VALUES (?, ?, ?)',
  };
