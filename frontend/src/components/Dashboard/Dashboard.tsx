import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { CCTV } from '../../types/cctv';
import { Favorite } from '../../types/Favorite';
import { EventItem } from '../../types/event';
import { fetchCCTVLocations, getUserFavorites } from '../../services/api';
import { socketService } from '../../services/socket';

// 날짜 포맷팅 함수들 (컴포넌트 외부로 이동)
const formatEventDate = (dateStr: string): string => {
  if (!dateStr || dateStr.trim() === '') return '';
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(8, 10);
  const minute = dateStr.substring(10, 12);
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const formatEventDateForSort = (dateStr: string): string => {
  if (!dateStr || dateStr.trim() === '') return '';
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const hour = dateStr.substring(8, 10);
  const minute = dateStr.substring(10, 12);
  const second = dateStr.substring(12, 14);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

const Dashboard: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [cctvLocations, setCctvLocations] = useState<CCTV[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

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

  // Socket 연결 및 이벤트 구독
  useEffect(() => {
    if (isLoggedIn) {
      socketService.connect();
      const unsubscribe = socketService.onEventUpdate((updatedEvents) => {
        console.log('Dashboard: Events updated:', updatedEvents.length);
        setEvents(updatedEvents);
      });

      return () => {
        unsubscribe();
      };
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

  // 최신 이벤트 6개 (startDate 기준 내림차순)
  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const dateA = new Date(formatEventDateForSort(a.startDate)).getTime();
        const dateB = new Date(formatEventDateForSort(b.startDate)).getTime();
        return dateB - dateA;
      })
      .slice(0, 6);
  }, [events]);

  return (
    <div className="fixed top-[calc(2rem+4rem+0.5rem)] right-2 w-80 h-[calc(100vh-2rem-4rem-0.5rem-2rem)] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 z-40 rounded-lg shadow-lg">
      {/* 즐겨찾기 섹션 */}
      {favoriteCCTVs.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">즐겨찾기</h2>
          <div className="flex flex-col gap-2 mb-6">
            {favoriteCCTVs.map(({ favorite, cctv }) => (
              <div key={favorite.cctv_id} className="text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-600 transition">
                <span className="text-sm">{cctv.location}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 최신 이벤트 섹션 */}
      {recentEvents.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">최신 이벤트</h2>
          <div className="flex flex-col gap-3">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 transition"
              >
                <div className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">{event.roadName}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {event.type} / {event.eventType}
                </div>
                <div className="text-xs mb-2 text-gray-700 dark:text-gray-300">{event.message}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatEventDate(event.startDate)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* 데이터 없음 메시지 */}
      {favoriteCCTVs.length === 0 && recentEvents.length === 0 && (
        <div className="text-gray-500 dark:text-gray-400 text-center py-8">
          <p className="mb-2">즐겨찾기가 없습니다.</p>
          <p>이벤트가 없습니다.</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
