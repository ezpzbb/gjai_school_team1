import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { CCTV } from '../types/cctv';
import Camera from '../components/Camera/Camera';
import Dashboard from '../components/Dashboard/Dashboard';
import { FavoritePageProvider, useFavoritePage } from '../providers/FavoritePageProvider';
import { useLayout } from '../providers/LayoutProvider';
import { useData } from '../providers/DataProvider';

const FavoritePageContent: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const favoritePageContext = useFavoritePage();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    sidebarCollapsed,
    dashboardCollapsed,
    setSidebarCollapsed,
    setDashboardCollapsed,
  } = useLayout();
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; cctv_id: number | null; location: string | null }>({
    show: false,
    cctv_id: null,
    location: null,
  });
  const previousLayoutRef = useRef<{ sidebar: boolean; dashboard: boolean } | null>(null);

  const {
    selectedCCTVs,
    pendingCCTV,
    placeCCTVAt,
    setSelectedCCTVs,
    analysisMode,
    setAnalysisMode,
    analysisTargetId,
    setAnalysisTargetId,
    focusAndExpandCCTV,
  } = favoritePageContext;
  const {
    cctvLocations,
    favorites,
    addFavorite,
    removeFavorite,
    refreshFavorites,
    error: dataError,
  } = useData();

  useEffect(() => {
    if (dataError) {
      setError(dataError);
    } else {
      setError(null);
    }
  }, [dataError]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const initialCCTVs = favorites
      .slice(0, 4)
      .map((fav) => cctvLocations.find((cctv) => cctv.cctv_id === fav.cctv_id))
      .filter((cctv): cctv is CCTV => Boolean(cctv));

    setSelectedCCTVs(initialCCTVs);
  }, [isLoggedIn, favorites, cctvLocations, setSelectedCCTVs]);

  const handleToggleFavorite = async (cctv_id: number, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        // 즐겨찾기 해제 - 확인 모달 표시
        if (!favorites.some((fav) => fav.cctv_id === cctv_id)) {
          console.warn('FavoritePage: cctv_id not in favorites:', cctv_id);
          return;
        }
        
        // CCTV 위치 찾기
        const cctv = selectedCCTVs.find((c) => c?.cctv_id === cctv_id);
        const location = cctv?.location || 'CCTV';
        
        // 확인 모달 표시
        setConfirmModal({
          show: true,
          cctv_id,
          location,
        });
        return;
      } else {
        // 즐겨찾기 추가
        await addFavorite(cctv_id);
        console.log('FavoritePage: Added favorite', cctv_id);
      }
    } catch (error: any) {
      console.error('FavoritePage: Failed to toggle favorite for cctv_id:', cctv_id, error);
      setError(`즐겨찾기 처리 중 오류: ${error.message}`);
    }
  };

  const handleRefreshFavorites = useCallback(async () => {
    try {
      await refreshFavorites();
      setError(null);
    } catch (err: any) {
      console.error('FavoritePage: Failed to refresh favorites:', err);
      setError(err?.message || '즐겨찾기를 다시 불러오지 못했습니다.');
    }
  }, [refreshFavorites]);

  const confirmRemoveFavorite = async () => {
    if (!confirmModal.cctv_id) return;
    
    const cctv_id = confirmModal.cctv_id;
    
    try {
      // 확대된 상태라면 축소
      const removedIndex = selectedCCTVs.findIndex((cctv) => cctv?.cctv_id === cctv_id);
      if (removedIndex !== -1 && expandedIndex === removedIndex) {
        setExpandedIndex(null);
      }
      
      await removeFavorite(cctv_id);
      console.log('FavoritePage: Removed favorite', cctv_id);

      // 모달 닫기
      setConfirmModal({ show: false, cctv_id: null, location: null });
    } catch (error: any) {
      console.error('FavoritePage: Failed to remove favorite for cctv_id:', cctv_id, error);
      setError(`즐겨찾기 처리 중 오류: ${error.message}`);
      // 모달 닫기
      setConfirmModal({ show: false, cctv_id: null, location: null });
    }
  };

  const enterAnalysisMode = useCallback(
    (targetId: number) => {
      if (!analysisMode) {
        previousLayoutRef.current = {
          sidebar: sidebarCollapsed,
          dashboard: dashboardCollapsed,
        };
        if (!sidebarCollapsed) {
          setSidebarCollapsed(true);
        }
        if (!dashboardCollapsed) {
          setDashboardCollapsed(true);
        }
      }
      setAnalysisTargetId(targetId);
      setAnalysisMode(true);
    },
    [
      analysisMode,
      sidebarCollapsed,
      dashboardCollapsed,
      setSidebarCollapsed,
      setDashboardCollapsed,
      setAnalysisMode,
      setAnalysisTargetId,
    ],
  );

  const exitAnalysisMode = useCallback(
    (options?: { restoreLayout?: boolean }) => {
      const shouldRestore = options?.restoreLayout ?? true;
      setAnalysisMode(false);
       setAnalysisTargetId(null);
      if (shouldRestore && previousLayoutRef.current) {
        setSidebarCollapsed(previousLayoutRef.current.sidebar);
        setDashboardCollapsed(previousLayoutRef.current.dashboard);
      }
      previousLayoutRef.current = null;
    },
    [setAnalysisMode, setSidebarCollapsed, setDashboardCollapsed],
  );

  useEffect(() => {
    if (!analysisMode) {
      previousLayoutRef.current = null;
      return;
    }

    if (!sidebarCollapsed || !dashboardCollapsed) {
      exitAnalysisMode({ restoreLayout: false });
    }
  }, [analysisMode, sidebarCollapsed, dashboardCollapsed, exitAnalysisMode]);

  // 확대 애니메이션 처리 헬퍼 함수
  const expandWithAnimation = useCallback((targetIndex: number | null, delay: number = 0) => {
    setTimeout(() => {
      setIsAnimating(true);
      setExpandedIndex(targetIndex);
      setTimeout(() => {
        setIsAnimating(false);
      }, 400);
    }, delay);
  }, []);

  // 쿼리 파라미터에서 CCTV ID와 확대 여부 파싱
  const parseCCTVQueryParams = useCallback(() => {
    const cctvIdParam = searchParams.get('cctv_id');
    const expandParam = searchParams.get('expand');

    if (!cctvIdParam || expandParam !== 'true') {
      return null;
    }

    const cctvId = parseInt(cctvIdParam);
    if (isNaN(cctvId)) {
      return null;
    }

    return cctvId;
  }, [searchParams]);

  // URL 쿼리 파라미터로 CCTV 확대 처리
  useEffect(() => {
    const cctvId = parseCCTVQueryParams();
    if (!cctvId || cctvLocations.length === 0) {
      return;
    }

    // selectedCCTVs에서 해당 CCTV가 이미 있는지 확인
    const existingIndex = selectedCCTVs.findIndex((cctv) => cctv.cctv_id === cctvId);

    if (existingIndex !== -1) {
      // 이미 슬롯에 있으면 바로 확대
      if (expandedIndex !== existingIndex) {
        expandWithAnimation(existingIndex);
      }
      // 쿼리 파라미터 제거
      setSearchParams({}, { replace: true });
    } else {
      // 슬롯에 없으면 배치
      focusAndExpandCCTV(cctvId, cctvLocations);
      // 쿼리 파라미터는 유지 (다음 useEffect에서 확대 처리)
    }
  }, [searchParams, cctvLocations, selectedCCTVs, focusAndExpandCCTV, setSearchParams, expandedIndex, parseCCTVQueryParams, expandWithAnimation]);

  // selectedCCTVs 변경 시 CCTV 인덱스 찾아서 자동 확대 (쿼리 파라미터가 있을 때만)
  useEffect(() => {
    const cctvId = parseCCTVQueryParams();
    if (!cctvId) {
      return;
    }

    // selectedCCTVs에서 해당 CCTV의 인덱스 찾기
    const targetIndex = selectedCCTVs.findIndex((cctv) => cctv.cctv_id === cctvId);

    if (targetIndex !== -1 && expandedIndex !== targetIndex) {
      // CCTV가 슬롯에 배치되었고 아직 확대되지 않았다면 확대
      expandWithAnimation(targetIndex, 100);
      // 확대 완료 후 쿼리 파라미터 제거
      setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 500);
    }
  }, [selectedCCTVs, searchParams, expandedIndex, setSearchParams, parseCCTVQueryParams, expandWithAnimation]);

  const handleExpand = (index: number) => {
    const targetIndex = expandedIndex === index ? null : index;
    expandWithAnimation(targetIndex);
  };

  const handleAnalysisAction = (cctv: CCTV) => {
    if (!cctv) {
      return;
    }

    if (analysisMode) {
      if (analysisTargetId === cctv.cctv_id) {
        exitAnalysisMode();
      } else {
        setAnalysisTargetId(cctv.cctv_id);
      }
    } else {
      enterAnalysisMode(cctv.cctv_id);
    }
  };

  const renderCameraCard = (cctv: CCTV | undefined, index: number, isCompact: boolean) => {
    const canPlace = pendingCCTV !== null;
    const isExpanded = expandedIndex === index && !isCompact;
    const isAnalyzing = !!(analysisMode && cctv && analysisTargetId === cctv.cctv_id);

    const baseClassName = `border-2 rounded-lg shadow-md overflow-visible bg-white dark:bg-gray-800 relative ${
      canPlace && !isExpanded
        ? 'border-blue-500/50 dark:border-blue-400/50 ring-2 ring-blue-400/30 dark:ring-blue-500/30 cursor-pointer hover:ring-blue-400/50 backdrop-blur-sm'
        : isAnalyzing
        ? 'border-amber-400 dark:border-amber-300 ring-2 ring-amber-300/50 dark:ring-amber-200/40'
        : 'border-gray-300 dark:border-gray-700'
    } ${isExpanded ? 'z-50' : ''}`;

    const cardStyle: React.CSSProperties = isCompact
      ? {
          height: '100%',
          minHeight: 0,
          transition: 'all 0.3s ease',
        }
      : {
          minHeight: 0,
          height: isExpanded ? 'auto' : '100%',
          transition:
            isExpanded || isAnimating
              ? 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              : 'all 0.3s ease',
          ...(canPlace && !isExpanded
            ? {
                background: 'rgba(53, 122, 189, 0.15)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px 0 rgba(53, 122, 189, 0.2)',
              }
            : {}),
          ...(isExpanded
            ? {
                position: 'fixed',
                left: sidebarCollapsed ? 'calc(4rem + 1rem)' : 'calc(16rem + 1rem)',
                right: dashboardCollapsed ? 'calc(4rem + 0.5rem + 0.5rem)' : 'calc(20rem + 0.5rem + 0.5rem)',
                top: 'calc(2rem + 4rem + 0.25rem)',
                height: 'calc(100vh - 2rem - 4rem - 0.25rem - 2rem)',
                width: sidebarCollapsed 
                  ? (dashboardCollapsed 
                      ? 'calc(100vw - 4rem - 1rem - 4rem - 0.5rem - 0.5rem)' 
                      : 'calc(100vw - 4rem - 1rem - 20rem - 0.5rem - 0.5rem)')
                  : (dashboardCollapsed 
                      ? 'calc(100vw - 16rem - 1rem - 4rem - 0.5rem - 0.5rem)' 
                      : 'calc(100vw - 16rem - 1rem - 20rem - 0.5rem - 0.5rem)'),
                zIndex: 100,
                animation: isExpanded && isAnimating ? 'expandAnimation 0.4s ease-out' : 'none',
              }
            : {}),
        };

    const handleCardClick = () => {
      if (isCompact) return;
      if (!isExpanded && pendingCCTV) {
        placeCCTVAt(index);
      }
    };

    return (
      <div
        key={cctv ? `cctv-${cctv.cctv_id}` : `empty-${index}`}
        onClick={handleCardClick}
        className={baseClassName}
        style={cardStyle}
      >
        {cctv ? (
          <>
            {canPlace && !isCompact && !isExpanded && (
              <div
                className="absolute top-2 left-2 z-10 text-white px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-md"
                style={{
                  background: 'rgba(53, 122, 189, 0.4)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 16px rgba(53, 122, 189, 0.3)',
                }}
              >
                여기에 배치
              </div>
            )}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <Camera
                  apiEndpoint={cctv.api_endpoint}
                  location={cctv.location}
                  cctv_id={cctv.cctv_id}
                  isFavorite={favorites.some((fav) => fav.cctv_id === cctv.cctv_id)}
                  onAnalyze={() => handleAnalysisAction(cctv)}
                  isAnalyzing={isAnalyzing}
                  onToggleFavorite={() =>
                    handleToggleFavorite(cctv.cctv_id, favorites.some((fav) => fav.cctv_id === cctv.cctv_id))
                  }
                  onExpand={
                    isCompact
                      ? undefined
                      : () => {
                          handleExpand(index);
                        }
                  }
                  isExpanded={isExpanded}
                  isPlacementMode={canPlace}
                  pageType="favorite"
                />
              </div>
            </div>
          </>
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center transition-all ${
              canPlace && !isCompact ? '' : 'bg-gray-50 dark:bg-gray-700/50'
            }`}
            style={
              canPlace && !isCompact
                ? {
                    background: 'rgba(53, 122, 189, 0.15)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                  }
                : {}
            }
          >
            <div className="text-center">
              <div
                className="text-sm mb-1 font-medium"
                style={
                  canPlace && !isCompact
                    ? {
                        color: 'rgba(255, 255, 255, 0.95)',
                      }
                    : {}
                }
              >
                {canPlace && !isCompact
                  ? `클릭하여 "${pendingCCTV.location}" 배치`
                  : '대시보드에서 CCTV 선택'}
              </div>
              {canPlace && !isCompact && (
                <div
                  className="text-xs font-semibold mt-2 px-3 py-1 rounded-lg backdrop-blur-sm"
                  style={{
                    color: 'rgba(255, 255, 255, 0.95)',
                    background: 'rgba(53, 122, 189, 0.3)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  ✓ 배치 가능
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
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
          onClick={handleRefreshFavorites}
        >
          재시도
        </button>
      </div>
    );
  }

  return (
    <>
      <Dashboard />
      <div 
        className={`fixed top-[calc(2rem+4rem+0.25rem)] h-[calc(100vh-2rem-4rem-0.25rem-2rem)] z-30 transition-all duration-300 overflow-hidden ${
          sidebarCollapsed ? 'left-[calc(4rem+1rem)]' : 'left-[calc(16rem+1rem)]'
        } ${
          dashboardCollapsed ? 'right-[calc(4rem+0.5rem+0.5rem)]' : 'right-[calc(20rem+0.5rem+0.5rem)]'
        }`}
      >
        <div className="flex flex-col h-full gap-4 px-2">
          {analysisMode ? (
            <>
              <div className="grid grid-cols-4 gap-4 h-[220px]">
                {Array.from({ length: 4 }, (_, index) => renderCameraCard(selectedCCTVs[index], index, true))}
              </div>
              <div className="flex-1 min-h-0 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-white/70 dark:bg-gray-800/60 flex items-center justify-center text-gray-500 dark:text-gray-300 text-sm font-medium">
                {(() => {
                  const target = selectedCCTVs.find((cctv) => cctv && cctv.cctv_id === analysisTargetId);
                  return target ? `${target.location} 분석 그래프 영역 (추후 구현 예정)` : '분석할 CCTV를 선택하세요.';
                })()}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
              {Array.from({ length: 4 }, (_, index) => renderCameraCard(selectedCCTVs[index], index, false))}
            </div>
          )}
        </div>

          {/* 대기 중인 CCTV 표시 */}
          {pendingCCTV && (
            <div 
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 backdrop-blur-xl"
              style={{
                background: 'rgba(53, 122, 189, 0.4)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px 0 rgba(53, 122, 189, 0.4)',
              }}
            >
              <span className="font-semibold">선택된 CCTV: {pendingCCTV.location}</span>
              <span className="text-sm opacity-90">→ 컴포넌트 위치를 클릭하여 배치하세요</span>
              <button
                onClick={() => favoritePageContext.setPendingCCTV(null)}
                className="ml-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all backdrop-blur-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                }}
              >
                취소
              </button>
            </div>
          )}
        </div>
      
      {/* 확대된 CCTV를 가리는 오버레이 - 투명하게 처리 */}
      {expandedIndex !== null && (
        <div
          className="fixed inset-0 z-40"
          style={{
            background: 'transparent',
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* 즐겨찾기 해제 확인 모달 */}
      {confirmModal.show && (
        <>
          {/* 모달 배경 오버레이 */}
          <div
            className="fixed inset-0 z-50"
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={() => setConfirmModal({ show: false, cctv_id: null, location: null })}
          />
          {/* 모달 */}
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              minWidth: '320px',
              maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#333',
                  marginBottom: '8px',
                }}
              >
                즐겨찾기 해제
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#666',
                  lineHeight: '1.5',
                }}
              >
                <strong style={{ color: '#333' }}>{confirmModal.location}</strong>의 즐겨찾기를 해제하시겠습니까?
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setConfirmModal({ show: false, cctv_id: null, location: null })}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666',
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
              >
                취소
              </button>
              <button
                onClick={confirmRemoveFavorite}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'white',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ef4444';
                }}
              >
                예
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes expandAnimation {
          from {
            transform: scale(0.85);
            opacity: 0.8;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes collapseAnimation {
          from {
            transform: scale(1);
            opacity: 1;
          }
          to {
            transform: scale(0.85);
            opacity: 0.8;
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
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