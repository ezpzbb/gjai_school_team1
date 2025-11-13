# 폴더 구조

- 계층별 분리 구조

## app

- 표현 계층
- HTTP 요청/응답, 라우팅, 스키마 검증. 즉, API 엔드포인트

## vision

- 모델 및 파이프라인 로직

  ### inference

  - 비즈니스 계층
  - YOLO 추론을 담당

  ### pipelines

  - 비즈니스 계층
  - 전처리, 후처리, 교통혼잡도 계산 등

## infra

- 서비스 인프라 자원

  ### adapters

  - 외부 자원 계층
  - 외부 API 혹은 CCTV API를 연결하는 계층

  ### configs

  - 시스템 계층
  - 설정, 배포, 로깅, 환경 분리

  ### models

  - 외부 자원 계층
  - 모델 파일, DB 등 I/O 담당

  ### monitoring

  - 시스템 계층
  - 로깅
