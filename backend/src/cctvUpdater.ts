// src/cctv/cctvUpdater.ts
import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import pool from './config/db';
import dotenv from 'dotenv';

dotenv.config();

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
  console.log('\nHLS CCTV 데이터 업데이트 시작... (cctvType=1)');

  // URLSearchParams에 명시적 타입 + apiKey 보장
  const params = new URLSearchParams({
    apiKey: API_KEY,           // string 보장
    type: 'its',
    cctvType: '1',
    minX: '126',
    maxX: '129',
    minY: '35',
    maxY: '38',
    getType: 'xml',
  } as Record<string, string>); // 타입 명시

  const fullUrl = `${BASE_URL}?${params.toString()}`;
  console.log('요청 URL:', fullUrl);

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
      },
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    console.log('HTTP 상태:', response.status);
    const xmlData: string = response.data;

    const jsonResult = await parseStringPromise(xmlData);
    const dataCount = parseInt(jsonResult?.response?.datacount?.[0] || '0', 10);
    console.log(`datacount: ${dataCount}`);

    if (dataCount === 0) {
      console.log('HLS CCTV 데이터 없음');
      return;
    }

    const dataNodes = jsonResult?.response?.data;
    const items: CctvItem[] = Array.isArray(dataNodes)
      ? dataNodes
      : dataNodes
      ? [dataNodes]
      : [];

    console.log(`총 아이템: ${items.length}`);

    // cctvType=1 + cctvurl 존재하는 것만 필터
    const hlsItems = items.filter(
      (item) => item.cctvtype?.[0] === '1' && (item.cctvurl?.[0] || item.cctvurl2?.[0])
    );

    console.log(`유효한 HLS CCTV: ${hlsItems.length}개`);

    if (hlsItems.length === 0) {
      console.log('HLS URL 없음');
      return;
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    let inserted = 0;
    let updated = 0;

    try {
      for (const item of hlsItems) {
        const location = (item.cctvname?.[0] || 'Unknown').trim();
        const hlsUrl = (item.cctvurl?.[0] || item.cctvurl2?.[0] || '').trim();
        const longitude = parseFloat(item.coordx?.[0] || '0');
        const latitude = parseFloat(item.coordy?.[0] || '0');

        if (!hlsUrl || isNaN(longitude) || isNaN(latitude)) {
          console.log(`스킵: ${location} (좌표 또는 URL 누락)`);
          continue;
        }

        // .m3u8 체크 제거 → KT ICT 프록시 URL 그대로 사용
        console.log(`저장: ${location} → ${hlsUrl.substring(0, 70)}...`);

        const [result]: any = await connection.execute(
          `INSERT INTO CCTV (location, latitude, longitude, api_endpoint)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             location = VALUES(location),
             latitude = VALUES(latitude),
             longitude = VALUES(longitude),
             api_endpoint = VALUES(api_endpoint)`,
          [location, latitude, longitude, hlsUrl]
        );

        if (result.affectedRows === 1) inserted++;
        if (result.affectedRows === 2) updated++;
      }

      await connection.commit();
      console.log(`HLS CCTV 업데이트 성공`);
      console.log(`   삽입: ${inserted}개`);
      console.log(`   수정: ${updated}개`);
      console.log(`   총 처리: ${hlsItems.length}건`);
    } catch (err: any) {
      await connection.rollback();
      console.error('DB 오류:', err.message);
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('업데이트 실패:', error.message);
  }
}