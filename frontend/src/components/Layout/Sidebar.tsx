import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useLayout } from "../../providers/LayoutProvider";

const Sidebar: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const { sidebarCollapsed, toggleSidebar } = useLayout();

  // 네비게이션 항목 (Header와 동일)
  const navItems = [
    { key: "dashboard", label: "대시보드", path: "/dashboard", icon: "/icons/dashboard.svg" },
    { key: "map", label: "지도", path: "/kakao-map", icon: "/icons/map.svg" },
    { key: "favorite", label: "CCTV", path: "/favorite", icon: "/icons/cctv.svg" },
  ];

  return (
    <aside 
      className={`fixed left-2 top-[calc(0.5rem+4rem+0.5rem)] h-[calc(100vh-0.5rem-4rem-0.5rem-0.5rem)] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex flex-col rounded-lg shadow-lg transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* 축소 버튼 */}
      <button
        onClick={toggleSidebar}
        className="fixed w-6 h-6 bg-blue-600 dark:bg-blue-700 text-white rounded-full flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-800 transition-all duration-300 z-[100] shadow-lg"
        style={{ 
          left: `calc(0.5rem + ${sidebarCollapsed ? '4rem' : '14rem'} - 0.75rem)`,
          top: '50vh', 
          transform: 'translateY(-50%)' 
        }}
        title={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
      >
        <svg
          className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 네비게이션 메뉴 */}
      <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
        <div className="flex flex-col space-y-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.path || pathname.startsWith(item.path);

            return (
              <Link
                key={item.key}
                to={item.path}
                className={`rounded-lg transition flex items-center ${
                  sidebarCollapsed ? 'justify-center p-2' : 'px-4 py-3 gap-3'
                } ${
                  isActive
                    ? "bg-blue-600 dark:bg-blue-700 text-white font-semibold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                <img 
                  src={item.icon} 
                  alt={item.label}
                  className={`w-6 h-6 transition-all duration-300 ${
                    isActive ? 'brightness-0 invert' : 'dark:brightness-0 dark:invert'
                  }`}
                />
                {!sidebarCollapsed && (
                  <span>{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 하단 설정 버튼 */}
      <div className={`border-t border-gray-200 dark:border-gray-700 mt-2 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
        <Link
          to="/settings"
          className={`w-full rounded-lg transition flex items-center justify-center ${
            sidebarCollapsed ? 'p-2' : 'px-4 py-3'
          } ${
            pathname === "/settings"
              ? "bg-blue-600 dark:bg-blue-700 text-white font-semibold"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
          title={sidebarCollapsed ? "설정" : ''}
        >
          {sidebarCollapsed ? <span className="text-2xl">⚙</span> : <span>설정</span>}
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
