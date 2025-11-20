export interface VehicleDetectionItem {
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
}

export interface VehicleUpdatePayload {
  cctvId: number;
  timestamp: number;
  detections: VehicleDetectionItem[];
  roiPolygon: [number, number][] | null;
}
