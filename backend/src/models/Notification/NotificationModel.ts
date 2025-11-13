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

