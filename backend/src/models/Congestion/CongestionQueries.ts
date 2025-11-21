// Congestion 쿼리 - 혼잡도 관련 데이터베이스 쿼리

export const CongestionQueries = {
  CREATE_TABLE: `
    CREATE TABLE IF NOT EXISTS congestion (
      congestion_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      frame_id INT NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      level TINYINT NOT NULL CHECK (level BETWEEN 0 AND 100),
      calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_frame_id (frame_id),
      KEY idx_timestamp (timestamp),
      KEY idx_level (level),
      CONSTRAINT fk_congestion_frame
        FOREIGN KEY (frame_id) REFERENCES frame(frame_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `,

  CHECK_TABLE_EXISTS: `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'congestion'
  `,

  GET_BY_ID: `
    SELECT congestion_id, frame_id, timestamp, level, calculated_at
    FROM congestion
    WHERE congestion_id = ?
    LIMIT 1
  `,

  GET_BY_FRAME_ID: `
    SELECT congestion_id, frame_id, timestamp, level, calculated_at
    FROM congestion
    WHERE frame_id = ?
    LIMIT 1
  `,

  GET_LATEST_BY_CCTV: `
    SELECT 
      c.congestion_id,
      c.frame_id,
      c.timestamp,
      c.level,
      c.calculated_at
    FROM congestion c
    INNER JOIN frame f ON c.frame_id = f.frame_id
    WHERE f.cctv_id = ?
    ORDER BY c.timestamp DESC
    LIMIT 1
  `,

  CREATE: `
    INSERT INTO congestion (frame_id, level, timestamp, calculated_at)
    VALUES (?, ?, ?, ?)
  `,

  // 대시보드용: 시간대별 혼잡도 데이터 조회 (5분 단위 집계)
  // 주의: frame.timestamp 기준으로 조회 (프레임 촬영 시간 기준)
  // congestion.timestamp는 계산 완료 시간이므로 프레임 촬영 시간과 2-3초 차이 발생
  // 5분 단위로 그룹화하여 평균 혼잡도 계산
  GET_CONGESTION_DATA: `
    SELECT 
      DATE_FORMAT(
        DATE_ADD(
          DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00'),
          INTERVAL FLOOR(MINUTE(f.timestamp) / 5) * 5 MINUTE
        ),
        '%Y-%m-%d %H:%i:00'
      ) as timestamp,
      AVG(c.level) as level
    FROM congestion c
    INNER JOIN frame f ON c.frame_id = f.frame_id
    WHERE f.cctv_id = ?
      AND f.timestamp >= ?
      AND f.timestamp <= ?
    GROUP BY 
      DATE_FORMAT(
        DATE_ADD(
          DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00'),
          INTERVAL FLOOR(MINUTE(f.timestamp) / 5) * 5 MINUTE
        ),
        '%Y-%m-%d %H:%i:00'
      )
    ORDER BY timestamp ASC
  `,
} as const;
