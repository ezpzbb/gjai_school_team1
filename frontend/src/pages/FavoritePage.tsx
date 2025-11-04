import React, { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';
import { fetchCCTVLocations, getUserFavorites, addFavorite, removeFavorite } from '../services/api';
import Camera from '../components/Camera/Camera';
import Dashboard from '../components/Dashboard/Dashboard';
import { FavoritePageProvider, useFavoritePage } from '../providers/FavoritePageProvider';

const FavoritePageContent: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const favoritePageContext = useFavoritePage();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const [error, setError] = useState<string | null>(null);

  // FavoritePageProvider 내부이므로 항상 존재해야 함
  if (!favoritePageContext) {
    return <div className="text-center p-4 text-gray-700 dark:text-gray-300">초기화 중...</div>;
  }

  const { selectedCCTVs, pendingCCTV, placeCCTVAt, setSelectedCCTVs } = favoritePageContext;

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
          
          // 초기 선택된 CCTV 설정 (최신 즐겨찾기 4개)
          const initialCCTVs = sortedFavorites
            .slice(0, 4)
            .map((fav) => cctvResponse.data.find((cctv) => cctv.cctv_id === fav.cctv_id))
            .filter((cctv): cctv is CCTV => cctv !== undefined);
          setSelectedCCTVs(initialCCTVs);
          
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
    return <div className="text-center p-4 text-gray-700 dark:text-gray-300">로그인이 필요합니다.</div>;
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 text-center p-4">
        {error}
        <button
          className="mt-4 bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition"
          onClick={() => fetchFavorites()}
        >
          재시도
        </button>
      </div>
    );
  }

  return (
    <>
      <Dashboard />
      <div className="fixed left-[calc(16rem+1rem+0.5rem)] right-[calc(20rem+0.5rem+0.5rem)] top-[calc(2rem+4rem+0.5rem)] h-[calc(100vh-2rem-4rem-0.5rem-2rem)] z-30">
        <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
          {Array.from({ length: 4 }, (_, index) => {
            const cctv = selectedCCTVs[index];
            const canPlace = pendingCCTV !== null;
            
            return (
              <div
                key={cctv ? `cctv-${cctv.cctv_id}` : `empty-${index}`}
                onClick={() => {
                  // 대기 중인 CCTV가 있으면 이 위치에 배치
                  if (pendingCCTV) {
                    placeCCTVAt(index);
                  }
                }}
                className={`border-2 rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-800 transition-all relative ${
                  canPlace
                    ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-300 dark:ring-blue-500 cursor-pointer hover:ring-blue-400'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
                style={{ minHeight: 0 }}
              >
                {cctv ? (
                  <>
                    {/* 대기 중인 CCTV 배치 가능 표시 */}
                    {canPlace && (
                      <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white px-2 py-1 rounded text-xs font-semibold">
                        여기에 배치
                      </div>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Camera
                        apiEndpoint={cctv.api_endpoint}
                        location={cctv.location}
                        cctv_id={cctv.cctv_id}
                        isFavorite={favorites.some((fav) => fav.cctv_id === cctv.cctv_id)}
                        onToggleFavorite={() => handleToggleFavorite(cctv.cctv_id, favorites.some((fav) => fav.cctv_id === cctv.cctv_id))}
                      />
                    </div>
                  </>
                ) : (
                  <div className={`w-full h-full flex items-center justify-center cursor-pointer ${
                    canPlace
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className="text-center">
                      <div className="text-gray-400 dark:text-gray-500 text-sm mb-1">
                        {canPlace 
                          ? `클릭하여 "${pendingCCTV.location}" 배치` 
                          : '대시보드에서 CCTV 선택'}
                      </div>
                      {canPlace && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 font-semibold mt-2">
                          ✓ 배치 가능
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* 대기 중인 CCTV 표시 */}
          {pendingCCTV && (
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3">
              <span className="font-semibold">선택된 CCTV: {pendingCCTV.location}</span>
              <span className="text-sm">→ 컴포넌트 위치를 클릭하여 배치하세요</span>
              <button
                onClick={() => favoritePageContext.setPendingCCTV(null)}
                className="ml-2 bg-white text-blue-500 px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100 transition"
              >
                취소
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const FavoritePage: React.FC = () => {
  return (
    <FavoritePageProvider>
      <FavoritePageContent />
    </FavoritePageProvider>
  );
};

export default FavoritePage;