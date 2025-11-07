/// <reference types="vite/client" />
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import { EventItem } from '../types/event';
import { fetchCCTVLocations, getUserFavorites, addFavorite, removeFavorite, searchCCTVLocations } from '../services/api';
import { socketService } from '../services/socket';
import Camera from './Camera/Camera';
import { useMap } from '../providers/MapProvider';
import { useLayout } from '../providers/LayoutProvider';

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
  const [isMapInitialized, setIsMapInitialized] = useState<boolean>(false); // 지도 초기화 상태 추가
  const overlayRef = useRef<any>(null);
  const eventInfoWindowRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const eventMarkersRef = useRef<any[]>([]);
  const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY as string;
  const { registerSelectCCTV, registerSelectEvent } = useMap();
  const { sidebarCollapsed, dashboardCollapsed } = useLayout();
  
  // 검색 자동완성 관련 상태
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<CCTV[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
      // CCTV 데이터와 즐겨찾기 데이터를 개별적으로 로드 (하나가 실패해도 다른 것은 로드)
      let cctvResponse: { success: boolean; data: CCTV[] } | null = null;
      let favoriteData: Favorite[] = [];

      // CCTV 데이터 로드
      try {
        cctvResponse = await fetchCCTVLocations();
        console.log('KakaoMap: CCTV locations fetched:', cctvResponse);
        if (cctvResponse && cctvResponse.data) {
          setCctvLocations(cctvResponse.data);
        }
      } catch (error: any) {
        console.error('KakaoMap: Failed to load CCTV locations:', error);
        if (error.message.includes('429') && retries > 0) {
          console.log(`KakaoMap: Retrying CCTV load (${retries} retries left)...`);
          setTimeout(() => loadData(retries - 1, delay), delay);
          return;
        }
        // CCTV 로드 실패 시에도 계속 진행 (즐겨찾기는 시도)
      }

      // 즐겨찾기 데이터 로드 (실패해도 계속 진행)
      try {
        favoriteData = await getUserFavorites();
        console.log('KakaoMap: User favorites fetched:', favoriteData);
        setFavorites(favoriteData);
      } catch (error: any) {
        console.warn('KakaoMap: Failed to load favorites (continuing without favorites):', error);
        // 즐겨찾기 로드 실패는 경고만 하고 계속 진행
        setFavorites([]);
      }

      // CCTV 데이터가 성공적으로 로드되었는지 확인
      if (!cctvResponse || !cctvResponse.data) {
        throw new Error('CCTV 데이터를 불러오지 못했습니다.');
      }

      setError(null);
    } catch (error: any) {
      console.error('KakaoMap: Failed to load data:', error);
      setError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
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
      setIsMapInitialized(false); // 지도 초기화 상태 초기화
      const script = document.getElementById('kakao-map-sdk');
      if (script) {
        script.remove();
      }
    };
  }, [KAKAO_API_KEY]);

  useEffect(() => {
    console.log('KakaoMap: cctvLocations updated:', cctvLocations.length, 'isMapInitialized:', isMapInitialized);
    // 지도가 초기화되고 데이터가 준비되었을 때만 마커 업데이트
    if (isMapInitialized && mapInstance.current) {
      if (cctvLocations.length > 0) {
        console.log('KakaoMap: Updating markers (map initialized and data ready)');
        updateMarkers();
      } else {
        console.warn('KakaoMap: No CCTV locations to display markers');
        // 데이터가 없는 경우 기존 마커 제거
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
      }
    } else {
      console.log('KakaoMap: Waiting for map initialization or data:', { 
        isMapInitialized, 
        hasMapInstance: !!mapInstance.current,
        cctvCount: cctvLocations.length 
      });
    }
  }, [cctvLocations, favorites, isMapInitialized]); // isMapInitialized 의존성 추가

  // 이벤트 마커 업데이트
  useEffect(() => {
    console.log('KakaoMap: Events updated:', events.length, 'isMapInitialized:', isMapInitialized);
    // 지도가 초기화되었을 때만 이벤트 마커 업데이트
    if (isMapInitialized && mapInstance.current) {
      if (events.length > 0) {
        console.log('KakaoMap: Updating event markers (map initialized and events ready)');
        updateEventMarkers().catch((error) => {
          console.error('KakaoMap: Failed to update event markers:', error);
        });
      } else {
        // 이벤트가 없으면 마커 제거
        console.log('KakaoMap: No events to display, removing event markers');
        eventMarkersRef.current.forEach((marker) => marker.setMap(null));
        eventMarkersRef.current = [];
      }
    } else {
      console.log('KakaoMap: Waiting for map initialization before updating event markers:', { 
        isMapInitialized, 
        hasMapInstance: !!mapInstance.current,
        eventCount: events.length 
      });
    }
  }, [events, isMapInitialized]); // isMapInitialized 의존성 추가

  // 사이드바/대시보드 축소 시 지도 relayout
  useEffect(() => {
    if (mapInstance.current && isMapInitialized) {
      console.log('KakaoMap: Layout changed, calling relayout');
      setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.relayout();
        }
      }, 350); // transition 완료 후 relayout (duration-300 + 50ms)
    }
  }, [sidebarCollapsed, dashboardCollapsed, isMapInitialized]);

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
      center: new window.kakao.maps.LatLng(35.159743, 126.851399),
      level: 5,
    };
    try {
      console.log('KakaoMap: Initializing Kakao Map');
      const map = new window.kakao.maps.Map(mapRef.current, options);
      mapInstance.current = map;
      console.log('KakaoMap: Map initialized successfully');
      
      // 지도 초기화 완료 상태 설정
      setIsMapInitialized(true);
      
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
        // 기존 모든 오버레이 및 InfoWindow 닫기
        if (overlayRef.current) {
          overlayRef.current.setMap(null);
          overlayRef.current = null;
        }
        if (eventInfoWindowRef.current) {
          eventInfoWindowRef.current.close();
          eventInfoWindowRef.current = null;
        }

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.zIndex = '10';
        container.style.background = 'rgba(255, 255, 255, 0.01)';
        container.style.backdropFilter = 'blur(25px)';
        container.style.setProperty('-webkit-backdrop-filter', 'blur(25px)');
        container.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        container.style.width = '400px';
        container.style.height = '270px';
        container.style.padding = '5px';

        const root = createRoot(container);
        // Camera 컴포넌트는 api_endpoint를 받아서 자동으로 UTIC URL(경찰청) 또는 HLS 스트리밍(ITS)을 처리합니다
        // UTIC URL은 iframe으로, HLS는 video 태그로 표시됩니다
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
            pageType="kakao-map"
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
         // 기존 모든 오버레이 및 InfoWindow 닫기
         if (overlayRef.current) {
           overlayRef.current.setMap(null);
           overlayRef.current = null;
         }
         if (eventInfoWindowRef.current) {
           eventInfoWindowRef.current.close();
           eventInfoWindowRef.current = null;
         }
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

  // 검색어로 자동완성 제안 가져오기
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchCCTVLocations(query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSelectedIndex(-1);
    } catch (error: any) {
      console.error('KakaoMap: Error fetching suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 검색어 변경 시 debounce 적용
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, fetchSuggestions]);

  // 모든 오버레이 및 InfoWindow 닫기 함수
  const closeAllOverlays = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }
    if (eventInfoWindowRef.current) {
      eventInfoWindowRef.current.close();
      eventInfoWindowRef.current = null;
    }
  }, []);

  // CCTV 오버레이 생성 및 표시 공통 함수
  const showCCTVOverlay = useCallback((cctv: CCTV, position: any) => {
    if (!window.kakao || !window.kakao.maps || !mapInstance.current) {
      console.warn('KakaoMap: Cannot show CCTV overlay - map not initialized');
      return;
    }

    // 기존 오버레이가 있으면 제거
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.zIndex = '10';
    container.style.background = 'rgba(255, 255, 255, 0.01)';
    container.style.backdropFilter = 'blur(25px)';
    container.style.setProperty('-webkit-backdrop-filter', 'blur(25px)');
    container.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    container.style.width = '400px';
    container.style.height = '270px';
    container.style.padding = '5px';

    // Camera 컴포넌트는 api_endpoint를 받아서 자동으로 UTIC URL(경찰청) 또는 HLS 스트리밍(ITS)을 처리합니다
    // UTIC URL은 iframe으로, HLS는 video 태그로 표시됩니다
    const root = createRoot(container);
    root.render(
      <Camera
        apiEndpoint={cctv.api_endpoint}
        location={cctv.location}
        cctv_id={cctv.cctv_id}
        isPopup
        isFavorite={favorites.some((fav) => fav.cctv_id === cctv.cctv_id)}
        onToggleFavorite={() => toggleFavorite(cctv.cctv_id)}
        onClose={closeAllOverlays}
        pageType="kakao-map"
      />
    );

    const overlay = new window.kakao.maps.CustomOverlay({
      position: position,
      content: container,
      xAnchor: -0.5,
      yAnchor: 0.5,
      map: mapInstance.current,
    });

    overlayRef.current = overlay;
    console.log('KakaoMap: CCTV overlay displayed for:', cctv.location, 'at', position);
  }, [favorites, toggleFavorite, closeAllOverlays]);

  // 선택한 CCTV로 지도 이동 및 오버레이 표시
  const selectCCTV = useCallback((cctv: CCTV) => {
    if (!window.kakao || !window.kakao.maps || !mapInstance.current) {
      console.warn('KakaoMap: Cannot select CCTV - map not initialized');
      return;
    }

    console.log('KakaoMap: Selecting CCTV:', cctv.location, cctv.cctv_id);

    // 기존 모든 오버레이 및 InfoWindow 닫기
    closeAllOverlays();

    const position = new window.kakao.maps.LatLng(cctv.latitude, cctv.longitude);
    
    // 지도 중심 이동
    mapInstance.current.setCenter(position);
    mapInstance.current.setLevel(3);

    // 지도 이동 완료 후 오버레이 표시 (타임아웃 사용 - 더 안정적)
    // 지도 이동 애니메이션이 완료될 때까지 대기
    setTimeout(() => {
      if (mapInstance.current) {
        showCCTVOverlay(cctv, position);
      }
    }, 300);

    // 검색창 닫기
    setShowSuggestions(false);
    setSearchQuery('');
  }, [closeAllOverlays, showCCTVOverlay]);

  // 이벤트 InfoWindow 생성 및 표시 공통 함수
  const showEventInfoWindow = useCallback((event: EventItem, _position: any, marker: any) => {
    if (!window.kakao || !window.kakao.maps || !mapInstance.current || !marker) {
      console.warn('KakaoMap: Cannot show event InfoWindow - map or marker not available');
      return;
    }

    // 기존 InfoWindow 닫기
    if (eventInfoWindowRef.current) {
      eventInfoWindowRef.current.close();
      eventInfoWindowRef.current = null;
    }

    if (marker) {
      // 이벤트 타입 한글 변환
      const getEventTypeName = (eventType: string): string => {
        if (eventType === 'cor' || eventType === '공사') return '공사';
        if (eventType === 'acc' || eventType === '교통사고') return '교통사고';
        if (eventType === 'wea' || eventType === '기상') return '기상';
        if (eventType === 'ete' || eventType === '기타돌발') return '기타돌발';
        if (eventType === 'dis' || eventType === '재난') return '재난';
        return eventType;
      };

      const getRoadTypeName = (type: string): string => {
        if (type === 'ex') return '고속도로';
        if (type === 'its') return '국도';
        if (type === 'loc') return '지방도';
        if (type === 'sgg') return '시군도';
        return type;
      };

      const eventTypeName = getEventTypeName(event.eventType);
      const roadTypeName = getRoadTypeName(event.type);

      const getEventTypeColor = (eventType: string): string => {
        if (eventType === 'cor' || eventType === '공사') return '#FF9800';
        if (eventType === 'acc' || eventType === '교통사고') return '#F44336';
        if (eventType === 'wea' || eventType === '기상') return '#2196F3';
        return '#9E9E9E';
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
      eventInfoWindowRef.current = infoWindow;
    }
  }, [closeAllOverlays]);

  // 이벤트 선택 함수
  const selectEvent = useCallback((event: EventItem) => {
    if (!window.kakao || !window.kakao.maps || !mapInstance.current) {
      console.warn('KakaoMap: Cannot select event - map not initialized');
      return;
    }

    // 기존 모든 오버레이 및 InfoWindow 닫기
    closeAllOverlays();

    const lat = parseFloat(event.coordY);
    const lng = parseFloat(event.coordX);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('KakaoMap: Invalid event coordinates:', event);
      return;
    }

    const position = new window.kakao.maps.LatLng(lat, lng);
    
    // 지도 중심 이동
    mapInstance.current.setCenter(position);
    mapInstance.current.setLevel(3);

    // 지도 이동 완료 후 이벤트 마커 찾아서 InfoWindow 표시
    setTimeout(() => {
      if (!mapInstance.current) return;

      const marker = eventMarkersRef.current.find((m: any) => {
        const markerPos = m.getPosition();
        return Math.abs(markerPos.getLat() - lat) < 0.0001 && Math.abs(markerPos.getLng() - lng) < 0.0001;
      });

      if (marker) {
        showEventInfoWindow(event, position, marker);
      } else {
        console.warn('KakaoMap: Event marker not found for event:', event.id);
      }
    }, 300);
  }, [closeAllOverlays, showEventInfoWindow]);

  // MapProvider에 함수 등록
  useEffect(() => {
    registerSelectCCTV(selectCCTV);
    registerSelectEvent(selectEvent);
  }, [registerSelectCCTV, registerSelectEvent, selectCCTV, selectEvent]);

  // 키보드 네비게이션 처리
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectCCTV(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          selectCCTV(suggestions[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSearchQuery('');
        searchInputRef.current?.blur();
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, selectCCTV]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 검색어 하이라이트 함수
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || query.trim() === '') {
      return text;
    }

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-300 text-gray-900">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (error) {
    return (
      <div className="text-red-600 text-center p-4 bg-white rounded-lg shadow">
        {error}
        <button
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          onClick={() => loadData()}
        >
          재시도
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* 검색 입력창 */}
      <div className="absolute top-4 left-4 z-50 w-96">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder="CCTV 위치 검색 (예: 호남지선)"
            className="w-full px-4 py-3 pr-10 text-gray-900 bg-white rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {/* 자동완성 드롭다운 */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-80 overflow-y-auto z-50"
            >
              {suggestions.map((cctv, index) => (
                <div
                  key={cctv.cctv_id}
                  onClick={() => selectCCTV(cctv)}
                  className={`px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors ${
                    index === selectedIndex ? 'bg-blue-100' : ''
                  } ${index !== suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="font-medium text-gray-900">
                    {highlightText(cctv.location, searchQuery)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    📍 {cctv.latitude.toFixed(6)}, {cctv.longitude.toFixed(6)}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* 검색 결과 없음 */}
          {showSuggestions && suggestions.length === 0 && searchQuery.trim().length > 0 && !isSearching && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50"
            >
              <div className="text-gray-500 text-center">검색 결과가 없습니다.</div>
            </div>
          )}
        </div>
      </div>

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