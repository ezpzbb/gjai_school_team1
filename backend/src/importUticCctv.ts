// UTIC CCTV XLSX 파일 임포트 스크립트
// XLSX 파일을 읽어서 CCTV 테이블에 URL을 저장하는 독립 실행 스크립트

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import pool from './config/db';
import dotenv from 'dotenv';

dotenv.config();

// XLSX 파일의 컬럼 타입 정의
interface XlsxRow {
  XCOORD?: number | string;
  YCOORD?: number | string;
  CCTVID?: string;
  CCTVNAME?: string;
  CENTERNAME?: string;
  RN?: number | string;
  STREAM_URL?: string;  // 실제 스트림 URL (선택사항 - 있으면 이걸 우선 사용)
  KIND?: string;      // URL의 kind 파라미터 (STREAM_URL이 없을 때 사용)
  CCTVCH?: number | string;  // URL의 cctvch 파라미터
  ID?: number | string;      // URL의 id 파라미터
  CCTVIP?: number | string;  // URL의 cctvip 파라미터
  [key: string]: any;
}

// 광주 지역 CCTV의 cctvch와 id 매핑 (CCTVID 기반)
// 실제 URL에서 추출한 값들
// 
// 패턴 분석 결과:
// - kind는 항상 'v' (광주 지역)
// - cctvch는 주로 5, 6 사용 (4도 있음)
// - id는 1000대(1034~1072)와 2000대(2024~2124) 사용
// - CCTVID 숫자와 id 사이에 명확한 수학적 패턴은 발견되지 않음
//   예: L310002→1039, L310003→1034, L310032→2124, L310037→1072
//   (순차적이지 않고, 일정한 공식도 없음)
// - 각 CCTV마다 고유한 값이 필요하므로 매핑 테이블 사용
const gwangjuCctvMapping: Record<string, { cctvch: number; id: number }> = {
  'L310001': { cctvch: 5, id: 1047 },
  'L310002': { cctvch: 5, id: 1039 },  // 각화사거리
  'L310003': { cctvch: 5, id: 1034 },  // 광주역
  'L310004': { cctvch: 4, id: 1112 },
  'L310005': { cctvch: 5, id: 1037 },
  'L310006': { cctvch: 6, id: 2012 },
  'L310007': { cctvch: 5, id: 1054 },
  'L310008': { cctvch: 4, id: 1113 },
  'L310009': { cctvch: 5, id: 1038 },  // 금남로4가역
  'L310010': { cctvch: 6, id: 2013 },  // 금남로5가역
  'L310011': { cctvch: 4, id: 1102 },
  'L310012': { cctvch: 5, id: 1063 },
  'L310013': { cctvch: 5, id: 1059 },  // 염주체육관사거리
  'L310014': { cctvch: 5, id: 1064 },
  'L310015': { cctvch: 5, id: 1056 },
  'L310016': { cctvch: 4, id: 2114 },
  'L310017': { cctvch: 6, id: 2066 },
  'L310018': { cctvch: 4, id: 1003 },
  'L310019': { cctvch: 4, id: 2109 },  // 신우아파트사거리
  'L310020': { cctvch: 5, id: 1052 },
  'L310021': { cctvch: 5, id: 1051 },
  'L310022': { cctvch: 5, id: 1030 },  // 남광주사거리
  'L310023': { cctvch: 5, id: 1057 },
  'L310024': { cctvch: 5, id: 1043 },
  'L310025': { cctvch: 5, id: 1078 },
  'L310026': { cctvch: 4, id: 1004 },
  'L310027': { cctvch: 4, id: 1005 },
  'L310028': { cctvch: 4, id: 2108 },
  'L310029': { cctvch: 4, id: 2111 },
  'L310030': { cctvch: 5, id: 1066 },
  'L310031': { cctvch: 6, id: 2037 },
  'L310032': { cctvch: 6, id: 2124 },  // 각화문흥지구입구
  'L310033': { cctvch: 4, id: 1020 },
  'L310034': { cctvch: 4, id: 2110 },
  'L310035': { cctvch: 4, id: 1022 },  // 광주오거리
  'L310036': { cctvch: 4, id: 1108 },
  'L310037': { cctvch: 5, id: 1072 },  // 광주청입구
  'L310038': { cctvch: 5, id: 1077 },
  'L310039': { cctvch: 4, id: 2119 },
  'L310040': { cctvch: 5, id: 1067 },  // 계수사거리
  'L310041': { cctvch: 6, id: 2065 },
  'L310042': { cctvch: 5, id: 1075 },
  'L310043': { cctvch: 5, id: 1065 },
  'L310044': { cctvch: 5, id: 1041 },
  'L310045': { cctvch: 5, id: 1076 },
  'L310046': { cctvch: 4, id: 2122 },
  'L310047': { cctvch: 4, id: 1013 },
  'L310048': { cctvch: 5, id: 1053 },
  'L310049': { cctvch: 5, id: 1061 },
  'L310050': { cctvch: 5, id: 1040 },  // 광산IC사거리
  'L310051': { cctvch: 4, id: 1018 },
  'L310052': { cctvch: 4, id: 1028 },
  'L310053': { cctvch: 4, id: 1105 },
  'L310054': { cctvch: 5, id: 1036 },
  'L310055': { cctvch: 5, id: 1071 },
  'L310056': { cctvch: 4, id: 1027 },
  'L310057': { cctvch: 4, id: 1023 },
  'L310058': { cctvch: 6, id: 2055 },
  'L310059': { cctvch: 5, id: 1045 },  // 광주공항사거리
  'L310060': { cctvch: 5, id: 1055 },
  'L310061': { cctvch: 5, id: 1060 },
  'L310062': { cctvch: 4, id: 1110 },
  'L310063': { cctvch: 5, id: 1074 },
  'L310064': { cctvch: 4, id: 1101 },  // 금호삼거리
  'L310065': { cctvch: 5, id: 1029 },
  'L310066': { cctvch: 5, id: 1046 },
  'L310067': { cctvch: 5, id: 1050 },
  'L310068': { cctvch: 5, id: 1070 },
  'L310069': { cctvch: 4, id: 2115 },
  'L310070': { cctvch: 5, id: 1033 },
  'L310071': { cctvch: 5, id: 1032 },
  'L310072': { cctvch: 4, id: 1019 },
  'L310073': { cctvch: 4, id: 2116 },
  'L310074': { cctvch: 5, id: 1062 },
  'L310075': { cctvch: 4, id: 1006 },
  'L310076': { cctvch: 6, id: 2069 },
  'L310077': { cctvch: 4, id: 1002 },
  'L310078': { cctvch: 4, id: 1001 },
  'L310079': { cctvch: 4, id: 1010 },
  'L310080': { cctvch: 4, id: 1026 },
  'L310081': { cctvch: 4, id: 1104 },
  'L310082': { cctvch: 5, id: 1048 },
  'L310083': { cctvch: 4, id: 1015 },
  'L310084': { cctvch: 4, id: 1016 },
  'L310085': { cctvch: 4, id: 2121 },  // 금호동CBS사거리
  'L310086': { cctvch: 4, id: 2118 },
  'L310087': { cctvch: 6, id: 2067 },  // 양산사거리
  'L310088': { cctvch: 4, id: 1111 },
  'L310089': { cctvch: 6, id: 2072 },
  'L310090': { cctvch: 4, id: 1012 },
  'L310091': { cctvch: 4, id: 1011 },
  'L310092': { cctvch: 4, id: 1009 },
  'L310093': { cctvch: 4, id: 1008 },
  'L310094': { cctvch: 4, id: 2123 },
  'L310095': { cctvch: 4, id: 2117 },
  'L310096': { cctvch: 4, id: 1021 },
  'L310097': { cctvch: 4, id: 1024 },
  'L310098': { cctvch: 4, id: 2120 },
  'L310099': { cctvch: 4, id: 2113 },
  'L310100': { cctvch: 6, id: 2016 },
  'L310101': { cctvch: 5, id: 1049 },
  'L310102': { cctvch: 5, id: 1042 },  // 광천사거리
  'L310103': { cctvch: 5, id: 1035 },
  'L310104': { cctvch: 6, id: 2023 },
  'L310105': { cctvch: 5, id: 1044 },
  'L310106': { cctvch: 6, id: 2024 },  // 계룡오거리
  'L310107': { cctvch: 6, id: 2025 },
  'L310108': { cctvch: 6, id: 2068 },
  'L310109': { cctvch: 6, id: 2003 },
  'L310110': { cctvch: 5, id: 1031 },
  'L310111': { cctvch: 5, id: 1073 },
  'L310112': { cctvch: 4, id: 1007 },
  'L310113': { cctvch: 5, id: 1058 },
  'L310114': { cctvch: 4, id: 2112 },
  'L310115': { cctvch: 4, id: 1107 },
  'L310116': { cctvch: 4, id: 1106 },
  'L310117': { cctvch: 4, id: 1014 },
  'L310118': { cctvch: 4, id: 1103 },
  'L310119': { cctvch: 4, id: 1017 },
  'L310120': { cctvch: 5, id: 1068 },
  'L310121': { cctvch: 5, id: 1069 },
  'L310122': { cctvch: 4, id: 1025 },
  'L310123': { cctvch: 4, id: 1109 },
  'L310124': { cctvch: 6, id: 2039 },
};

// UTIC 스트림 URL 생성 함수
function generateUticStreamUrl(
  cctvId: string, 
  cctvName: string, 
  kind?: string, 
  cctvIp?: string | number,
  cctvch?: string | number,
  id?: string | number,
  centerName?: string
): string {
  // .env에서 CCTV_KEY 가져오기
  const cctvKey = process.env.CCTV_KEY;
  
  if (!cctvKey) {
    throw new Error('CCTV_KEY가 .env 파일에 설정되지 않았습니다.');
  }

  const baseUrl = 'https://www.utic.go.kr/jsp/map/openDataCctvStream.jsp';
  
  // 광주 지역인 경우 kind='v'로 고정
  let kindValue = kind && kind !== 'undefined' ? kind : 'KB';
  if (centerName === '광주광역시') {
    kindValue = 'v';
  }
  
  // 광주 지역이고 cctvch/id가 없으면 매핑 테이블에서 찾기
  let cctvchValue: string;
  let idValue: string;
  
  if (centerName === '광주광역시') {
    if (cctvch !== undefined && cctvch !== null && cctvch !== 'undefined') {
      cctvchValue = String(cctvch);
    } else if (gwangjuCctvMapping[cctvId]) {
      cctvchValue = String(gwangjuCctvMapping[cctvId].cctvch);
    } else {
      // 매핑이 없으면 기본값 사용 (재생 안될 수 있음)
      cctvchValue = 'undefined';
      console.warn(`⚠️  광주 CCTV ${cctvId}의 cctvch 매핑이 없습니다. 기본값 사용.`);
    }
    
    if (id !== undefined && id !== null && id !== 'undefined') {
      idValue = String(id);
    } else if (gwangjuCctvMapping[cctvId]) {
      idValue = String(gwangjuCctvMapping[cctvId].id);
    } else {
      // 매핑이 없으면 기본값 사용 (재생 안될 수 있음)
      idValue = 'undefined';
      console.warn(`⚠️  광주 CCTV ${cctvId}의 id 매핑이 없습니다. 기본값 사용.`);
    }
  } else {
    // 광주가 아닌 경우
    cctvchValue = cctvch !== undefined && cctvch !== null && cctvch !== 'undefined' ? String(cctvch) : 'undefined';
    idValue = id !== undefined && id !== null && id !== 'undefined' ? String(id) : 'undefined';
  }
  
  const cctvIpValue = cctvIp !== undefined && cctvIp !== null && cctvIp !== 'undefined' ? String(cctvIp) : 'undefined';
  
  const params = new URLSearchParams({
    key: cctvKey,
    cctvid: cctvId,
    cctvName: encodeURIComponent(cctvName),
    kind: kindValue,
    cctvip: cctvIpValue,
    cctvch: cctvchValue,
    id: idValue,
    cctvpasswd: 'undefined',
    cctvport: 'undefined',
  });
  
  return `${baseUrl}?${params.toString()}`;
}

// 좌표 변환 함수 (TM 좌표계 → WGS84, 필요시)
// 한국 TM 좌표계를 WGS84로 변환하는 간단한 근사 변환
function convertTmToWgs84(tmX: number, tmY: number): { latitude: number; longitude: number } {
  // TM 좌표계인지 확인 (대략적인 범위 체크)
  // 한국 TM 좌표계: X(200000~600000), Y(100000~600000)
  // WGS84: 경도 124~132, 위도 33~43
  
  // 만약 이미 WGS84 좌표라면 그대로 반환
  if (tmX >= 124 && tmX <= 132 && tmY >= 33 && tmY <= 43) {
    return { latitude: tmY, longitude: tmX };
  }
  
  // TM 좌표계인 경우 간단한 변환 (정확한 변환은 proj4 라이브러리 사용 권장)
  // 여기서는 근사치로 변환 (실제 사용 시 정확한 변환 공식이나 라이브러리 사용 필요)
  const longitude = (tmX - 200000) / 111320.0 + 127.0;
  const latitude = (tmY - 500000) / 110540.0 + 38.0;
  
  return { latitude, longitude };
}

// XLSX 파일 읽기 및 파싱
function readXlsxFile(filePath: string): XlsxRow[] {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    console.log(`XLSX 파일 읽기 중: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    
    // 첫 번째 시트 읽기
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // JSON으로 변환
    const data = XLSX.utils.sheet_to_json<XlsxRow>(worksheet);
    
    console.log(`총 ${data.length}개의 행을 읽었습니다.`);
    return data;
  } catch (error: any) {
    throw new Error(`XLSX 파일 읽기 실패: ${error.message}`);
  }
}

// CCTV 데이터를 DB에 저장 (연결 객체를 매개변수로 받음)
async function saveCctvToDatabase(
  connection: any,
  cctvId: string,
  location: string,
  latitude: number,
  longitude: number,
  apiEndpoint: string,
  centerName?: string
): Promise<{ inserted: boolean; updated: boolean }> {
  try {
    // cctv_code 생성 (SHA256 해시 사용) - VARCHAR(64)에 맞게 64자리 hex 문자열
    const crypto = await import('crypto');
    const cctvCode = crypto.createHash('sha256')
      .update(`${location.trim()}|${longitude}|${latitude}`)
      .digest('hex');

    // DB 제약조건에 맞게 데이터 검증 및 잘라내기
    // location: VARCHAR(125) - 최대 125자
    const trimmedLocation = location.trim();
    if (trimmedLocation.length > 125) {
      console.warn(`⚠️  location이 125자를 초과합니다. 잘라냅니다: ${trimmedLocation.substring(0, 125)}...`);
    }
    const finalLocation = trimmedLocation.substring(0, 125);

    // api_endpoint: VARCHAR(512) - 최대 512자
    if (apiEndpoint.length > 512) {
      console.warn(`⚠️  api_endpoint가 512자를 초과합니다. 잘라냅니다: ${apiEndpoint.substring(0, 512)}...`);
    }
    const finalApiEndpoint = apiEndpoint.substring(0, 512);

    // cctv_code는 SHA256 해시이므로 정확히 64자리임이 보장됨 (VARCHAR(64)에 맞음)

    // INSERT 또는 UPDATE (cctv_code 기준, UNIQUE 제약조건 활용)
    const [result]: any = await connection.execute(
      `INSERT INTO CCTV (cctv_code, location, latitude, longitude, api_endpoint)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         api_endpoint = VALUES(api_endpoint),
         location = VALUES(location),
         latitude = VALUES(latitude),
         longitude = VALUES(longitude)`,
      [cctvCode, finalLocation, latitude, longitude, finalApiEndpoint]
    );

    const inserted = result.affectedRows === 1;
    const updated = result.affectedRows === 2;

    return { inserted, updated };
  } catch (error: any) {
    // DB 저장 중 오류 발생 시 상세 정보 출력
    const errorMessage = error?.message || error?.toString() || '알 수 없는 DB 오류';
    const sqlMessage = error?.sqlMessage || '';
    const sqlState = error?.sqlState || '';
    const errno = error?.errno || '';
    
    throw new Error(`DB 저장 실패 (cctv_id: ${cctvId}, location: ${location}): ${errorMessage}${sqlMessage ? ` (SQL: ${sqlMessage})` : ''}${sqlState ? ` [${sqlState}]` : ''}${errno ? ` (errno: ${errno})` : ''}`);
  }
}

// 메인 실행 함수
// @param options - 실행 옵션
//   - isStandalone: 독립 실행 모드인지 여부 (기본값: false)
//     true: pool.end() 호출 및 process.exit() 사용
//     false: pool.end() 호출 안 함, 에러 throw
async function main(options: { isStandalone?: boolean } = {}) {
  const { isStandalone = false } = options;
  
  try {
    console.log('='.repeat(60));
    console.log('UTIC CCTV XLSX 임포트 시작');
    console.log('='.repeat(60));

    // CCTV_KEY 환경변수 확인
    if (!process.env.CCTV_KEY) {
      const errorMsg = 'CCTV_KEY가 .env 파일에 설정되지 않았습니다. 백엔드 폴더의 .env 파일에 CCTV_KEY를 추가해주세요.';
      console.error(`\n❌ 오류: ${errorMsg}`);
      if (isStandalone) {
        process.exit(1);
      } else {
        throw new Error(errorMsg);
      }
    }
    console.log('✅ CCTV_KEY 확인 완료');

    // XLSX 파일 경로 (백엔드 폴더 내)
    const xlsxFilePath = path.join(__dirname, '..', 'cctv_data.xlsx');
    
    // 파일 경로 확인 및 출력
    console.log(`\n파일 경로: ${xlsxFilePath}`);
    console.log(`파일 존재 여부: ${fs.existsSync(xlsxFilePath) ? '✅ 있음' : '❌ 없음'}`);
    
    if (!fs.existsSync(xlsxFilePath)) {
      const errorMsg = `XLSX 파일을 찾을 수 없습니다. 파일을 다음 경로에 위치시켜주세요: ${xlsxFilePath}`;
      console.error(`\n❌ 오류: ${errorMsg}`);
      if (isStandalone) {
        process.exit(1);
      } else {
        // 라이브러리 모드에서는 파일이 없어도 백엔드 시작을 막지 않음
        console.warn('⚠️  CCTV 자동 임포트를 건너뜁니다. (백엔드는 정상 시작됩니다)');
        return;
      }
    }

    // XLSX 파일 읽기
    const rows = readXlsxFile(xlsxFilePath);

    if (rows.length === 0) {
      const errorMsg = 'XLSX 파일에 데이터가 없습니다.';
      console.log(`❌ ${errorMsg}`);
      if (isStandalone) {
        process.exit(1);
      } else {
        console.warn('⚠️  CCTV 자동 임포트를 건너뜁니다. (백엔드는 정상 시작됩니다)');
        return;
      }
    }

    // 데이터 처리 및 저장
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('\n데이터 처리 시작...\n');

    // DB 연결 설정 확인
    console.log('DB 연결 시도 중...');
    console.log(`  - Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  - Port: ${process.env.DB_PORT || '3306'}`);
    console.log(`  - Database: ${process.env.DB_NAME || 'new_schema'}`);
    console.log(`  - User: ${process.env.DB_USERNAME || 'root'}`);

    // 하나의 DB 연결을 가져와서 모든 작업 수행 (연결 풀 고갈 방지)
    let connection;
    try {
      connection = await pool.getConnection();
      console.log('✅ DB 연결 성공\n');
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || '알 수 없는 연결 오류';
      const errorCode = error?.code || '';
      console.error('\n❌ DB 연결 실패:', errorMessage);
      if (errorCode) {
        console.error(`오류 코드: ${errorCode}`);
      }
      console.error('\n확인 사항:');
      console.error('1. MySQL 서버가 실행 중인지 확인');
      console.error('2. .env 파일의 DB 설정이 올바른지 확인');
      console.error('3. 방화벽 설정 확인');
      throw new Error(`DB 연결 실패: ${errorMessage} (${errorCode})`);
    }

    try {
      // 트랜잭션 시작
      await connection.beginTransaction();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          // 필수 필드 확인
          const cctvId = row.CCTVID?.toString().trim();
          const cctvName = row.CCTVNAME?.toString().trim();
          const xCoord = row.XCOORD;
          const yCoord = row.YCOORD;
          const centerName = row.CENTERNAME?.toString().trim();
          
          // CENTERNAME이 "광주광역시"인 것만 처리
          if (centerName !== '광주광역시') {
            skipped++;
            continue;
          }

          if (!cctvId || !cctvName || xCoord === undefined || yCoord === undefined) {
            console.log(`[${i + 1}/${rows.length}] ⚠️  스킵: 필수 필드 누락 (CCTVID: ${cctvId}, CCTVNAME: ${cctvName}, 좌표: ${xCoord}, ${yCoord})`);
            skipped++;
            continue;
          }

          // 좌표 변환
          const x = typeof xCoord === 'string' ? parseFloat(xCoord) : xCoord;
          const y = typeof yCoord === 'string' ? parseFloat(yCoord) : yCoord;

          if (isNaN(x) || isNaN(y)) {
            console.log(`[${i + 1}/${rows.length}] ⚠️  스킵: 유효하지 않은 좌표 (${xCoord}, ${yCoord})`);
            skipped++;
            continue;
          }

          // 좌표 변환
          let latitude: number;
          let longitude: number;
          try {
            const coords = convertTmToWgs84(x, y);
            latitude = coords.latitude;
            longitude = coords.longitude;
          } catch (error: any) {
            throw new Error(`좌표 변환 실패: ${error?.message || error}`);
          }

          // URL 생성 또는 사용
          let streamUrl: string;
          try {
            // 방법 1: XLSX에 STREAM_URL 컬럼이 있으면 직접 사용
            const streamUrlFromXlsx = row.STREAM_URL?.toString().trim();
            if (streamUrlFromXlsx && streamUrlFromXlsx.startsWith('http')) {
              streamUrl = streamUrlFromXlsx;
              console.log(`[${i + 1}/${rows.length}] ✅ STREAM_URL 컬럼에서 URL 사용: ${cctvName}`);
            } else {
              // 방법 2: STREAM_URL이 없으면 파라미터로 생성
              // 광주 지역은 kind='v'로 고정, cctvch/id는 매핑 테이블에서 찾음
              const kind = row.KIND?.toString().trim();
              const cctvIp = row.CCTVIP;
              const cctvch = row.CCTVCH;
              const id = row.ID;
              
              streamUrl = generateUticStreamUrl(
                cctvId, 
                cctvName, 
                kind,           // KIND 컬럼 값 (광주는 'v'로 자동 변경)
                cctvIp,         // CCTVIP 컬럼 값
                cctvch,         // CCTVCH 컬럼 값 (없으면 매핑 테이블에서 찾음)
                id,             // ID 컬럼 값 (없으면 매핑 테이블에서 찾음)
                centerName      // CENTERNAME (광주 지역 판별용)
              );
              
              if (centerName === '광주광역시' && (!cctvch || !id)) {
                if (gwangjuCctvMapping[cctvId]) {
                  console.log(`[${i + 1}/${rows.length}] ✅ 매핑 테이블에서 URL 생성: ${cctvName} (cctvch=${gwangjuCctvMapping[cctvId].cctvch}, id=${gwangjuCctvMapping[cctvId].id})`);
                } else {
                  console.log(`[${i + 1}/${rows.length}] ⚠️  매핑 없음 - URL 생성 (재생 안될 수 있음): ${cctvName}`);
                }
              } else {
                console.log(`[${i + 1}/${rows.length}] ✅ 파라미터로 URL 생성: ${cctvName}`);
              }
            }
          } catch (error: any) {
            throw new Error(`URL 생성 실패: ${error?.message || error}`);
          }

          // DB 저장 (연결 객체 전달)
          const result = await saveCctvToDatabase(
            connection,
            cctvId,
            cctvName,
            latitude,
            longitude,
            streamUrl,
            centerName
          );

          if (result.inserted) {
            inserted++;
            if ((i + 1) % 100 === 0 || i === 0) {
              console.log(`[${i + 1}/${rows.length}] ✅ 신규 삽입: ${cctvName} (${cctvId})`);
            }
          } else if (result.updated) {
            updated++;
            if ((i + 1) % 100 === 0 || i === 0) {
              console.log(`[${i + 1}/${rows.length}] 🔄 업데이트: ${cctvName} (${cctvId})`);
            }
          }

        } catch (error: any) {
          errors++;
          const errorMessage = error?.message || error?.toString() || '알 수 없는 오류';
          const errorStack = error?.stack ? `\n  스택: ${error.stack}` : '';
          console.error(`[${i + 1}/${rows.length}] ❌ 오류: ${errorMessage}${errorStack}`);
          
          // 첫 번째 오류의 경우 더 자세한 정보 출력
          if (errors === 1) {
            console.error(`상세 오류 정보:`, {
              row: row,
              error: error,
              errorType: error?.constructor?.name,
              errorKeys: Object.keys(error || {}),
            });
          }
        }
      }

      // 트랜잭션 커밋
      await connection.commit();
      console.log('\n✅ 트랜잭션 커밋 완료');
    } catch (error: any) {
      // 트랜잭션 롤백
      await connection.rollback();
      console.error('\n❌ 트랜잭션 롤백:', error?.message || error);
      throw error;
    } finally {
      // 연결 해제
      connection.release();
      console.log('✅ DB 연결 해제');
    }

    // 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('임포트 완료');
    console.log('='.repeat(60));
    console.log(`총 처리: ${rows.length}개`);
    console.log(`✅ 신규 삽입: ${inserted}개`);
    console.log(`🔄 업데이트: ${updated}개`);
    console.log(`⚠️  스킵: ${skipped}개`);
    console.log(`❌ 오류: ${errors}개`);
    console.log('='.repeat(60));

    // 데이터베이스 연결 풀 종료 (독립 실행 모드에서만)
    if (isStandalone) {
      await pool.end();
      console.log('\n✅ 데이터베이스 연결 풀 종료');
    }

  } catch (error: any) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error(error.stack);
    
    // 독립 실행 모드에서만 pool 종료 및 프로세스 종료
    if (isStandalone) {
      try {
        await pool.end();
      } catch (poolError) {
        // 무시
      }
      process.exit(1);
    } else {
      // 라이브러리 모드에서는 에러를 throw하여 호출자가 처리하도록 함
      // 하지만 백엔드 시작을 막지 않기 위해 경고만 출력
      console.warn('⚠️  CCTV 자동 임포트 실패. 백엔드는 정상 시작됩니다.');
      throw error;
    }
  }
}

// 스크립트 실행 (독립 실행 모드)
if (require.main === module) {
  main({ isStandalone: true }).catch((error) => {
    console.error('예상치 못한 오류:', error);
    process.exit(1);
  });
}

export { main };

