// 프레임 캡처 서비스 - CCTV 스트림에서 주기적으로 프레임 캡처 및 모델 서버 전송

import axios from 'axios';
import { Pool } from 'mysql2/promise';
import { CCTVTransaction } from '../models/Camera/CameraTransactions';
import { FrameTransaction } from '../models/Frame/FrameTransactions';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
// @ts-ignore - sharp 타입 정의가 없어도 동작함
import sharp from 'sharp';

const execAsync = promisify(exec);

interface CaptureTask {
  cctvId: number;
  intervalId: NodeJS.Timeout;
  streamUrl: string;
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
  private captureInterval: number; // 초 단위
  private imageStoragePath: string; // 이미지 저장 경로
  private tempStoragePath: string; // 임시 파일 저장 경로

  // 프레임 큐 시스템
  private frameQueues: Map<number, FrameQueue> = new Map();
  
  // 환경변수 설정
  private readonly MAX_FRAME_QUEUE_SIZE: number;
  private readonly FRAMES_PER_SEGMENT: number;
  private readonly FRAME_SAMPLE_INTERVAL: number;
  private readonly QUEUE_WARNING_THRESHOLD: number;
  private readonly QUEUE_STOP_THRESHOLD: number;
  private readonly USE_FFMPEG_PIPE: boolean;
  private readonly MAX_IMAGE_WIDTH: number;
  private readonly MAX_IMAGE_HEIGHT: number;
  private readonly JPEG_QUALITY: number;
  
  // 최적화: axios 인스턴스 재사용 (연결 풀링)
  private readonly axiosInstance: ReturnType<typeof axios.create>;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
    this.cctvTransaction = new CCTVTransaction(dbPool);
    this.frameTransaction = new FrameTransaction(dbPool);
    this.modelServerUrl = process.env.MODEL_SERVER_URL || 'http://model:8000';
    // 환경변수에서 캡처 주기 읽기 (초 단위, 기본값 2초)
    this.captureInterval = parseInt(process.env.FRAME_CAPTURE_INTERVAL || '2', 10) * 1000;
    // 이미지 저장 경로 설정 (환경변수 또는 기본값)
    this.imageStoragePath = process.env.FRAME_STORAGE_PATH || path.resolve(__dirname, '../../uploads/frames');
    // 임시 파일 저장 경로 설정
    this.tempStoragePath = path.resolve(__dirname, '../../uploads/temp');
    
    // 큐 시스템 환경변수
    this.MAX_FRAME_QUEUE_SIZE = parseInt(process.env.MAX_FRAME_QUEUE_SIZE || '5', 10);
    this.FRAMES_PER_SEGMENT = parseInt(process.env.FRAMES_PER_SEGMENT || '2', 10);
    this.FRAME_SAMPLE_INTERVAL = parseInt(process.env.FRAME_SAMPLE_INTERVAL || '30', 10);
    this.QUEUE_WARNING_THRESHOLD = parseInt(process.env.QUEUE_WARNING_THRESHOLD || '4', 10);
    this.QUEUE_STOP_THRESHOLD = parseInt(process.env.QUEUE_STOP_THRESHOLD || '5', 10);
    this.USE_FFMPEG_PIPE = process.env.USE_FFMPEG_PIPE !== 'false';
    this.MAX_IMAGE_WIDTH = parseInt(process.env.MAX_IMAGE_WIDTH || '1280', 10);
    this.MAX_IMAGE_HEIGHT = parseInt(process.env.MAX_IMAGE_HEIGHT || '720', 10);
    this.JPEG_QUALITY = parseInt(process.env.JPEG_QUALITY || '85', 10);
    
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
    if (!fs.existsSync(this.tempStoragePath)) {
      fs.mkdirSync(this.tempStoragePath, { recursive: true });
      console.log(`[FrameCapture] 임시 파일 저장 디렉토리 생성: ${this.tempStoragePath}`);
    }
  }

  /**
   * 분석 시작 - 프레임을 큐에 넣어서 처리하는 방식
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
      
      console.log(`[FrameCapture] CCTV ${cctvId} 프레임 큐 처리 시작`);
      console.log(`[FrameCapture] 설정: 주기=${this.captureInterval / 1000}초, 큐=${this.MAX_FRAME_QUEUE_SIZE}개, 세그먼트당=${this.FRAMES_PER_SEGMENT}개, 이미지=${this.MAX_IMAGE_WIDTH}x${this.MAX_IMAGE_HEIGHT}, 품질=${this.JPEG_QUALITY}%`);

      // 프레임 큐 초기화
      this.frameQueues.set(cctvId, {
        frames: [],
        processing: false,
        lastProcessedTime: Date.now(),
        totalProcessed: 0,
        skippedFrames: 0,
        averageProcessingTime: 0,
      });

      // 즉시 첫 프레임 수집
      this.captureFrames(cctvId, actualStreamUrl).catch((err) => {
        console.error(`[FrameCapture] 첫 프레임 수집 실패: CCTV ${cctvId}`, err.message);
      });

      // 주기적으로 프레임 수집
      const intervalId = setInterval(() => {
        this.captureFrames(cctvId, actualStreamUrl).catch((err) => {
          console.error(`[FrameCapture] 프레임 수집 실패: CCTV ${cctvId}`, err.message);
        });
      }, this.captureInterval);

      this.activeTasks.set(cctvId, {
        cctvId,
        intervalId,
        streamUrl: actualStreamUrl,
      });
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

    clearInterval(task.intervalId);
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
   * 프레임 수집 및 큐에 추가
   * 최적화: 백프레셔 처리 및 메모리 효율성 개선
   */
  private async captureFrames(cctvId: number, streamUrl: string): Promise<void> {
    try {
      const queue = this.frameQueues.get(cctvId);
      if (!queue) {
        console.warn(`[FrameCapture] CCTV ${cctvId}의 프레임 큐가 없습니다.`);
        return;
      }

      // 큐 크기 확인 및 백프레셔 처리
      if (queue.frames.length >= this.QUEUE_STOP_THRESHOLD) {
        queue.skippedFrames++;
        // 로그를 간소화하여 성능 향상
        if (queue.skippedFrames % 10 === 0) {
          console.warn(`[FrameCapture] CCTV ${cctvId}: 큐가 가득 참 (${queue.frames.length}/${this.MAX_FRAME_QUEUE_SIZE}), ${queue.skippedFrames}개 스킵`);
        }
        return;
      }

      if (queue.frames.length >= this.QUEUE_WARNING_THRESHOLD) {
        // 경고 로그도 간소화
        if (queue.frames.length === this.QUEUE_WARNING_THRESHOLD) {
          console.warn(`[FrameCapture] CCTV ${cctvId}: 큐 크기 경고 (${queue.frames.length}/${this.MAX_FRAME_QUEUE_SIZE})`);
        }
      }

      // HLS 스트림인 경우 여러 프레임 추출
      if (streamUrl.toLowerCase().includes('.m3u8')) {
        const frames = await this.extractFramesFromHLS(cctvId, streamUrl);
        if (frames && frames.length > 0) {
          // 큐에 추가할 때도 크기 확인
          for (const frameBuffer of frames) {
            if (queue.frames.length >= this.MAX_FRAME_QUEUE_SIZE) {
              queue.skippedFrames++;
              break; // 큐가 가득 차면 중단
            }
            await this.addFrameToQueue(cctvId, frameBuffer);
          }
        }
      } else {
        // MJPEG 스트림인 경우 단일 프레임
        const frameBuffer = await this.fetchFrameFromStream(streamUrl);
        if (frameBuffer && queue.frames.length < this.MAX_FRAME_QUEUE_SIZE) {
          await this.addFrameToQueue(cctvId, frameBuffer);
        } else if (frameBuffer) {
          queue.skippedFrames++;
        }
      }
    } catch (error: any) {
      console.error(`[FrameCapture] 프레임 수집 오류: CCTV ${cctvId}`, error.message);
    }
  }

  /**
   * 프레임을 큐에 추가 (FIFO)
   * 최적화: 버퍼 크기 검증 및 메모리 효율성 개선
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
  }

  /**
   * 스트림에서 프레임 가져오기 (HLS/MJPEG 지원)
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

      // HLS 스트림 (.m3u8)인 경우 처리
      if (streamUrl.toLowerCase().includes('.m3u8')) {
        return await this.fetchFrameFromHLS(streamUrl, httpsAgent);
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
   * HLS 스트림에서 여러 프레임 추출
   */
  private async extractFramesFromHLS(cctvId: number, m3u8Url: string, httpsAgent?: any): Promise<Buffer[] | null> {
    try {
      console.log(`[FrameCapture] HLS 스트림 처리 시작: CCTV ${cctvId}, URL: ${m3u8Url.substring(0, 100)}...`);

      const playlistResponse = await this.axiosInstance.get(m3u8Url, {
        responseType: 'text',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Connection': 'keep-alive',
        },
        httpsAgent: httpsAgent,
      });

      const playlistContent = playlistResponse.data;
      console.log(`[FrameCapture] 플레이리스트 다운로드 완료: ${playlistContent.length}bytes`);

      const segmentUrls = this.parseM3U8Playlist(playlistContent, m3u8Url);

      if (segmentUrls.length === 0) {
        console.warn(`[FrameCapture] 플레이리스트에서 세그먼트를 찾을 수 없습니다.`);
        return null;
      }

      const segmentUrl = segmentUrls[0];
      console.log(`[FrameCapture] 세그먼트 다운로드 시작: ${segmentUrl.substring(0, 100)}...`);

      const segmentResponse = await this.axiosInstance.get(segmentUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Connection': 'keep-alive',
        },
        httpsAgent: httpsAgent,
        maxContentLength: 10 * 1024 * 1024,
      });

      const tsBuffer = Buffer.from(segmentResponse.data);
      console.log(`[FrameCapture] TS 세그먼트 다운로드 완료: ${tsBuffer.length}bytes`);

      if (this.USE_FFMPEG_PIPE) {
        const frames = await this.extractFramesFromTSWithFFmpegPipe(tsBuffer);
        if (frames && frames.length > 0) {
          console.log(`[FrameCapture] FFmpeg 파이프로 TS에서 ${frames.length}개 프레임 추출 성공`);
          return frames;
        }
      } else {
        const jpegFrame = await this.extractFrameFromTSWithFFmpeg(tsBuffer);
        if (jpegFrame) {
          console.log(`[FrameCapture] FFmpeg로 TS에서 프레임 추출 성공: ${jpegFrame.length}bytes`);
          return [jpegFrame];
        }
      }

      console.warn(`[FrameCapture] TS 세그먼트에서 프레임을 추출할 수 없습니다.`);
      return null;
    } catch (error: any) {
      console.error(`[FrameCapture] HLS 스트림 처리 실패:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: m3u8Url.substring(0, 100),
      });
      return null;
    }
  }

  /**
   * HLS 스트림(.m3u8)에서 단일 프레임 추출 (레거시)
   */
  private async fetchFrameFromHLS(m3u8Url: string, httpsAgent?: any): Promise<Buffer | null> {
    try {
      console.log(`[FrameCapture] HLS 스트림 처리 시작: ${m3u8Url.substring(0, 100)}...`);

      // .m3u8 플레이리스트 다운로드 (레거시)
      const playlistResponse = await this.axiosInstance.get(m3u8Url, {
        responseType: 'text',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Connection': 'keep-alive',
        },
        httpsAgent: httpsAgent,
      });

      const playlistContent = playlistResponse.data;
      console.log(`[FrameCapture] 플레이리스트 다운로드 완료: ${playlistContent.length}bytes`);

      // 플레이리스트에서 세그먼트 URL 추출
      const segmentUrls = this.parseM3U8Playlist(playlistContent, m3u8Url);
      
      if (segmentUrls.length === 0) {
        console.warn(`[FrameCapture] 플레이리스트에서 세그먼트를 찾을 수 없습니다.`);
        return null;
      }

      // 첫 번째 세그먼트 URL 사용 (최신 프레임)
      const segmentUrl = segmentUrls[0];
      console.log(`[FrameCapture] 세그먼트 다운로드 시작: ${segmentUrl.substring(0, 100)}...`);

      // TS 세그먼트 다운로드 (레거시)
      const segmentResponse = await this.axiosInstance.get(segmentUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Connection': 'keep-alive',
        },
        httpsAgent: httpsAgent,
        maxContentLength: 10 * 1024 * 1024, // 10MB 제한
      });

      const tsBuffer = Buffer.from(segmentResponse.data);
      console.log(`[FrameCapture] TS 세그먼트 다운로드 완료: ${tsBuffer.length}bytes`);

      // FFmpeg를 사용하여 TS 파일에서 비디오 프레임 추출
      const jpegFrame = await this.extractFrameFromTSWithFFmpeg(tsBuffer);
      
      if (jpegFrame) {
        console.log(`[FrameCapture] FFmpeg로 TS에서 프레임 추출 성공: ${jpegFrame.length}bytes`);
        return jpegFrame;
      }

      console.warn(`[FrameCapture] TS 세그먼트에서 프레임을 추출할 수 없습니다.`);
      return null;
    } catch (error: any) {
      console.error(`[FrameCapture] HLS 스트림 처리 실패:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: m3u8Url.substring(0, 100),
      });
      return null;
    }
  }

  /**
   * M3U8 플레이리스트 파싱하여 세그먼트 URL 추출
   */
  private parseM3U8Playlist(playlistContent: string, baseUrl: string): string[] {
    const segmentUrls: string[] = [];
    const lines = playlistContent.split('\n');
    
    // base URL 추출 (상대 경로 처리용)
    const baseUrlObj = new URL(baseUrl);
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 세그먼트 URL (.ts 파일)
      if (line && !line.startsWith('#') && (line.endsWith('.ts') || line.includes('.ts?'))) {
        let segmentUrl: string;
        
        // 절대 URL인 경우
        if (line.startsWith('http://') || line.startsWith('https://')) {
          segmentUrl = line;
        } 
        // 상대 URL인 경우
        else {
          segmentUrl = new URL(line, basePath).href;
        }
        
        segmentUrls.push(segmentUrl);
      }
    }

    console.log(`[FrameCapture] 플레이리스트에서 ${segmentUrls.length}개의 세그먼트 발견`);
    return segmentUrls;
  }

  /**
   * FFmpeg 파이프를 사용하여 TS 버퍼에서 여러 프레임 추출
   */
  private async extractFramesFromTSWithFFmpegPipe(tsBuffer: Buffer): Promise<Buffer[] | null> {
    return new Promise((resolve, reject) => {
      const frames: Buffer[] = [];
      let frameBuffer = Buffer.alloc(0);
      let frameCount = 0;
      const maxFrames = this.FRAMES_PER_SEGMENT;

      const ffmpegArgs = [
        '-i', 'pipe:0',
        '-vf', `select='not(mod(n,${this.FRAME_SAMPLE_INTERVAL}))'`,
        '-vsync', '0',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-q:v', '2',
        'pipe:1'
      ];

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      ffmpegProcess.stdin.write(tsBuffer);
      ffmpegProcess.stdin.end();

      ffmpegProcess.stdout.on('data', (chunk: Buffer) => {
        frameBuffer = Buffer.concat([frameBuffer, chunk]);

        let startIndex = frameBuffer.indexOf(Buffer.from([0xff, 0xd8]));

        while (startIndex !== -1 && frameCount < maxFrames) {
          const endIndex = frameBuffer.indexOf(Buffer.from([0xff, 0xd9]), startIndex + 2);

          if (endIndex !== -1) {
            const jpegFrame = frameBuffer.slice(startIndex, endIndex + 2);
            frames.push(jpegFrame);
            frameCount++;

            frameBuffer = frameBuffer.slice(endIndex + 2);
            startIndex = frameBuffer.indexOf(Buffer.from([0xff, 0xd8]));
          } else {
            break;
          }
        }
      });

      ffmpegProcess.stdout.on('end', () => {
        if (frames.length > 0) {
          resolve(frames);
        } else {
          resolve(null);
        }
      });

      ffmpegProcess.stderr.on('data', (data: Buffer) => {
        // FFmpeg stderr는 일반적으로 경고이므로 로그 제거 (성능 향상)
        // 실제 에러는 'close' 이벤트에서 처리
      });

      ffmpegProcess.on('error', (error) => {
        console.error(`[FrameCapture] FFmpeg 프로세스 실행 실패:`, error.message);
        reject(error);
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0 && frames.length === 0) {
          // 에러 코드는 조용히 처리 (너무 자주 발생할 수 있음)
        }
      });

      setTimeout(() => {
        if (frames.length === 0) {
          ffmpegProcess.kill();
          resolve(null);
        }
      }, 15000);
    });
  }

  /**
   * FFmpeg를 사용하여 TS 파일에서 비디오 프레임 추출
   * TS 파일은 MPEG-TS 비디오 컨테이너이므로 FFmpeg로 디코딩하여 프레임 추출
   */
  private async extractFrameFromTSWithFFmpeg(tsBuffer: Buffer): Promise<Buffer | null> {
    const tempTsPath = path.join(this.tempStoragePath, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.ts`);
    const tempJpegPath = path.join(this.tempStoragePath, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);

    try {
      // TS 파일을 임시 디렉토리에 저장
      fs.writeFileSync(tempTsPath, tsBuffer);

      // FFmpeg를 사용하여 TS 파일에서 첫 번째 프레임을 JPEG로 추출
      const ffmpegCommand = `ffmpeg -i "${tempTsPath}" -vframes 1 -f image2 -y "${tempJpegPath}" 2>&1`;
      
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      });

      // FFmpeg 에러 출력 확인 (경고는 무시)
      if (stderr && !stderr.includes('frame=') && stderr.includes('Error')) {
        return null;
      }

      // JPEG 파일이 생성되었는지 확인
      if (!fs.existsSync(tempJpegPath)) {
        return null;
      }

      // JPEG 파일 읽기
      const jpegBuffer = fs.readFileSync(tempJpegPath);

      // JPEG 유효성 검증
      if (jpegBuffer.length < 100 || jpegBuffer[0] !== 0xff || jpegBuffer[1] !== 0xd8) {
        return null;
      }

      return jpegBuffer;
    } catch (error: any) {
      // 에러 로그 간소화
      if (error.code !== 'ETIMEDOUT') {
        console.error(`[FrameCapture] FFmpeg 실행 실패:`, error.message);
      }
      return null;
    } finally {
      // 임시 파일 정리
      try {
        if (fs.existsSync(tempTsPath)) {
          fs.unlinkSync(tempTsPath);
        }
        if (fs.existsSync(tempJpegPath)) {
          fs.unlinkSync(tempJpegPath);
        }
      } catch (cleanupError: any) {
        console.warn(`[FrameCapture] 임시 파일 정리 실패:`, cleanupError.message);
      }
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
   * 최적화: 워커 간격을 동적으로 조정하여 CPU 사용률 최적화
   */
  private startFrameProcessingWorker(): void {
    const WORKER_INTERVAL = parseInt(process.env.FRAME_WORKER_INTERVAL || '200', 10); // 기본 200ms
    
    setInterval(() => {
      let processedCount = 0;
      const maxProcessPerCycle = parseInt(process.env.MAX_PROCESS_PER_CYCLE || '2', 10); // 사이클당 최대 처리 수
      
      for (const [cctvId, queue] of this.frameQueues.entries()) {
        if (processedCount >= maxProcessPerCycle) {
          break; // 한 사이클에 너무 많이 처리하지 않도록 제한
        }
        
        if (!queue.processing && queue.frames.length > 0) {
          processedCount++;
          this.processNextFrame(cctvId).catch((err) => {
            console.error(`[FrameCapture] 프레임 처리 오류: CCTV ${cctvId}`, err.message);
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
    } catch (error: any) {
      console.error(`[FrameCapture] 프레임 처리 실패: CCTV ${cctvId}, Frame ${frameItem.frameId}`, error.message);
    } finally {
      queue.processing = false;
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
   * 모든 캡처 작업 중지
   */
  stopAll(): void {
    for (const [cctvId, task] of this.activeTasks.entries()) {
      clearInterval(task.intervalId);
      console.log(`[FrameCapture] CCTV ${cctvId} 캡처 중지`);
    }
    this.activeTasks.clear();
  }
}

