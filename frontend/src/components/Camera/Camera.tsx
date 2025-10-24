import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface CameraProps {
  apiEndpoint: string | null;
}

const Camera: React.FC<CameraProps> = ({ apiEndpoint }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null); // Hls 인스턴스 저장

  useEffect(() => {
    console.log('Camera: Received apiEndpoint:', apiEndpoint);
    if (!apiEndpoint || !videoRef.current) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls; // Hls 인스턴스 저장
      hls.loadSource(apiEndpoint);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS error:', {
          apiEndpoint,
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          error: data,
        });
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = apiEndpoint;
      videoRef.current.play().catch((error) => {
        console.error('Video play error:', { apiEndpoint, error });
      });
    } else {
      console.error('HLS is not supported in this browser.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy(); // 실제 사용 중인 Hls 인스턴스 정리
        hlsRef.current = null;
      }
    };
  }, [apiEndpoint]);

  if (!apiEndpoint) {
    return (
      <div style={{ padding: '20px', border: '1px solid #ccc', marginTop: '10px' }}>
        <h3>CCTV 영상</h3>
        <p>영상을 선택하려면 지도에서 CCTV 마커를 클릭하세요.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', marginTop: '10px' }}>
      <h3>CCTV 영상</h3>
      <video
        ref={videoRef}
        controls
        autoPlay
        muted
        style={{ width: '100%', maxHeight: '400px' }}
        onError={(e) => console.error('Video loading error:', { apiEndpoint, error: e })}
      >
        브라우저가 비디오를 지원하지 않습니다.
      </video>
    </div>
  );
};

export default Camera;