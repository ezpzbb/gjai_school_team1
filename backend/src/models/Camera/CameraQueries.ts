// 카메라 쿼리 - 카메라 관련 데이터베이스 쿼리 함수들 (조회, 검색, 필터링)

export const cctvQueries = {
  getAllCCTVLocations: `
    SELECT cctv_id, location, latitude, longitude, api_endpoint
    FROM CCTV
  `,
};