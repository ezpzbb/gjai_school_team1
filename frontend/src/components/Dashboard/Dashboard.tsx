import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { CCTV } from '../../types/cctv';
import { Favorite } from '../../types/Favorite';
import { EventItem } from '../../types/event';
import { socketService } from '../../services/socket';
import { useMap } from '../../providers/MapProvider';
import { useFavoritePage } from '../../providers/FavoritePageProvider';
import { useLayout } from '../../providers/LayoutProvider';
import { useData } from '../../providers/DataProvider';

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
  const mapContext = useMap();
  const { dashboardCollapsed, toggleDashboard } = useLayout();
  const [events, setEvents] = useState<EventItem[]>([]);
  const { favorites, cctvLocations, error: dataError } = useData();
  const [error, setError] = useState<string | null>(null);
  
  // MapProvider가 있는지 확인 (registerSelectCCTV가 실제 함수인지 확인)
  const hasMapProvider = typeof mapContext.registerSelectCCTV === 'function' && 
    mapContext.registerSelectCCTV.toString().indexOf('console.warn') === -1;
  
  // FavoritePageProvider가 있을 수도 있고 없을 수도 있으므로 try-catch로 감싼다
  let favoritePageContext: ReturnType<typeof useFavoritePage> | null = null;
  try {
    favoritePageContext = useFavoritePage();
  } catch {
    favoritePageContext = null;
  }
  
  const selectCCTV = (cctv: CCTV) => {
    // MapProvider가 있으면 카카오맵으로 이동
    if (hasMapProvider) {
      mapContext.selectCCTV(cctv);
    }
    // FavoritePageProvider가 있으면 대기 상태로 설정 (즉시 배치하지 않음)
    if (favoritePageContext) {
      favoritePageContext.setPendingCCTV(cctv);
    }
  };
  
  const selectEvent = hasMapProvider ? mapContext.selectEvent : () => {};

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    if (dataError) {
      setError(dataError);
    } else {
      setError(null);
    }
  }, [isLoggedIn, dataError]);

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

  if (error) {
    return (
      <div className={`fixed top-[calc(0.5rem+4rem+0.5rem)] right-2 h-[calc(100vh-0.5rem-4rem-0.5rem-0.5rem)] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 z-40 rounded-lg shadow-lg flex flex-col transition-all duration-300 ${dashboardCollapsed ? 'w-16' : 'w-72'}`}>
        <button
          onClick={toggleDashboard}
          className="fixed w-6 h-6 bg-blue-600 dark:bg-blue-700 text-white rounded-full flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-800 transition-all duration-300 z-50 shadow-lg"
          style={{ 
            right: `calc(0.5rem + ${dashboardCollapsed ? '4rem' : '18rem'} - 0.75rem)`,
            top: '50vh', 
            transform: 'translateY(-50%)' 
          }}
          title={dashboardCollapsed ? "대시보드 펼치기" : "대시보드 접기"}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${dashboardCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {!dashboardCollapsed && (
          <div className="w-full h-full flex items-center justify-center text-center text-sm text-red-500 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    );
  }

  // 모든 즐겨찾기 표시 (스크롤 가능)
  // 즐겨찾기에 해당하는 CCTV 정보 매칭
  const favoriteCCTVs = favorites
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
    <div className={`fixed top-[calc(0.5rem+4rem+0.5rem)] right-2 h-[calc(100vh-0.5rem-4rem-0.5rem-0.5rem)] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 z-40 rounded-lg shadow-lg flex flex-col transition-all duration-300 ${
      dashboardCollapsed ? 'w-16' : 'w-72'
    }`}>
      {/* 축소 버튼 */}
      <button
        onClick={toggleDashboard}
        className="fixed w-6 h-6 bg-blue-600 dark:bg-blue-700 text-white rounded-full flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-800 transition-all duration-300 z-50 shadow-lg"
        style={{ 
          right: `calc(0.5rem + ${dashboardCollapsed ? '4rem' : '18rem'} - 0.75rem)`,
          top: '50vh', 
          transform: 'translateY(-50%)' 
        }}
        title={dashboardCollapsed ? "대시보드 펼치기" : "대시보드 접기"}
      >
        <svg
          className={`w-4 h-4 transition-transform duration-300 ${dashboardCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {!dashboardCollapsed && (
        <>
      {/* 즐겨찾기 섹션 */}
      {favoriteCCTVs.length > 0 && (
        <div className="mb-6 flex-shrink-0">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">즐겨찾기</h2>
          <div 
            className="flex flex-col gap-2 overflow-y-auto"
            style={{ maxHeight: 'calc((100vh - 2rem - 4rem - 0.5rem - 2rem) * 0.4)' }}
          >
            {favoriteCCTVs.map(({ favorite, cctv }) => (
              <div 
                key={favorite.cctv_id} 
                onClick={hasMapProvider || favoritePageContext ? () => selectCCTV(cctv) : undefined}
                className={`text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 rounded-lg p-3 transition flex-shrink-0 ${
                  hasMapProvider || favoritePageContext
                    ? 'hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer' 
                    : 'cursor-default'
                }`}
              >
                <span className="text-sm">{cctv.location}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최신 이벤트 섹션 */}
      {recentEvents.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100 flex-shrink-0">최신 이벤트</h2>
          <div 
            className="flex flex-col gap-3 overflow-y-auto flex-1"
            style={{ maxHeight: 'calc((100vh - 2rem - 4rem - 0.5rem - 2rem) * 0.5)' }}
          >
            {recentEvents.map((event) => (
              <div
                key={event.id}
                onClick={hasMapProvider ? () => selectEvent(event) : undefined}
                className={`bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-gray-900 dark:text-gray-100 transition flex-shrink-0 ${
                  hasMapProvider 
                    ? 'hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer' 
                    : 'cursor-default'
                }`}
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
        </div>
      )}
      
      {/* 데이터 없음 메시지 */}
      {favoriteCCTVs.length === 0 && recentEvents.length === 0 && (
        <div className="text-gray-500 dark:text-gray-400 text-center py-8">
          <p className="mb-2">즐겨찾기가 없습니다.</p>
          <p>이벤트가 없습니다.</p>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default Dashboard;
