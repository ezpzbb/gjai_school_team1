import React from 'react';
import AnalyzedImageView from './AnalyzedImageView';
import AnalysisListView from './AnalysisListView';

interface AnalysisAreaProps {
  cctvId: number;
  cctvLocation: string;
}

const AnalysisArea: React.FC<AnalysisAreaProps> = ({ cctvId, cctvLocation }) => {

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {cctvLocation} 실시간 분석
        </h3>
      </div>

      {/* 좌우 분할 영역 - 높이 제한 및 내부 스크롤 */}
      <div className="flex-1 flex gap-2 min-h-0 max-h-full overflow-hidden items-stretch">
        {/* 좌측: 분석 이미지 (50%) - 우측과 같은 높이 유지 */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <AnalyzedImageView cctvId={cctvId} />
        </div>

        {/* 우측: 리스트 데이터 (50%) - 높이 제한 */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <AnalysisListView cctvId={cctvId} />
        </div>
      </div>
    </div>
  );
};

export default AnalysisArea;

