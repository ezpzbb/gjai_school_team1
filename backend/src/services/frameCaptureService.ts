// 프레임 캡처 서비스 - CCTV 스트림에서 실시간 프레임 캡처 및 모델 서버 전송
// HLS 스트림: FFmpeg 직접 연결 방식으로 실시간 프레임 추출
// MJPEG 스트림: 주기적 프레임 수집

import axios from 'axios';
import { Pool } from 'mysql2/promise';
import { CCTVTransaction } from '../models/Camera/CameraTransactions';
import { FrameTransaction } from '../models/Frame/FrameTransactions';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
// @ts-ignore - sharp 타입 정의가 없어도 동작함
import sharp from 'sharp';

interface CaptureTask {
  cctvId: number;
  streamUrl: string;
  intervalId?: NodeJS.Timeout; // MJPEG 스트림 방식일 때만 사용
  ffmpegProcess?: any; // HLS 직접 연결 방식일 때 사용
  reconnectTimer?: NodeJS.Timeout; // 재연결 타이머
  healthCheckInterval?: NodeJS.Timeout; // 헬스 체크 인터벌
  isDirectStream?: boolean; // HLS 직접 연결 방식 여부
  frameCount: number; // 추출된 프레임 수
  lastFrameTime: number; // 마지막 프레임 추출 시간
}

interface FrameQueueItem {
  frameId: number;
  frameBuffer: Buffer;
  timestamp: Date;
  cctvId: number;
}

interface FrameQueue {
  frames: FrameQueueItem[];
  processing: boolean;
  lastProcessedTime: number;
  totalProcessed: number;
  skippedFrames: number;
  averageProcessingTime: number;
}

export class FrameCaptureService {
  private dbPool: Pool;
  private cctvTransaction: CCTVTransaction;
  private frameTransaction: FrameTransaction;
  private activeTasks: Map<number, CaptureTask> = new Map();
  private modelServerUrl: string;
  private imageStoragePath: string; // 이미지 저장 경로

  // 프레임 큐 시스템
  private frameQueues: Map<number, FrameQueue> = new Map();
  
  // 환경변수 설정
  private readonly MAX_FRAME_QUEUE_SIZE: number;
  private readonly QUEUE_WARNING_THRESHOLD: number;
  private readonly QUEUE_STOP_THRESHOLD: number;
  private readonly MAX_IMAGE_WIDTH: number;
  private readonly MAX_IMAGE_HEIGHT: number;
  private readonly JPEG_QUALITY: number;
  private readonly USE_HLS_DIRECT_STREAM: boolean; // HLS 직접 연결 방식 사용 여부
  private readonly HLS_RECONNECT_DELAY: number; // 재연결 지연 시간 (ms)
  private readonly HLS_FRAME_RATE: number; // 초당 프레임 추출 목표 (FPS)
  private readonly HLS_TIMEOUT: number; // 스트림 타임아웃 (초)
  
  // 최적화: axios 인스턴스 재사용 (연결 풀링)
  private readonly axiosInstance: ReturnType<typeof axios.create>;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
    this.cctvTransaction = new CCTVTransaction(dbPool);
    this.frameTransaction = new FrameTransaction(dbPool);
    this.modelServerUrl = process.env.MODEL_SERVER_URL || 'http://model:8000';
    // 이미지 저장 경로 설정 (환경변수 또는 기본값)
    this.imageStoragePath = process.env.FRAME_STORAGE_PATH || path.resolve(__dirname, '../../uploads/frames');
    
    // 큐 시스템 환경변수
    this.MAX_FRAME_QUEUE_SIZE = parseInt(process.env.MAX_FRAME_QUEUE_SIZE || '5', 10);
    this.QUEUE_WARNING_THRESHOLD = parseInt(process.env.QUEUE_WARNING_THRESHOLD || '4', 10);
    this.QUEUE_STOP_THRESHOLD = parseInt(process.env.QUEUE_STOP_THRESHOLD || '5', 10);
    this.MAX_IMAGE_WIDTH = parseInt(process.env.MAX_IMAGE_WIDTH || '1280', 10);
    this.MAX_IMAGE_HEIGHT = parseInt(process.env.MAX_IMAGE_HEIGHT || '720', 10);
    this.JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || '85', 10);
    this.USE_HLS_DIRECT_STREAM = process.env.USE_HLS_DIRECT_STREAM !== 'false'; // 기본값: true
    this.HLS_RECONNECT_DELAY = parseInt(process.env.HLS_RECONNECT_DELAY || '5000', 10);
    this.HLS_FRAME_RATE = parseInt(process.env.HLS_FRAME_RATE || '1', 10); // 기본 1 FPS
    this.HLS_TIMEOUT = parseInt(process.env.HLS_TIMEOUT || '30', 10); // 기본 30초
    
    // 최적화: axios 인스턴스 생성 (연결 재사용)
    this.axiosInstance = axios.create({
      timeout: 15000,
      maxRedirects: 3,
      httpAgent: new (require('http').Agent)({ keepAlive: true, maxSockets: 10 }),
      httpsAgent: new (require('https').Agent)({ keepAlive: true, maxSockets: 10 }),
    });
    
    // 저장 디렉토리 생성
    this.ensureStorageDirectory();
    
    // 프레임 처리 워커 시작
    this.startFrameProcessingWorker();
  }

  /**
   * 이미지 저장 디렉토리 생성
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.imageStoragePath)) {
      fs.mkdirSync(this.imageStoragePath, { recursive: true });
      console.log(`[FrameCapture] 이미지 저장 디렉토리 생성: ${this.imageStoragePath}`);
    }
  }

  /**
   * 분석 시작 - HLS 직접 연결 방식으로 프레임 추출
   */
  async startCapture(cctvId: number): Promise<void> {
    // 이미 실행 중이면 무시
    if (this.activeTasks.has(cctvId)) {
      console.log(`[FrameCapture] CCTV ${cctvId}는 이미 캡처 중입니다.`);
      return;
    }

    try {
      // CCTV 정보 조회
      const cctvLocations = await this.cctvTransaction.getAllCCTVLocations();
      const cctv = cctvLocations.find((c) => c.cctv_id === cctvId);

      if (!cctv || !cctv.api_endpoint) {
        throw new Error(`CCTV ${cctvId}를 찾을 수 없거나 스트림 URL이 없습니다.`);
      }

      // 실제 스트림 URL 해석 (HLS 등 처리)
      const { cctvStreamResolver } = await import('./cctvStreamResolver');
      const actualStreamUrl = await cctvStreamResolver.resolve(cctv.api_endpoint);
      
      // 프레임 큐 초기화
      this.frameQueues.set(cctvId, {
        frames: [],
        processing: false,
        lastProcessedTime: Date.now(),
        totalProcessed: 0,
        skippedFrames: 0,
        averageProcessingTime: 0,
      });

      // HLS 스트림인 경우 직접 연결 방식 사용
      const isHLS = actualStreamUrl.toLowerCase().includes('.m3u8');
      if (isHLS && this.USE_HLS_DIRECT_STREAM) {
        console.log(`[FrameCapture] CCTV ${cctvId} HLS 직접 연결 방식 시작`);
        console.log(`[FrameCapture] 설정: FPS=${this.HLS_FRAME_RATE}, 타임아웃=${this.HLS_TIMEOUT}초, 큐=${this.MAX_FRAME_QUEUE_SIZE}개`);
        
        await this.startHLSDirectStream(cctvId, actualStreamUrl);
      } else {
        // MJPEG 스트림인 경우 직접 프레임 수집
        console.log(`[FrameCapture] CCTV ${cctvId} MJPEG 스트림 처리 시작`);
        await this.startMJPEGStream(cctvId, actualStreamUrl);
      }
    } catch (error: any) {
      console.error(`[FrameCapture] 캡처 시작 실패: CCTV ${cctvId}`, error.message);
      throw error;
    }
  }

  /**
   * 분석 중지 - 프레임 캡처 중지 및 큐 정리
   */
  stopCapture(cctvId: number): void {
    const task = this.activeTasks.get(cctvId);
    if (!task) {
      console.log(`[FrameCapture] CCTV ${cctvId}는 캡처 중이 아닙니다.`);
      return;
    }

    // FFmpeg 프로세스 종료
    if (task.ffmpegProcess) {
      try {
        task.ffmpegProcess.kill('SIGTERM');
        console.log(`[FrameCapture] CCTV ${cctvId} FFmpeg 프로세스 종료`);
      } catch (error: any) {
        console.error(`[FrameCapture] FFmpeg 프로세스 종료 실패:`, error.message);
      }
    }

    // 재연결 타이머 정리
    if (task.reconnectTimer) {
      clearTimeout(task.reconnectTimer);
    }

    // 헬스 체크 인터벌 정리
    if (task.healthCheckInterval) {
      clearInterval(task.healthCheckInterval);
    }

    this.activeTasks.delete(cctvId);

    // 프레임 큐 정리
    const queue = this.frameQueues.get(cctvId);
    if (queue) {
      console.log(`[FrameCapture] CCTV ${cctvId} 프레임 캡처 중지`);
      console.log(`[FrameCapture] 처리 통계: 총 ${queue.totalProcessed}개 처리, ${queue.skippedFrames}개 스킵`);
      this.frameQueues.delete(cctvId);
    }
  }

  /**
   * MJPEG 스트림 처리 시작
   */
  private async startMJPEGStream(cctvId: number, streamUrl: string): Promise<void> {
    const MJPEG_CAPTURE_INTERVAL = parseInt(process.env.MJPEG_CAPTURE_INTERVAL || '1000', 10); // 기본 1초
    
    // 주기적으로 프레임 수집
    const captureInterval = setInterval(async () => {
      try {
        const queue = this.frameQueues.get(cctvId);
        if (!queue) {
          clearInterval(captureInterval);
          return;
        }

        // 큐 크기 확인 및 백프레셔 처리
        if (queue.frames.length >= this.QUEUE_STOP_THRESHOLD) {
          queue.skippedFrames++;
          if (queue.skippedFrames % 10 === 0) {
            console.warn(`[FrameCapture] CCTV ${cctvId}: 큐가 가득 참 (${queue.frames.length}/${this.MAX_FRAME_QUEUE_SIZE}), ${queue.skippedFrames}개 스킵`);
          }
          return;
        }

        // MJPEG 스트림에서 프레임 가져오기
        const frameBuffer = await this.fetchFrameFromStream(streamUrl);
        if (frameBuffer && queue.frames.length < this.MAX_FRAME_QUEUE_SIZE) {
          await this.addFrameToQueue(cctvId, frameBuffer);
        } else if (frameBuffer) {
          queue.skippedFrames++;
        }
      } catch (error: any) {
        console.error(`[FrameCapture] MJPEG 프레임 수집 오류: CCTV ${cctvId}`, error.message);
      }
    }, MJPEG_CAPTURE_INTERVAL);

    // 즉시 첫 프레임 수집
    try {
      const frameBuffer = await this.fetchFrameFromStream(streamUrl);
      if (frameBuffer) {
        await this.addFrameToQueue(cctvId, frameBuffer);
      }
    } catch (error: any) {
      console.error(`[FrameCapture] 첫 MJPEG 프레임 수집 실패: CCTV ${cctvId}`, error.message);
    }

    // 작업 정보 저장 (interval 관리를 위해)
    const existingTask = this.activeTasks.get(cctvId);
    if (existingTask) {
      existingTask.intervalId = captureInterval;
    } else {
      this.activeTasks.set(cctvId, {
        cctvId,
        streamUrl: streamUrl,
        intervalId: captureInterval,
        frameCount: 0,
        lastFrameTime: Date.now(),
      });
    }
  }

  /**
   * 프레임을 큐에 추가 (FIFO)
   * 최적화: 버퍼 크기 검증 및 메모리 효율성 개선
   * 이벤트 기반 처리: 프레임 추가 시 즉시 처리 시작 (CPU 안정적 사용)
   */
  private async addFrameToQueue(cctvId: number, frameBuffer: Buffer): Promise<void> {
    const queue = this.frameQueues.get(cctvId);
    if (!queue) {
      return;
    }

    // 버퍼 크기 검증 (너무 큰 버퍼는 스킵)
    const MAX_BUFFER_SIZE = parseInt(process.env.MAX_FRAME_BUFFER_SIZE || '5242880', 10); // 기본 5MB
    if (frameBuffer.length > MAX_BUFFER_SIZE) {
      queue.skippedFrames++;
      console.warn(`[FrameCapture] CCTV ${cctvId}: 프레임 버퍼가 너무 큼 (${frameBuffer.length}bytes > ${MAX_BUFFER_SIZE}bytes), 스킵`);
      return;
    }

    // 큐가 가득 차면 가장 오래된 프레임 제거 (FIFO)
    if (queue.frames.length >= this.MAX_FRAME_QUEUE_SIZE) {
      const removed = queue.frames.shift();
      // 제거된 프레임의 버퍼 메모리 해제
      if (removed) {
        removed.frameBuffer = Buffer.alloc(0);
      }
      queue.skippedFrames++;
      // 로그 간소화
      if (queue.skippedFrames % 5 === 0) {
        console.warn(`[FrameCapture] CCTV ${cctvId}: 큐가 가득 차서 오래된 프레임 제거 (${queue.skippedFrames}개 스킵)`);
      }
    }

    const timestamp = new Date();
    const frame = await this.frameTransaction.createFrame({
      cctv_id: cctvId,
      timestamp: timestamp,
      image_path: '',
    });

    const wasEmpty = queue.frames.length === 0;
    queue.frames.push({
      frameId: frame.frame_id,
      frameBuffer: frameBuffer,
      timestamp: timestamp,
      cctvId: cctvId,
    });

    // 로그 간소화 (큐 크기가 변경될 때만 로그)
    if (queue.frames.length === 1 || queue.frames.length === this.MAX_FRAME_QUEUE_SIZE) {
      console.log(`[FrameCapture] CCTV ${cctvId}: 프레임 큐에 추가 (frame_id: ${frame.frame_id}, 큐 크기: ${queue.frames.length}/${this.MAX_FRAME_QUEUE_SIZE})`);
    }

    // 이벤트 기반 처리: 큐가 비어있었고 처리 중이 아니면 즉시 처리 시작
    // 이를 통해 CPU가 지속적으로 사용되도록 함
    if (wasEmpty && !queue.processing) {
      // 비동기로 처리하여 addFrameToQueue가 블로킹되지 않도록 함
      setImmediate(() => {
        this.processNextFrame(cctvId).catch((err) => {
          console.error(`[FrameCapture] 프레임 처리 오류: CCTV ${cctvId}`, err.message);
          const q = this.frameQueues.get(cctvId);
          if (q) {
            q.processing = false;
          }
        });
      });
    }
  }

  /**
   * MJPEG 스트림에서 프레임 가져오기
   * 최적화: 로깅 간소화 및 메모리 효율성 개선
   */
  private async fetchFrameFromStream(streamUrl: string): Promise<Buffer | null> {
    try {
      // HTTPS 인증서 설정 (UTIC 인증서 사용)
      const https = require('https');
      const fs = require('fs');
      const path = require('path');
      
      let httpsAgent: any = undefined;
      const caPath = process.env.NODE_EXTRA_CA_CERTS || process.env.UTIC_CA_PATH || './certs/utic.pem';
      try {
        const resolvedPath = path.isAbsolute(caPath) 
          ? caPath 
          : path.resolve(process.cwd(), caPath);
        if (fs.existsSync(resolvedPath)) {
          const caContent = fs.readFileSync(resolvedPath, 'utf8');
          httpsAgent = new https.Agent({ 
            ca: caContent,
            keepAlive: true,
            maxSockets: 10,
          });
        }
      } catch (certError: any) {
        // 인증서 로드 실패는 조용히 처리 (이미 로드된 경우가 많음)
      }

      // MJPEG 또는 일반 이미지 스트림 처리 (최적화: axios 인스턴스 재사용)
      const response = await this.axiosInstance.get(streamUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/jpeg, image/png, */*',
          'Connection': 'keep-alive',
        },
        httpsAgent: httpsAgent,
        maxContentLength: 10 * 1024 * 1024,
        validateStatus: (status) => status < 500,
      });

      const buffer = Buffer.from(response.data);
      
      // JPEG 시작 마커 찾기 (0xFF 0xD8)
      const jpegStart = buffer.indexOf(Buffer.from([0xff, 0xd8]));
      
      if (jpegStart === -1) {
        // 일반 JPEG 이미지인 경우
        if (response.headers['content-type']?.includes('image/jpeg') || 
            response.headers['content-type']?.includes('image/png')) {
          return buffer;
        }
        return null;
      }

      // JPEG 종료 마커 찾기 (0xFF 0xD9)
      const jpegEnd = buffer.indexOf(Buffer.from([0xff, 0xd9]), jpegStart);

      if (jpegEnd !== -1 && jpegEnd > jpegStart) {
        return buffer.slice(jpegStart, jpegEnd + 2);
      }

      // 종료 마커가 없으면 시작 마커부터 끝까지 사용
      if (jpegStart !== -1) {
        return buffer.slice(jpegStart);
      }

      // 일반 JPEG 이미지인 경우
      if (response.headers['content-type']?.includes('image/jpeg') || 
          response.headers['content-type']?.includes('image/png')) {
        return buffer;
      }

      return null;
    } catch (error: any) {
      // 에러 로그는 간소화 (너무 자주 발생할 수 있음)
      if (error.code !== 'ECONNRESET' && error.code !== 'ETIMEDOUT') {
        console.error(`[FrameCapture] 스트림 프레임 가져오기 실패:`, error.message);
      }
      return null;
    }
  }


  /**
   * 백엔드 스냅샷 엔드포인트를 통해 프레임 가져오기 (대안)
   * 참고: 현재는 구현되지 않았지만, 향후 추가 가능
   */
  private async fetchSnapshotFromBackend(cctvId: number): Promise<Buffer | null> {
    // TODO: 백엔드에 스냅샷 엔드포인트가 있다면 사용
    // 예: GET /api/cctv/:id/snapshot
    console.log(`[FrameCapture] 백엔드 스냅샷 엔드포인트는 아직 구현되지 않았습니다.`);
    return null;
  }

  /**
   * 프레임 처리 워커 시작 (큐에서 순차적으로 프레임 처리)
   * 최적화: 워커는 백업 역할만 수행 (주요 처리는 이벤트 기반 연속 처리)
   * 워커 간격을 짧게 하여 큐에 남은 프레임을 빠르게 감지
   */
  private startFrameProcessingWorker(): void {
    const WORKER_INTERVAL = parseInt(process.env.FRAME_WORKER_INTERVAL || '100', 10); // 기본 100ms로 단축
    
    setInterval(() => {
      // 워커는 백업 역할: 이벤트 기반 처리가 놓친 프레임이 있으면 처리
      // 대부분의 처리는 addFrameToQueue와 processNextFrame의 연속 처리에서 이루어짐
      for (const [cctvId, queue] of this.frameQueues.entries()) {
        // 처리 중이 아니고 큐에 프레임이 있으면 처리 시작
        if (!queue.processing && queue.frames.length > 0) {
          this.processNextFrame(cctvId).catch((err) => {
            console.error(`[FrameCapture] 워커 프레임 처리 오류: CCTV ${cctvId}`, err.message);
            const q = this.frameQueues.get(cctvId);
            if (q) {
              q.processing = false;
            }
          });
        }
      }
    }, WORKER_INTERVAL);
  }

  /**
   * 큐에서 다음 프레임 처리
   * 연속 처리: 처리 완료 후 큐에 프레임이 있으면 즉시 다음 프레임 처리 (CPU 안정적 사용)
   */
  private async processNextFrame(cctvId: number): Promise<void> {
    const queue = this.frameQueues.get(cctvId);
    if (!queue || queue.frames.length === 0 || queue.processing) {
      return;
    }

    queue.processing = true;
    const frameItem = queue.frames.shift();

    if (!frameItem) {
      queue.processing = false;
      return;
    }

    const startTime = Date.now();

    try {
      // 이미지 최적화 (리사이즈, 압축, 메타데이터 제거)
      const optimizedFrameBuffer = await sharp(frameItem.frameBuffer)
        .resize(this.MAX_IMAGE_WIDTH, this.MAX_IMAGE_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ 
          quality: this.JPEG_QUALITY, 
          mozjpeg: true,
          progressive: true, // Progressive JPEG로 로딩 성능 향상
          optimizeScans: true, // 스캔 최적화
        })
        .removeAlpha() // 알파 채널 제거 (불필요한 경우)
        .toBuffer({ resolveWithObject: false });

      // 원본 버퍼 메모리 해제 (큰 버퍼이므로 명시적으로 해제)
      frameItem.frameBuffer = Buffer.alloc(0);

      // 모델 서버에 전송
      await this.sendFrameToModel(frameItem.cctvId, frameItem.frameId, optimizedFrameBuffer);

      const processingTime = Date.now() - startTime;
      queue.totalProcessed++;
      queue.lastProcessedTime = Date.now();

      // 이동 평균 계산 (성능 최적화)
      queue.averageProcessingTime =
        (queue.averageProcessingTime * (queue.totalProcessed - 1) + processingTime) / queue.totalProcessed;

      // 로그 간소화 (처리 시간이 평균보다 크거나, 특정 간격마다만 로그)
      const shouldLog = processingTime > queue.averageProcessingTime * 1.5 || queue.totalProcessed % 10 === 0;
      if (shouldLog) {
        console.log(
          `[FrameCapture] CCTV ${cctvId}: 프레임 처리 완료 (frame_id: ${frameItem.frameId}, ` +
          `처리 시간: ${processingTime}ms, 평균: ${Math.round(queue.averageProcessingTime)}ms, ` +
          `큐 크기: ${queue.frames.length}/${this.MAX_FRAME_QUEUE_SIZE}, 총 처리: ${queue.totalProcessed})`
        );
      }

      // 연속 처리: 큐에 프레임이 있으면 즉시 다음 프레임 처리
      // 이를 통해 CPU가 지속적으로 사용되도록 함 (쉬는 텀 제거)
      const hasMoreFrames = queue.frames.length > 0;
      queue.processing = false; // 처리 완료 표시

      if (hasMoreFrames) {
        // 즉시 다음 프레임 처리 (재귀 호출)
        // setImmediate를 사용하여 스택 오버플로우 방지
        setImmediate(() => {
          this.processNextFrame(cctvId).catch((err) => {
            console.error(`[FrameCapture] 연속 프레임 처리 오류: CCTV ${cctvId}`, err.message);
            const q = this.frameQueues.get(cctvId);
            if (q) {
              q.processing = false;
            }
          });
        });
      }
    } catch (error: any) {
      console.error(`[FrameCapture] 프레임 처리 실패: CCTV ${cctvId}, Frame ${frameItem.frameId}`, error.message);
      queue.processing = false;
      
      // 에러 발생 시에도 큐에 프레임이 있으면 계속 처리 시도
      if (queue.frames.length > 0) {
        setImmediate(() => {
          this.processNextFrame(cctvId).catch((err) => {
            console.error(`[FrameCapture] 에러 후 프레임 처리 오류: CCTV ${cctvId}`, err.message);
            const q = this.frameQueues.get(cctvId);
            if (q) {
              q.processing = false;
            }
          });
        });
      }
    }
  }

  /**
   * 모델 서버에 프레임 전송 및 분석 완료 이미지 저장
   * 최적화: 연결 재사용, 타임아웃 조정, 에러 핸들링 개선
   */
  private async sendFrameToModel(cctvId: number, frameId: number, frameBuffer: Buffer): Promise<void> {
    const MAX_RETRIES = parseInt(process.env.MODEL_SERVER_MAX_RETRIES || '2', 10);
    const RETRY_DELAY = parseInt(process.env.MODEL_SERVER_RETRY_DELAY || '1000', 10);
    
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 모델 서버에 이미지 분석 요청
        const formData = new FormData();
        formData.append('image', frameBuffer, {
          filename: `cctv_${cctvId}_${frameId}.jpg`, // 타임스탬프 제거하여 파일명 간소화
          contentType: 'image/jpeg',
        });
        formData.append('cctv_id', cctvId.toString());
        formData.append('frame_id', frameId.toString());

        const response = await this.axiosInstance.post(`${this.modelServerUrl}/analyze/frame`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Connection': 'keep-alive',
          },
          timeout: parseInt(process.env.MODEL_SERVER_TIMEOUT || '10000', 10),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });

        // 로그 간소화: 전체 데이터 대신 요약 정보만 출력
        if (response.data?.ok) {
          const detectionsCount = response.data.detections_count || 0;
          const detections = response.data.detections || [];
          
          // 클래스별 개수 집계 (성능 최적화)
          const classCounts: { [key: string]: number } = {};
          if (Array.isArray(detections)) {
            detections.forEach((d: any) => {
              if (d?.cls) {
                classCounts[d.cls] = (classCounts[d.cls] || 0) + 1;
              }
            });
          }
          
          const classSummary = Object.entries(classCounts)
            .slice(0, 5) // 최대 5개만 표시
            .map(([cls, count]) => `${cls}:${count}`)
            .join(', ');
          
          // 로그 레벨 조정 (감지가 있을 때만 상세 로그)
          if (detectionsCount > 0) {
            console.log(`[FrameCapture] 모델 분석 완료: CCTV ${cctvId}, Frame ${frameId}, 감지: ${detectionsCount}개 (${classSummary})`);
          }
          
          return; // 성공 시 즉시 반환
        } else {
          lastError = new Error(response.data?.error || 'Unknown error');
        }
      } catch (error: any) {
        lastError = error;
        
        // 404 에러는 재시도하지 않음
        if (error.response?.status === 404) {
          console.warn(`[FrameCapture] 모델 서버 엔드포인트가 아직 구현되지 않았습니다: /analyze/frame`);
          return; // 재시도하지 않고 종료
        }
        
        // 마지막 시도가 아니면 재시도
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (attempt + 1))); // 지수 백오프
          continue;
        }
      }
    }
    
    // 모든 재시도 실패
    console.error(`[FrameCapture] 모델 서버 전송 실패 (${MAX_RETRIES + 1}회 시도): CCTV ${cctvId}, Frame ${frameId}`, lastError?.message || 'Unknown error');
    throw lastError || new Error('모델 서버 전송 실패');
  }

  /**
   * HLS 스트림 직접 연결 방식으로 프레임 추출 시작
   * FFmpeg를 사용하여 HLS 스트림을 직접 읽고 실시간으로 프레임 추출
   */
  private async startHLSDirectStream(cctvId: number, m3u8Url: string): Promise<void> {
    const task = this.activeTasks.get(cctvId);
    if (task && task.ffmpegProcess) {
      console.log(`[FrameCapture] CCTV ${cctvId}는 이미 HLS 직접 연결 중입니다.`);
      return;
    }

    // HTTPS 인증서 설정 (UTIC 인증서 사용)
    const https = require('https');
    const fs = require('fs');
    const path = require('path');
    
    let httpsAgent: any = undefined;
    const caPath = process.env.NODE_EXTRA_CA_CERTS || process.env.UTIC_CA_PATH || './certs/utic.pem';
    try {
      const resolvedPath = path.isAbsolute(caPath) 
        ? caPath 
        : path.resolve(process.cwd(), caPath);
      if (fs.existsSync(resolvedPath)) {
        const caContent = fs.readFileSync(resolvedPath, 'utf8');
        httpsAgent = new https.Agent({ 
          ca: caContent,
          keepAlive: true,
          maxSockets: 10,
        });
      }
    } catch (certError: any) {
      console.warn(`[FrameCapture] 인증서 로드 실패 (계속 진행):`, certError.message);
    }

    // FFmpeg 인자 설정
    // -i: 입력 스트림 URL (HLS)
    // -vf select: 프레임 샘플링 (초당 목표 FPS에 맞춤)
    // -vsync 0: 프레임 드롭 허용 (버퍼링 방지)
    // -f image2pipe: 파이프 출력 형식
    // -vcodec mjpeg: JPEG 인코딩
    // -q:v 2: JPEG 품질 (2 = 높은 품질)
    // -timeout: 네트워크 타임아웃 (마이크로초 단위)
    // -reconnect 관련: 자동 재연결 설정
    const frameInterval = Math.max(1, Math.floor(30 / this.HLS_FRAME_RATE)); // 30fps 기준 샘플링 간격
    const ffmpegArgs = [
      '-i', m3u8Url,
      '-vf', `select='not(mod(n,${frameInterval}))'`,
      '-vsync', '0',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', '2',
      '-timeout', `${this.HLS_TIMEOUT * 1000000}`, // 마이크로초 단위
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      'pipe:1'
    ];

    console.log(`[FrameCapture] CCTV ${cctvId} FFmpeg 프로세스 시작: ${m3u8Url.substring(0, 100)}...`);

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(httpsAgent ? { NODE_EXTRA_CA_CERTS: caPath } : {}),
      },
    });

    let frameBuffer = Buffer.alloc(0);
    let frameCount = 0;
    let lastFrameTime = Date.now();
    let errorCount = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    // 프레임 데이터 수신 처리
    ffmpegProcess.stdout.on('data', async (chunk: Buffer) => {
      try {
        frameBuffer = Buffer.concat([frameBuffer, chunk]);

        // JPEG 프레임 파싱 (0xFF 0xD8 시작, 0xFF 0xD9 종료)
        let startIndex = frameBuffer.indexOf(Buffer.from([0xff, 0xd8]));

        while (startIndex !== -1) {
          const endIndex = frameBuffer.indexOf(Buffer.from([0xff, 0xd9]), startIndex + 2);

          if (endIndex !== -1) {
            const jpegFrame = frameBuffer.slice(startIndex, endIndex + 2);
            
            // 큐 크기 확인
            const queue = this.frameQueues.get(cctvId);
            const task = this.activeTasks.get(cctvId);
            if (queue && queue.frames.length < this.MAX_FRAME_QUEUE_SIZE && task) {
              await this.addFrameToQueue(cctvId, jpegFrame);
              frameCount++;
              lastFrameTime = Date.now();
              task.frameCount = frameCount;
              task.lastFrameTime = lastFrameTime;
              errorCount = 0; // 성공 시 에러 카운트 리셋
            } else {
              // 큐가 가득 찬 경우 스킵
              const q = this.frameQueues.get(cctvId);
              if (q) {
                q.skippedFrames++;
              }
            }

            // 처리된 부분 제거
            frameBuffer = frameBuffer.slice(endIndex + 2);
            startIndex = frameBuffer.indexOf(Buffer.from([0xff, 0xd8]));
          } else {
            // 완전한 프레임이 아직 없음
            break;
          }
        }

        // 버퍼가 너무 커지면 경고 (메모리 누수 방지)
        if (frameBuffer.length > 10 * 1024 * 1024) { // 10MB
          console.warn(`[FrameCapture] CCTV ${cctvId}: 프레임 버퍼가 너무 큼 (${frameBuffer.length}bytes), 초기화`);
          frameBuffer = Buffer.alloc(0);
        }
      } catch (error: any) {
        errorCount++;
        console.error(`[FrameCapture] CCTV ${cctvId} 프레임 처리 오류:`, error.message);
        
        if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`[FrameCapture] CCTV ${cctvId}: 연속 에러 ${errorCount}회 발생, 재연결 시도`);
          this.scheduleHLSReconnect(cctvId, m3u8Url);
          return;
        }
      }
    });

    // FFmpeg stderr 처리 (로그 및 에러 감지)
    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      const stderrText = data.toString();
      
      // 에러 메시지 감지
      if (stderrText.toLowerCase().includes('error') || 
          stderrText.toLowerCase().includes('failed') ||
          stderrText.toLowerCase().includes('timeout')) {
        errorCount++;
        console.warn(`[FrameCapture] CCTV ${cctvId} FFmpeg 경고:`, stderrText.substring(0, 200));
        
        if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`[FrameCapture] CCTV ${cctvId}: FFmpeg 연속 에러 ${errorCount}회 발생, 재연결 시도`);
          this.scheduleHLSReconnect(cctvId, m3u8Url);
        }
      }
    });

    // 프로세스 종료 처리
    ffmpegProcess.on('close', (code, signal) => {
      const task = this.activeTasks.get(cctvId);
      if (!task || !task.isDirectStream) {
        // 이미 중지된 경우
        return;
      }

      // 헬스 체크 인터벌 정리
      if (task.healthCheckInterval) {
        clearInterval(task.healthCheckInterval);
        task.healthCheckInterval = undefined;
      }

      console.log(`[FrameCapture] CCTV ${cctvId} FFmpeg 프로세스 종료 (code: ${code}, signal: ${signal})`);
      
      // 정상 종료가 아닌 경우 재연결 시도
      if (code !== 0 && code !== null) {
        console.warn(`[FrameCapture] CCTV ${cctvId}: 비정상 종료 감지, 재연결 시도`);
        this.scheduleHLSReconnect(cctvId, m3u8Url);
      }
    });

    // 프로세스 에러 처리
    ffmpegProcess.on('error', (error) => {
      console.error(`[FrameCapture] CCTV ${cctvId} FFmpeg 프로세스 실행 실패:`, error.message);
      this.scheduleHLSReconnect(cctvId, m3u8Url);
    });

    // 타임아웃 감지: 일정 시간 동안 프레임이 없으면 재연결
    const healthCheckInterval = setInterval(() => {
      const task = this.activeTasks.get(cctvId);
      if (!task || !task.isDirectStream) {
        clearInterval(healthCheckInterval);
        return;
      }

      const timeSinceLastFrame = Date.now() - task.lastFrameTime;
      const timeoutThreshold = this.HLS_TIMEOUT * 1000 * 2; // 타임아웃의 2배

      if (timeSinceLastFrame > timeoutThreshold) {
        console.warn(`[FrameCapture] CCTV ${cctvId}: ${Math.round(timeSinceLastFrame / 1000)}초 동안 프레임 없음, 재연결 시도`);
        clearInterval(healthCheckInterval);
        task.healthCheckInterval = undefined;
        if (task.ffmpegProcess) {
          task.ffmpegProcess.kill('SIGTERM');
        }
        this.scheduleHLSReconnect(cctvId, m3u8Url);
      }
    }, 10000); // 10초마다 체크

    // 작업 정보 업데이트
    const existingTask = this.activeTasks.get(cctvId);
    if (existingTask) {
      existingTask.ffmpegProcess = ffmpegProcess;
      existingTask.isDirectStream = true;
      existingTask.frameCount = frameCount;
      existingTask.lastFrameTime = lastFrameTime;
      existingTask.healthCheckInterval = healthCheckInterval;
    } else {
      this.activeTasks.set(cctvId, {
        cctvId,
        streamUrl: m3u8Url,
        ffmpegProcess: ffmpegProcess,
        isDirectStream: true,
        frameCount: frameCount,
        lastFrameTime: lastFrameTime,
        healthCheckInterval: healthCheckInterval,
      });
    }

    console.log(`[FrameCapture] CCTV ${cctvId} HLS 직접 연결 시작 완료`);
  }

  /**
   * HLS 스트림 재연결 스케줄링
   */
  private scheduleHLSReconnect(cctvId: number, m3u8Url: string): void {
    const task = this.activeTasks.get(cctvId);
    if (!task || !task.isDirectStream) {
      return;
    }

    // 이미 재연결이 예약되어 있으면 무시
    if (task.reconnectTimer) {
      return;
    }

    console.log(`[FrameCapture] CCTV ${cctvId}: ${this.HLS_RECONNECT_DELAY / 1000}초 후 재연결 시도`);

    task.reconnectTimer = setTimeout(async () => {
      const currentTask = this.activeTasks.get(cctvId);
      if (!currentTask || !currentTask.isDirectStream) {
        return;
      }

      // 기존 프로세스 정리
      if (currentTask.ffmpegProcess) {
        try {
          currentTask.ffmpegProcess.kill('SIGTERM');
        } catch (error: any) {
          // 무시
        }
      }

      // 헬스 체크 인터벌 정리
      if (currentTask.healthCheckInterval) {
        clearInterval(currentTask.healthCheckInterval);
        currentTask.healthCheckInterval = undefined;
      }

      currentTask.reconnectTimer = undefined;
      currentTask.ffmpegProcess = undefined;

      // 재연결 시도
      try {
        await this.startHLSDirectStream(cctvId, m3u8Url);
        console.log(`[FrameCapture] CCTV ${cctvId} 재연결 성공`);
      } catch (error: any) {
        console.error(`[FrameCapture] CCTV ${cctvId} 재연결 실패:`, error.message);
        // 재연결 실패 시 다시 시도
        this.scheduleHLSReconnect(cctvId, m3u8Url);
      }
    }, this.HLS_RECONNECT_DELAY);
  }

  /**
   * 모든 캡처 작업 중지
   */
  stopAll(): void {
    for (const [cctvId, task] of this.activeTasks.entries()) {
      if (task.intervalId) {
        clearInterval(task.intervalId);
      }
      if (task.ffmpegProcess) {
        try {
          task.ffmpegProcess.kill('SIGTERM');
        } catch (error: any) {
          // 무시
        }
      }
      if (task.reconnectTimer) {
        clearTimeout(task.reconnectTimer);
      }
      if (task.healthCheckInterval) {
        clearInterval(task.healthCheckInterval);
      }
      console.log(`[FrameCapture] CCTV ${cctvId} 캡처 중지`);
    }
    this.activeTasks.clear();
  }
}

