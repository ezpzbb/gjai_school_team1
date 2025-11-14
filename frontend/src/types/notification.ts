export interface CongestionNotification {
  congestion_id: number;
  cctv_id: number;
  level: number;
  location: string;
  timestamp: string | Date;
}

export interface NotificationData {
  notifications: CongestionNotification[];
  threshold: number;
}

export interface NotificationState {
  id: string;
  congestion_id?: number;
  cctv_id: number; // 혼잡도 알림용 또는 사고 알림의 nearest_cctv_id
  level?: number;
  location: string;
  timestamp: Date;
  read: boolean;
  // 사고 알림 관련 필드
  event_id?: string;
  event_type?: string;
  event_detail_type?: string;
  nearest_cctv_id?: number;
  nearest_cctv_location?: string;
  distance_meters?: number;
  latest_congestion_level?: number | null;
  latest_congestion_timestamp?: Date | null;
  notification_type?: 'congestion' | 'accident';
}

export interface AccidentNotification {
  event_id: string;
  event_type: string;
  event_detail_type: string;
  nearest_cctv_id: number;
  nearest_cctv_location: string;
  distance_meters: number;
  latest_congestion_level: number | null;
  latest_congestion_timestamp: string | Date | null;
  timestamp: string | Date;
}

export interface AccidentNotificationData {
  notifications: AccidentNotification[];
  maxDistanceMeters: number;
}

