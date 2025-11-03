import axios from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.CCTV_API_KEY;
if (!API_KEY) {
  throw new Error('CCTV_API_KEY가 .env에 설정되지 않았습니다.');
}

const BASE_URL = 'https://openapi.its.go.kr:9443/eventInfo';

// 좌표 범위 설정 (한국 전역 기본값)
export interface EventBounds {
  minX: number; // 최소 경도
  maxX: number; // 최대 경도
  minY: number; // 최소 위도
  maxY: number; // 최대 위도
}

// 기본 좌표 범위 (한국 전역)
const DEFAULT_BOUNDS: EventBounds = {
  minX: 124.0,
  maxX: 132.0,
  minY: 33.0,
  maxY: 39.0,
};

// 이벤트 아이템 인터페이스
export interface EventItem {
  type: string; // 도로 유형
  eventType: string; // 이벤트 유형
  eventDetailType: string; // 이벤트 세부 유형
  startDate: string; // 발생 일시
  coordX: string; // 경도
  coordY: string; // 위도
  linkId: string; // 링크 ID
  roadName: string; // 도로명
  roadNo: string; // 도로 번호
  roadDrcType: string; // 도로 방향 유형
  lanesBlockType: string; // 차단 통제 유형
  lanesBlocked: string; // 차단 차로
  message: string; // 돌발 내용
  endDate: string; // 종료 일시
  id: string; // 고유 ID (linkId + startDate 조합)
}

// XML 응답 인터페이스
interface EventItemRaw {
  type?: string[];
  eventType?: string[];
  eventDetailType?: string[];
  startDate?: string[];
  coordX?: string[];
  coordY?: string[];
  linkId?: string[];
  roadName?: string[];
  roadNo?: string[];
  roadDrcType?: string[];
  lanesBlockType?: string[];
  lanesBlocked?: string[];
  message?: string[];
  endDate?: string[];
}

// 메모리에 저장할 이벤트 맵 (id -> EventItem)
const eventMap = new Map<string, EventItem>();

// 현재 설정된 좌표 범위
let currentBounds: EventBounds = DEFAULT_BOUNDS;

// 이벤트 업데이트 콜백 함수 타입
export type EventUpdateCallback = (events: EventItem[]) => void;

let updateCallback: EventUpdateCallback | null = null;

/**
 * 이벤트 업데이트 콜백 함수 설정
 */
export function setEventUpdateCallback(callback: EventUpdateCallback): void {
  updateCallback = callback;
}

/**
 * 좌표 범위 설정
 */
export function setBounds(bounds: EventBounds): void {
  currentBounds = bounds;
  console.log('이벤트 좌표 범위 업데이트:', bounds);
}

/**
 * 현재 저장된 이벤트 목록 가져오기
 */
export function getEvents(): EventItem[] {
  return Array.from(eventMap.values());
}

/**
 * 고유 ID 생성
 */
function generateEventId(linkId: string, startDate: string): string {
  return `${linkId}_${startDate}`;
}

/**
 * 종료된 이벤트 제거
 */
function removeExpiredEvents(): void {
  const now = new Date();
  const expiredIds: string[] = [];

  for (const [id, event] of eventMap.entries()) {
    // endDate가 있고 현재 시간보다 이전이면 삭제
    if (event.endDate && event.endDate.trim() !== '') {
      // endDate 형식: YYYYMMDDHH24MISS
      const year = event.endDate.substring(0, 4);
      const month = event.endDate.substring(4, 6);
      const day = event.endDate.substring(6, 8);
      const hour = event.endDate.substring(8, 10);
      const minute = event.endDate.substring(10, 12);
      const second = event.endDate.substring(12, 14);

      const endDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );

      if (endDate < now) {
        expiredIds.push(id);
      }
    }
  }

  expiredIds.forEach((id) => {
    eventMap.delete(id);
  });

  if (expiredIds.length > 0) {
    console.log(`종료된 이벤트 ${expiredIds.length}개 제거`);
  }
}

/**
 * XML 파싱하여 EventItem으로 변환
 */
function parseEventItem(item: EventItemRaw): EventItem | null {
  const linkId = item.linkId?.[0]?.trim() || '';
  const startDate = item.startDate?.[0]?.trim() || '';

  if (!linkId || !startDate) {
    return null;
  }

  return {
    type: item.type?.[0]?.trim() || '',
    eventType: item.eventType?.[0]?.trim() || '',
    eventDetailType: item.eventDetailType?.[0]?.trim() || '',
    startDate,
    coordX: item.coordX?.[0]?.trim() || '',
    coordY: item.coordY?.[0]?.trim() || '',
    linkId,
    roadName: item.roadName?.[0]?.trim() || '',
    roadNo: item.roadNo?.[0]?.trim() || '',
    roadDrcType: item.roadDrcType?.[0]?.trim() || '',
    lanesBlockType: item.lanesBlockType?.[0]?.trim() || '',
    lanesBlocked: item.lanesBlocked?.[0]?.trim() || '',
    message: item.message?.[0]?.trim() || '',
    endDate: item.endDate?.[0]?.trim() || '',
    id: generateEventId(linkId, startDate),
  };
}

/**
 * API 요청 (단일 도로 유형)
 */
async function fetchEventsByType(type: string): Promise<EventItem[]> {
  const params = new URLSearchParams({
    apiKey: API_KEY!,
    type,
    eventType: 'all',
    minX: currentBounds.minX.toString(),
    maxX: currentBounds.maxX.toString(),
    minY: currentBounds.minY.toString(),
    maxY: currentBounds.maxY.toString(),
    getType: 'xml',
  } as Record<string, string>);

  const fullUrl = `${BASE_URL}?${params.toString()}`;
  console.log(`이벤트 요청 (${type}): ${fullUrl}`);

  try {
    const response = await axios.get(fullUrl, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 30000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    const xmlData: string = response.data;
    const jsonResult = await parseStringPromise(xmlData);

    // resultCode 확인
    const resultCode = jsonResult?.response?.header?.[0]?.resultCode?.[0];
    if (resultCode !== '0') {
      const resultMsg = jsonResult?.response?.header?.[0]?.resultMsg?.[0] || 'Unknown error';
      console.error(`API 오류 (${type}): ${resultMsg}`);
      return [];
    }

    const totalCount = parseInt(jsonResult?.response?.body?.[0]?.totalCount?.[0] || '0', 10);
    console.log(`${type} 이벤트 총 개수: ${totalCount}`);

    if (totalCount === 0) {
      return [];
    }

    const itemsNode = jsonResult?.response?.body?.[0]?.items?.[0];
    const items: EventItemRaw[] = Array.isArray(itemsNode?.item)
      ? itemsNode.item
      : itemsNode?.item
        ? [itemsNode.item]
        : [];

    const events: EventItem[] = [];
    for (const item of items) {
      const event = parseEventItem(item);
      if (event) {
        events.push(event);
      }
    }

    return events;
  } catch (error: any) {
    console.error(`이벤트 요청 실패 (${type}):`, error.message);
    return [];
  }
}

/**
 * 이벤트 데이터 업데이트
 */
export async function updateEventData(): Promise<void> {
  console.log('\n고속도로/국도 이벤트 데이터 업데이트 시작...');

  // 종료된 이벤트 제거
  removeExpiredEvents();

  try {
    // 고속도로와 국도 각각 요청
    const [highwayEvents, nationalEvents] = await Promise.all([
      fetchEventsByType('ex'), // 고속도로
      fetchEventsByType('its'), // 국도
    ]);

    console.log(`고속도로 이벤트: ${highwayEvents.length}개`);
    console.log(`국도 이벤트: ${nationalEvents.length}개`);

    const allEvents = [...highwayEvents, ...nationalEvents];
    console.log(`총 이벤트: ${allEvents.length}개`);

    // 메모리에 저장 (기존 데이터 업데이트 또는 추가)
    let updated = 0;
    let added = 0;

    for (const event of allEvents) {
      if (eventMap.has(event.id)) {
        // 기존 이벤트 업데이트
        eventMap.set(event.id, event);
        updated++;
      } else {
        // 새 이벤트 추가
        eventMap.set(event.id, event);
        added++;
      }
    }

    console.log(`이벤트 업데이트 완료 - 신규: ${added}개, 업데이트: ${updated}개, 총: ${eventMap.size}개`);

    // 콜백 호출하여 소켓으로 전송
    if (updateCallback) {
      updateCallback(getEvents());
    }
  } catch (error: any) {
    console.error('이벤트 업데이트 실패:', error.message);
  }
}

