import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';

// MySQL 연결 설정
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'wlqrkrhtlvek1!',
  database: 'new_schema',
};

// JSON 파일 경로
const jsonFilePath = path.join(__dirname, 'cctv.json');

// CCTV 데이터 타입 정의
interface CCTVData {
  roadsectionid: string;
  coordx: number;
  coordy: number;
  cctvresolution: string;
  filecreatetime: string;
  cctvtype: number;
  cctvformat: string;
  cctvname: string;
  cctvurl: string;
}

interface JSONResponse {
  response: {
    coordtype: number;
    data: CCTVData[];
    datacount: number;
  };
}

// CCTV 데이터 삽입 함수
async function insertCCTVData(data: CCTVData[]): Promise<void> {
  let connection: mysql.Connection | undefined;
  try {
    // 데이터베이스 연결
    connection = await mysql.createConnection(dbConfig);
    
    // 트랜잭션 시작
    await connection.beginTransaction();
    
    // 다중 INSERT 쿼리 준비
    const query = `
      INSERT INTO CCTV (location, latitude, longitude, api_endpoint)
      VALUES ?
    `;
    
    // 데이터 매핑
    const values = data.map(item => [
      item.cctvname,
      item.coordy,
      item.coordx,
      item.cctvurl,
    ]);
    
    // 다중 INSERT 실행
    const [result] = await connection.query(query, [values]);
    
    console.log(`Inserted ${data.length} rows successfully! Affected rows: ${(result as any).affectedRows}`);
    
    // 트랜잭션 커밋
    await connection.commit();
  } catch (error) {
    console.error('Error inserting data into CCTV table:', error);
    if (connection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// JSON 파일 읽기 및 데이터 삽입
async function main() {
  try {
    // JSON 파일 읽기
    const rawData = await fs.readFile(jsonFilePath, 'utf-8');
    const jsonData: JSONResponse = JSON.parse(rawData);
    
    // 데이터 검증
    if (!jsonData.response || !Array.isArray(jsonData.response.data)) {
      throw new Error('Invalid JSON structure: response.data is not an array');
    }
    
    const cctvData = jsonData.response.data;
    console.log(`Found ${cctvData.length} CCTV records in JSON file`);
    
    // 데이터 삽입
    await insertCCTVData(cctvData);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// 메인 함수 실행
main();