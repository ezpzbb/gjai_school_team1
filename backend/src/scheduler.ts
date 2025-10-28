// src/cctv/scheduler.ts
import { updateCctvData } from './cctvUpdater';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

export function startCctvScheduler(): void {
  if (intervalId) return;

  // 서버 시작 시 즉시 실행
  console.log('CCTV 스케줄러 시작: 즉시 실행 + 24시간 간격');
  updateCctvData();

  intervalId = setInterval(() => {
    console.log('24시간 경과 → CCTV 자동 업데이트 시작');
    updateCctvData();
  }, TWENTY_FOUR_HOURS);
}

export function stopCctvScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('CCTV 스케줄러 중지됨');
  }
}