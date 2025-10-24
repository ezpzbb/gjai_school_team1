import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface CameraProps {
  apiEndpoint: string | null;
  location?: string;
  cctv_id: number; // cctv_id 추가
  isPopup?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const Camera: React.FC<CameraProps> = ({ apiEndpoint, location, cctv_id, isPopup, isFavorite, onToggleFavorite }) => {
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
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#333',
      }}>
        영상을 선택하려면 CCTV 마커를 클릭하세요.
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: '#f8f8f8',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {/* CCTV 위치 - 상단 */}
      <div style={{
        height: '40px',
        padding: '0 15px',
        backgroundColor: '#ffffffff',
        color: 'black',
        display: 'flex',
        alignItems: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        borderBottom: '1px solid #357abd',
      }}>
        📍 {location || 'CCTV 위치'}
      </div>

      {/* 실시간 영상 - 중앙 */}
      <div style={{
        flex: '1',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: '10px',
        minHeight: '160px',
      }}>
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          style={{
            width: isPopup ? '340px' : '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
          onError={(e) => console.error('Video loading error:', { apiEndpoint, cctv_id, error: e })}
        >
          브라우저가 비디오를 지원하지 않습니다.
        </video>
      </div>

      {/* 즐겨찾기 버튼 - 하단 */}
      <div style={{
        height: '40px',
        padding: '0 15px',
        backgroundColor: '#ffffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        borderTop: '1px solid #34495e',
      }}>
        <button
          onClick={onToggleFavorite}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f39c12',
            color: 'black',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {isFavorite ? '★ 즐겨찾기됨' : '☆ 즐겨찾기'}
        </button>
      </div>
    </div>
  );
};

export default Camera;