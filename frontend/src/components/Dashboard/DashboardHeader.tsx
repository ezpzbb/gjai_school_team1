import React from 'react';
import { CCTV } from '../../types/cctv';
import { AnalyzedTimeRange } from '../../types/dashboard';
import { formatTimeRange } from '../../utils/dateUtils';

interface DashboardHeaderProps {
  favoriteCCTVs: CCTV[];
  selectedCctvId: number | null;
  onCctvChange: (cctvId: number | null) => void;
  availableTimeRanges: AnalyzedTimeRange[];
  selectedTimeRange: { start: string; end: string } | null;
  onTimeRangeChange: (timeRange: { start: string; end: string } | null) => void;
  isLoadingTimeRanges: boolean;
  onReportExport?: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  favoriteCCTVs,
  selectedCctvId,
  onCctvChange,
  availableTimeRanges,
  selectedTimeRange,
  onTimeRangeChange,
  isLoadingTimeRanges,
  onReportExport,
}) => {

  const getTimeRangeDisplay = (range: AnalyzedTimeRange): string => {
    const formatted = formatTimeRange(range.start, range.end);
    return `${formatted} (${range.frame_count}개 프레임 분석 완료)`;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
        {/* CCTV 선택 */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            CCTV 선택
          </label>
          <select
            value={selectedCctvId || ''}
            onChange={(e) => onCctvChange(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">CCTV를 선택하세요</option>
            {favoriteCCTVs.map((cctv) => (
              <option key={cctv.cctv_id} value={cctv.cctv_id}>
                {cctv.location} ⭐
              </option>
            ))}
          </select>
        </div>

        {/* 시간대 선택 */}
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            분석 완료 시간대 선택
          </label>
          <select
            value={selectedTimeRange ? `${selectedTimeRange.start}|${selectedTimeRange.end}` : ''}
            onChange={(e) => {
              if (e.target.value) {
                const [start, end] = e.target.value.split('|');
                onTimeRangeChange({ start, end });
              } else {
                onTimeRangeChange(null);
              }
            }}
            disabled={!selectedCctvId || isLoadingTimeRanges || availableTimeRanges.length === 0}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {isLoadingTimeRanges
                ? '시간대를 불러오는 중...'
                : availableTimeRanges.length === 0
                ? '분석 완료된 시간대가 없습니다'
                : '시간대를 선택하세요'}
            </option>
            {availableTimeRanges.map((range, index) => (
              <option key={index} value={`${range.start}|${range.end}`}>
                {getTimeRangeDisplay(range)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 보고서 출력 버튼 */}
      {onReportExport && (
        <button
          onClick={onReportExport}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition rounded-lg shadow flex-shrink-0"
        >
          보고서 출력
        </button>
      )}
    </div>
  );
};

export default React.memo(DashboardHeader);

