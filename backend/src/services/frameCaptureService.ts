// 프레임 캡처 서비스 - CCTV 스트림에서 주기적으로 프레임 캡처 및 모델 서버 전송

import axios from 'axios';
import { Pool } from 'mysql2/promise';
import { CCTVTransaction } from '../models/Camera/CameraTransactions';
import { FrameTransaction } from '../models/Frame/FrameTransactions';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CaptureTask {
  cctvId: number;
  intervalId: NodeJS.Timeout;
  streamUrl: string;
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

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
    this.cctvTransaction = new CCTVTransaction(dbPool);
    this.frameTransaction = new FrameTransaction(dbPool);
    this.modelServerUrl = process.env.MODEL_SERVER_URL || 'http://model:8000';
    // 환경변수에서 캡처 주기 읽기 (초 단위, 기본값 5초)
    this.captureInterval = parseInt(process.env.FRAME_CAPTURE_INTERVAL || '5', 10) * 1000;
    // 이미지 저장 경로 설정 (환경변수 또는 기본값)
    this.imageStoragePath = process.env.FRAME_STORAGE_PATH || path.resolve(__dirname, '../../uploads/frames');
    // 임시 파일 저장 경로 설정
    this.tempStoragePath = path.resolve(__dirname, '../../uploads/temp');
    
    // 저장 디렉토리 생성
    this.ensureStorageDirectory();
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
   * 분석 시작 - 주기적으로 프레임 캡처 및 모델 서버 전송 시작
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
      
      console.log(`[FrameCapture] CCTV ${cctvId} 프레임 캡처 시작 (주기: ${this.captureInterval / 1000}초)`);
      console.log(`[FrameCapture] 원본 URL: ${cctv.api_endpoint.substring(0, 100)}...`);
      console.log(`[FrameCapture] 해석된 스트림 URL: ${actualStreamUrl.substring(0, 100)}...`);

      // 즉시 첫 프레임 캡처
      this.captureAndSend(cctvId, actualStreamUrl).catch((err) => {
        console.error(`[FrameCapture] 첫 프레임 캡처 실패: CCTV ${cctvId}`, err.message);
      });

      // 주기적으로 캡처
      const intervalId = setInterval(() => {
        this.captureAndSend(cctvId, actualStreamUrl).catch((err) => {
          console.error(`[FrameCapture] 프레임 캡처 실패: CCTV ${cctvId}`, err.message);
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
   * 분석 중지 - 프레임 캡처 중지
   */
  stopCapture(cctvId: number): void {
    const task = this.activeTasks.get(cctvId);
    if (!task) {
      console.log(`[FrameCapture] CCTV ${cctvId}는 캡처 중이 아닙니다.`);
      return;
    }

    clearInterval(task.intervalId);
    this.activeTasks.delete(cctvId);
    console.log(`[FrameCapture] CCTV ${cctvId} 프레임 캡처 중지`);
  }

  /**
   * 프레임 캡처 및 모델 서버 전송
   */
  private async captureAndSend(cctvId: number, streamUrl: string): Promise<void> {
    try {
      // 스트림에서 프레임 가져오기
      // MJPEG 스트림의 경우 첫 번째 프레임을 가져옴
      // HLS 스트림의 경우 TS 세그먼트에서 프레임 추출 시도
      let frameBuffer = await this.fetchFrameFromStream(streamUrl);

      // HLS 스트림에서 프레임 추출 실패 시, 백엔드 스냅샷 엔드포인트 사용 시도
      if (!frameBuffer && streamUrl.toLowerCase().includes('.m3u8')) {
        console.log(`[FrameCapture] CCTV ${cctvId}: HLS 스트림에서 프레임 추출 실패, 스냅샷 엔드포인트 시도`);
        frameBuffer = await this.fetchSnapshotFromBackend(cctvId);
      }

      if (!frameBuffer) {
        console.warn(`[FrameCapture] CCTV ${cctvId}: 프레임을 가져올 수 없습니다.`);
        return;
      }

      // 타임스탬프 생성
      const timestamp = new Date();
      
      // DB에 프레임 정보 저장 (이미지 경로는 나중에 분석 완료 후 업데이트)
      const frame = await this.frameTransaction.createFrame({
        cctv_id: cctvId,
        timestamp: timestamp,
        image_path: '', // 분석 완료 후 업데이트됨
      });

      console.log(`[FrameCapture] CCTV ${cctvId}: 프레임 정보 생성 완료 (frame_id: ${frame.frame_id})`);

      // 모델 서버에 전송 (frame_id 포함) - 분석 완료 이미지를 받아서 저장
      await this.sendFrameToModel(cctvId, frame.frame_id, frameBuffer);

      console.log(`[FrameCapture] CCTV ${cctvId}: 프레임 캡처 및 전송 완료`);
    } catch (error: any) {
      console.error(`[FrameCapture] 프레임 캡처/전송 오류: CCTV ${cctvId}`, error.message);
      throw error;
    }
  }

  /**
   * 스트림에서 프레임 가져오기 (HLS/MJPEG 지원)
   */
  private async fetchFrameFromStream(streamUrl: string): Promise<Buffer | null> {
    try {
      console.log(`[FrameCapture] 스트림 URL 접근 시도: ${streamUrl.substring(0, 100)}...`);
      
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
          httpsAgent = new https.Agent({ ca: caContent });
          console.log(`[FrameCapture] HTTPS 인증서 로드 완료: ${resolvedPath}`);
        }
      } catch (certError: any) {
        console.warn(`[FrameCapture] 인증서 로드 실패 (계속 진행):`, certError.message);
      }

      // HLS 스트림 (.m3u8)인 경우 처리
      if (streamUrl.toLowerCase().includes('.m3u8')) {
        return await this.fetchFrameFromHLS(streamUrl, httpsAgent);
      }

      // MJPEG 또는 일반 이미지 스트림 처리
      const response = await axios.get(streamUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/jpeg, image/png, */*',
        },
        httpsAgent: httpsAgent,
        maxContentLength: 10 * 1024 * 1024, // 10MB 제한
        validateStatus: (status) => status < 500,
      });

      console.log(`[FrameCapture] 스트림 응답 수신: status=${response.status}, content-type=${response.headers['content-type']}, size=${response.data.byteLength}bytes`);

      const buffer = Buffer.from(response.data);
      
      // JPEG 시작 마커 찾기 (0xFF 0xD8)
      const jpegStart = buffer.indexOf(Buffer.from([0xff, 0xd8]));
      console.log(`[FrameCapture] JPEG 시작 마커 위치: ${jpegStart}`);
      
      if (jpegStart === -1) {
        console.warn(`[FrameCapture] JPEG 시작 마커를 찾을 수 없습니다. 버퍼 시작 부분:`, buffer.slice(0, 100).toString('hex'));
        // 일반 JPEG 이미지인 경우
        if (response.headers['content-type']?.includes('image/jpeg') || 
            response.headers['content-type']?.includes('image/png')) {
          console.log(`[FrameCapture] Content-Type이 이미지이므로 전체 버퍼 반환`);
          return buffer;
        }
        return null;
      }

      // JPEG 종료 마커 찾기 (0xFF 0xD9)
      const jpegEnd = buffer.indexOf(Buffer.from([0xff, 0xd9]), jpegStart);
      console.log(`[FrameCapture] JPEG 종료 마커 위치: ${jpegEnd}`);

      if (jpegEnd !== -1 && jpegEnd > jpegStart) {
        const frameBuffer = buffer.slice(jpegStart, jpegEnd + 2);
        console.log(`[FrameCapture] 프레임 추출 성공: ${frameBuffer.length}bytes`);
        return frameBuffer;
      }

      // 종료 마커가 없으면 시작 마커부터 끝까지 사용
      if (jpegStart !== -1) {
        const frameBuffer = buffer.slice(jpegStart);
        console.log(`[FrameCapture] 종료 마커 없음, 시작 마커부터 끝까지 사용: ${frameBuffer.length}bytes`);
        return frameBuffer;
      }

      // 일반 JPEG 이미지인 경우
      if (response.headers['content-type']?.includes('image/jpeg') || 
          response.headers['content-type']?.includes('image/png')) {
        console.log(`[FrameCapture] Content-Type이 이미지이므로 전체 버퍼 반환`);
        return buffer;
      }

      console.warn(`[FrameCapture] 프레임을 추출할 수 없습니다. Content-Type: ${response.headers['content-type']}`);
      return null;
    } catch (error: any) {
      console.error(`[FrameCapture] 스트림에서 프레임 가져오기 실패:`, {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: streamUrl.substring(0, 100),
      });
      return null;
    }
  }

  /**
   * HLS 스트림(.m3u8)에서 프레임 추출
   */
  private async fetchFrameFromHLS(m3u8Url: string, httpsAgent?: any): Promise<Buffer | null> {
    try {
      console.log(`[FrameCapture] HLS 스트림 처리 시작: ${m3u8Url.substring(0, 100)}...`);

      // .m3u8 플레이리스트 다운로드
      const playlistResponse = await axios.get(m3u8Url, {
        responseType: 'text',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

      // TS 세그먼트 다운로드
      const segmentResponse = await axios.get(segmentUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
   * FFmpeg를 사용하여 TS 파일에서 비디오 프레임 추출
   * TS 파일은 MPEG-TS 비디오 컨테이너이므로 FFmpeg로 디코딩하여 프레임 추출
   */
  private async extractFrameFromTSWithFFmpeg(tsBuffer: Buffer): Promise<Buffer | null> {
    const tempTsPath = path.join(this.tempStoragePath, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.ts`);
    const tempJpegPath = path.join(this.tempStoragePath, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);

    try {
      // TS 파일을 임시 디렉토리에 저장
      fs.writeFileSync(tempTsPath, tsBuffer);
      console.log(`[FrameCapture] TS 파일 임시 저장: ${tempTsPath}`);

      // FFmpeg를 사용하여 TS 파일에서 첫 번째 프레임을 JPEG로 추출
      // -i: 입력 파일
      // -vframes 1: 첫 번째 프레임만 추출
      // -f image2: 이미지 형식으로 출력
      // -y: 출력 파일 덮어쓰기
      const ffmpegCommand = `ffmpeg -i "${tempTsPath}" -vframes 1 -f image2 -y "${tempJpegPath}" 2>&1`;
      
      console.log(`[FrameCapture] FFmpeg 실행: ${ffmpegCommand.substring(0, 100)}...`);
      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        timeout: 15000, // 15초 타임아웃
        maxBuffer: 10 * 1024 * 1024, // 10MB 버퍼
      });

      // FFmpeg 에러 출력 확인 (경고는 무시)
      if (stderr && !stderr.includes('frame=') && stderr.includes('Error')) {
        console.error(`[FrameCapture] FFmpeg 에러: ${stderr}`);
        return null;
      }

      // JPEG 파일이 생성되었는지 확인
      if (!fs.existsSync(tempJpegPath)) {
        console.warn(`[FrameCapture] FFmpeg가 JPEG 파일을 생성하지 못했습니다.`);
        return null;
      }

      // JPEG 파일 읽기
      const jpegBuffer = fs.readFileSync(tempJpegPath);
      console.log(`[FrameCapture] FFmpeg로 JPEG 추출 완료: ${jpegBuffer.length}bytes`);

      // JPEG 유효성 검증
      if (jpegBuffer.length < 100) {
        console.warn(`[FrameCapture] 추출된 JPEG가 너무 작습니다: ${jpegBuffer.length}bytes`);
        return null;
      }

      // JPEG 시작 마커 확인
      if (jpegBuffer[0] !== 0xff || jpegBuffer[1] !== 0xd8) {
        console.warn(`[FrameCapture] 추출된 파일이 유효한 JPEG가 아닙니다.`);
        return null;
      }

      return jpegBuffer;
    } catch (error: any) {
      console.error(`[FrameCapture] FFmpeg 실행 실패:`, error.message);
      if (error.stdout) console.error(`[FrameCapture] FFmpeg stdout:`, error.stdout);
      if (error.stderr) console.error(`[FrameCapture] FFmpeg stderr:`, error.stderr);
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
   * 모델 서버에 프레임 전송 및 분석 완료 이미지 저장
   */
  private async sendFrameToModel(cctvId: number, frameId: number, frameBuffer: Buffer): Promise<void> {
    try {
      // 모델 서버에 이미지 분석 요청
      const formData = new FormData();
      formData.append('image', frameBuffer, {
        filename: `cctv_${cctvId}_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      });
      formData.append('cctv_id', cctvId.toString());
      formData.append('frame_id', frameId.toString()); // frame_id 전달

      const response = await axios.post(`${this.modelServerUrl}/analyze/frame`, formData, {
        headers: formData.getHeaders(),
        timeout: 10000,
      });

      // 로그 간소화: 전체 데이터 대신 요약 정보만 출력
      if (response.data?.ok) {
        const detectionsCount = response.data.detections_count || 0;
        const detections = response.data.detections || [];
        // 클래스별 개수 집계
        const classCounts: { [key: string]: number } = {};
        detections.forEach((d: any) => {
          classCounts[d.cls] = (classCounts[d.cls] || 0) + 1;
        });
        const classSummary = Object.entries(classCounts)
          .map(([cls, count]) => `${cls}:${count}`)
          .join(', ');
        console.log(`[FrameCapture] 모델 서버 분석 완료: CCTV ${cctvId}, Frame ${frameId}, 감지 수: ${detectionsCount}개 (${classSummary})`);
      } else {
        console.error(`[FrameCapture] 모델 서버 분석 실패: CCTV ${cctvId}, Frame ${frameId}`, response.data?.error || 'Unknown error');
      }
    } catch (error: any) {
      // 모델 서버 엔드포인트가 아직 구현되지 않았을 수 있음
      if (error.response?.status === 404) {
        console.warn(`[FrameCapture] 모델 서버 엔드포인트가 아직 구현되지 않았습니다: /analyze/frame`);
      } else {
        console.error(`[FrameCapture] 모델 서버 전송 실패: CCTV ${cctvId}, Frame ${frameId}`, error.message);
      }
      throw error;
    }
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

