import React from "react";

interface CircularProgressProps {
  size?: number; // px 사이즈 인터페이스
  strokeWidth?: number;
  progress: number; // 0~100 게이지 인터페이스
}

export const CircularProgress: React.FC<CircularProgressProps> = ({ size = 48, strokeWidth = 4, progress }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(148,163,184,0.4)" // 배경 원
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(16, 185, 129, 0.9)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.15s linear" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.32} fill="#e5e7eb">
        {Math.round(clamped)}%
      </text>
    </svg>
  );
};
