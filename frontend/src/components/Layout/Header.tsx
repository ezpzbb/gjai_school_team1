import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { useLayout } from "../../providers/LayoutProvider";



const Header: React.FC = () => {
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { sidebarCollapsed } = useLayout();
  const pathname = location.pathname;

  // 유저 메뉴 상태
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지 (유저 메뉴)
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  // 네비게이션 항목 (지도 경로를 /kakao-map으로 변경, 딥러닝분석 추가)
  const navItems = [
    { key: "dashboard", label: "대시보드", path: "/dashboard" },
    { key: "map", label: "지도", path: "/kakao-map" },
    { key: "favorite", label: "CCTV", path: "/favorite" }, // FavoritePage.tsx로 이동
  ];

  const handleMenuClick = () => {
    setMenuOpen((o) => !o);
  };

  return (
    <header 
      className={`fixed top-2 right-2 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 ${
        sidebarCollapsed ? 'left-[calc(4rem+1rem)]' : 'left-[calc(16rem+1rem)]'
      }`}
    >
      <div className="container mx-auto flex items-center justify-between text-gray-900 dark:text-gray-100" style={{ minHeight: '40px' }}>
        {/* 중앙: 네비게이션 (대시보드, 지도, 딥러닝분석) */}
        <div className="hidden lg:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center space-x-4">
            {navItems.map((item) => {
              const isActive =
                pathname === item.path || pathname.startsWith(item.path);

              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`px-4 py-1 whitespace-nowrap rounded-full transition ${
                    isActive 
                      ? "text-blue-600 dark:text-blue-400 font-semibold" 
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* 우측: 프로필/로그인 - placeholder로 높이 유지 */}
        <div className="flex items-center space-x-4 ml-auto">
          {/* 높이 유지를 위한 투명 placeholder */}
          <div style={{ width: '180px', height: '40px' }} className="invisible"></div>
          {/* 다크모드 전환 버튼 - 우측 고정 */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
            style={{
              position: 'fixed',
              right: 'calc(2rem + 90px)',
              top: 'calc(0.5rem + 2.25rem)',
              transform: 'translateY(-50%)',
              zIndex: 60
            }}
            aria-label={theme === 'light' ? '다크모드로 전환' : '라이트모드로 전환'}
          >
            {theme === 'light' ? (
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          {isLoggedIn ? (
            <>
              {/* 프로필/유저 메뉴 (계정관리, 로그아웃) - 우측 고정 */}
              <div 
                className="relative" 
                ref={menuRef}
                style={{
                  position: 'fixed',
                  right: '2rem',
                  top: 'calc(0.5rem + 2.25rem)',
                  transform: 'translateY(-50%)',
                  zIndex: 60
                }}
              >
                <button
                  onClick={handleMenuClick}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition flex items-center space-x-2"
                >
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{user?.username || "사용자"}</span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 font-semibold truncate bg-gray-50 dark:bg-gray-900">
                      {user?.username || "사용자"}
                    </div>
                    <Link
                      to="/settings" // 계정 관리 페이지로 이동
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      계정관리
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 로그인 버튼 - 우측 고정 */
            <Link 
              to="/auth/login"
              style={{
                position: 'fixed',
                right: '2rem',
                top: 'calc(0.5rem + 2.25rem)',
                transform: 'translateY(-50%)',
                zIndex: 60
              }}
            >
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition flex items-center space-x-2 px-4 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                <span className="hidden sm:inline">로그인</span>
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;