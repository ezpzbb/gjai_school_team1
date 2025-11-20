export interface VehicleDetectionItem {
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
}

export interface VehicleUpdatePayload {
  cctvId: number;
  frameId?: number; // 프레임 ID (선택사항, 프레임 캡처 방식일 때 사용)
  timestamp: number;
  detections: VehicleDetectionItem[];
  roiPolygon: [number, number][] | null;
}
