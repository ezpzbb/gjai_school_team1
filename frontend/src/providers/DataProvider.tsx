import React, { createContext, useContext, useState, useEffect } from 'react';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import { fetchCCTVLocations, getUserFavorites } from '../services/api';

interface DataContextType {
  cctvLocations: CCTV[];
  favorites: Favorite[];
  loadData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const loadData = async () => {
    try {
      const [cctvResponse, favoriteData] = await Promise.all([
        fetchCCTVLocations(),
        getUserFavorites(),
      ]);
      console.log('DataProvider: Data loaded', { cctv: cctvResponse.data, favorites: favoriteData });
      setCctvLocations(cctvResponse.data);
      setFavorites(favoriteData);
    } catch (error) {
      console.error('DataProvider: Failed to load data:', error);
    }
  };

  useEffect(() => {
    console.log('DataProvider: Initializing data load');
    loadData();
  }, []);

  return (
    <DataContext.Provider value={{ cctvLocations, favorites, loadData }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};