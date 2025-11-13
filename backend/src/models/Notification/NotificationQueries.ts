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
    LEFT JOIN congestion_notifications cn 
      ON c.congestion_id = cn.congestion_id 
      AND f.user_id = cn.user_id
    WHERE c.level >= ?
      AND c.timestamp >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      AND cn.notification_id IS NULL
    ORDER BY c.timestamp DESC
  `,

  /**
   * 알림 발송 이력 저장
   */
  SAVE_NOTIFICATION_HISTORY: `
    INSERT INTO congestion_notifications 
      (congestion_id, user_id, cctv_id, status)
    VALUES (?, ?, ?, ?)
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
    LEFT JOIN congestion_notifications cn 
      ON c.congestion_id = cn.congestion_id 
      AND f.user_id = cn.user_id
    WHERE c.congestion_id = ?
      AND f.cctv_id = ?
      AND c.level >= ?
      AND cn.notification_id IS NULL
  `,
} as const;

