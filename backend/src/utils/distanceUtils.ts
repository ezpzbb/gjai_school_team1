/**
 * 거리 계산 유틸리티
 * Haversine 공식을 사용하여 두 지점 간의 거리를 계산합니다.
 */

/**
 * Haversine 공식을 사용한 두 지점 간 거리 계산 (미터 단위)
 * @param lat1 첫 번째 지점의 위도
 * @param lon1 첫 번째 지점의 경도
 * @param lat2 두 번째 지점의 위도
 * @param lon2 두 번째 지점의 경도
 * @returns 거리 (미터)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // 지구 반지름 (미터)
  const R = 6371000;

  // 위도와 경도를 라디안으로 변환
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine 공식
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // 거리 계산 (미터)
  const distance = R * c;

  return Math.round(distance);
}

/**
 * 두 지점 간 거리가 지정된 거리 이내인지 확인
 * @param lat1 첫 번째 지점의 위도
 * @param lon1 첫 번째 지점의 경도
 * @param lat2 두 번째 지점의 위도
 * @param lon2 두 번째 지점의 경도
 * @param maxDistanceMeters 최대 거리 (미터)
 * @returns 거리 이내 여부
 */
export function isWithinDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  maxDistanceMeters: number
): boolean {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= maxDistanceMeters;
}

