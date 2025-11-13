import React, { createContext, useContext, useRef, ReactNode } from 'react';
import { CCTV } from '../types/cctv';
import { EventItem } from '../types/event';

interface MapContextType {
  selectCCTV: (cctv: CCTV) => void;
  selectEvent: (event: EventItem) => void;
  registerSelectCCTV: (fn: (cctv: CCTV) => void) => void;
  registerSelectEvent: (fn: (event: EventItem) => void) => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const selectCCTVRef = useRef<((cctv: CCTV) => void) | null>(null);
  const selectEventRef = useRef<((event: EventItem) => void) | null>(null);

  const selectCCTV = (cctv: CCTV) => {
    if (selectCCTVRef.current) {
      selectCCTVRef.current(cctv);
    }
  };

  const selectEvent = (event: EventItem) => {
    if (selectEventRef.current) {
      selectEventRef.current(event);
    }
  };

  const registerSelectCCTV = (fn: (cctv: CCTV) => void) => {
    selectCCTVRef.current = fn;
  };

  const registerSelectEvent = (fn: (event: EventItem) => void) => {
    selectEventRef.current = fn;
  };

  return (
    <MapContext.Provider value={{ selectCCTV, selectEvent, registerSelectCCTV, registerSelectEvent }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    // MapProvider가 없을 때는 빈 함수를 반환하여 오류 방지
    return {
      selectCCTV: () => {
        console.warn('useMap: MapProvider not found, selectCCTV ignored');
      },
      selectEvent: () => {
        console.warn('useMap: MapProvider not found, selectEvent ignored');
      },
      registerSelectCCTV: () => {
        console.warn('useMap: MapProvider not found, registerSelectCCTV ignored');
      },
      registerSelectEvent: () => {
        console.warn('useMap: MapProvider not found, registerSelectEvent ignored');
      },
    };
  }
  return context;
};
