// Statistics 모델 - 통계 정보 타입 정의

export interface Statistics {
  statistics_id: number;
  detection_id: number;
  object_count: number;
  vehicle_total: number;
}

export interface StatisticsInput {
  detection_id: number;
  object_count: number;
  vehicle_total: number;
}

export interface VehicleStatisticsPoint {
  timestamp: string;
  vehicle_total: number;
  object_count: number;
}

// 차량 유형별 통계 (대시보드용)
export interface VehicleStatisticsByType {
  timestamp: string;
  object_text: string;
  count: number;
}

