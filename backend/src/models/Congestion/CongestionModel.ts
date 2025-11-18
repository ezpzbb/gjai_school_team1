// Congestion 모델 - 혼잡도 정보 타입 정의

export interface Congestion {
  congestion_id: number;
  frame_id: number;
  timestamp: Date;
  level: number; // 0-100
  calculated_at: Date;
}

export interface CongestionInput {
  frame_id: number;
  level: number;
  timestamp?: Date;
  calculated_at?: Date;
}

export interface CongestionDataPoint {
  timestamp: string;
  level: number;
}

