// Frame 모델 - 프레임 정보 타입 정의

export interface Frame {
  frame_id: number;
  cctv_id: number;
  timestamp: Date;
  image_path: string;
}

export interface FrameInput {
  cctv_id: number;
  timestamp?: Date;
  image_path: string;
}

export interface AnalyzedTimeRange {
  start: string; // ISO 8601 형식
  end: string; // ISO 8601 형식
  frame_count: number;
  congestion_count: number;
  detection_count: number;
  statistics_count: number;
}

