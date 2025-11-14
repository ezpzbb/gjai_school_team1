// src/scheduler.ts
// ITS CCTV 업데이트는 제거됨 (경찰청 UTIC API로 전환)
// ITS 이벤트 업데이트는 유지
// 혼잡도 알림 스케줄러는 제거됨 (DB 삽입 시 즉시 알림으로 전환)
import { updateEventData } from './eventUpdater';

const TEN_MINUTES = 10 * 60 * 1000;

let eventIntervalId: NodeJS.Timeout | null = null;

export function startEventScheduler(): void {
  if (eventIntervalId) return;

  console.log('이벤트 스케줄러 시작: 즉시 실행 + 10분 간격');
  updateEventData();

  eventIntervalId = setInterval(() => {
    console.log('10분 경과 → 경찰청 이벤트 자동 업데이트 시작');
    updateEventData();
  }, TEN_MINUTES);
}

// 혼잡도 알림 스케줄러는 제거됨
// DB 삽입 시 즉시 알림으로 전환되었으므로 스케줄러 불필요

export function stopEventScheduler(): void {
  if (eventIntervalId) {
    clearInterval(eventIntervalId);
    eventIntervalId = null;
    console.log('이벤트 스케줄러 중지됨');
  }
}

// 혼잡도 알림 스케줄러는 제거됨