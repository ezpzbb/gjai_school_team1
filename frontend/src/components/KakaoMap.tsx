/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import { EventItem } from '../types/event';
import { fetchCCTVLocations, getUserFavorites, addFavorite, removeFavorite } from '../services/api';
import { socketService } from '../services/socket';
import Camera from './Camera/Camera';

interface KakaoMap {
  LatLng: new (lat: number, lng: number) => any;
  Map: new (container: HTMLElement, options: any) => any;
  Marker: new (options: any) => any;
  CustomOverlay: new (options: any) => any;
  Size: new (width: number, height: number) => any;
  Point: new (x: number, y: number) => any;
  MarkerImage: new (src: string, size: any, options: any) => any;
  InfoWindow: new (options: any) => any;
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
    Size: new (width: number, height: number) => any;
    Point: new (x: number, y: number) => any;
    MarkerImage: new (src: string, size: any, options: any) => any;
    InfoWindow: new (options: any) => any;
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
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<number | null>(null); // 클릭 중인 cctv_id
  const overlayRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const eventMarkersRef = useRef<any[]>([]);
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

  // Socket 연결 및 이벤트 구독
  useEffect(() => {
    socketService.connect();
    const unsubscribe = socketService.onEventUpdate((updatedEvents) => {
      console.log('KakaoMap: Events updated:', updatedEvents.length);
      setEvents(updatedEvents);
    });

    return () => {
      unsubscribe();
      socketService.disconnect();
    };
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
      // 리사이즈 핸들러 제거
      if (mapInstance.current && (mapInstance.current as any).__resizeHandler) {
        window.removeEventListener('resize', (mapInstance.current as any).__resizeHandler);
      }
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      eventMarkersRef.current.forEach((marker) => marker.setMap(null));
      eventMarkersRef.current = [];
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

  // 이벤트 마커 업데이트
  useEffect(() => {
    if (mapInstance.current && events.length > 0) {
      updateEventMarkers().catch((error) => {
        console.error('KakaoMap: Failed to update event markers:', error);
      });
    } else if (mapInstance.current) {
      // 이벤트가 없으면 마커 제거
      eventMarkersRef.current.forEach((marker) => marker.setMap(null));
      eventMarkersRef.current = [];
    }
  }, [events]);

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
      
      // 지도 크기 조정을 위한 리사이즈 핸들러
      const handleResize = () => {
        if (mapInstance.current) {
          setTimeout(() => {
            mapInstance.current.relayout();
          }, 100);
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // 초기화 직후에도 relayout 호출 (DOM이 완전히 렌더링된 후)
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.relayout();
        }
      }, 300);
      
      // cleanup function을 위해 저장
      (mapInstance.current as any).__resizeHandler = handleResize;
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

  // SVG 파일을 data URL로 변환하는 함수 (캐싱 포함)
  const svgCache = useRef<Map<string, string>>(new Map());

  const getSvgDataUrl = async (iconPath: string): Promise<string> => {
    // 캐시 확인
    if (svgCache.current.has(iconPath)) {
      return svgCache.current.get(iconPath)!;
    }

    try {
      // 절대 경로로 요청 (React Router 우회)
      const fullPath = `${window.location.origin}${iconPath}`;
      console.log('KakaoMap: Fetching SVG from:', fullPath);
      const response = await fetch(fullPath, {
        method: 'GET',
        headers: {
          'Accept': 'image/svg+xml',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load SVG: ${response.status} ${response.statusText}`);
      }

      const svgText = await response.text();
      console.log('KakaoMap: SVG loaded successfully:', iconPath);
      
      // SVG를 data URL로 변환
      const encodedSvg = encodeURIComponent(svgText);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
      
      // 캐시에 저장
      svgCache.current.set(iconPath, dataUrl);
      
      return dataUrl;
    } catch (error) {
      console.error('KakaoMap: Failed to load SVG:', iconPath, error);
      // 기본 아이콘 반환
      const defaultSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="12" fill="#FF6B6B"/></svg>';
      const defaultDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(defaultSvg)}`;
      return defaultDataUrl;
    }
  };

  const updateEventMarkers = async () => {
    if (!window.kakao || !window.kakao.maps || !mapInstance.current) {
      console.error('KakaoMap: Cannot update event markers: SDK or map instance missing');
      return;
    }

    console.log('KakaoMap: Updating event markers for events:', events.length);
    // 기존 이벤트 마커 제거
    eventMarkersRef.current.forEach((marker) => marker.setMap(null));
    eventMarkersRef.current = [];

    // 각 이벤트에 대해 마커 생성 (비동기)
    const markerPromises = events.map(async (event) => {
      const lat = parseFloat(event.coordY);
      const lng = parseFloat(event.coordX);

      if (isNaN(lat) || isNaN(lng)) {
        console.warn('KakaoMap: Invalid event coordinates:', event);
        return null;
      }

      const markerPosition = new window.kakao.maps.LatLng(lat, lng);

      // 이벤트 타입에 따른 아이콘 파일 경로 (public/icons 폴더)
      let iconPath = '/icons/etc.svg'; // 기본값
      if (event.eventType === 'cor' || event.eventType === '공사') {
        iconPath = '/icons/work.svg';
      } else if (event.eventType === 'acc' || event.eventType === '교통사고') {
        iconPath = '/icons/accident.svg';
      } else if (event.eventType === 'wea' || event.eventType === '기상') {
        iconPath = '/icons/weather.svg';
      } else if (event.eventType === 'ete' || event.eventType === '기타돌발') {
        iconPath = '/icons/etc.svg';
      }

      // SVG를 data URL로 변환
      const svgDataUrl = await getSvgDataUrl(iconPath);
      console.log('KakaoMap: SVG data URL created for:', iconPath);

      const imageSize = new window.kakao.maps.Size(32, 32);
      const imageOption = { offset: new window.kakao.maps.Point(16, 16) };
      const markerImage = new window.kakao.maps.MarkerImage(
        svgDataUrl,
        imageSize,
        imageOption
      );

      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        image: markerImage,
        title: `${event.roadName} - ${event.message}`,
      });

      marker.setMap(mapInstance.current);
      eventMarkersRef.current.push(marker);

      // 이벤트 마커 클릭 시 정보창 표시
      window.kakao.maps.event.addListener(marker, 'click', () => {
        // 이벤트 타입 한글 변환
        const getEventTypeName = (eventType: string): string => {
          if (eventType === 'cor' || eventType === '공사') return '공사';
          if (eventType === 'acc' || eventType === '교통사고') return '교통사고';
          if (eventType === 'wea' || eventType === '기상') return '기상';
          if (eventType === 'ete' || eventType === '기타돌발') return '기타돌발';
          if (eventType === 'dis' || eventType === '재난') return '재난';
          return eventType;
        };

        // 도로 유형 한글 변환
        const getRoadTypeName = (type: string): string => {
          if (type === 'ex') return '고속도로';
          if (type === 'its') return '국도';
          if (type === 'loc') return '지방도';
          if (type === 'sgg') return '시군도';
          return type;
        };

        const eventTypeName = getEventTypeName(event.eventType);
        const roadTypeName = getRoadTypeName(event.type);

        // 이벤트 타입에 따른 색상
        const getEventTypeColor = (eventType: string): string => {
          if (eventType === 'cor' || eventType === '공사') return '#FF9800'; // 주황
          if (eventType === 'acc' || eventType === '교통사고') return '#F44336'; // 빨강
          if (eventType === 'wea' || eventType === '기상') return '#2196F3'; // 파랑
          return '#9E9E9E'; // 회색
        };

        const eventColor = getEventTypeColor(event.eventType);

        const infoContent = `
          <div style="padding: 15px; min-width: 280px; font-family: 'Malgun Gothic', sans-serif;">
            <div style="background: ${eventColor}; color: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-weight: bold; font-size: 16px; text-align: center;">
              ${eventTypeName}
            </div>
            <div style="margin-bottom: 10px;">
              <div style="font-weight: bold; font-size: 15px; color: #333; margin-bottom: 4px;">
                ${event.roadName || '도로명 없음'}
              </div>
              <div style="font-size: 12px; color: #666;">
                ${roadTypeName}
              </div>
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
              ${event.eventDetailType ? `
                <div style="margin-bottom: 6px; font-size: 13px;">
                  <span style="color: #666; font-weight: 600;">상세 유형:</span>
                  <span style="color: #333; margin-left: 6px;">${event.eventDetailType}</span>
                </div>
              ` : ''}
              <div style="margin-bottom: 6px; font-size: 13px;">
                <span style="color: #666; font-weight: 600;">내용:</span>
                <div style="color: #333; margin-top: 4px; line-height: 1.4;">${event.message || '내용 없음'}</div>
              </div>
              ${event.lanesBlocked ? `
                <div style="margin-bottom: 6px; font-size: 13px;">
                  <span style="color: #666; font-weight: 600;">차단 차로:</span>
                  <span style="color: #F44336; margin-left: 6px; font-weight: 600;">${event.lanesBlocked}</span>
                </div>
              ` : ''}
              ${event.roadDrcType ? `
                <div style="margin-bottom: 6px; font-size: 13px;">
                  <span style="color: #666; font-weight: 600;">방향:</span>
                  <span style="color: #333; margin-left: 6px;">${event.roadDrcType}</span>
                </div>
              ` : ''}
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px; font-size: 11px; color: #888;">
              <div style="margin-bottom: 4px;">
                <span style="font-weight: 600;">발생:</span> ${formatEventDate(event.startDate) || '시간 정보 없음'}
              </div>
              ${event.endDate ? `
                <div>
                  <span style="font-weight: 600;">종료 예정:</span> ${formatEventDate(event.endDate)}
                </div>
              ` : '<div style="color: #F44336;">종료 예정 시간 미정</div>'}
            </div>
          </div>
        `;

        const infoWindow = new window.kakao.maps.InfoWindow({
          content: infoContent,
          removable: true,
        });

        infoWindow.open(mapInstance.current, marker);
      });

      return marker;
    });

    // 모든 마커 생성 완료 대기
    const markers = await Promise.all(markerPromises);
    const validMarkers = markers.filter((marker): marker is any => marker !== null);
    
    console.log('KakaoMap: Event markers updated, count:', validMarkers.length);
  };

  const formatEventDate = (dateStr: string): string => {
    if (!dateStr || dateStr.trim() === '') return '';
    // YYYYMMDDHH24MISS 형식을 YYYY-MM-DD HH:MM:SS로 변환
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const minute = dateStr.substring(10, 12);
    const second = dateStr.substring(12, 14);
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
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
    <div className="w-full h-full relative overflow-hidden">
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg" 
        style={{ 
          border: '1px solid #ccc',
          minHeight: '100%',
          minWidth: '100%'
        }} 
      />
      {cctvLocations.length === 0 && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-center p-4">CCTV 데이터를 불러오는 중입니다...</div>
      )}
    </div>
  );
};

export default KakaoMap;