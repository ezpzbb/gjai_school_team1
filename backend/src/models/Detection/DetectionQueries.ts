// Detection 쿼리 - 객체 감지 관련 데이터베이스 쿼리

export const DetectionQueries = {
  CREATE_TABLE: `
    CREATE TABLE IF NOT EXISTS detection (
      detection_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      frame_id INT NOT NULL,
      confidence FLOAT NOT NULL CHECK (confidence BETWEEN 0 AND 1),
      bounding_box VARCHAR(50) NOT NULL,
      detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      object_text VARCHAR(100) NOT NULL,
      KEY idx_frame_id (frame_id),
      KEY idx_object_text (object_text),
      KEY idx_confidence (confidence),
      KEY idx_detected_at (detected_at),
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
    INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text)
    VALUES (?, ?, ?, ?, ?)
  `,

  // 대시보드용: 객체 유형별 통계 조회
  // 최적화: 서브쿼리 대신 윈도우 함수 사용
  GET_DETECTION_STATISTICS: `
    SELECT 
      d.object_text,
      COUNT(*) as count,
      ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 
        2
      ) as percentage
    FROM detection d
    INNER JOIN frame f ON d.frame_id = f.frame_id
    WHERE f.cctv_id = ?
      AND f.timestamp >= ?
      AND f.timestamp <= ?
    GROUP BY d.object_text
    ORDER BY count DESC
  `,
} as const;
