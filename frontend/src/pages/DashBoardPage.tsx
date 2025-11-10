import React from 'react';

const DashBoardPage: React.FC = () => {
  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-end mb-6">
          <button className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition rounded-lg shadow">
            보고서 출력
          </button>
        </div>

        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 p-8 text-center text-gray-500 dark:text-gray-300">
          대시보드 콘텐츠가 이 영역에 표시될 예정입니다.
        </div>
      </div>
    </div>
  );
};

export default DashBoardPage;
