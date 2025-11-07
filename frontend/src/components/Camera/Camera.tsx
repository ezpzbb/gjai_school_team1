import React, { useEffect, useRef } from 'react';

interface CameraProps {
  apiEndpoint: string | null;
  location?: string;
  cctv_id: number;
  isPopup?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClose?: () => void; // 닫기 버튼을 위한 콜백 추가
  onExpand?: () => void; // 크게보기 버튼을 위한 콜백 추가
  isExpanded?: boolean; // 확대 상태인지 여부
  isPlacementMode?: boolean; // 배치 모드인지 여부 (크게보기 버튼 비활성화)
  pageType?: 'kakao-map' | 'favorite'; // 페이지 타입
}

const Camera: React.FC<CameraProps> = ({
  apiEndpoint,
  location,
  cctv_id,
  isPopup,
  isFavorite,
  onToggleFavorite,
  onClose,
  onExpand,
  isExpanded,
  isPlacementMode = false,
  pageType,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 컨테이너 크기에 맞춰 비율 계산 (UTIC 페이지의 상단 바 높이 약 50px 고려)
  const [scale, setScale] = React.useState(1);
  const [translateY, setTranslateY] = React.useState(0);
  const initialContainerSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      // 초기 컨테이너 크기 저장 (처음 한 번만)
      const rect = container.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        return;
      }
      
      // 초기 크기를 저장하고, 이후에는 이 크기 기준으로만 scale 계산
      if (!initialContainerSizeRef.current) {
        initialContainerSizeRef.current = {
          width: rect.width,
          height: rect.height,
        };
        console.log('Camera: Initial container size saved', initialContainerSizeRef.current);
      }
      
      // scale 계산은 항상 초기 크기 기준 (축소/확대 시에도 동일한 scale 유지)
      const containerWidth = initialContainerSizeRef.current.width;
      const containerHeight = initialContainerSizeRef.current.height;
      
      // iframe 내부 HTML 구조 분석:
      // - <p class="hd">: 상단 바 (닫기 버튼 포함) - 높이 약 40-50px
      // - <div class="cctv_area player">: video 영역 (320x240px)
      // - <p class="bot03">, <p class="bot02">: 하단 텍스트들
      
      const uticTopBarHeight = 45; // 상단 바 높이 (<p class="hd">) - 실제 측정값에 맞게 조정
      const videoWidth = 320; // video 영역 너비 (<div class="cctv_area player">)
      const videoHeight = 240; // video 영역 높이

      // objectFit: 'contain' 방식 - 영상 전체가 보이도록 (안 잘리게)
      const scaleByWidth = containerWidth / videoWidth;
      const scaleByHeight = containerHeight / videoHeight;
      
      // 작은 scale 사용 = contain 방식 (영상 안 잘림)
      const baseScale = Math.min(scaleByWidth, scaleByHeight);
      
      // 페이지별로 다른 설정 적용
      let zoomAdjust = 1.0; // 기본값: 확대 안 함
      let additionalOffset = 25;
      
      if (pageType === 'kakao-map') {
        // 카카오맵: 줌 더 + 좌상단으로 이동
        zoomAdjust = 1.18;
        additionalOffset = 21.5;
      } else if (pageType === 'favorite') {
        // Favorite: 원래 맞춰놓은 비율 유지
        zoomAdjust = 1.1;
        additionalOffset = 30;
      }
      
      const calculatedScale = baseScale * zoomAdjust;

      // 상단바를 위로 밀어서 숨김 + 위치 조정
      const scaledTopBarHeight = uticTopBarHeight * calculatedScale;
      const calculatedTranslateY = -((scaledTopBarHeight - additionalOffset) / containerHeight) * 100;

      console.log('Camera: Scale calculation', {
        pageType: pageType || 'unknown',
        initialSize: `${containerWidth.toFixed(0)}x${containerHeight.toFixed(0)}`,
        currentSize: `${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`,
        finalScale: calculatedScale.toFixed(3),
        translateY: calculatedTranslateY.toFixed(2) + '%',
      });

      setScale(calculatedScale);
      setTranslateY(calculatedTranslateY);
    };

    // pageType 변경 또는 apiEndpoint 변경 시 초기 크기 리셋하고 재계산
    initialContainerSizeRef.current = null;
    
    // 초기 계산
    let retryCount = 0;
    const maxRetries = 10;
    
    const tryUpdateScale = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        updateScale();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryUpdateScale, 100);
      }
    };

    tryUpdateScale();
    
    const timeoutId = setTimeout(() => {
      tryUpdateScale();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [apiEndpoint, pageType]);

  if (!apiEndpoint) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#333',
        }}
      >
        영상을 선택하려면 CCTV 마커를 클릭하세요.
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255, 255, 255, 0.01)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 닫기 버튼 */}
      {isPopup && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#ff4444',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            cursor: 'pointer',
            zIndex: '20',
          }}
        >
          ×
        </button>
      )}

      {/* CCTV 위치 - 상단 */}
      <div
        style={{
          height: '40px',
          padding: '0 15px',
          background: 'rgba(255, 255, 255, 0.015)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          color: 'black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '14px',
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(53, 122, 189, 0.1)',
        }}
      >
        <span>📍 {location || 'CCTV 위치'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 크게보기 버튼 */}
          {onExpand && !isExpanded && (
            <button
              onClick={(e) => {
                if (isPlacementMode) return;
                e.stopPropagation();
                onExpand();
              }}
              disabled={isPlacementMode}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: isPlacementMode ? 'rgba(255, 255, 255, 0.5)' : 'white',
                background: isPlacementMode ? 'rgba(156, 163, 175, 0.5)' : 'rgba(53, 122, 189, 0.8)',
                border: 'none',
                borderRadius: '6px',
                cursor: isPlacementMode ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'scale(1)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                opacity: isPlacementMode ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isPlacementMode) {
                  e.currentTarget.style.background = 'rgba(37, 99, 235, 1)';
                  e.currentTarget.style.transform = 'scale(1.08)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(53, 122, 189, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPlacementMode) {
                  e.currentTarget.style.background = 'rgba(53, 122, 189, 0.8)';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              크게보기
            </button>
          )}
          {/* 되돌리기 버튼 */}
          {onExpand && isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: 'white',
                background: 'rgba(107, 114, 128, 0.8)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'scale(1)',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(75, 85, 99, 1)';
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(107, 114, 128, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
            >
              되돌리기
            </button>
          )}
        </div>
      </div>

      {/* 실시간 영상 - 상단 정렬 */}
      <div
        ref={containerRef}
        style={{
          flex: '1',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#000',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
          aspectRatio: '16/9',
        }}
      >
        {/* 고정 크기 wrapper - 영상과 버튼을 함께 포함 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '640px',
            height: 'auto',
            aspectRatio: '16/9',
            overflow: 'hidden',
          }}
        >
          {/* UTIC URL (경찰청 CCTV) - iframe으로 표시 */}
          <iframe
            src={apiEndpoint || ''}
            style={{
              width: '640px',
              height: '480px',
              border: 'none',
              display: 'block',
              transform: `scale(${scale}) translateY(${translateY}%) ${pageType === 'kakao-map' ? 'translateX(-18%)' : ''}`,
              transformOrigin: 'center top',
            }}
            allow="autoplay; fullscreen"
            title={`CCTV ${location || cctv_id}`}
          />
          
          {/* 즐겨찾기 버튼 - wrapper 기준 고정 */}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: 'white',
                background: isFavorite ? 'rgba(234, 179, 8, 0.9)' : 'rgba(156, 163, 175, 0.8)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: 'scale(1)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                zIndex: 10000,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isFavorite ? 'rgba(234, 179, 8, 1)' : 'rgba(107, 114, 128, 1)';
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = `0 4px 12px ${isFavorite ? 'rgba(234, 179, 8, 0.5)' : 'rgba(107, 114, 128, 0.5)'}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isFavorite ? 'rgba(234, 179, 8, 0.9)' : 'rgba(156, 163, 175, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
              }}
            >
              {isFavorite ? '★' : '☆'} 즐겨찾기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Camera;