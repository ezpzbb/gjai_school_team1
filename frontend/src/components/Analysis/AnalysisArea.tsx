import React, { useState, useEffect, useMemo } from 'react';
import { socketService } from '../../services/socket';
import { VehicleUpdatePayload } from '../../types/vehicle';
import CongestionChart from '../Dashboard/CongestionChart';
import VehicleCountChart from '../Dashboard/VehicleCountChart';
import ObjectTypeChart from '../Dashboard/ObjectTypeChart';
import { CongestionDataPoint, VehicleStatisticsPoint, DetectionStatistics } from '../../types/dashboard';

interface AnalysisAreaProps {
  cctvId: number;
  cctvLocation: string;
}

const AnalysisArea: React.FC<AnalysisAreaProps> = ({ cctvId, cctvLocation }) => {
  // 실시간 데이터 수집
  const [vehicleUpdates, setVehicleUpdates] = useState<VehicleUpdatePayload[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);

  // 차트 데이터 변환
  const congestionData: CongestionDataPoint[] = useMemo(() => {
    // 차량 수를 기반으로 혼잡도 계산 (간단한 예시)
    const data: CongestionDataPoint[] = [];
    vehicleUpdates.forEach((update) => {
      const vehicleCount = update.detections.length;
      // 차량 수에 따라 혼잡도 레벨 계산 (0-100)
      let level = 0;
      if (vehicleCount > 20) level = 100;
      else if (vehicleCount > 15) level = 80;
      else if (vehicleCount > 10) level = 60;
      else if (vehicleCount > 5) level = 40;
      else if (vehicleCount > 0) level = 20;

      data.push({
        timestamp: new Date(update.timestamp * 1000).toISOString(), // 초를 밀리초로 변환 후 ISO 문자열로 변환
        level,
      });
    });
    return data;
  }, [vehicleUpdates]);

  // 차량 유형별 시간대별 통계 데이터 생성
  const vehicleData: VehicleStatisticsPoint[] = useMemo(() => {
    return vehicleUpdates.map((update) => {
      // 차량 유형 필터링 (한글 및 영어 모두 지원)
      const vehicleTypes = ['car', 'truck', 'bus', '승용차', '트럭', '버스', '오토바이(자전거)'];
      const vehicleCount = update.detections.filter((d) => 
        vehicleTypes.includes(d.cls)
      ).length;
      
      return {
        timestamp: new Date(update.timestamp * 1000).toISOString(), // 초를 밀리초로 변환 후 ISO 문자열로 변환
        vehicle_total: vehicleCount,
        object_count: update.detections.length,
      };
    });
  }, [vehicleUpdates]);

  // 차량 유형별 시간대별 통계 데이터 (차트용)
  const vehicleTypeData = useMemo(() => {
    // 차량 유형별로 시간대별 집계
    const typeMap: { [key: string]: { [timestamp: string]: number } } = {};
    const vehicleTypes = ['승용차', '버스', '트럭', '오토바이(자전거)', 'car', 'truck', 'bus'];
    
    vehicleUpdates.forEach((update) => {
      const timestamp = new Date(update.timestamp * 1000).toISOString();
      vehicleTypes.forEach((type) => {
        if (!typeMap[type]) {
          typeMap[type] = {};
        }
        const count = update.detections.filter((d) => d.cls === type).length;
        typeMap[type][timestamp] = (typeMap[type][timestamp] || 0) + count;
      });
    });

    // 모든 타임스탬프 수집
    const allTimestamps = new Set<string>();
    vehicleUpdates.forEach((update) => {
      allTimestamps.add(new Date(update.timestamp * 1000).toISOString());
    });
    const sortedTimestamps = Array.from(allTimestamps).sort();

    // 차량 유형별 데이터셋 생성
    return vehicleTypes
      .filter((type) => {
        // 한글 우선, 영어는 한글 매핑이 없을 때만 사용
        if (type === 'car' && typeMap['승용차']) return false;
        if (type === 'truck' && typeMap['트럭']) return false;
        if (type === 'bus' && typeMap['버스']) return false;
        return true;
      })
      .map((type) => ({
        label: type === 'car' ? '승용차' : type === 'truck' ? '트럭' : type === 'bus' ? '버스' : type,
        data: sortedTimestamps.map((ts) => typeMap[type]?.[ts] || 0),
        timestamps: sortedTimestamps,
      }))
      .filter((dataset) => dataset.data.some((count) => count > 0)); // 데이터가 있는 것만 표시
  }, [vehicleUpdates]);

  const detectionData: DetectionStatistics[] = useMemo(() => {
    const counts: { [key: string]: number } = {};
    vehicleUpdates.forEach((update) => {
      update.detections.forEach((det) => {
        // 차량 유형만 집계 (한글 및 영어 모두 지원)
        const vehicleTypes = ['car', 'truck', 'bus', '승용차', '트럭', '버스', '오토바이(자전거)'];
        if (vehicleTypes.includes(det.cls)) {
          counts[det.cls] = (counts[det.cls] || 0) + 1;
        }
      });
    });

    // 차량 유형별로 정렬 (승용차, 버스, 트럭, 오토바이 순서)
    const vehicleOrder = ['승용차', '버스', '트럭', '오토바이(자전거)', 'car', 'truck', 'bus'];
    return Object.entries(counts)
      .sort(([a], [b]) => {
        const indexA = vehicleOrder.indexOf(a);
        const indexB = vehicleOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
      .map(([cls, count]) => ({
        object_text: cls,
        count,
      }));
  }, [vehicleUpdates]);

  // Socket 구독
  useEffect(() => {
    if (!cctvId) {
      console.log('[AnalysisArea] cctvId가 없어서 구독을 시작하지 않습니다.');
      return;
    }

    console.log(`[AnalysisArea] CCTV ${cctvId}에 대한 vehicle-update 구독 시작`);
    setIsCollecting(true);
    const unsubscribe = socketService.onVehicleUpdate(cctvId, (payload: VehicleUpdatePayload) => {
      console.log(`[AnalysisArea] vehicle-update 수신: CCTV ${payload.cctvId}, 감지 수: ${payload.detections.length}`);
      setVehicleUpdates((prev) => {
        // 최근 100개만 유지
        const updated = [...prev, payload];
        return updated.slice(-100);
      });
    });

    return () => {
      console.log(`[AnalysisArea] CCTV ${cctvId}에 대한 vehicle-update 구독 해제`);
      unsubscribe();
      setIsCollecting(false);
    };
  }, [cctvId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* 헤더 */}
      <div className="flex-shrink-0 mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {cctvLocation} 실시간 분석
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <div
            className={`w-2 h-2 rounded-full ${isCollecting ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {isCollecting ? '데이터 수집 중...' : '대기 중'}
          </span>
          {vehicleUpdates.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-500">
              ({vehicleUpdates.length}개 데이터 수집됨)
            </span>
          )}
        </div>
      </div>

      {/* 데이터가 없을 때 */}
      {vehicleUpdates.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
          {isCollecting
            ? '분석 데이터를 수집하고 있습니다. 잠시만 기다려주세요...'
            : '분석 데이터가 아직 없습니다.'}
        </div>
      )}

      {/* 차트 영역 */}
      {vehicleUpdates.length > 0 && (
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
          {/* 큰 차트 - 혼잡도 */}
          <div className="flex-[2] min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
              <CongestionChart data={congestionData} isLoading={false} />
            </div>
          </div>

          {/* 작은 차트 2개 */}
          <div className="flex-[1] min-h-0 flex gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <VehicleCountChart data={vehicleData} vehicleTypeData={vehicleTypeData} isLoading={false} />
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex-1 min-h-0">
                <ObjectTypeChart data={detectionData} isLoading={false} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisArea;

