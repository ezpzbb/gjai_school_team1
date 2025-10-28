// src/cctv/cctvUpdater.ts
import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import pool from './config/db';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.CCTV_API_KEY;
if (!API_KEY) {
  throw new Error('CCTV_API_KEY가 .env에 설정되지 않았습니다.');
}

const BASE_URL = 'https://openapi.its.go.kr:9443/cctvInfo';

// API 응답 인터페이스
interface CctvItem {
  cctvname?: string[];
  cctvurl?: string[];
  cctvurl2?: string[];
  coordx?: string[];
  coordy?: string[];
  cctvtype?: string[];
}

// 고유 cctv_code 생성 (SHA256 해시)
function generateCctvCode(name: string, lon: string, lat: string): string {
  const input = `${name.trim()}|${lon.trim()}|${lat.trim()}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function updateCctvData(): Promise<void> {
  console.log('\nHLS CCTV 데이터 업데이트 시작... (cctv_code = SHA256(name|lon|lat))');

  const params = new URLSearchParams({
    apiKey: API_KEY,
    type: 'ex',
    cctvType: '1',           // 1: HLS 스트리밍
    minX: '126.000000',
    maxX: '129.000000',
    minY: '35.000000',
    maxY: '38.000000',
    getType: 'xml',
  } as Record<string, string>);

  const fullUrl = `${BASE_URL}?${params.toString()}`;
  console.log('요청 URL:', fullUrl);

  try {
    const response = await axios.get(fullUrl, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 30000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
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

    // 유효한 HLS CCTV 필터링
    const hlsItems = items.filter(
      (item) =>
        item.cctvtype?.[0] === '1' &&
        item.cctvname?.[0] &&
        item.coordx?.[0] &&
        item.coordy?.[0] &&
        (item.cctvurl?.[0] || item.cctvurl2?.[0])
    );

    console.log(`유효한 HLS CCTV: ${hlsItems.length}개`);

    if (hlsItems.length === 0) {
      console.log('유효한 데이터 없음');
      return;
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    let inserted = 0;
    let updated = 0;
    let urlChanged = 0;

    try {
      for (const item of hlsItems) {
        const location = item.cctvname![0].trim();
        const lon = item.coordx![0].trim();
        const lat = item.coordy![0].trim();
        const newUrl = (item.cctvurl?.[0] || item.cctvurl2?.[0] || '').trim();
        const longitude = parseFloat(lon);
        const latitude = parseFloat(lat);

        if (isNaN(longitude) || isNaN(latitude) || !newUrl) {
          console.log(`스킵: ${location} (좌표/URL 누락)`);
          continue;
        }

        const cctvCode = generateCctvCode(location, lon, lat);

        const [result]: any = await connection.execute(
          `INSERT INTO CCTV (cctv_code, location, latitude, longitude, api_endpoint)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             api_endpoint = VALUES(api_endpoint),
             latitude = VALUES(latitude),
             longitude = VALUES(longitude)`,
          [cctvCode, location, latitude, longitude, newUrl]
        );

        if (result.affectedRows === 1) {
          inserted++;
          console.log(`신규 삽입: ${location} (cctv_id 고정)`);
        } else if (result.affectedRows === 2) {
          updated++;
          const [old]: any = await connection.execute(
            'SELECT api_endpoint FROM CCTV WHERE cctv_code = ?',
            [cctvCode]
          );
          if (old.length > 0 && old[0].api_endpoint !== newUrl) {
            urlChanged++;
            console.log(`URL 업데이트: ${location} → ${newUrl.substring(0, 60)}...`);
          }
        }
      }

      await connection.commit();
      console.log(`HLS CCTV 업데이트 성공`);
      console.log(`   신규 삽입: ${inserted}개`);
      console.log(`   업데이트: ${updated}개`);
      console.log(`   URL 변경: ${urlChanged}개 (재생 보장)`);
      console.log(`   총 CCTV 수: ${inserted + updated}개`);
      console.log(`   cctv_id 고정: cctv_code로 식별`);
      console.log(`   프론트 영향: 없음 (cctv_id 그대로 사용)`);
      console.log(`   검색/지도 기능: 인덱스 활용`);

    } catch (err: any) {
      await connection.rollback();
      console.error('DB 트랜잭션 실패:', err.message);
      throw err;
    } finally {
      connection.release();
    }

  } catch (error: any) {
    if (error.response) {
      console.error('API 오류:', error.response.status);
      console.error('응답 미리보기:', error.response.data?.substring(0, 500));
    } else {
      console.error('업데이트 실패:', error.message);
    }
  }
}