import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CCTV } from '../types/cctv';

interface FavoritePageContextType {
  selectedCCTVs: CCTV[];
  pendingCCTV: CCTV | null;
  setPendingCCTV: (cctv: CCTV | null) => void;
  placeCCTVAt: (index: number) => void;
  setSelectedCCTVs: (cctvs: CCTV[]) => void;
}

const FavoritePageContext = createContext<FavoritePageContextType | undefined>(undefined);

export const FavoritePageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCCTVs, setSelectedCCTVs] = useState<CCTV[]>([]);
  const [pendingCCTV, setPendingCCTV] = useState<CCTV | null>(null);

  // 특정 인덱스에 대기 중인 CCTV를 배치
  const placeCCTVAt = (index: number) => {
    if (index < 0 || index >= 4 || !pendingCCTV) return;
    
    setSelectedCCTVs((prev) => {
      // 현재 배열을 4개로 채우기 (빈 자리는 null로)
      const current = Array(4).fill(null).map((_, i) => prev[i] || null);
      
      // 선택한 위치에 이미 CCTV가 있는지 확인
      const existingCCTV = current[index];
      
      // 대기 중인 CCTV가 현재 어느 위치에 있는지 찾기
      const pendingIndex = current.findIndex(
        (cctv, i) => cctv && cctv.cctv_id === pendingCCTV.cctv_id
      );
      
      // 새로운 배열 생성
      const newArray = [...current];
      
      // 대기 중인 CCTV를 현재 위치에서 제거
      if (pendingIndex !== -1) {
        newArray[pendingIndex] = null;
      }
      
      // 선택한 위치에 CCTV가 있고, 대기 중인 CCTV와 다르다면 위치 교체
      if (existingCCTV && existingCCTV.cctv_id !== pendingCCTV.cctv_id) {
        // 대기 중인 CCTV의 원래 위치에 기존 CCTV 배치 (swap)
        if (pendingIndex !== -1) {
          newArray[pendingIndex] = existingCCTV;
        } else {
          // 대기 중인 CCTV가 새로 추가되는 경우, 기존 CCTV를 빈 공간으로 이동
          const emptyIndex = newArray.findIndex((cctv, i) => cctv === null && i !== index);
          if (emptyIndex !== -1) {
            newArray[emptyIndex] = existingCCTV;
          }
        }
      }
      
      // 선택한 위치에 대기 중인 CCTV 배치
      newArray[index] = pendingCCTV;
      
      // null 제거하고 최대 4개 유지
      const result = newArray.filter((c): c is CCTV => c !== null).slice(0, 4);
      return result;
    });
    
    // 대기 중인 CCTV 초기화
    setPendingCCTV(null);
  };

  return (
    <FavoritePageContext.Provider value={{ 
      selectedCCTVs, 
      pendingCCTV,
      setPendingCCTV,
      placeCCTVAt,
      setSelectedCCTVs 
    }}>
      {children}
    </FavoritePageContext.Provider>
  );
};

export const useFavoritePage = () => {
  const context = useContext(FavoritePageContext);
  if (!context) {
    // FavoritePageProvider가 없을 때는 null 반환 (optional)
    return null;
  }
  return context;
};

