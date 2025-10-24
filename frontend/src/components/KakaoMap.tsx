/// <reference types="vite/client" />

import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CCTV } from '../types/cctv';
import { fetchCCTVLocations } from '../services/api';
import Camera from './Camera/Camera';

declare global {
  interface Window {
    kakao: any;
  }
}

const KakaoMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const overlayRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY;

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const toggleFavorite = (apiEndpoint: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(apiEndpoint)
        ? prev.filter((item) => item !== apiEndpoint)
        : [...prev, apiEndpoint];
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  useEffect(() => {
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
    const initializeMapHandler = () => {
      if (window.kakao && window.kakao.maps && mapRef.current) {
        window.kakao.maps.load(initializeMap);
      }
    };

    if (window.kakao && window.kakao.maps && mapRef.current) {
      initializeMapHandler();
      return;
    }

    const existingScript = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;
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
  }, [KAKAO_API_KEY]);

  useEffect(() => {
    if (mapInstance.current && cctvLocations.length > 0) {
      updateMarkers();
    }
  }, [cctvLocations, favorites]);

  const initializeMap = () => {
    if (!mapRef.current || !window.kakao || !window.kakao.maps) return;

    const options = {
      center: new window.kakao.maps.LatLng(36.35, 127.38),
      level: 5,
    };
    const map = new window.kakao.maps.Map(mapRef.current, options);
    mapInstance.current = map;
    updateMarkers();
  };

  const updateMarkers = () => {
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
        container.style.width = '400px'; // 큰 틀에 맞게 확대
        container.style.height = '300px'; // 큰 틀에 맞게 확대
        container.style.padding = '5px'; // 패딩 간격 확보

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
            isPopup
            isFavorite={favorites.includes(cctv.api_endpoint)}
            onToggleFavorite={() => toggleFavorite(cctv.api_endpoint)}
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