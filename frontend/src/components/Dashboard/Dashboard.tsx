import React, { useEffect, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { CCTV } from '../../types/cctv';
import { Favorite } from '../../types/Favorite';
import { fetchCCTVLocations, getUserFavorites } from '../../services/api';

const Dashboard: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchData = async () => {
        try {
          const favoriteData = await getUserFavorites();
          const cctvResponse = await fetchCCTVLocations();
          
          // added_at 기준 내림차순 정렬 (최신순)
          const sortedFavorites = favoriteData.sort((a, b) => 
            new Date(b.added_at || 0).getTime() - new Date(a.added_at || 0).getTime()
          );
          
          setFavorites(sortedFavorites);
          setCctvLocations(cctvResponse.data);
        } catch (error) {
          console.error('Dashboard: Failed to fetch data:', error);
        }
      };
      
      fetchData();
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return null;
  }

  // 최대 4개의 최신 즐겨찾기만 표시
  const displayedFavorites = favorites.slice(0, 4);
  
  // 즐겨찾기에 해당하는 CCTV 정보 매칭
  const favoriteCCTVs = displayedFavorites
    .map((favorite) => {
      const cctv = cctvLocations.find((loc) => loc.cctv_id === favorite.cctv_id);
      return cctv ? { favorite, cctv } : null;
    })
    .filter((item): item is { favorite: Favorite; cctv: CCTV } => item !== null);

  if (favoriteCCTVs.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-16 right-0 w-80 h-[calc(100vh-4rem)] overflow-y-auto bg-gray-800 border-l border-gray-700 p-4 z-40 rounded-l-lg">
      <h2 className="text-xl font-bold mb-4 text-white">즐겨찾기</h2>
      <div className="flex flex-col gap-2">
        {favoriteCCTVs.map(({ favorite, cctv }) => (
          <div key={favorite.cctv_id} className="text-white">
            <span className="text-sm">{cctv.location}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
