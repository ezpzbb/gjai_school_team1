// Detection 모델 - 객체 감지 정보 타입 정의

export interface Detection {
  detection_id: number;
  frame_id: number;
  confidence: number; // 0-1
  bounding_box: string; // "x,y,w,h" 또는 JSON
  detected_at: Date;
  object_text: string; // "person", "car", "bicycle"
  track_id?: number | null;
  speed_kmh?: number | null;
  dwell_seconds?: number;
}

export interface DetectionInput {
  frame_id: number;
  confidence: number;
  bounding_box: string;
  detected_at?: Date;
  object_text: string;
  track_id?: number | null;
  speed_kmh?: number | null;
  dwell_seconds?: number;
}

export interface DetectionStatistics {
  object_text: string;
  avg_speed_kmh: number;
  congestion_time_sec: number;
}
