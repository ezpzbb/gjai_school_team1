/// <reference types="vite/client" />

import React, { useEffect, useRef, useState } from 'react';
import { CCTV } from '../types/cctv';
import { fetchCCTVLocations } from '../services/api';

// KakaoMap API 타입 정의
declare global {
  interface Window {
    kakao: any;
  }
}

interface KakaoMapProps {
  onMarkerClick: (apiEndpoint: string) => void;
}

const KakaoMap: React.FC<KakaoMapProps> = ({ onMarkerClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY;

  useEffect(() => {
    // CCTV 데이터 가져오기
    const loadCCTVLocations = async () => {
      try {
        const data = await fetchCCTVLocations();
        setCctvLocations(data);
      } catch (error) {
        console.error('Failed to load CCTV locations:', error);
      }
    };
    loadCCTVLocations();
  }, []);

  useEffect(() => {
    // KakaoMap SDK 로드
    if (window.kakao && window.kakao.maps && mapRef.current) {
      initializeMap();
      return;
    }

    const existingScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;
    const initializeMapHandler = () => {
      if (window.kakao && window.kakao.maps && mapRef.current) {
        window.kakao.maps.load(initializeMap);
      }
    };

    if (existingScript) {
      existingScript.addEventListener('load', initializeMapHandler);
    } else {
      const script = document.createElement('script');
      script.id = 'kakao-map-sdk';
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&autoload=false`;
      script.async = true;

      script.onload = initializeMapHandler;

      script.onerror = () => {
        console.error('Kakao Map SDK failed to load.');
      };

      document.head.appendChild(script);
    }

    return () => {
      if (existingScript instanceof HTMLScriptElement) {
        existingScript.removeEventListener('load', initializeMapHandler);
      }
    };
  }, [KAKAO_API_KEY, cctvLocations]);

  const initializeMap = () => {
    if (!mapRef.current || !window.kakao || !window.kakao.maps) return;

    const options = {
      center: new window.kakao.maps.LatLng(36.35, 127.38),
      level: 5,
    };
    const map = new window.kakao.maps.Map(mapRef.current, options);

    // CCTV 마커 추가
    cctvLocations.forEach((cctv) => {
      const markerPosition = new window.kakao.maps.LatLng(cctv.latitude, cctv.longitude);
      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        title: cctv.location,
      });

      marker.setMap(map);

      // 마커 클릭 이벤트
      window.kakao.maps.event.addListener(marker, 'click', () => {
        onMarkerClick(cctv.api_endpoint);
      });
    });
  };

  return <div ref={mapRef} style={{ width: '100%', height: '600px', border: '1px solid #ccc' }} />;
};

export default KakaoMap;