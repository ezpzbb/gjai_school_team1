// 날짜 포맷팅 유틸 함수

/**
 * ISO 8601 형식의 타임스탬프를 시간 문자열로 변환 (HH:MM)
 */
export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * ISO 8601 형식의 타임스탬프를 날짜+시간 문자열로 변환
 */
export const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 시간 범위 포맷팅
 */
export const formatTimeRange = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateStr = startDate.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
  });
  const startTime = startDate.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = endDate.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} ${startTime} ~ ${endTime}`;
};

