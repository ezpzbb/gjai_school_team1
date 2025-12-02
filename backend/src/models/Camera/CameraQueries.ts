// 카메라 쿼리 - 카메라 관련 데이터베이스 쿼리 함수들 (조회, 검색, 필터링)

export const cctvQueries = {
  getAllCCTVLocations: `
    SELECT cctv_id, location, latitude, longitude, api_endpoint
    FROM cctv
  `,
  getCCTVById: `
    SELECT cctv_id, location, latitude, longitude, api_endpoint
    FROM cctv
    WHERE cctv_id = ?
    LIMIT 1
  `,
  searchCCTVLocations: (keyword: string): string => `
    SELECT cctv_id, location, latitude, longitude, api_endpoint
    FROM cctv
    WHERE location LIKE ?
    ORDER BY 
      CASE 
        WHEN location LIKE ? THEN 1
        WHEN location LIKE ? THEN 2
        ELSE 3
      END,
      location ASC
    LIMIT 10
  `,
  CREATE_TABLE: `
    CREATE TABLE IF NOT EXISTS cctv (
      cctv_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      cctv_code VARCHAR(64) NOT NULL UNIQUE,
      location VARCHAR(125) NOT NULL,
      latitude FLOAT NOT NULL,
      longitude FLOAT NOT NULL,
      api_endpoint VARCHAR(512) NOT NULL,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_coords (longitude, latitude),
      KEY idx_location (location)
    ) ENGINE=InnoDB AUTO_INCREMENT=149416 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `,
  CHECK_TABLE_EXISTS: `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cctv'
  `,
  COUNT_CCTV: "SELECT COUNT(*) as count FROM cctv",
};
