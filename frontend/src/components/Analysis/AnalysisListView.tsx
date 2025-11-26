import React, { useState, useEffect, useMemo, useRef } from 'react';
import { socketService } from '../../services/socket';
import { VehicleUpdatePayload } from '../../types/vehicle';

interface AnalysisListViewProps {
  cctvId: number;
}

interface AnalysisListItem {
  timestamp: number;
  formattedTime: string;
  congestionLevel: number;
  vehicleCount: number;
  vehicleTypeBreakdown: { [type: string]: number };
}

interface SavedAnalysisSection {
  id: string;
  minuteKey: string;
  startTimestamp: number;
  endTimestamp: number;
  items: AnalysisListItem[];
  savedAt: number;
}

const AnalysisListView: React.FC<AnalysisListViewProps> = ({ cctvId }) => {
  // 실시간 데이터 (최신 1개만 표시)
  const [realtimeData, setRealtimeData] = useState<VehicleUpdatePayload | null>(null);
  
  // 현재 1분간 수집 중인 데이터
  const [currentMinuteData, setCurrentMinuteData] = useState<VehicleUpdatePayload[]>([]);
  
  // 저장된 섹션 (최대 10개, FIFO)
  const [savedSections, setSavedSections] = useState<SavedAnalysisSection[]>([]);
  
  // 마지막 저장 시간
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  
  // 섹션 접기/펼치기 상태
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  // 자동 스크롤
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const latestSectionRef = useRef<HTMLDivElement>(null);

  // 혼잡도 계산 함수 (백엔드와 동일)
  const calculateCongestionLevel = (vehicleCount: number): number => {
    if (vehicleCount === 0) return 0;
    if (vehicleCount <= 10) return 20;
    if (vehicleCount <= 20) return 40;
    if (vehicleCount <= 30) return 60;
    if (vehicleCount <= 39) return 70;
    if (vehicleCount <= 50) return 80;
    return 100;
  };

  // 차량 유형별 breakdown 생성
  const getVehicleTypeBreakdown = (detections: VehicleUpdatePayload['detections']) => {
    const breakdown: { [type: string]: number } = {};
    const vehicleTypes = ['car', 'truck', 'bus', '승용차', '트럭', '버스', '오토바이(자전거)'];
    
    detections.forEach((det) => {
      if (vehicleTypes.includes(det.cls)) {
        const normalizedType = det.cls === 'car' ? '승용차' : 
                               det.cls === 'truck' ? '트럭' : 
                               det.cls === 'bus' ? '버스' : det.cls;
        breakdown[normalizedType] = (breakdown[normalizedType] || 0) + 1;
      }
    });
    
    return breakdown;
  };

  // vehicle-update 이벤트 구독
  useEffect(() => {
    if (!cctvId) {
      setRealtimeData(null);
      setCurrentMinuteData([]);
      setLastSaveTime(null);
      return;
    }

    const unsubscribe = socketService.onVehicleUpdate(cctvId, (payload: VehicleUpdatePayload) => {
      // 실시간 데이터 업데이트 (최신 1개만)
      setRealtimeData(payload);

      // 현재 분 데이터에 추가
      setCurrentMinuteData((prev) => [...prev, payload]);
    });

    return () => {
      unsubscribe();
      setRealtimeData(null);
      setCurrentMinuteData([]);
      setLastSaveTime(null);
    };
  }, [cctvId]);

  // 1분 간격 저장 로직
  useEffect(() => {
    if (!cctvId || currentMinuteData.length === 0) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      
      // 마지막 저장 시간이 없으면 현재 시간으로 설정
      if (lastSaveTime === null) {
        setLastSaveTime(now);
        return;
      }

      // 1분(60초) 경과 확인
      if (now - lastSaveTime >= 60 && currentMinuteData.length > 0) {
        // 1분 간격 평균치 계산
        const sortedData = [...currentMinuteData].sort((a, b) => a.timestamp - b.timestamp);
        const startTimestamp = sortedData[0].timestamp;
        const endTimestamp = sortedData[sortedData.length - 1].timestamp;
        
        const startDate = new Date(startTimestamp * 1000);
        const minuteKey = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;

        // 평균 차량 수 계산
        const totalVehicleCount = sortedData.reduce((sum, update) => sum + update.detections.length, 0);
        const avgVehicleCount = Math.round(totalVehicleCount / sortedData.length);

        // 차량 유형별 평균 계산
        const typeCountsSum: Record<string, number> = {};
        sortedData.forEach((update) => {
          const breakdown = getVehicleTypeBreakdown(update.detections);
          Object.entries(breakdown).forEach(([type, count]) => {
            typeCountsSum[type] = (typeCountsSum[type] || 0) + count;
          });
        });
        const avgTypeBreakdown: Record<string, number> = {};
        Object.entries(typeCountsSum).forEach(([type, sum]) => {
          avgTypeBreakdown[type] = Math.round(sum / sortedData.length);
        });

        // 평균 혼잡도 계산
        const avgCongestionLevel = calculateCongestionLevel(avgVehicleCount);

        // 평균치 1개만 저장 (모든 개별 데이터는 저장하지 않음)
        const avgItem: AnalysisListItem = {
          timestamp: startTimestamp,
          formattedTime: `${minuteKey} 평균`,
          congestionLevel: avgCongestionLevel,
          vehicleCount: avgVehicleCount,
          vehicleTypeBreakdown: avgTypeBreakdown,
        };

        const section: SavedAnalysisSection = {
          id: `section-${startTimestamp}`,
          minuteKey,
          startTimestamp,
          endTimestamp,
          items: [avgItem], // 평균치 1개만 저장
          savedAt: now,
        };

        // 저장된 섹션에 추가 (FIFO: 최대 10개)
        setSavedSections((prev) => {
          const updated = [...prev, section];
          // 10개 초과 시 가장 오래된 것 제거
          return updated.slice(-10);
        });

        // 현재 분 데이터 초기화
        setCurrentMinuteData([]);
        setLastSaveTime(now);
      }
    }, 1000); // 1초마다 체크

    return () => clearInterval(interval);
  }, [cctvId, currentMinuteData, lastSaveTime]);

  // 최신 섹션 자동 펼치기
  useEffect(() => {
    if (savedSections.length > 0) {
      const latestSection = savedSections[savedSections.length - 1];
      setExpandedSections((prev) => {
        const newSet = new Set(prev);
        newSet.add(latestSection.id);
        return newSet;
      });
    }
  }, [savedSections]);

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && latestSectionRef.current && scrollContainerRef.current) {
      latestSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [savedSections, autoScroll]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // 실시간 데이터를 리스트 아이템으로 변환
  const realtimeListItem: AnalysisListItem | null = useMemo(() => {
    if (!realtimeData) return null;

    const date = new Date(realtimeData.timestamp * 1000);
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

    return {
      timestamp: realtimeData.timestamp,
      formattedTime,
      congestionLevel: calculateCongestionLevel(realtimeData.detections.length),
      vehicleCount: realtimeData.detections.length,
      vehicleTypeBreakdown: getVehicleTypeBreakdown(realtimeData.detections),
    };
  }, [realtimeData]);

  const renderVehicleTypeBreakdown = (breakdown: { [type: string]: number }) => {
    const entries = Object.entries(breakdown);
    if (entries.length === 0) return <span className="text-gray-400 dark:text-gray-500">-</span>;
    
    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([type, count]) => (
          <span
            key={type}
            className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
          >
            {type}: {count}
          </span>
        ))}
      </div>
    );
  };

  const getCongestionColor = (level: number) => {
    if (level >= 80) return 'text-red-600 dark:text-red-400';
    if (level >= 60) return 'text-orange-600 dark:text-orange-400';
    if (level >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="h-full flex flex-col min-h-0 max-h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">분석 데이터</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              autoScroll
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {autoScroll ? '자동 스크롤: ON' : '자동 스크롤: OFF'}
          </button>
        </div>
      </div>

      {/* 리스트 영역 - 높이 제한 및 내부 스크롤 */}
      <div className="flex-1 flex flex-col min-h-0 max-h-full overflow-hidden">
        {/* 실시간 데이터 (상단 - 고정) */}
        {realtimeListItem && (
          <div className="flex-shrink-0 p-2 border-b-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
              실시간 데이터
            </div>
            <table className="w-full text-xs">
              <thead className="bg-blue-100 dark:bg-blue-900/40">
                <tr>
                  <th className="px-2 py-1 text-left">시간</th>
                  <th className="px-2 py-1 text-left">혼잡도</th>
                  <th className="px-2 py-1 text-left">차량 수</th>
                  <th className="px-2 py-1 text-left">차량 유형</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-blue-100 dark:hover:bg-blue-900/40">
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{realtimeListItem.formattedTime}</td>
                  <td className={`px-2 py-1 font-medium ${getCongestionColor(realtimeListItem.congestionLevel)}`}>
                    {realtimeListItem.congestionLevel}%
                  </td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{realtimeListItem.vehicleCount}대</td>
                  <td className="px-2 py-1">{renderVehicleTypeBreakdown(realtimeListItem.vehicleTypeBreakdown)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 저장된 데이터 (하단 - 스크롤 가능) */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
          <div className="p-2">
            {savedSections.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 text-sm">
                {realtimeListItem ? '저장된 데이터가 없습니다. (1분 간격으로 저장됩니다)' : '데이터가 없습니다.'}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  저장된 데이터 ({savedSections.length}/10)
                </div>
                {savedSections.map((section, index) => {
                const isExpanded = expandedSections.has(section.id);
                const isLatest = index === savedSections.length - 1;

                return (
                  <div
                    key={section.id}
                    ref={isLatest ? latestSectionRef : null}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
                  >
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {section.minuteKey} ({section.items.length}개)
                        </span>
                        {isLatest && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                            최신
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isExpanded ? '접기' : '펼치기'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                              <tr>
                                <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">시간</th>
                                <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">혼잡도</th>
                                <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">차량 수</th>
                                <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">차량 유형</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {section.items.map((item, idx) => (
                                <tr
                                  key={`${item.timestamp}-${idx}`}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{item.formattedTime}</td>
                                  <td className={`px-2 py-1 font-medium ${getCongestionColor(item.congestionLevel)}`}>
                                    {item.congestionLevel}%
                                  </td>
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{item.vehicleCount}대</td>
                                  <td className="px-2 py-1">{renderVehicleTypeBreakdown(item.vehicleTypeBreakdown)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisListView;

