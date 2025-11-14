export interface NotificationTarget {
  user_id: number;
  cctv_id: number;
  congestion_id: number;
  level: number;
  location: string;
  timestamp: Date;
}

export interface NotificationHistory {
  notification_id: number;
  congestion_id: number;
  user_id: number;
  cctv_id: number;
  sent_at: Date;
  status: 'sent' | 'failed';
}

export interface NotificationHistoryInput {
  congestion_id: number;
  user_id: number;
  cctv_id: number;
  status: 'sent' | 'failed';
}

export interface AccidentNotificationTarget {
  user_id: number;
  event_id: string;
  event_type: string;
  event_detail_type: string;
  // 가장 가까운 CCTV 정보
  nearest_cctv_id: number;
  nearest_cctv_location: string;
  distance_meters: number;
  // 가장 가까운 CCTV의 최신 혼잡도
  latest_congestion_level: number | null;
  latest_congestion_timestamp: Date | null;
  timestamp: Date;
}

export interface AccidentNotificationHistoryInput {
  event_id: string;
  user_id: number;
  cctv_id: number; // 가장 가까운 CCTV ID
  distance_meters: number;
  status: 'sent' | 'failed';
}

