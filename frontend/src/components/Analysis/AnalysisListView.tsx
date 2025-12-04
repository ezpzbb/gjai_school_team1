import React, { useState, useEffect, useMemo, useRef } from "react";
import { socketService } from "../../services/socket";
import { VehicleUpdatePayload } from "../../types/vehicle";

const PIXEL_TO_METER = 0.05; // 실측 m/px로 교체하세요

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

interface DirectionalBreakdown {
  total: number;
  byType: Record<string, number>;
  avgSpeed?: number;
  avgDwell?: number;
}

interface SavedAnalysisSection {
  id: string;
  minuteKey: string;
  startTimestamp: number;
  endTimestamp: number;
  items: AnalysisListItem[];
  savedAt: number;
  dirBreakdown?: { up: DirectionalBreakdown; down: DirectionalBreakdown };
}

const AnalysisListView: React.FC<AnalysisListViewProps> = ({ cctvId }) => {
  const [realtimeData, setRealtimeData] = useState<VehicleUpdatePayload | null>(null);
  const [currentMinuteData, setCurrentMinuteData] = useState<VehicleUpdatePayload[]>([]);
  const [savedSections, setSavedSections] = useState<SavedAnalysisSection[]>([]);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [sectionBuffer, setSectionBuffer] = useState<VehicleUpdatePayload[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const latestSectionRef = useRef<HTMLDivElement>(null);

  const calculateCongestionLevel = (vehicleCount: number): number => {
    if (vehicleCount === 0) return 0;
    if (vehicleCount <= 10) return 20;
    if (vehicleCount <= 20) return 40;
    if (vehicleCount <= 30) return 60;
    if (vehicleCount <= 39) return 70;
    if (vehicleCount <= 50) return 80;
    return 100;
  };

  const getVehicleTypeBreakdown = (detections: VehicleUpdatePayload["detections"]) => {
    const breakdown: { [type: string]: number } = {};
    const vehicleTypes = ["승용차", "버스", "트럭", "오토바이(자전거)"];
    const seen = new Set<number>();
    detections.forEach((det) => {
      if (det.trackId == null) return;
      if (!vehicleTypes.includes(det.cls)) return;
      if (seen.has(det.trackId)) return;
      seen.add(det.trackId);
      breakdown[det.cls] = (breakdown[det.cls] || 0) + 1;
    });
    return breakdown;
  };

  const countUniqueTrackedVehicles = (detections: VehicleUpdatePayload["detections"]) => {
    const ids = new Set<number>();
    detections.forEach((det) => {
      if (det.trackId != null) ids.add(det.trackId);
    });
    return ids.size;
  };

  useEffect(() => {
    if (!cctvId) {
      setRealtimeData(null);
      setCurrentMinuteData([]);
      setLastSaveTime(null);
      return;
    }
    const unsubscribe = socketService.onVehicleUpdate(cctvId, (payload: VehicleUpdatePayload) => {
      setRealtimeData(payload);
      setCurrentMinuteData((prev) => [...prev, payload]); // 실시간 누적용(계속 유지)
      setSectionBuffer((prev) => [...prev, payload]); // 1분 섹션용
    });
    return () => {
      unsubscribe();
      setRealtimeData(null);
      setCurrentMinuteData([]);
      setLastSaveTime(null);
    };
  }, [cctvId]);

  // 방향별 메트릭: trackKey 단위 1회 누적, 방향 전환 시 이전 방향에서 제거
  const dirMetrics = useMemo(() => {
    const init = {
      up: { total: 0, byType: {} as Record<string, number>, speedSum: 0, speedSamples: 0, dwell: new Map<string, { first: number; last: number }>(), seen: new Set<string>() },
      down: { total: 0, byType: {} as Record<string, number>, speedSum: 0, speedSamples: 0, dwell: new Map<string, { first: number; last: number }>(), seen: new Set<string>() },
    };
    const lastPos = new Map<string, { t: number; cx: number; cy: number; dir: "up" | "down" }>();
    const trackDir = new Map<string, "up" | "down">();
    const makeKey = (det: VehicleUpdatePayload["detections"][number]) => (det.trackId != null ? `id:${det.trackId}` : `bbox:${det.bbox.join(",")}`);

    currentMinuteData.forEach(({ timestamp, detections }) => {
      detections.forEach((det) => {
        if (!det.direction || det.trackId == null) return;
        const dir: "up" | "down" = det.direction === "up" ? "up" : "down";
        const key = makeKey(det);
        const cx = (det.bbox[0] + det.bbox[2]) / 2;
        const cy = (det.bbox[1] + det.bbox[3]) / 2;

        const prevDir = trackDir.get(key);
        if (prevDir && prevDir !== dir && init[prevDir].seen.has(key)) {
          init[prevDir].seen.delete(key);
          init[prevDir].total = Math.max(0, init[prevDir].total - 1);
          const prevTypeCount = init[prevDir].byType[det.cls] ?? 0;
          if (prevTypeCount > 0) init[prevDir].byType[det.cls] = prevTypeCount - 1;
        }

        if (!init[dir].seen.has(key)) {
          init[dir].seen.add(key);
          init[dir].total += 1;
          init[dir].byType[det.cls] = (init[dir].byType[det.cls] ?? 0) + 1;
        }
        trackDir.set(key, dir);

        const prev = lastPos.get(key);
        if (prev && prev.dir === dir && timestamp > prev.t) {
          const dt = timestamp - prev.t;
          if (dt > 0) {
            const distPx = Math.hypot(cx - prev.cx, cy - prev.cy);
            const speedKmh = ((distPx * PIXEL_TO_METER) / dt) * 3.6;
            init[dir].speedSum += speedKmh;
            init[dir].speedSamples += 1;
          }
          const dwell = init[dir].dwell.get(key) ?? { first: prev.t, last: prev.t };
          dwell.last = timestamp;
          init[dir].dwell.set(key, dwell);
        } else {
          init[dir].dwell.set(key, { first: timestamp, last: timestamp });
        }
        lastPos.set(key, { t: timestamp, cx, cy, dir });
      });
    });

    const finalize = (dir: "up" | "down") => {
      const dwellValues = Array.from(init[dir].dwell.values()).map((d) => Math.max(0, d.last - d.first));
      const avgDwell = dwellValues.length ? dwellValues.reduce((a, b) => a + b, 0) / dwellValues.length : 0;
      return {
        total: init[dir].total,
        byType: init[dir].byType,
        avgSpeed: init[dir].speedSamples ? init[dir].speedSum / init[dir].speedSamples : 0,
        avgDwell,
      };
    };

    return { up: finalize("up"), down: finalize("down") };
  }, [currentMinuteData]);

  // const dirBreakdown = useMemo(
  //   () => ({
  //     up: { total: dirMetrics.up.total, byType: dirMetrics.up.byType },
  //     down: { total: dirMetrics.down.total, byType: dirMetrics.down.byType },
  //   }),
  //   [dirMetrics]
  // );

  // 섹션 저장용 방향 집계 (총계/차종)
  const buildDirectionalBreakdown = (frames: VehicleUpdatePayload[]): { up: DirectionalBreakdown; down: DirectionalBreakdown } => {
    const init = {
      up: { total: 0, byType: {} as Record<string, number> },
      down: { total: 0, byType: {} as Record<string, number> },
    };
    const countedDir = new Map<string, "up" | "down">();
    const makeKey = (det: VehicleUpdatePayload["detections"][number]) => (det.trackId != null ? `id:${det.trackId}` : `bbox:${det.bbox.join(",")}`);

    frames.forEach(({ detections }) => {
      detections.forEach((det) => {
        if (!det.direction || det.trackId == null) return; //trackId 없는 경우 제외
        const dir: "up" | "down" = det.direction === "up" ? "up" : "down";
        const key = makeKey(det);
        const prevDir = countedDir.get(key);
        if (prevDir && prevDir !== dir) {
          init[prevDir].total = Math.max(0, init[prevDir].total - 1);
          const prevTypeCount = init[prevDir].byType[det.cls] ?? 0;
          if (prevTypeCount > 0) init[prevDir].byType[det.cls] = prevTypeCount - 1;
        }
        if (prevDir !== dir) {
          init[dir].total += 1;
          init[dir].byType[det.cls] = (init[dir].byType[det.cls] || 0) + 1;
          countedDir.set(key, dir);
        }
      });
    });
    return init;
  };

  // 1분 간격 섹션 저장
  useEffect(() => {
    if (!cctvId || sectionBuffer.length === 0) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      if (lastSaveTime === null) {
        setLastSaveTime(now);
        return;
      }
      if (now - lastSaveTime >= 60 && currentMinuteData.length > 0) {
        const sortedData = [...sectionBuffer].sort((a, b) => a.timestamp - b.timestamp);
        const startTimestamp = sortedData[0].timestamp;
        const endTimestamp = sortedData[sortedData.length - 1].timestamp;
        const startDate = new Date(startTimestamp * 1000);
        const minuteKey = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;

        const totalVehicleCount = sortedData.reduce((sum, update) => sum + countUniqueTrackedVehicles(update.detections), 0);
        const avgVehicleCount = Math.round(totalVehicleCount / sortedData.length);

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

        const sectionDirBreakdown = buildDirectionalBreakdown(sortedData);

        const avgItem: AnalysisListItem = {
          timestamp: startTimestamp,
          formattedTime: `${minuteKey} 평균`,
          congestionLevel: calculateCongestionLevel(avgVehicleCount),
          vehicleCount: avgVehicleCount,
          vehicleTypeBreakdown: avgTypeBreakdown,
        };

        const section: SavedAnalysisSection = {
          id: `section-${startTimestamp}`,
          minuteKey,
          startTimestamp,
          endTimestamp,
          items: [avgItem],
          savedAt: now,
          dirBreakdown: {
            up: { ...sectionDirBreakdown.up, avgSpeed: dirMetrics.up.avgSpeed, avgDwell: dirMetrics.up.avgDwell },
            down: { ...sectionDirBreakdown.down, avgSpeed: dirMetrics.down.avgSpeed, avgDwell: dirMetrics.down.avgDwell },
          },
        };
        setSavedSections((prev) => [...prev, section].slice(-10));
        setSectionBuffer([]); // 섹션 버퍼만 비움
        setLastSaveTime(now);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cctvId, currentMinuteData, lastSaveTime, dirMetrics]);

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

  useEffect(() => {
    if (autoScroll && latestSectionRef.current && scrollContainerRef.current) {
      latestSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [savedSections, autoScroll]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) newSet.delete(sectionId);
      else newSet.add(sectionId);
      return newSet;
    });
  };

  const realtimeListItem: AnalysisListItem | null = useMemo(() => {
    if (!realtimeData) return null;
    const date = new Date(realtimeData.timestamp * 1000);
    const formattedTime = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
    const uniqueRealtimeCount = countUniqueTrackedVehicles(realtimeData.detections);
    return {
      timestamp: realtimeData.timestamp,
      formattedTime,
      congestionLevel: calculateCongestionLevel(uniqueRealtimeCount),
      vehicleCount: uniqueRealtimeCount,
      vehicleTypeBreakdown: getVehicleTypeBreakdown(realtimeData.detections),
    };
  }, [realtimeData]);

  const renderVehicleTypeBreakdown = (breakdown: { [type: string]: number }) => {
    const entries = Object.entries(breakdown);
    if (entries.length === 0) return <span className="text-gray-400 dark:text-gray-500">-</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([type, count]) => (
          <span key={type} className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
            {type}: {count}
          </span>
        ))}
      </div>
    );
  };

  const getCongestionColor = (level: number) => {
    if (level >= 80) return "text-red-600 dark:text-red-400";
    if (level >= 60) return "text-orange-600 dark:text-orange-400";
    if (level >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
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
              autoScroll ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {autoScroll ? "자동 스크롤: ON" : "자동 스크롤: OFF"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 max-h-full overflow-hidden">
        {/* 저장된 데이터 */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
          <div className="p-2">
            {savedSections.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400 text-sm">
                {realtimeListItem ? "저장된 데이터가 없습니다. (1분 간격으로 저장됩니다)" : "데이터가 없습니다."}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">저장된 데이터 ({savedSections.length}/10)</div>
                {savedSections.map((section, index) => {
                  const isExpanded = expandedSections.has(section.id);
                  const isLatest = index === savedSections.length - 1;
                  const sectionDir = section.dirBreakdown || dirMetrics;

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
                            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {section.minuteKey} ({section.items.length}개)
                          </span>
                          {isLatest && <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">최신</span>}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{isExpanded ? "접기" : "펼치기"}</span>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                  <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">방향</th>
                                  <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">총 차량 수</th>
                                  <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">혼잡도</th>
                                  <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">차량 유형별 수</th>
                                  <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">평균 속도</th>
                                  <th className="px-2 py-1 text-left text-gray-700 dark:text-gray-300">정체 시간</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  <td className="px-2 py-1 font-semibold text-emerald-500">상행</td>
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{sectionDir.up.total}대</td>
                                  <td className={`px-2 py-1 font-medium ${getCongestionColor(calculateCongestionLevel(sectionDir.up.total))}`}>
                                    {calculateCongestionLevel(sectionDir.up.total)}%
                                  </td>
                                  <td className="px-2 py-1">
                                    {Object.keys(sectionDir.up.byType || {}).length === 0 ? (
                                      <span className="text-gray-400 dark:text-gray-500">데이터 없음</span>
                                    ) : (
                                      renderVehicleTypeBreakdown(sectionDir.up.byType)
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{sectionDir.up.avgSpeed?.toFixed ? sectionDir.up.avgSpeed.toFixed(1) : "0.0"} km/h</td>
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{sectionDir.up.avgDwell?.toFixed ? sectionDir.up.avgDwell.toFixed(1) : "0.0"} s</td>
                                </tr>
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                  <td className="px-2 py-1 font-semibold text-blue-500">하행</td>
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{sectionDir.down.total}대</td>
                                  <td className={`px-2 py-1 font-medium ${getCongestionColor(calculateCongestionLevel(sectionDir.down.total))}`}>
                                    {calculateCongestionLevel(sectionDir.down.total)}%
                                  </td>
                                  <td className="px-2 py-1">
                                    {Object.keys(sectionDir.down.byType || {}).length === 0 ? (
                                      <span className="text-gray-400 dark:text-gray-500">데이터 없음</span>
                                    ) : (
                                      renderVehicleTypeBreakdown(sectionDir.down.byType)
                                    )}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">
                                    {sectionDir.down.avgSpeed?.toFixed ? sectionDir.down.avgSpeed.toFixed(1) : "0.0"} km/h
                                  </td>
                                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">
                                    {sectionDir.down.avgDwell?.toFixed ? sectionDir.down.avgDwell.toFixed(1) : "0.0"} s
                                  </td>
                                </tr>
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

        {/* 실시간 누적 (하단 고정) */}
        {realtimeListItem && (
          <div className="flex-shrink-0 p-2 border-t-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">실시간 방향별 누적</div>
            <table className="w-full text-xs">
              <thead className="bg-blue-100 dark:bg-blue-900/40">
                <tr>
                  <th className="px-2 py-1 text-left">방향</th>
                  <th className="px-2 py-1 text-left">총 차량 수</th>
                  <th className="px-2 py-1 text-left">차량 유형별</th>
                  <th className="px-2 py-1 text-left">평균 속도</th>
                  <th className="px-2 py-1 text-left">정체 시간</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-blue-100 dark:hover:bg-blue-900/40">
                  <td className="px-2 py-1 font-semibold text-emerald-500">상행</td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{dirMetrics.up.total}대</td>
                  <td className="px-2 py-1">
                    {Object.keys(dirMetrics.up.byType).length === 0 ? (
                      <span className="text-gray-400 dark:text-gray-500">데이터 없음</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(dirMetrics.up.byType).map(([type, count]) => (
                          <span key={`up-${type}`} className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 rounded">
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{dirMetrics.up.avgSpeed.toFixed(1)} km/h</td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{dirMetrics.up.avgDwell.toFixed(1)} s</td>
                </tr>
                <tr className="hover:bg-blue-100 dark:hover:bg-blue-900/40">
                  <td className="px-2 py-1 font-semibold text-blue-500">하행</td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{dirMetrics.down.total}대</td>
                  <td className="px-2 py-1">
                    {Object.keys(dirMetrics.down.byType).length === 0 ? (
                      <span className="text-gray-400 dark:text-gray-500">데이터 없음</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(dirMetrics.down.byType).map(([type, count]) => (
                          <span key={`down-${type}`} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 rounded">
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{dirMetrics.down.avgSpeed.toFixed(1)} km/h</td>
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{dirMetrics.down.avgDwell.toFixed(1)} s</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisListView;
