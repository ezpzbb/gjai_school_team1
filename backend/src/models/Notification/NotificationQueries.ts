export const NotificationQueries = {
  /**
   * 혼잡도 알림 발송 대상 조회
   * 즐겨찾기한 CCTV의 혼잡도가 임계값 이상인 경우 조회
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

  /**
   * CCTV의 최신 혼잡도 조회
   */
  GET_LATEST_CONGESTION_BY_CCTV: `
    SELECT 
      c.congestion_id,
      c.level,
      c.timestamp
    FROM congestion c
    INNER JOIN frame fr ON c.frame_id = fr.frame_id
    WHERE fr.cctv_id = ?
    ORDER BY c.timestamp DESC
    LIMIT 1
  `,
} as const;

