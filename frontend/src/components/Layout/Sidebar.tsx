import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useLayout } from "../../providers/LayoutProvider";

const Sidebar: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const { sidebarCollapsed, toggleSidebar } = useLayout();

  // 네비게이션 항목 (Header와 동일)
  const navItems = [
    { key: "dashboard", label: "대시보드", path: "/dashboard" },
    { key: "map", label: "지도", path: "/kakao-map" },
    { key: "favorite", label: "딥러닝분석", path: "/favorite" },
  ];

  return (
    <aside 
      className={`fixed left-2 top-2 h-[calc(100vh-2.5rem)] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex flex-col rounded-lg shadow-lg transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* 축소 버튼 */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-8 w-6 h-6 bg-blue-600 dark:bg-blue-700 text-white rounded-full flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-800 transition z-50 shadow-lg"
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

      {/* 최상단: 로고 */}
      <div className={`p-4 mb-2 ${sidebarCollapsed ? 'text-center' : ''}`}>
        <Link to="/" className="flex items-center justify-center">
          <span className={`text-gray-900 dark:text-gray-100 font-bold transition-all duration-300 ${
            sidebarCollapsed ? 'text-xl' : 'text-2xl'
          }`}>
            {sidebarCollapsed ? 'P' : 'Palantir'}
          </span>
        </Link>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 p-4">
        <div className="flex flex-col space-y-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.path || pathname.startsWith(item.path);

            return (
              <Link
                key={item.key}
                to={item.path}
                className={`px-4 py-3 rounded-lg transition flex items-center justify-center ${
                  isActive
                    ? "bg-blue-600 dark:bg-blue-700 text-white font-semibold"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
                title={sidebarCollapsed ? item.label : ''}
              >
                {sidebarCollapsed ? (
                  <span className="text-lg">{item.label[0]}</span>
                ) : (
                  <span>{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 하단 설정 버튼 */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 mt-2">
        <Link
          to="/settings"
          className={`w-full px-4 py-3 rounded-lg transition flex items-center justify-center ${
            pathname === "/settings"
              ? "bg-blue-600 dark:bg-blue-700 text-white font-semibold"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
          }`}
          title={sidebarCollapsed ? "설정" : ''}
        >
          {sidebarCollapsed ? <span className="text-lg">⚙</span> : <span>설정</span>}
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
