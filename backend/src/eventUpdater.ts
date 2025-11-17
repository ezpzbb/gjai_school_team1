import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';

dotenv.config();

// 사고 알림 서비스 import (순환 참조 없음: accidentNotificationService는 EventItem만 import)
import { accidentNotificationService } from './services/accidentNotificationService';

const API_KEY = process.env.CCTV_KEY || process.env.CCTV_API_KEY || '';
if (!API_KEY) {
  throw new Error('CCTV_KEY 또는 CCTV_API_KEY가 .env에 설정되지 않았습니다.');
}

const CA_PATH = process.env.NODE_EXTRA_CA_CERTS || process.env.UTIC_CA_PATH;

let httpsAgent: https.Agent | undefined;

if (CA_PATH) {
  try {
    const resolvedPath = path.isAbsolute(CA_PATH)
      ? CA_PATH
      : path.resolve(process.cwd(), CA_PATH);
    const caContent = fs.readFileSync(resolvedPath, 'utf8');
    httpsAgent = new https.Agent({ ca: caContent });
    console.log(`경찰청 인증서 CA 로드 완료: ${resolvedPath}`);
  } catch (error) {
    console.error(`경찰청 인증서 로드 실패 (${CA_PATH}):`, (error as Error).message);
  }
}

const BASE_URL = 'https://www.utic.go.kr/guide/imsOpenData.do';

export interface EventItem {
  type: string;
  eventType: string;
  eventDetailType: string;
  startDate: string;
  coordX: string;
  coordY: string;
  linkId: string;
  roadName: string;
  roadNo: string;
  roadDrcType: string;
  lanesBlockType: string;
  lanesBlocked: string;
  message: string;
  endDate: string;
  id: string;
}

type PoliceEventRaw = {
  incidentId?: string;
  incidenteTypeCd?: string;
  incidenteSubTypeCd?: string;
  incidenteTrafficCd?: string;
  incTrafficCode?: string;
  incidentTitle?: string;
  addressJibun?: string;
  addressNew?: string;
  addressJibunCd?: string;
  locationDataX?: string;
  locationDataY?: string;
  locationTypeCd?: string;
  linkId?: string;
  roadName?: string;
  lane?: string;
  startDate?: string;
  endDate?: string;
  controlType?: string;
  updateDate?: string;
};

export type EventUpdateCallback = (events: EventItem[]) => void;

const GWANGJU_KEYWORDS = ['광주광역시', '광주시', '광산구', '북구', '남구', '동구', '서구'];
const GWANGJU_JIBUN_PREFIX = '29';

const eventMap = new Map<string, EventItem>();
let updateCallback: EventUpdateCallback | null = null;

export function setEventUpdateCallback(callback: EventUpdateCallback): void {
  updateCallback = callback;
}

export function getEvents(): EventItem[] {
  return Array.from(eventMap.values());
}

const INCIDENT_TYPE_MAP: Record<string, string> = {
  '1': '교통사고',
  '2': '공사',
  '3': '기상',
  '4': '재난',
  '5': '행사',
  '6': '차량고장',
};

const INCIDENT_SUBTYPE_MAP: Record<string, string> = {
  '1': '추돌',
  '2': '전복',
  '3': '측면충돌',
  '4': '정면충돌',
  '5': '화재',
  '6': '보행자사고',
  '7': '낙하물사고',
  '8': '차량고장',
};

function normalizeDate(dateStr?: string): string {
  if (!dateStr) {
    return '';
  }

  const trimmed = dateStr.trim();

  if (/^\d{14}$/.test(trimmed)) {
    return trimmed;
  }

  const koreanFormat = trimmed.match(
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(\d{1,2})시\s*(\d{1,2})분(?:\s*(\d{1,2})초)?/
  );

  if (koreanFormat) {
    const [, year, month, day, hour, minute, second] = koreanFormat;
    const sec = second ?? '0';
    return (
      year.padStart(4, '0') +
      month.padStart(2, '0') +
      day.padStart(2, '0') +
      hour.padStart(2, '0') +
      minute.padStart(2, '0') +
      sec.padStart(2, '0')
    );
  }

  return '';
}

function determineEventType(record: PoliceEventRaw): string {
  const typeCd = record.incidenteTypeCd?.trim();
  if (typeCd && INCIDENT_TYPE_MAP[typeCd]) {
    return INCIDENT_TYPE_MAP[typeCd];
  }

  const title = record.incidentTitle ?? '';
  if (title.includes('사고')) return '교통사고';
  if (title.includes('공사')) return '공사';
  if (title.includes('호우') || title.includes('폭설') || title.includes('기상')) return '기상';
  if (title.includes('재난')) return '재난';
  if (title.includes('행사')) return '행사';

  return '기타돌발';
}

function determineEventDetail(record: PoliceEventRaw): string {
  const detailCd = record.incidenteSubTypeCd?.trim();
  if (detailCd && INCIDENT_SUBTYPE_MAP[detailCd]) {
    return INCIDENT_SUBTYPE_MAP[detailCd];
  }
  return detailCd || '';
}

function determineRoadType(record: PoliceEventRaw): string {
  const locationType = record.locationTypeCd?.trim();
  if (locationType === 'C0101') return 'ex';
  if (locationType === 'C0102') return 'its';
  return 'pol';
}

function isGwangjuRecord(record: PoliceEventRaw): boolean {
  const jibunCd = record.addressJibunCd?.trim();
  const jibun = record.addressJibun?.trim() ?? '';

  if (!jibunCd || !jibunCd.startsWith(GWANGJU_JIBUN_PREFIX)) {
    return false;
  }

  if (!jibun || !jibun.includes('광주')) {
    return false;
  }

  return true;
}

function parsePoliceRecord(record: PoliceEventRaw): EventItem | null {
  const incidentId = record.incidentId?.trim();
  const coordX = record.locationDataX?.trim();
  const coordY = record.locationDataY?.trim();

  if (!incidentId || !coordX || !coordY) {
    return null;
  }

  const startDate = normalizeDate(record.startDate || record.updateDate);
  const endDate = normalizeDate(record.endDate);

  return {
    id: incidentId,
    type: determineRoadType(record),
    eventType: determineEventType(record),
    eventDetailType: determineEventDetail(record),
    startDate,
    coordX,
    coordY,
    linkId: record.linkId?.trim() || incidentId,
    roadName: record.roadName?.trim() || '',
    roadNo: record.linkId?.trim() || '',
    roadDrcType: '',
    lanesBlockType: record.incidenteTrafficCd?.trim() || record.incTrafficCode?.trim() || record.controlType?.trim() || '',
    lanesBlocked: record.lane?.trim() || '',
    message: record.incidentTitle?.trim() || '',
    endDate,
  };
}

async function fetchPoliceEvents(): Promise<EventItem[]> {
  const params = new URLSearchParams();
  params.append('key', API_KEY);
  params.append('dataType', 'xml');
  params.append('serviceID', 'incident');

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`경찰청 돌발 이벤트 요청: ${url}`);

  try {
    const response = await axios.get(url, {
      timeout: 30000,
      responseType: 'text',
      httpsAgent,
    });
    const json = await parseStringPromise(response.data, {
      explicitArray: false,
      trim: true,
    });

    const records = json?.result?.record;
    const recordArray: PoliceEventRaw[] = Array.isArray(records) ? records : records ? [records] : [];

    const filtered = recordArray.filter(isGwangjuRecord);
    const events: EventItem[] = [];

    for (const record of filtered) {
      const event = parsePoliceRecord(record);
      if (event) {
        events.push(event);
      }
    }

    console.log(`경찰청 이벤트 수신: 총 ${events.length}건 (광주 지역 필터 적용)`);
    return events;
  } catch (error: any) {
    console.error('경찰청 돌발 이벤트 요청 실패:', error.message);
    return [];
  }
}

export async function updateEventData(): Promise<void> {
  console.log('\n경찰청 돌발 이벤트 업데이트 시작...');

  try {
    const events = await fetchPoliceEvents();
    eventMap.clear();
    for (const event of events) {
      eventMap.set(event.id, event);
    }

    console.log(`경찰청 돌발 이벤트 업데이트 완료 - 저장된 이벤트: ${eventMap.size}개`);

    // 기존 이벤트 업데이트 콜백 (지도 표시용)
    if (updateCallback) {
      updateCallback(getEvents());
    }

    // 사고 이벤트 알림 발송 (비동기로 처리하여 응답 지연 방지)
    setImmediate(() => {
      accidentNotificationService.sendAccidentNotifications(events).catch((error: any) => {
        console.error('사고 알림 발송 실패:', error);
        // 알림 실패해도 이벤트 업데이트는 성공한 것으로 처리
      });
    });
  } catch (error: any) {
    console.error('경찰청 돌발 이벤트 업데이트 실패:', error.message);
  }
}

