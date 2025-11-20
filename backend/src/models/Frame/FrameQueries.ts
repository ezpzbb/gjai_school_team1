// Frame 쿼리 - 프레임 관련 데이터베이스 쿼리

export const FrameQueries = {
  CREATE_TABLE: `
    CREATE TABLE IF NOT EXISTS frame (
      frame_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      cctv_id INT NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      image_path VARCHAR(512) NOT NULL,
      KEY idx_cctv_timestamp (cctv_id, timestamp),
      KEY idx_timestamp (timestamp),
      CONSTRAINT fk_frame_cctv
        FOREIGN KEY (cctv_id) REFERENCES cctv(cctv_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `,

  CHECK_TABLE_EXISTS: `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'frame'
  `,

  GET_BY_ID: `
    SELECT frame_id, cctv_id, timestamp, image_path
    FROM frame
    WHERE frame_id = ?
    LIMIT 1
  `,

  GET_BY_CCTV_ID: `
    SELECT frame_id, cctv_id, timestamp, image_path
    FROM frame
    WHERE cctv_id = ?
    ORDER BY timestamp DESC
  `,

  GET_BY_CCTV_AND_TIME_RANGE: `
    SELECT frame_id, cctv_id, timestamp, image_path
    FROM frame
    WHERE cctv_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
    ORDER BY timestamp ASC
  `,

  CREATE: `
    INSERT INTO frame (cctv_id, timestamp, image_path)
    VALUES (?, ?, ?)
  `,

  DELETE_BY_ID: `
    DELETE FROM frame
    WHERE frame_id = ?
  `,

  // 대시보드용: 분석 완료 시간대 조회
  // 주의: frame.timestamp 기준으로 그룹화 (프레임 촬영 시간 기준)
  // 모든 분석이 완료된 시간대만 조회 (congestion, detection, statistics 모두 존재)
  // 모델 처리 지연(2-3초)을 고려하여 완료된 데이터만 표시
  // end_time은 애플리케이션 레벨에서 계산 (start_time + 1시간)
  GET_ANALYZED_TIME_RANGES: `
    SELECT 
      DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00') as start_time,
      COUNT(DISTINCT f.frame_id) as frame_count,
      COUNT(DISTINCT c.congestion_id) as congestion_count,
      COUNT(DISTINCT d.detection_id) as detection_count,
      COUNT(DISTINCT s.statistics_id) as statistics_count
    FROM frame f
    INNER JOIN congestion c ON f.frame_id = c.frame_id
    INNER JOIN detection d ON f.frame_id = d.frame_id
    INNER JOIN statistics s ON d.detection_id = s.detection_id
    WHERE f.cctv_id = ?
    GROUP BY DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00')
    HAVING frame_count > 0 
      AND congestion_count > 0 
      AND detection_count > 0 
      AND statistics_count > 0
    ORDER BY start_time DESC
    LIMIT 100
  `,
} as const;
