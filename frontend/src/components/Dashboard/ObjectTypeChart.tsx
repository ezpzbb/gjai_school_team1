import React, { useMemo, useRef, useEffect } from "react";
import { Chart as ChartComponent } from "react-chartjs-2";
import { ChartData, Chart as ChartJS, ChartOptions } from "chart.js";
import "../../utils/chartConfig"; // Chart.js 플러그인 등록
import { DetectionStatistics } from "../../types/dashboard";
import { CHART_COLORS } from "../../constants/chartColors";
import ChartContainer from "./ChartContainer";

interface ObjectTypeChartProps {
  data: DetectionStatistics[];
  isLoading?: boolean;
}

const ObjectTypeChart: React.FC<ObjectTypeChartProps> = ({ data, isLoading = false }) => {
  const chartRef = useRef<ChartJS<"bar" | "line">>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartData = useMemo<ChartData<"bar" | "line">>(
    () => ({
      labels: data.map((d) => d.object_text),
      datasets: [
        {
          type: "bar",
          label: "평균 속도 (km/h)",
          data: data.map((d) => d.avg_speed_kmh ?? 0),
          backgroundColor: CHART_COLORS.PRIMARY_LIGHT,
          borderColor: CHART_COLORS.PRIMARY,
          borderWidth: 1.5,
          yAxisID: "ySpeed",
          barPercentage: 0.6,
        },
        {
          type: "line",
          label: "정체 시간 (분)",
          data: data.map((d) => (d.congestion_time_sec ?? 0) / 60),
          borderColor: CHART_COLORS.WARNING,
          backgroundColor: CHART_COLORS.WARNING,
          pointRadius: 4,
          tension: 0.35,
          fill: false,
          yAxisID: "yCongestion",
        },
      ],
    }),
    [data]
  );

  const options = useMemo<ChartOptions<"bar" | "line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top" },
        title: { display: true, text: "객체별 평균 속도 / 정체 시간" },
        tooltip: {
          callbacks: {
            label: (ctx) => (ctx.datasetIndex === 0 ? `평균 속도: ${ctx.formattedValue} km/h` : `정체 시간: ${ctx.formattedValue}분`),
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "객체 유형" } },
        ySpeed: { type: "linear", position: "left", title: { display: true, text: "평균 속도 (km/h)" }, min: 0 },
        yCongestion: { type: "linear", position: "right", title: { display: true, text: "정체 시간 (분)" }, min: 0, grid: { drawOnChartArea: false } },
      },
    }),
    []
  );

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
    window.addEventListener("resize", handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  return (
    <ChartContainer isLoading={isLoading} isEmpty={data.length === 0} height="100%">
      <div ref={containerRef} className="w-full h-full bg-white dark:bg-gray-800 rounded-lg p-3">
        <ChartComponent type="bar" ref={chartRef} data={chartData} options={options} />
      </div>
    </ChartContainer>
  );
};

export default ObjectTypeChart;
