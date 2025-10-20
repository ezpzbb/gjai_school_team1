import React, { useEffect, useRef } from "react";

// ✅ 타입 정의 (같은 파일 내에 선언)
declare global {
  interface Window {
    kakao: any;
  }

  interface ImportMetaEnv {
    readonly VITE_KAKAO_API_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const KakaoMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY;

  useEffect(() => {
    // 이미 SDK가 추가되어 있으면 바로 지도 초기화
    if (window.kakao && window.kakao.maps && mapRef.current) {
      const options = {
        center: new window.kakao.maps.LatLng(36.35, 127.38),
        level: 3,
      };
      new window.kakao.maps.Map(mapRef.current, options);
      return;
    }

    // SDK 스크립트 생성
    const existingScript = document.getElementById("kakao-map-sdk");
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.kakao && window.kakao.maps && mapRef.current) {
          const options = {
            center: new window.kakao.maps.LatLng(36.35, 127.38),
            level: 3,
          };
          new window.kakao.maps.Map(mapRef.current, options);
        }
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-map-sdk";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&autoload=false`;
    script.async = true;

    script.onload = () => {
      if (window.kakao && window.kakao.maps && mapRef.current) {
        window.kakao.maps.load(() => {
          const options = {
            center: new window.kakao.maps.LatLng(36.35, 127.38),
            level: 3,
          };
          new window.kakao.maps.Map(mapRef.current, options);
        });
      }
    };

    script.onerror = () => {
      console.error("Kakao Map SDK failed to load.");
    };

    document.head.appendChild(script);
  }, [KAKAO_API_KEY]);

  return <div ref={mapRef} style={{ width: "100%", height: "400px", border: "1px solid #ccc" }} />;
};

export default KakaoMap;
