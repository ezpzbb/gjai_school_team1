// src/scheduler.ts
// ITS CCTV 업데이트는 제거됨 (경찰청 UTIC API로 전환)
// ITS 이벤트 업데이트는 유지
import { updateEventData } from './eventUpdater';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

let eventIntervalId: NodeJS.Timeout | null = null;

export function startEventScheduler(): void {
  if (eventIntervalId) return;

  console.log('이벤트 스케줄러 시작: 즉시 실행 + 15분 간격');
  updateEventData();

  eventIntervalId = setInterval(() => {
    console.log('15분 경과 → 경찰청 이벤트 자동 업데이트 시작');
    updateEventData();
  }, FIFTEEN_MINUTES);
}

export function stopEventScheduler(): void {
  if (eventIntervalId) {
    clearInterval(eventIntervalId);
    eventIntervalId = null;
    console.log('이벤트 스케줄러 중지됨');
  }
}