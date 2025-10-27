/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import { fetchCCTVLocations, getUserFavorites, addFavorite, removeFavorite } from '../services/api';
import Camera from './Camera/Camera';

interface KakaoMap {
  LatLng: new (lat: number, lng: number) => any;
  Map: new (container: HTMLElement, options: any) => any;
  Marker: new (options: any) => any;
  CustomOverlay: new (options: any) => any;
  event: {
    addListener: (target: any, event: string, callback: () => void) => void;
  };
}

interface KakaoMaps {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => any;
    Map: new (container: HTMLElement, options: any) => any;
    Marker: new (options: any) => any;
    CustomOverlay: new (options: any) => any;
    event: {
      addListener: (target: any, event: string, callback: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    kakao: KakaoMaps;
  }
}

const KakaoMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<number | null>(null); // 클릭 중인 cctv_id
  const overlayRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY as string;

  const toggleFavorite = async (cctv_id: number) => {
    if (isToggling !== null) {
      console.log('KakaoMap: Toggle in progress, ignoring click for cctv_id:', cctv_id);
      return;
    }
    setIsToggling(cctv_id);
    console.log('KakaoMap: toggleFavorite called', { cctv_id });
    try {
      // 서버에서 최신 즐겨찾기 상태 확인
      const currentFavorites = await getUserFavorites();
      const isFavorite = currentFavorites.some((fav: Favorite) => fav.cctv_id === cctv_id);
      console.log('KakaoMap: Current favorite status for cctv_id:', cctv_id, isFavorite);

      if (isFavorite) {
        await removeFavorite(cctv_id);
        console.log('KakaoMap: Removed favorite for cctv_id:', cctv_id);
      } else {
        await addFavorite(cctv_id);
        console.log('KakaoMap: Added favorite for cctv_id:', cctv_id);
      }
      // 최신 즐겨찾기 목록으로 상태 갱신
      const updatedFavorites = await getUserFavorites();
      setFavorites(updatedFavorites);
      console.log('KakaoMap: Updated favorites:', updatedFavorites);
    } catch (error: any) {
      console.error('KakaoMap: Failed to toggle favorite for cctv_id:', cctv_id, error);
      setError(`즐겨찾기 처리 중 오류: ${error.message}`);
    } finally {
      setIsToggling(null);
    }
  };

  const loadData = async (retries = 3, delay = 2000) => {
    console.log('KakaoMap: loadData started');
    try {
      const [cctvResponse, favoriteData] = await Promise.all([
        fetchCCTVLocations(),
        getUserFavorites(),
      ]);
      console.log('KakaoMap: CCTV locations fetched:', cctvResponse);
      console.log('KakaoMap: User favorites fetched:', favoriteData);
      setCctvLocations(cctvResponse.data);
      setFavorites(favoriteData);
      setError(null);
    } catch (error: any) {
      console.error('KakaoMap: Failed to load data:', error);
      if (error.message.includes('429') && retries > 0) {
        console.log(`KakaoMap: Retrying loadData (${retries} retries left)...`);
        setTimeout(() => loadData(retries - 1, delay), delay);
      } else {
        setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  useEffect(() => {
    console.log('KakaoMap: loadData triggered');
    loadData();
  }, []);

  useEffect(() => {
    console.log('KakaoMap: Checking mapRef:', !!mapRef.current, 'KAKAO_API_KEY:', !!KAKAO_API_KEY);
    const loadKakaoScript = (retries = 3, delay = 1000) => {
      if (!KAKAO_API_KEY) {
        console.error('KakaoMap: KAKAO_API_KEY is not defined in .env');
        setError('지도 API 키가 설정되지 않았습니다.');
        return;
      }

      if (window.kakao && window.kakao.maps) {
        console.log('KakaoMap: Kakao Maps SDK already loaded');
        window.kakao.maps.load(() => {
          if (mapRef.current) {
            console.log('KakaoMap: Map container found, initializing map');
            initializeMap();
          } else {
            console.error('KakaoMap: Map container not found');
            setError('지도 컨테이너를 찾을 수 없습니다.');
          }
        });
        return;
      }

      const existingScript = document.getElementById('kakao-map-sdk');
      if (existingScript) {
        console.log('KakaoMap: Kakao Maps SDK script already exists, waiting for load');
        existingScript.addEventListener('load', initializeMapHandler);
        return;
      }

      console.log('KakaoMap: Loading Kakao Maps SDK');
      const script = document.createElement('script');
      script.id = 'kakao-map-sdk';
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&autoload=false`;
      script.async = true;
      script.onload = () => {
        console.log('KakaoMap: Kakao Maps SDK script loaded');
        initializeMapHandler();
      };
      script.onerror = () => {
        console.error(`KakaoMap: Failed to load Kakao Map SDK. Retrying (${retries} left)...`);
        if (retries > 0) {
          setTimeout(() => loadKakaoScript(retries - 1, delay), delay);
        } else {
          setError('지도 SDK를 로드하지 못했습니다.');
        }
      };
      document.head.appendChild(script);
    };

    const initializeMapHandler = () => {
      console.log('KakaoMap: initializeMapHandler called');
      if (!window.kakao || !window.kakao.maps) {
        console.error('KakaoMap: Kakao Maps SDK not loaded');
        setError('지도 SDK가 로드되지 않았습니다.');
        return;
      }
      window.kakao.maps.load(() => {
        console.log('KakaoMap: Kakao Maps SDK loaded');
        if (mapRef.current) {
          console.log('KakaoMap: Map container found, initializing map');
          initializeMap();
        } else {
          console.error('KakaoMap: Map container not found');
          setError('지도 컨테이너를 찾을 수 없습니다.');
        }
      });
    };

    console.log('KakaoMap: Component mounted');
    loadKakaoScript();

    return () => {
      console.log('KakaoMap: Component unmounted');
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      mapInstance.current = null;
      const script = document.getElementById('kakao-map-sdk');
      if (script) {
        script.remove();
      }
    };
  }, [KAKAO_API_KEY]);

  useEffect(() => {
    console.log('KakaoMap: cctvLocations updated:', cctvLocations);
    if (mapInstance.current && cctvLocations.length > 0) {
      console.log('KakaoMap: Updating markers');
      updateMarkers();
    } else if (mapInstance.current && cctvLocations.length === 0) {
      console.warn('KakaoMap: No CCTV locations to display markers');
    }
  }, [cctvLocations, favorites]); // favorites 의존성 추가

  const initializeMap = () => {
    if (!mapRef.current || !window.kakao || !window.kakao.maps) {
      console.error('KakaoMap: Cannot initialize map: SDK or container missing', {
        mapRef: !!mapRef.current,
        kakao: !!window.kakao,
        kakaoMaps: !!window.kakao?.maps,
      });
      setError('지도 초기화에 실패했습니다.');
      return;
    }

    const options = {
      center: new window.kakao.maps.LatLng(36.35, 127.38),
      level: 5,
    };
    try {
      console.log('KakaoMap: Initializing Kakao Map');
      const map = new window.kakao.maps.Map(mapRef.current, options);
      mapInstance.current = map;
      console.log('KakaoMap: Map initialized successfully');
      if (cctvLocations.length > 0) {
        updateMarkers();
      } else {
        console.warn('KakaoMap: No CCTV locations available for markers');
      }
    } catch (error) {
      console.error('KakaoMap: Failed to initialize Kakao Map:', error);
      setError('지도 초기화 중 오류가 발생했습니다.');
    }
  };

  const updateMarkers = () => {
    if (!window.kakao || !window.kakao.maps || !mapInstance.current) {
      console.error('KakaoMap: Cannot update markers: SDK or map instance missing');
      return;
    }

    console.log('KakaoMap: Updating markers for CCTV locations:', cctvLocations);
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }

    cctvLocations.forEach((cctv) => {
      const markerPosition = new window.kakao.maps.LatLng(cctv.latitude, cctv.longitude);
      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        title: cctv.location,
      });

      marker.setMap(mapInstance.current);
      markersRef.current.push(marker);

      window.kakao.maps.event.addListener(marker, 'click', () => {
        if (overlayRef.current) {
          overlayRef.current.setMap(null);
          overlayRef.current = null;
        }

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.zIndex = '10';
        container.style.background = '#f8f8f8';
        container.style.border = '2px solid #333';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        container.style.width = '400px';
        container.style.height = '300px';
        container.style.padding = '5px';

        const root = createRoot(container);
        root.render(
          <Camera
            apiEndpoint={cctv.api_endpoint}
            location={cctv.location}
            cctv_id={cctv.cctv_id}
            isPopup
            isFavorite={favorites.some((fav) => fav.cctv_id === cctv.cctv_id)}
            onToggleFavorite={() => toggleFavorite(cctv.cctv_id)}
            onClose={() => {
              if (overlayRef.current) {
                overlayRef.current.setMap(null);
                overlayRef.current = null;
              }
            }}
          />
        );

        const overlay = new window.kakao.maps.CustomOverlay({
          position: markerPosition,
          content: container,
          xAnchor: -0.5,
          yAnchor: 0.5,
          map: mapInstance.current,
        });

        overlayRef.current = overlay;

        const updateOverlayPosition = () => {
          if (overlayRef.current) {
            overlayRef.current.setPosition(markerPosition);
          }
        };

        window.kakao.maps.event.addListener(mapInstance.current, 'dragend', updateOverlayPosition);
        window.kakao.maps.event.addListener(mapInstance.current, 'zoom_changed', updateOverlayPosition);
      });
    });
    console.log('KakaoMap: Markers updated, count:', markersRef.current.length);
  };

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
        <button
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => loadData()}
        >
          재시도
        </button>
      </div>
    );
  }

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: '600px', border: '1px solid #ccc' }} />
      {cctvLocations.length === 0 && !error && (
        <div className="text-center p-4">CCTV 데이터를 불러오는 중입니다...</div>
      )}
    </div>
  );
};

export default KakaoMap;