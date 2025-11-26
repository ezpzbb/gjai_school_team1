import React, { useMemo, useRef, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { TooltipItem, Chart as ChartJS } from 'chart.js';
import '../../utils/chartConfig'; // Chart.js 플러그인 등록
import { DetectionStatistics } from '../../types/dashboard';
import { OBJECT_TYPE_COLORS } from '../../constants/chartColors';
import ChartContainer from './ChartContainer';

interface ObjectTypeChartProps {
  data: DetectionStatistics[];
  isLoading?: boolean;
}

const ObjectTypeChart: React.FC<ObjectTypeChartProps> = ({ data, isLoading = false }) => {
  const chartRef = useRef<ChartJS<'doughnut'>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartData = useMemo(() => {
    const colors = OBJECT_TYPE_COLORS.slice(0, data.length);
    return {
      labels: data.map((item) => item.object_text),
      datasets: [
        {
          data: data.map((item) => item.count),
          backgroundColor: colors,
          borderColor: colors.map((color) => color.replace('0.8', '1')),
          borderWidth: 2,
        },
      ],
    };
  }, [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 0,
    plugins: {
      legend: {
        display: true,
        position: 'right' as const,
      },
      title: {
        display: true,
        text: '객체 유형별 통계',
        font: {
          size: 14,
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: TooltipItem<'doughnut'>) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const dataset = context.dataset;
            const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${label}: ${value}개 (${percentage}%)`;
          },
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
        <Doughnut ref={chartRef} data={chartData} options={options} />
      </div>
    </ChartContainer>
  );
};

export default ObjectTypeChart;

