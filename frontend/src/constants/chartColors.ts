// 차트 색상 상수

export const CHART_COLORS = {
  PRIMARY: 'rgb(59, 130, 246)',
  PRIMARY_ALPHA: 'rgba(59, 130, 246, 0.8)',
  PRIMARY_LIGHT: 'rgba(59, 130, 246, 0.1)',
  
  SECONDARY: 'rgb(156, 163, 175)',
  SECONDARY_ALPHA: 'rgba(156, 163, 175, 0.8)',
  
  SUCCESS: 'rgba(16, 185, 129, 0.8)',
  WARNING: 'rgba(245, 158, 11, 0.8)',
  DANGER: 'rgba(239, 68, 68, 0.8)',
  PURPLE: 'rgba(139, 92, 246, 0.8)',
  PINK: 'rgba(236, 72, 153, 0.8)',
} as const;

/**
 * 객체 유형별 차트 색상 배열
 */
export const OBJECT_TYPE_COLORS = [
  CHART_COLORS.PRIMARY_ALPHA,
  CHART_COLORS.SUCCESS,
  CHART_COLORS.WARNING,
  CHART_COLORS.DANGER,
  CHART_COLORS.PURPLE,
  CHART_COLORS.PINK,
] as const;

