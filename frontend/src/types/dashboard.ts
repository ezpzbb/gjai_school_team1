// 대시보드 관련 타입 정의

export interface AnalyzedTimeRange {
  start: string; // ISO 8601 형식
  end: string; // ISO 8601 형식
  frame_count: number;
  congestion_count: number;
  detection_count: number;
}

export interface CongestionDataPoint {
  timestamp: string;
  level: number;
}

export interface VehicleStatisticsPoint {
  timestamp: string;
  vehicle_total: number;
  object_count: number;
}

// 차량 유형별 통계 (백엔드에서 반환)
export interface VehicleStatisticsByType {
  timestamp: string;
  object_text: string;
  count: number;
}

export interface DetectionStatistics {
  object_text: string;
  count: number;
  percentage?: number;
}

