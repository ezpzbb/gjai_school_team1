// Statistics 쿼리 - 통계 관련 데이터베이스 쿼리

export const StatisticsQueries = {
  CREATE_TABLE: `
    CREATE TABLE IF NOT EXISTS STATISTICS (
      statistics_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      detection_id INT NOT NULL,
      object_count INT NOT NULL DEFAULT 0,
      vehicle_total INT NOT NULL DEFAULT 0,
      KEY idx_detection_id (detection_id),
      KEY idx_object_count (object_count),
      KEY idx_vehicle_total (vehicle_total),
      CONSTRAINT fk_statistics_detection
        FOREIGN KEY (detection_id) REFERENCES DETECTION(detection_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `,

  CHECK_TABLE_EXISTS: `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'statistics'
  `,

  GET_BY_ID: `
    SELECT statistics_id, detection_id, object_count, vehicle_total
    FROM statistics
    WHERE statistics_id = ?
    LIMIT 1
  `,

  GET_BY_DETECTION_ID: `
    SELECT statistics_id, detection_id, object_count, vehicle_total
    FROM statistics
    WHERE detection_id = ?
    LIMIT 1
  `,

  CREATE: `
    INSERT INTO statistics (detection_id, object_count, vehicle_total)
    VALUES (?, ?, ?)
  `,

  // 대시보드용: 시간대별 차량 통계 조회
  // 주의: frame.timestamp 기준으로 집계 (프레임 촬영 시간 기준)
  // detection.detected_at은 계산 완료 시간이므로 프레임 촬영 시간과 2-3초 차이 발생
  // 완료된 데이터만 조회 (statistics가 존재하는 경우만)
  GET_VEHICLE_STATISTICS: `
    SELECT 
      DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:%i:00') as timestamp,
      COALESCE(SUM(s.vehicle_total), 0) as vehicle_total,
      COALESCE(SUM(s.object_count), 0) as object_count
    FROM frame f
    INNER JOIN detection d ON f.frame_id = d.frame_id
    INNER JOIN statistics s ON d.detection_id = s.detection_id
    WHERE f.cctv_id = ?
      AND f.timestamp >= ?
      AND f.timestamp <= ?
    GROUP BY DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:%i:00')
    ORDER BY timestamp ASC
  `,
} as const;

