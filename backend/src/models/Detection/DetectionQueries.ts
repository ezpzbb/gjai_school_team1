// Detection 쿼리 - 객체 감지 관련 데이터베이스 쿼리

export const DetectionQueries = {
  CREATE_TABLE: `
    CREATE TABLE IF NOT EXISTS detection (
    detection_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    frame_id INT NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    bounding_box VARCHAR(255) NOT NULL,
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    object_text VARCHAR(100) NOT NULL,
    track_id INT NULL,
    speed_kmh DECIMAL(10,2) NULL,
    dwell_seconds INT NOT NULL DEFAULT 0,
    KEY idx_frame_id (frame_id),
    KEY idx_object_text (object_text),
    KEY idx_detected_at (detected_at),
    KEY idx_track_id (track_id),
    CONSTRAINT fk_detection_frame
      FOREIGN KEY (frame_id) REFERENCES frame(frame_id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`,

  CHECK_TABLE_EXISTS: `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'detection'
  `,

  GET_BY_ID: `
    SELECT detection_id, frame_id, confidence, bounding_box, detected_at, object_text
    FROM detection
    WHERE detection_id = ?
    LIMIT 1
  `,

  GET_BY_FRAME_ID: `
    SELECT detection_id, frame_id, confidence, bounding_box, detected_at, object_text
    FROM detection
    WHERE frame_id = ?
    ORDER BY detected_at ASC
  `,

  CREATE: `
    INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text, track_id, speed_kmh, dwell_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,

  // 대시보드용: 객체 유형별 통계 조회
  // 최적화: 서브쿼리 대신 윈도우 함수 사용
  GET_DETECTION_STATISTICS: `
    SELECT
      d.object_text,
      AVG(COALESCE(d.speed_kmh, 0))     AS avg_speed_kmh,
      SUM(COALESCE(d.dwell_seconds, 0)) AS congestion_time_sec
    FROM detection d
    JOIN frame f ON d.frame_id = f.frame_id
    WHERE f.cctv_id = ?
      AND f.timestamp >= ?
      AND f.timestamp <= ?
    GROUP BY d.object_text
    ORDER BY congestion_time_sec DESC;
    `,
} as const;
