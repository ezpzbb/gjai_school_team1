// 카메라 모델 - CCTV 카메라 정보 데이터베이스 스키마 및 Mongoose 모델 정의

export interface CCTV {
  cctv_id: number;
  location: string;
  latitude: number;
  longitude: number;
  api_endpoint: string;
}
