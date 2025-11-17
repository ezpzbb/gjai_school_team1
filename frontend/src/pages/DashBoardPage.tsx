import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../providers/DataProvider';
import {
  getAnalyzedTimeRanges,
  getCongestionData,
  getVehicleStatistics,
  getDetectionStatistics,
} from '../services/api';
import {
  AnalyzedTimeRange,
  CongestionDataPoint,
  VehicleStatisticsPoint,
  DetectionStatistics,
} from '../types/dashboard';
import DashboardHeader from '../components/Dashboard/DashboardHeader';
import CongestionChart from '../components/Dashboard/CongestionChart';
import VehicleCountChart from '../components/Dashboard/VehicleCountChart';
import ObjectTypeChart from '../components/Dashboard/ObjectTypeChart';

const DashBoardPage: React.FC = () => {
  const { favorites, getCctvById } = useData();

  // 즐겨찾기 CCTV 목록 (메모이제이션)
  const favoriteCCTVs = useMemo(
    () =>
      favorites
        .map((fav) => getCctvById(fav.cctv_id))
        .filter((cctv): cctv is NonNullable<typeof cctv> => Boolean(cctv)),
    [favorites, getCctvById]
  );

  // 상태 관리
  const [selectedCctvId, setSelectedCctvId] = useState<number | null>(null);
  const [availableTimeRanges, setAvailableTimeRanges] = useState<AnalyzedTimeRange[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<{ start: string; end: string } | null>(null);

  // 차트 데이터 상태
  const [congestionData, setCongestionData] = useState<CongestionDataPoint[]>([]);
  const [vehicleData, setVehicleData] = useState<VehicleStatisticsPoint[]>([]);
  const [detectionData, setDetectionData] = useState<DetectionStatistics[]>([]);

  // 개별 로딩 상태
  const [isLoadingTimeRanges, setIsLoadingTimeRanges] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    congestion: false,
    vehicles: false,
    detections: false,
  });

  // 개별 에러 상태
  const [error, setError] = useState<string | null>(null);
  const [chartErrors, setChartErrors] = useState({
    congestion: null as string | null,
    vehicles: null as string | null,
    detections: null as string | null,
  });

  // CCTV 선택 시 시간대 목록 조회
  useEffect(() => {
    if (!selectedCctvId) {
      setAvailableTimeRanges([]);
      setSelectedTimeRange(null);
      return;
    }

    const fetchTimeRanges = async () => {
      setIsLoadingTimeRanges(true);
      setError(null);
      try {
        const timeRanges = await getAnalyzedTimeRanges(selectedCctvId);
        setAvailableTimeRanges(timeRanges || []);
        // 시간대 선택 초기화
        setSelectedTimeRange(null);
        
        // 데이터가 없을 때는 에러가 아닌 정보 메시지
        if (!timeRanges || timeRanges.length === 0) {
          console.log('분석 완료된 시간대가 없습니다.');
        }
      } catch (err: any) {
        console.error('시간대 목록 조회 실패:', err);
        // 500 에러인 경우 서버 오류로 표시
        if (err.message?.includes('500')) {
          setError(`서버 오류가 발생했습니다. 분석된 데이터가 없을 수 있습니다.`);
        } else {
          setError(`시간대 목록을 불러오지 못했습니다: ${err.message}`);
        }
        setAvailableTimeRanges([]);
      } finally {
        setIsLoadingTimeRanges(false);
      }
    };

    fetchTimeRanges();
  }, [selectedCctvId]);

  // 시간대 선택 시 차트 데이터 조회 (개별 에러 처리)
  useEffect(() => {
    if (!selectedCctvId || !selectedTimeRange) {
      setCongestionData([]);
      setVehicleData([]);
      setDetectionData([]);
      setChartErrors({ congestion: null, vehicles: null, detections: null });
      return;
    }

    const fetchChartData = async () => {
      // 초기화
      setError(null);
      setChartErrors({ congestion: null, vehicles: null, detections: null });
      setLoadingStates({ congestion: true, vehicles: true, detections: true });

      // 혼잡도 데이터 조회
      const fetchCongestion = async () => {
        try {
          setLoadingStates((prev) => ({ ...prev, congestion: true }));
          const data = await getCongestionData(selectedCctvId, selectedTimeRange.start, selectedTimeRange.end);
          setCongestionData(data);
          setChartErrors((prev) => ({ ...prev, congestion: null }));
        } catch (err: any) {
          console.error('혼잡도 데이터 조회 실패:', err);
          setChartErrors((prev) => ({
            ...prev,
            congestion: `혼잡도 데이터를 불러오지 못했습니다: ${err.message}`,
          }));
          setCongestionData([]);
        } finally {
          setLoadingStates((prev) => ({ ...prev, congestion: false }));
        }
      };

      // 차량 통계 데이터 조회
      const fetchVehicles = async () => {
        try {
          setLoadingStates((prev) => ({ ...prev, vehicles: true }));
          const data = await getVehicleStatistics(selectedCctvId, selectedTimeRange.start, selectedTimeRange.end);
          setVehicleData(data);
          setChartErrors((prev) => ({ ...prev, vehicles: null }));
        } catch (err: any) {
          console.error('차량 통계 데이터 조회 실패:', err);
          setChartErrors((prev) => ({
            ...prev,
            vehicles: `차량 통계 데이터를 불러오지 못했습니다: ${err.message}`,
          }));
          setVehicleData([]);
        } finally {
          setLoadingStates((prev) => ({ ...prev, vehicles: false }));
        }
      };

      // 객체 유형 통계 데이터 조회
      const fetchDetections = async () => {
        try {
          setLoadingStates((prev) => ({ ...prev, detections: true }));
          const data = await getDetectionStatistics(selectedCctvId, selectedTimeRange.start, selectedTimeRange.end);
          setDetectionData(data);
          setChartErrors((prev) => ({ ...prev, detections: null }));
        } catch (err: any) {
          console.error('객체 유형 통계 데이터 조회 실패:', err);
          setChartErrors((prev) => ({
            ...prev,
            detections: `객체 유형 통계 데이터를 불러오지 못했습니다: ${err.message}`,
          }));
          setDetectionData([]);
        } finally {
          setLoadingStates((prev) => ({ ...prev, detections: false }));
        }
      };

      // 병렬로 실행하되 각각 독립적으로 에러 처리
      await Promise.allSettled([fetchCongestion(), fetchVehicles(), fetchDetections()]);
    };

    fetchChartData();
  }, [selectedCctvId, selectedTimeRange]);

  const handleReportExport = useCallback(() => {
    // TODO: 보고서 출력 기능 구현
    alert('보고서 출력 기능은 추후 구현 예정입니다.');
  }, []);

  return (
    <div className="h-[calc(100vh-4rem-1rem)] flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="flex-1 flex flex-col p-3 min-h-0 overflow-hidden">
        {/* 헤더 */}
        <div className="mb-2 flex-shrink-0">
          <DashboardHeader
            favoriteCCTVs={favoriteCCTVs}
            selectedCctvId={selectedCctvId}
            onCctvChange={setSelectedCctvId}
            availableTimeRanges={availableTimeRanges}
            selectedTimeRange={selectedTimeRange}
            onTimeRangeChange={setSelectedTimeRange}
            isLoadingTimeRanges={isLoadingTimeRanges}
            onReportExport={handleReportExport}
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg text-xs flex-shrink-0">
            {error}
          </div>
        )}

        {/* 빈 상태 */}
        {!selectedCctvId && (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 text-gray-500 dark:text-gray-300 min-h-0">
            CCTV를 선택해주세요.
          </div>
        )}

        {selectedCctvId && !selectedTimeRange && !isLoadingTimeRanges && (
          <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 text-gray-500 dark:text-gray-300 min-h-0">
            {availableTimeRanges.length === 0
              ? '선택한 CCTV에 분석 완료된 시간대가 없습니다.'
              : '분석 완료 시간대를 선택해주세요.'}
          </div>
        )}

        {/* 차트 영역 */}
        {selectedCctvId && selectedTimeRange && (
          <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
            {/* 큰 차트 - 혼잡도 */}
            <div className="flex-[2] min-h-0 flex flex-col">
              {chartErrors.congestion && (
                <div className="mb-1 p-1.5 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 rounded text-xs flex-shrink-0">
                  {chartErrors.congestion}
                  <button
                    onClick={() => {
                      const fetchCongestion = async () => {
                        try {
                          setLoadingStates((prev) => ({ ...prev, congestion: true }));
                          const data = await getCongestionData(selectedCctvId, selectedTimeRange.start, selectedTimeRange.end);
                          setCongestionData(data);
                          setChartErrors((prev) => ({ ...prev, congestion: null }));
                        } catch (err: any) {
                          setChartErrors((prev) => ({
                            ...prev,
                            congestion: `재시도 실패: ${err.message}`,
                          }));
                        } finally {
                          setLoadingStates((prev) => ({ ...prev, congestion: false }));
                        }
                      };
                      fetchCongestion();
                    }}
                    className="ml-2 underline"
                  >
                    재시도
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <CongestionChart data={congestionData} isLoading={loadingStates.congestion} />
              </div>
            </div>

            {/* 작은 차트 2개 */}
            <div className="flex-[1] min-h-0 flex gap-2">
              <div className="flex-1 min-w-0 flex flex-col">
                {chartErrors.vehicles && (
                  <div className="mb-1 p-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 rounded text-xs flex-shrink-0">
                    {chartErrors.vehicles}
                    <button
                      onClick={() => {
                        const fetchVehicles = async () => {
                          try {
                            setLoadingStates((prev) => ({ ...prev, vehicles: true }));
                            const data = await getVehicleStatistics(selectedCctvId, selectedTimeRange.start, selectedTimeRange.end);
                            setVehicleData(data);
                            setChartErrors((prev) => ({ ...prev, vehicles: null }));
                          } catch (err: any) {
                            setChartErrors((prev) => ({
                              ...prev,
                              vehicles: `재시도 실패: ${err.message}`,
                            }));
                          } finally {
                            setLoadingStates((prev) => ({ ...prev, vehicles: false }));
                          }
                        };
                        fetchVehicles();
                      }}
                      className="ml-2 underline"
                    >
                      재시도
                    </button>
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <VehicleCountChart data={vehicleData} isLoading={loadingStates.vehicles} />
                </div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                {chartErrors.detections && (
                  <div className="mb-1 p-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 rounded text-xs flex-shrink-0">
                    {chartErrors.detections}
                    <button
                      onClick={() => {
                        const fetchDetections = async () => {
                          try {
                            setLoadingStates((prev) => ({ ...prev, detections: true }));
                            const data = await getDetectionStatistics(selectedCctvId, selectedTimeRange.start, selectedTimeRange.end);
                            setDetectionData(data);
                            setChartErrors((prev) => ({ ...prev, detections: null }));
                          } catch (err: any) {
                            setChartErrors((prev) => ({
                              ...prev,
                              detections: `재시도 실패: ${err.message}`,
                            }));
                          } finally {
                            setLoadingStates((prev) => ({ ...prev, detections: false }));
                          }
                        };
                        fetchDetections();
                      }}
                      className="ml-2 underline"
                    >
                      재시도
                    </button>
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <ObjectTypeChart data={detectionData} isLoading={loadingStates.detections} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashBoardPage;
