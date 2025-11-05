import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

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
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    console.log('Camera: Received apiEndpoint:', apiEndpoint, 'cctv_id:', cctv_id);
    if (!apiEndpoint || !videoRef.current) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(apiEndpoint);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS error:', {
          apiEndpoint,
          cctv_id,
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          error: data,
        });
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = apiEndpoint;
      videoRef.current.play().catch((error) => {
        console.error('Video play error:', { apiEndpoint, cctv_id, error });
      });
    } else {
      console.error('HLS is not supported in this browser.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [apiEndpoint, cctv_id]);

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
        position: 'relative', // 닫기 버튼을 절대 위치로 배치하기 위해
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

      {/* 실시간 영상 - 중앙 */}
      <div
        style={{
          flex: '1',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
          aspectRatio: '16/9', // 모든 CCTV 화면을 16:9 비율로 통일
        }}
      >
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain', // 비디오 전체가 보이도록 하되, 여백은 검은색으로 표시
            display: 'block',
          }}
          onError={(e) => console.error('Video loading error:', { apiEndpoint, cctv_id, error: e })}
        >
          브라우저가 비디오를 지원하지 않습니다.
        </video>
        
        {/* 즐겨찾기 버튼 - 우측 하단 */}
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
              zIndex: 10,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
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
  );
};

export default Camera;