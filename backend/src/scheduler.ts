// src/scheduler.ts
import { updateCctvData } from './cctvUpdater';
import { updateEventData } from './eventUpdater';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

let cctvIntervalId: NodeJS.Timeout | null = null;
let eventIntervalId: NodeJS.Timeout | null = null;

export function startCctvScheduler(): void {
  if (cctvIntervalId) return;

  // 서버 시작 시 즉시 실행
  console.log('CCTV 스케줄러 시작: 즉시 실행 + 24시간 간격');
  updateCctvData();

  cctvIntervalId = setInterval(() => {
    console.log('24시간 경과 → CCTV 자동 업데이트 시작');
    updateCctvData();
  }, TWENTY_FOUR_HOURS);
}

export function stopCctvScheduler(): void {
  if (cctvIntervalId) {
    clearInterval(cctvIntervalId);
    cctvIntervalId = null;
    console.log('CCTV 스케줄러 중지됨');
  }
}

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