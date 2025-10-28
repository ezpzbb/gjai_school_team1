// src/cctv/cctvUpdater.ts
import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import pool from './config/db';
import dotenv from 'dotenv';

dotenv.config();

// API 키 검증
const API_KEY = process.env.CCTV_API_KEY;
if (!API_KEY) {
  throw new Error('CCTV_API_KEY가 .env에 설정되지 않았습니다.');
}

const BASE_URL = 'https://openapi.its.go.kr:9443/cctvInfo';

interface CctvItem {
  cctvname?: string[];
  cctvurl?: string[];
  cctvurl2?: string[];
  coordx?: string[];
  coordy?: string[];
  cctvtype?: string[];
}

export async function updateCctvData(): Promise<void> {
  console.log('\nHLS CCTV 데이터 업데이트 시작... (cctvType=1, type=ex)');

  // 요청 파라미터 (타입 명시로 TS2345 오류 방지)
  const params = new URLSearchParams({
    apiKey: API_KEY,
    type: 'ex',            // 고속도로 (HLS CCTV 다수)
    cctvType: '1',         // 1: 실시간 스트리밍 (HLS)
    minX: '126.000000',
    maxX: '129.000000',
    minY: '35.000000',
    maxY: '38.000000',
    getType: 'xml',
  } as Record<string, string>);

  const fullUrl = `${BASE_URL}?${params.toString()}`;
  console.log('요청 URL:', fullUrl);

  try {
    // 1. API 호출
    const response = await axios.get(fullUrl, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
      },
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // 개발용: 인증서 무시
      }),
    });

    console.log('HTTP 상태:', response.status);
    const xmlData: string = response.data;

    // 2. XML → JSON 파싱
    const jsonResult = await parseStringPromise(xmlData);
    const dataCount = parseInt(jsonResult?.response?.datacount?.[0] || '0', 10);
    console.log(`datacount: ${dataCount}`);

    if (dataCount === 0) {
      console.log('HLS CCTV 데이터 없음: 요청 범위에 해당 CCTV 없음');
      return;
    }

    // 3. data.item 추출
    const dataNodes = jsonResult?.response?.data;
    const items: CctvItem[] = Array.isArray(dataNodes)
      ? dataNodes
      : dataNodes
      ? [dataNodes]
      : [];

    console.log(`총 아이템: ${items.length}`);

    // 4. cctvType=1 + cctvurl 존재하는 것만 필터링
    const hlsItems = items.filter(
      (item) => item.cctvtype?.[0] === '1' && (item.cctvurl?.[0] || item.cctvurl2?.[0])
    );

    console.log(`유효한 HLS CCTV: ${hlsItems.length}개`);

    if (hlsItems.length === 0) {
      console.log('HLS URL이 있는 CCTV 없음');
      return;
    }

    // 5. DB 업데이트 (트랜잭션)
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 5-1. 기존 CCTV 데이터 전체 삭제 (CASCADE로 연관 테이블도 자동 삭제)
      console.log('기존 CCTV 데이터 삭제 중... (DELETE + CASCADE)');
      await connection.execute('DELETE FROM CCTV');

      // 5-2. AUTO_INCREMENT 리셋 (cctv_id 1부터 시작)
      await connection.execute('ALTER TABLE CCTV AUTO_INCREMENT = 1');

      // 5-3. 새로 삽입
      let inserted = 0;
      for (const item of hlsItems) {
        const location = (item.cctvname?.[0] || 'Unknown').trim();
        const hlsUrl = (item.cctvurl?.[0] || item.cctvurl2?.[0] || '').trim();
        const longitude = parseFloat(item.coordx?.[0] || '0');
        const latitude = parseFloat(item.coordy?.[0] || '0');

        if (!hlsUrl || isNaN(longitude) || isNaN(latitude)) {
          console.log(`스킵: ${location} (좌표 또는 URL 누락)`);
          continue;
        }

        // KT ICT 프록시 URL 그대로 저장 (재생 가능)
        console.log(`저장: ${location} → ${hlsUrl.substring(0, 70)}...`);

        await connection.execute(
          `INSERT INTO CCTV (location, latitude, longitude, api_endpoint)
           VALUES (?, ?, ?, ?)`,
          [location, latitude, longitude, hlsUrl]
        );

        inserted++;
      }

      await connection.commit();
      console.log(`HLS CCTV 업데이트 성공`);
      console.log(`   삭제: 기존 모든 데이터 (CASCADE)`);
      console.log(`   삽입: ${inserted}개`);
      console.log(`   총 CCTV 수: ${inserted}개`);

    } catch (err: any) {
      await connection.rollback();
      console.error('DB 트랜잭션 실패:', err.message);
      throw err;
    } finally {
      connection.release();
    }

  } catch (error: any) {
    if (error.response) {
      console.error('API 응답 오류:', error.response.status);
      console.error('응답 데이터:', error.response.data?.substring(0, 500));
    } else {
      console.error('업데이트 실패:', error.message);
    }
  }
}