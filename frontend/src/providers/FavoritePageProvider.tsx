import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CCTV } from '../types/cctv';

interface FavoritePageContextType {
  selectedCCTVs: CCTV[];
  pendingCCTV: CCTV | null;
  setPendingCCTV: (cctv: CCTV | null) => void;
  placeCCTVAt: (index: number) => void;
  setSelectedCCTVs: (cctvs: CCTV[]) => void;
  analysisMode: boolean;
  setAnalysisMode: (mode: boolean) => void;
  analysisTargetId: number | null;
  setAnalysisTargetId: (id: number | null) => void;
  focusAndExpandCCTV: (cctvId: number, cctvLocations: CCTV[]) => number | null;
}

const FavoritePageContext = createContext<FavoritePageContextType | undefined>(undefined);

export const FavoritePageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCCTVs, setSelectedCCTVs] = useState<CCTV[]>([]);
  const [pendingCCTV, setPendingCCTV] = useState<CCTV | null>(null);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [analysisTargetId, setAnalysisTargetId] = useState<number | null>(null);

  // 특정 인덱스에 대기 중인 CCTV를 배치
  const placeCCTVAt = (index: number) => {
    if (index < 0 || index >= 4 || !pendingCCTV) return;
    
    setSelectedCCTVs((prev) => {
      // 현재 배열을 4개로 채우기 (빈 자리는 null로)
      const current: (CCTV | null)[] = Array(4).fill(null).map((_, i) => prev[i] || null);
      
      // 선택한 위치에 이미 CCTV가 있는지 확인
      const existingCCTV = current[index];
      
      // 대기 중인 CCTV가 현재 어느 위치에 있는지 찾기
      const pendingIndex = current.findIndex(
        (cctv) => cctv && cctv.cctv_id === pendingCCTV.cctv_id
      );
      
      // 새로운 배열 생성
      const newArray: (CCTV | null)[] = [...current];
      
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

  // 특정 CCTV를 찾아서 슬롯에 배치하고 인덱스 반환
  const focusAndExpandCCTV = useCallback((cctvId: number, cctvLocations: CCTV[]): number | null => {
    // CCTV 정보 찾기
    const targetCCTV = cctvLocations.find((cctv) => cctv.cctv_id === cctvId);
    if (!targetCCTV) {
      return null;
    }

    let resultIndex: number | null = null;

    setSelectedCCTVs((prev) => {
      // 현재 배열을 4개로 채우기 (빈 자리는 null로)
      const current: (CCTV | null)[] = Array(4).fill(null).map((_, i) => prev[i] || null);
      
      // 이미 해당 CCTV가 있는지 확인
      const existingIndex = current.findIndex(
        (cctv) => cctv && cctv.cctv_id === cctvId
      );

      if (existingIndex !== -1) {
        // 이미 있으면 해당 인덱스 반환
        resultIndex = existingIndex;
        return prev;
      }

      // 빈 자리 찾기
      const emptyIndex = current.findIndex((cctv) => cctv === null);
      
      if (emptyIndex !== -1) {
        // 빈 자리가 있으면 그 자리에 배치
        resultIndex = emptyIndex;
        const newArray = [...current];
        newArray[emptyIndex] = targetCCTV;
        return newArray.filter((c): c is CCTV => c !== null).slice(0, 4);
      } else {
        // 빈 자리가 없으면 첫 번째 자리에 배치
        resultIndex = 0;
        const newArray = [targetCCTV, ...current.slice(1)];
        return newArray.filter((c): c is CCTV => c !== null).slice(0, 4);
      }
    });

    return resultIndex;
  }, []);

  return (
    <FavoritePageContext.Provider value={{ 
      selectedCCTVs, 
      pendingCCTV,
      setPendingCCTV,
      placeCCTVAt,
      setSelectedCCTVs,
      analysisMode,
      setAnalysisMode,
      analysisTargetId,
      setAnalysisTargetId,
      focusAndExpandCCTV,
    }}>
      {children}
    </FavoritePageContext.Provider>
  );
};

export const useFavoritePage = () => {
  const context = useContext(FavoritePageContext);
  if (!context) {
    throw new Error('useFavoritePage must be used within FavoritePageProvider');
  }
  return context;
};

