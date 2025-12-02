import React, { useMemo, useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js';
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
  const chartRef = useRef<ChartJS<'line'>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
    resizeDelay: 0,
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

  // 리사이즈 감지 및 차트 업데이트
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    });

    resizeObserver.observe(container);

    // window resize 이벤트도 감지 (추가 보완)
    const handleWindowResize = () => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  return (
    <ChartContainer
      isLoading={isLoading}
      isEmpty={data.length === 0}
      height="100%"
    >
      <div ref={containerRef} className="w-full h-full bg-white dark:bg-gray-800 rounded-lg p-3">
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </ChartContainer>
  );
};

export default CongestionChart;

