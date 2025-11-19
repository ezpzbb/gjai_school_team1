import React, { useMemo, useRef, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS } from 'chart.js';
import '../../utils/chartConfig'; // Chart.js 플러그인 등록
import { VehicleStatisticsPoint } from '../../types/dashboard';
import { formatTime } from '../../utils/dateUtils';
import { CHART_COLORS } from '../../constants/chartColors';
import ChartContainer from './ChartContainer';

interface VehicleCountChartProps {
  data: VehicleStatisticsPoint[];
  isLoading?: boolean;
}

const VehicleCountChart: React.FC<VehicleCountChartProps> = ({ data, isLoading = false }) => {
  const chartRef = useRef<ChartJS<'bar'>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartData = useMemo(() => ({
    labels: data.map((point) => formatTime(point.timestamp)),
    datasets: [
      {
        label: '차량 수',
        data: data.map((point) => point.vehicle_total),
        backgroundColor: CHART_COLORS.PRIMARY_ALPHA,
        borderColor: CHART_COLORS.PRIMARY,
        borderWidth: 1,
      },
      {
        label: '객체 수',
        data: data.map((point) => point.object_count),
        backgroundColor: CHART_COLORS.SECONDARY_ALPHA,
        borderColor: CHART_COLORS.SECONDARY,
        borderWidth: 1,
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
        text: '시간대별 차량 통계',
        font: {
          size: 14,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: '수량',
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
        <Bar ref={chartRef} data={chartData} options={options} />
      </div>
    </ChartContainer>
  );
};

export default VehicleCountChart;

