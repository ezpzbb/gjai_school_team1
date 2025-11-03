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
  id: string; // 고유 ID
}

