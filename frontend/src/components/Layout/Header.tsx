import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";

// 임시 Icons 컴포넌트 (실제 구현 필요)
const Icons: React.FC<{ name: string; className: string }> = ({ name, className }) => {
  return <span className={className}>{name}</span>; // 실제 SVG 아이콘으로 대체 필요
};

const Header: React.FC = () => {
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
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
    { key: "favorite", label: "딥러닝분석", path: "/favorite" }, // FavoritePage.tsx로 이동
  ];

  const handleMenuClick = () => {
    setMenuOpen((o) => !o);
  };

  return (
    <header className="fixed top-0 left-64 right-0 z-50 bg-white border-b border-gray-200 px-6 py-4 rounded-bl-lg shadow-sm">
      <div className="container mx-auto flex items-center justify-between text-gray-900">
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
                    isActive ? "text-blue-600 font-semibold" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* 우측: 프로필/로그인 */}
        <div className="flex items-center space-x-4 ml-auto">
          {isLoggedIn ? (
            <>
              {/* 프로필/유저 메뉴 (계정관리, 로그아웃) */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={handleMenuClick}
                  className="p-2 hover:bg-gray-100 rounded-full transition"
                >
                  <Icons name="user" className="w-8 h-8" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white text-gray-900 rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="px-4 py-2 border-b border-gray-200 font-semibold truncate bg-gray-50">
                      {user?.username || "사용자"}
                    </div>
                    <Link
                      to="/settings" // 계정 관리 페이지로 이동
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                      onClick={() => setMenuOpen(false)}
                    >
                      계정관리
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 로그인 버튼 */
            <Link to="/auth/login">
              <button className="p-2 hover:bg-gray-100 rounded-full transition flex items-center space-x-2 px-4 text-gray-700 hover:text-gray-900">
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