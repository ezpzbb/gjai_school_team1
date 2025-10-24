/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import { fetchCCTVLocations, getUserFavorites, addFavorite, removeFavorite } from '../services/api';
import Camera from './Camera/Camera';

// Kakao Maps 타입 정의
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
  const [favorites, setFavorites] = useState<number[]>([]);
  const overlayRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY as string;

  const toggleFavorite = async (cctv_id: number, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await removeFavorite(cctv_id);
        setFavorites((prev) => prev.filter((id) => id !== cctv_id));
      } else {
        await addFavorite(cctv_id);
        setFavorites((prev) => [...prev, cctv_id]);
      }
    } catch (error) {
      console.error('Failed to toggle favorite for cctv_id:', cctv_id, error);
      alert('즐겨찾기 처리 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [cctvData, favoriteData] = await Promise.all([
          fetchCCTVLocations(),
          getUserFavorites(),
        ]);
        console.log('CCTV locations fetched:', cctvData);
        console.log('User favorites fetched:', favoriteData);
        setCctvLocations(cctvData);
        setFavorites(favoriteData.map((fav: Favorite) => fav.cctv_id));
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadKakaoScript = (retries = 3, delay = 1000) => {
      if (!KAKAO_API_KEY) {
        console.error('KAKAO_API_KEY is not defined in .env');
        return;
      }
      if (retries === 0) {
        console.error('Max retries reached for Kakao Map SDK');
        return;
      }

      const existingScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', initializeMapHandler);
        return;
      }

      const script = document.createElement('script');
      script.id = 'kakao-map-sdk';
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&autoload=false`;
      script.async = true;
      script.onload = initializeMapHandler;
      script.onerror = () => {
        console.error(`Failed to load Kakao Map SDK. Retrying (${retries} left)...`);
        setTimeout(() => loadKakaoScript(retries - 1, delay), delay);
      };
      document.head.appendChild(script);
    };

    const initializeMapHandler = () => {
      if (!window.kakao || !window.kakao.maps) {
        console.error('Kakao Maps SDK not loaded');
        return;
      }
      window.kakao.maps.load(() => {
        if (mapRef.current) {
          initializeMap();
        } else {
          console.error('Map container not found');
        }
      });
    };

    loadKakaoScript();

    return () => {
      const existingScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.removeEventListener('load', initializeMapHandler);
      }
    };
  }, [KAKAO_API_KEY]);

  useEffect(() => {
    if (mapInstance.current && cctvLocations.length > 0) {
      updateMarkers();
    }
  }, [cctvLocations, favorites]);

  const initializeMap = () => {
    if (!mapRef.current || !window.kakao || !window.kakao.maps) {
      console.error('Cannot initialize map: Kakao Maps SDK or container missing');
      return;
    }

    const options = {
      center: new window.kakao.maps.LatLng(36.35, 127.38),
      level: 5,
    };
    try {
      const map = new window.kakao.maps.Map(mapRef.current, options);
      mapInstance.current = map;
      updateMarkers();
    } catch (error) {
      console.error('Failed to initialize Kakao Map:', error);
    }
  };

  const updateMarkers = () => {
    if (!window.kakao || !window.kakao.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

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

        const closeButton = document.createElement('button');
        closeButton.innerText = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.width = '24px';
        closeButton.style.height = '24px';
        closeButton.style.borderRadius = '50%';
        closeButton.style.background = '#ff4444';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '16px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.zIndex = '20';
        closeButton.onclick = () => {
          if (overlayRef.current) {
            overlayRef.current.setMap(null);
            overlayRef.current = null;
          }
        };
        container.appendChild(closeButton);

        const root = createRoot(container);
        root.render(
          <Camera
            apiEndpoint={cctv.api_endpoint}
            location={cctv.location}
            cctv_id={cctv.cctv_id}
            isPopup
            isFavorite={favorites.includes(cctv.cctv_id)}
            onToggleFavorite={() => toggleFavorite(cctv.cctv_id, favorites.includes(cctv.cctv_id))}
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
  };

  return <div ref={mapRef} style={{ width: '100%', height: '600px', border: '1px solid #ccc' }} />;
};

export default KakaoMap;