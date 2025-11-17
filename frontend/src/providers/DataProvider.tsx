import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import {
  fetchCCTVLocations,
  getUserFavorites,
  addFavorite as apiAddFavorite,
  removeFavorite as apiRemoveFavorite,
} from '../services/api';
import { useAuth } from './AuthProvider';

interface DataContextType {
  cctvLocations: CCTV[];
  favorites: Favorite[];
  isLoading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshCCTVs: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  addFavorite: (cctvId: number) => Promise<void>;
  removeFavorite: (cctvId: number) => Promise<void>;
  toggleFavorite: (cctvId: number) => Promise<boolean>;
  getCctvById: (cctvId: number) => CCTV | undefined;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const sortFavorites = (favorites: Favorite[]): Favorite[] =>
  [...favorites].sort((a, b) => {
    const timeA = new Date(a.added_at || 0).getTime();
    const timeB = new Date(b.added_at || 0).getTime();
    return timeB - timeA;
  });

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCCTVs = useCallback(async () => {
    const response = await fetchCCTVLocations();
    setCctvLocations(response.data);
  }, []);

  const refreshFavorites = useCallback(async () => {
    const favoriteData = await getUserFavorites();
    setFavorites(sortFavorites(favoriteData));
  }, []);

  const refreshAll = useCallback(async () => {
    if (!isLoggedIn) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [cctvResponse, favoriteData] = await Promise.all([
        fetchCCTVLocations(),
        getUserFavorites(),
      ]);
      setCctvLocations(cctvResponse.data);
      setFavorites(sortFavorites(favoriteData));
    } catch (err: any) {
      console.error('DataProvider: Failed to load data:', err);
      setError(err?.message || '데이터를 불러오지 못했습니다.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const addFavorite = useCallback(
    async (cctvId: number) => {
      const favorite = await apiAddFavorite(cctvId);
      setFavorites((prev) => {
        if (prev.some((item) => item.cctv_id === favorite.cctv_id)) {
          return prev;
        }
        return sortFavorites([...prev, favorite]);
      });
    },
    [],
  );

  const removeFavorite = useCallback(async (cctvId: number) => {
    await apiRemoveFavorite(cctvId);
    setFavorites((prev) => prev.filter((favorite) => favorite.cctv_id !== cctvId));
  }, []);

  const toggleFavorite = useCallback(
    async (cctvId: number) => {
      const exists = favorites.some((favorite) => favorite.cctv_id === cctvId);
      if (exists) {
        await removeFavorite(cctvId);
        return false;
      }
      await addFavorite(cctvId);
      return true;
    },
    [addFavorite, removeFavorite, favorites],
  );

  useEffect(() => {
    if (isLoggedIn) {
      refreshAll().catch(() => {
        /* 에러는 refreshAll 내부에서 처리됨 */
      });
    } else {
      setCctvLocations([]);
      setFavorites([]);
      setIsLoading(false);
      setError(null);
    }
  }, [isLoggedIn, refreshAll]);

  const getCctvById = useCallback(
    (cctvId: number) => cctvLocations.find((cctv) => cctv.cctv_id === cctvId),
    [cctvLocations],
  );

  const value = useMemo(
    () => ({
      cctvLocations,
      favorites,
      isLoading,
      error,
      refreshAll,
      refreshCCTVs,
      refreshFavorites,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      getCctvById,
    }),
    [
      cctvLocations,
      favorites,
      isLoading,
      error,
      refreshAll,
      refreshCCTVs,
      refreshFavorites,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      getCctvById,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};