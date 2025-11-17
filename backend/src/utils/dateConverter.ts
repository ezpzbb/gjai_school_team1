// 날짜 변환 유틸 함수

/**
 * Date 객체나 문자열을 ISO 8601 형식으로 변환
 */
export function convertToISO8601(timestamp: Date | string): string {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  if (typeof timestamp === 'string') {
    const dateStr = timestamp.trim();
    
    // 'YYYY-MM-DD HH:MM:SS' 형식인 경우
    if (dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const isoStr = dateStr.replace(' ', 'T') + '.000Z';
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${isoStr}`);
      }
      return date.toISOString();
    }
    
    // 다른 형식인 경우 직접 변환 시도
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    return date.toISOString();
  }

  throw new Error(`Invalid timestamp type: ${typeof timestamp}`);
}

/**
 * Date 객체를 MySQL이 이해할 수 있는 형식으로 변환 (YYYY-MM-DD HH:MM:SS)
 */
export function convertToMySQLDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

