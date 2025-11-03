import React from "react";
import { Link, useLocation } from "react-router-dom";

const Sidebar: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;

  // 네비게이션 항목 (Header와 동일)
  const navItems = [
    { key: "dashboard", label: "대시보드", path: "/dashboard" },
    { key: "map", label: "지도", path: "/kakao-map" },
    { key: "favorite", label: "딥러닝분석", path: "/favorite" },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-gray-800 border-r border-gray-700 flex flex-col rounded-r-lg">
      {/* 최상단: 로고 */}
      <div className="p-4 mb-2">
        <Link to="/" className="flex items-center">
          
          <span className="text-white text-2xl font-bold">흑염룡CCTV</span>
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
                className={`px-4 py-3 rounded-lg transition flex items-center ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 하단 설정 버튼 */}
      <div className="p-4 border-t border-gray-700 mt-2">
        <Link
          to="/settings"
          className={`w-full px-4 py-3 rounded-lg transition flex items-center ${
            pathname === "/settings"
              ? "bg-blue-600 text-white"
              : "text-gray-300 hover:bg-gray-700 hover:text-white"
          }`}
        >
          <span>설정</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;
