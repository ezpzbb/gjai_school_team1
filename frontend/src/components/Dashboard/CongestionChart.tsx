import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import '../../utils/chartConfig'; // Chart.js 플러그인 등록
import { CongestionDataPoint } from '../../types/dashboard';
import { formatTime } from '../../utils/dateUtils';
import { CHART_COLORS } from '../../constants/chartColors';
import ChartContainer from './ChartContainer';

interface CongestionChartProps {
  data: CongestionDataPoint[];
  isLoading?: boolean;
}

const CongestionChart: React.FC<CongestionChartProps> = ({ data, isLoading = false }) => {
  const chartData = useMemo(() => ({
    labels: data.map((point) => formatTime(point.timestamp)),
    datasets: [
      {
        label: '혼잡도',
        data: data.map((point) => point.level),
        borderColor: CHART_COLORS.PRIMARY,
        backgroundColor: CHART_COLORS.PRIMARY_LIGHT,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  }), [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '시간대별 혼잡도 추이',
        font: {
          size: 16,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: '혼잡도 (%)',
        },
      },
      x: {
        title: {
          display: true,
          text: '시간',
        },
      },
    },
  }), []);

  return (
    <ChartContainer
      isLoading={isLoading}
      isEmpty={data.length === 0}
      height="100%"
    >
      <div className="w-full h-full bg-white dark:bg-gray-800 rounded-lg p-3">
        <Line data={chartData} options={options} />
      </div>
    </ChartContainer>
  );
};

export default CongestionChart;

