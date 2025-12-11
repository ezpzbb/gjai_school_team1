export interface VehicleDetectionItem {
  trackId: number | null;
  cls: string;
  conf: number;
  bbox: [number, number, number, number];
  direction?: "up" | "down" | null;
  speed_kmh?: number | null;
  speedKmh?: number | null;
  dwell_seconds?: number;
  dwellSeconds?: number;
}

export interface VehicleUpdatePayload {
  cctvId: number;
  timestamp: number;
  detections: VehicleDetectionItem[];
  roiPolygon: [number, number][] | null;
}
