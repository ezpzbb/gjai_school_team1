import React from 'react';

interface ChartContainerProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  height?: string;
  children: React.ReactNode;
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  isLoading = false,
  isEmpty = false,
  emptyMessage = '데이터가 없습니다.',
  loadingMessage = '데이터를 불러오는 중...',
  height = '300px',
  children,
}) => {
  if (isLoading) {
    return (
      <div
        className="w-full flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg"
        style={{ height }}
      >
        <div className="text-gray-500 dark:text-gray-400">{loadingMessage}</div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className="w-full flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg"
        style={{ height }}
      >
        <div className="text-gray-500 dark:text-gray-400">{emptyMessage}</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ChartContainer;

