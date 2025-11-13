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
  congestion_id: number;
  cctv_id: number;
  level: number;
  location: string;
  timestamp: Date;
  read: boolean;
}

