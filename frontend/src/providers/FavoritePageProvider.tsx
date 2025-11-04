import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CCTV } from '../types/cctv';

interface FavoritePageContextType {
  selectedCCTVs: CCTV[];
  updateSelectedCCTVs: (cctv: CCTV) => void;
  setSelectedCCTVs: (cctvs: CCTV[]) => void;
}

const FavoritePageContext = createContext<FavoritePageContextType | undefined>(undefined);

export const FavoritePageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCCTVs, setSelectedCCTVs] = useState<CCTV[]>([]);

  // CCTV를 선택 목록에 추가 (최대 4개, 클릭한 CCTV를 첫 번째로)
  const updateSelectedCCTVs = (cctv: CCTV) => {
    setSelectedCCTVs((prev) => {
      // 이미 존재하는 CCTV는 제거
      const filtered = prev.filter((c) => c.cctv_id !== cctv.cctv_id);
      // 클릭한 CCTV를 첫 번째로 추가
      const updated = [cctv, ...filtered];
      // 최대 4개만 유지
      return updated.slice(0, 4);
    });
  };

  return (
    <FavoritePageContext.Provider value={{ selectedCCTVs, updateSelectedCCTVs, setSelectedCCTVs }}>
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

