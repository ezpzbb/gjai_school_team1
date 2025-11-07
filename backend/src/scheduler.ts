// src/scheduler.ts
// ITS CCTV 업데이트는 제거됨 (경찰청 UTIC API로 전환)
// ITS 이벤트 업데이트는 유지
import { updateEventData } from './eventUpdater';

const THIRTY_MINUTES = 30 * 60 * 1000;

let eventIntervalId: NodeJS.Timeout | null = null;

export function startEventScheduler(): void {
  if (eventIntervalId) return;

  // 서버 시작 시 즉시 실행
  console.log('이벤트 스케줄러 시작: 즉시 실행 + 30분 간격');
  updateEventData();

  eventIntervalId = setInterval(() => {
    console.log('30분 경과 → 이벤트 자동 업데이트 시작');
    updateEventData();
  }, THIRTY_MINUTES);
}

export function stopEventScheduler(): void {
  if (eventIntervalId) {
    clearInterval(eventIntervalId);
    eventIntervalId = null;
    console.log('이벤트 스케줄러 중지됨');
  }
}