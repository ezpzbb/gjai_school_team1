// 카메라 쿼리 - 카메라 관련 데이터베이스 쿼리 함수들 (조회, 검색, 필터링)

export const cctvQueries = {
  getAllCCTVLocations: `
    SELECT cctv_id, location, latitude, longitude, api_endpoint
    FROM CCTV
  `,
  searchCCTVLocations: (keyword: string): string => `
    SELECT cctv_id, location, latitude, longitude, api_endpoint
    FROM CCTV
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
};