// Notification 쿼리 - 알림 관련 데이터베이스 쿼리 (notification 테이블만 관리)

export const NotificationQueries = {
  /**
   * 혼잡도 알림 발송 대상 조회
   * 즐겨찾기한 CCTV의 혼잡도가 임계값 이상인 경우 조회
   * 주의: congestion, frame 테이블은 각각의 모델에서 관리
   */
  GET_NOTIFICATION_TARGETS: `
    SELECT DISTINCT
      f.user_id,
      f.cctv_id,
      c.congestion_id,
      c.level,
      c.timestamp,
      cctv.location
    FROM congestion c
    INNER JOIN frame fr ON c.frame_id = fr.frame_id
    INNER JOIN Favorite f ON fr.cctv_id = f.cctv_id
    INNER JOIN cctv ON fr.cctv_id = cctv.cctv_id
    LEFT JOIN notification n 
      ON c.congestion_id = n.congestion_id 
      AND f.user_id = n.user_id
      AND n.notification_type = 'congestion'
    WHERE c.level >= ?
      AND c.timestamp >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      AND n.notification_id IS NULL
    ORDER BY c.timestamp DESC
  `,

  /**
   * 알림 발송 이력 저장 (혼잡도 알림용)
   */
  SAVE_NOTIFICATION_HISTORY: `
    INSERT INTO notification 
      (notification_type, congestion_id, user_id, cctv_id, status)
    VALUES ('congestion', ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE status = VALUES(status)
  `,

  /**
   * 특정 혼잡도 데이터에 대한 알림 발송 대상 조회 (즉시 알림용)
   */
  GET_NOTIFICATION_TARGETS_FOR_CONGESTION: `
    SELECT DISTINCT
      f.user_id,
      f.cctv_id,
      c.congestion_id,
      c.level,
      c.timestamp,
      cctv.location
    FROM congestion c
    INNER JOIN frame fr ON c.frame_id = fr.frame_id
    INNER JOIN Favorite f ON fr.cctv_id = f.cctv_id
    INNER JOIN cctv ON fr.cctv_id = cctv.cctv_id
    LEFT JOIN notification n 
      ON c.congestion_id = n.congestion_id 
      AND f.user_id = n.user_id
      AND n.notification_type = 'congestion'
    WHERE c.congestion_id = ?
      AND f.cctv_id = ?
      AND c.level >= ?
      AND n.notification_id IS NULL
  `,

  /**
   * 사용자별 즐겨찾기 CCTV 조회 (위도/경도 포함)
   */
  GET_USER_FAVORITE_CCTVS_WITH_COORDS: `
    SELECT DISTINCT
      f.user_id,
      f.cctv_id,
      cctv.location,
      cctv.latitude,
      cctv.longitude
    FROM Favorite f
    INNER JOIN cctv ON f.cctv_id = cctv.cctv_id
    WHERE f.user_id = ?
  `,

  /**
   * 사고 이벤트 알림 이력 저장
   */
  SAVE_ACCIDENT_NOTIFICATION_HISTORY: `
    INSERT INTO notification 
      (notification_type, event_id, user_id, cctv_id, distance_meters, status)
    VALUES ('accident', ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      status = VALUES(status),
      sent_at = CURRENT_TIMESTAMP
  `,

  /**
   * 사고 이벤트 알림 중복 체크 (사용자당 이벤트당 1개만)
   */
  CHECK_ACCIDENT_NOTIFICATION_EXISTS: `
    SELECT notification_id
    FROM notification
    WHERE notification_type = 'accident'
      AND event_id = ? 
      AND user_id = ?
    LIMIT 1
  `,

  CREATE_NOTIFICATION_TABLE: `
    CREATE TABLE IF NOT EXISTS notification (
      notification_id INT AUTO_INCREMENT PRIMARY KEY,
      notification_type ENUM('congestion', 'accident') NOT NULL DEFAULT 'congestion',
      congestion_id INT NULL,
      event_id VARCHAR(255) NULL,
      distance_meters INT NULL,
      user_id INT NOT NULL,
      cctv_id INT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('sent', 'failed') NOT NULL DEFAULT 'sent',
      UNIQUE KEY uniq_congestion_notification (notification_type, congestion_id, user_id, cctv_id),
      UNIQUE KEY uniq_accident_notification (notification_type, event_id, user_id, cctv_id),
      KEY idx_user (user_id),
      KEY idx_cctv (cctv_id),
      KEY idx_sent_at (sent_at),
      KEY idx_notification_type (notification_type),
      CONSTRAINT fk_notification_congestion
        FOREIGN KEY (congestion_id) REFERENCES congestion(congestion_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id) REFERENCES User(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_notification_cctv
        FOREIGN KEY (cctv_id) REFERENCES cctv(cctv_id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `,

  CHECK_NOTIFICATION_TABLE_EXISTS: `
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'notification'
  `,
} as const;

