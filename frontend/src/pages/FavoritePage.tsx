import React, { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import { fetchCCTVLocations, getUserFavorites, addFavorite, removeFavorite } from '../services/api';
import Camera from '../components/Camera/Camera';
import Dashboard from '../components/Dashboard/Dashboard';

const FavoritePage: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = async (retries = 3, delay = 2000) => {
    try {
      const favoriteData = await getUserFavorites();
      console.log('FavoritePage: User favorites fetched:', favoriteData);
      const cctvResponse = await fetchCCTVLocations();
      console.log('FavoritePage: CCTV locations fetched:', cctvResponse);
      // added_at 기준 내림차순 정렬 (최신순)
      const sortedFavorites = favoriteData.sort((a, b) => 
        new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime()
      );
      setFavorites(sortedFavorites);
      setCctvLocations(cctvResponse.data);
      setError(null);
    } catch (error: any) {
      console.error('FavoritePage: Failed to fetch favorites:', error);
      if (error.message.includes('429') && retries > 0) {
        console.log(`FavoritePage: Retrying fetchFavorites (${retries} retries left)...`);
        setTimeout(() => fetchFavorites(retries - 1, delay), delay);
      } else {
        setError('즐겨찾기 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      console.log('FavoritePage: Fetching favorites');
      fetchFavorites();
    }
  }, [isLoggedIn]);

  const handleToggleFavorite = async (cctv_id: number, isFavorite: boolean) => {
    console.log('FavoritePage: handleToggleFavorite called', { cctv_id, isFavorite });
    try {
      if (isFavorite) {
        if (!favorites.some((fav) => fav.cctv_id === cctv_id)) {
          console.warn('FavoritePage: cctv_id not in favorites:', cctv_id);
          return;
        }
        await removeFavorite(cctv_id);
        const updatedFavorites = await getUserFavorites();
        const sortedFavorites = updatedFavorites.sort((a, b) => 
          new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime()
        );
        setFavorites(sortedFavorites);
        console.log('FavoritePage: Removed favorite, new favorites:', sortedFavorites);
      } else {
        await addFavorite(cctv_id);
        const updatedFavorites = await getUserFavorites();
        const sortedFavorites = updatedFavorites.sort((a, b) => 
          new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime()
        );
        setFavorites(sortedFavorites);
        console.log('FavoritePage: Added favorite, new favorites:', sortedFavorites);
      }
    } catch (error: any) {
      console.error('FavoritePage: Failed to toggle favorite for cctv_id:', cctv_id, error);
      setError(`즐겨찾기 처리 중 오류: ${error.message}`);
    }
  };

  if (!isLoggedIn) {
    return <div className="text-center p-4 text-gray-700">로그인이 필요합니다.</div>;
  }

  if (error) {
    return (
      <div className="text-red-600 text-center p-4">
        {error}
        <button
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          onClick={() => fetchFavorites()}
        >
          재시도
        </button>
      </div>
    );
  }

  // 최대 4개의 최신 즐겨찾기만 표시
  const displayedFavorites = favorites.slice(0, 4);

  return (
    <>
      <Dashboard />
      <div className="p-4 pr-80">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">즐겨찾기</h1>
        <div className="grid grid-cols-2 gap-4">
          {displayedFavorites.map((favorite) => {
            const cctv = cctvLocations.find((loc) => loc.cctv_id === favorite.cctv_id);
            if (!cctv) {
              console.warn('FavoritePage: CCTV not found for cctv_id:', favorite.cctv_id);
              return null;
            }
            return (
              <Camera
                key={favorite.cctv_id}
                apiEndpoint={cctv.api_endpoint}
                location={cctv.location}
                cctv_id={cctv.cctv_id}
                isFavorite={favorites.some((fav) => fav.cctv_id === cctv.cctv_id)}
                onToggleFavorite={() => handleToggleFavorite(cctv.cctv_id, favorites.some((fav) => fav.cctv_id === cctv.cctv_id))}
              />
            );
          })}
        </div>
        <div className="mt-4">
          <p className="text-gray-600">표시된 즐겨찾기 수: {displayedFavorites.length}</p>
        </div>
      </div>
    </>
  );
};

export default FavoritePage;