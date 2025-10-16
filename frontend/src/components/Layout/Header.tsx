import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";

// 임시 Icons 컴포넌트 (실제 구현 필요)
const Icons: React.FC<{ name: string; className: string }> = ({ name, className }) => {
  return <span className={className}>{name}</span>; // 실제 SVG 아이콘으로 대체 필요
};

// 임시 Notification 컴포넌트 (실제 구현 필요)
const Notification: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute right-0 mt-2 w-64 bg-white text-black rounded shadow-lg p-4 z-50">
      <button onClick={onClose} className="text-sm text-gray-600">
        알림 닫기
      </button>
      <p>알림 내용 (임시)</p>
    </div>
  );
};

const Header: React.FC = () => {
  const location = useLocation();
  const { isLoggedIn, user, logout } = useAuth();
  const pathname = location.pathname;

  // 유저 메뉴 상태
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 알림 팝업 상태
  const [notifOpen, setNotifOpen] = useState(false);
  const notifAnchorRef = useRef<HTMLButtonElement>(null);

  // 외부 클릭 감지 (유저 메뉴 및 알림)
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      // notifAnchorRef는 버튼 자체를 가리키므로, 버튼의 부모(relative div)로 영역을 확인
      const notifArea = notifAnchorRef.current?.parentElement;
      if (notifOpen && notifArea && !notifArea.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen, notifOpen]);

  // **요청에 따라 변경된 네비게이션 항목**
  const navItems = [
    { key: "dashboard", label: "대시보드", path: "/dashboard" },
    { key: "map", label: "지도", path: "/map" },
  ];

  const handleNotifClick = () => {
    setMenuOpen(false); // 다른 팝업 닫기
    setNotifOpen((o) => !o);
  };

  const handleMenuClick = () => {
    setNotifOpen(false); // 다른 팝업 닫기
    setMenuOpen((o) => !o);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black to-transparent px-6 py-4">
      <div className="container mx-auto flex items-center justify-between text-white">
        {/* 좌측: 로고 (메인 페이지로 랜딩) */}
        <Link to="/" className="flex items-center">
          <img src="/logo.svg" alt="Logo" className="h-10 w-auto" />
        </Link>

        {/* 중앙: 네비게이션 (대시보드, 지도) */}
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
                    isActive ? "text-blue-500" : "text-gray-300 hover:bg-white/30 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* 우측: 알림 + 프로필/로그인 */}
        <div className="flex items-center space-x-4">
          {isLoggedIn ? (
            <>
              {/* 알림 버튼 및 팝업 */}
              <div className="relative">
                <button
                  ref={notifAnchorRef}
                  onClick={handleNotifClick}
                  className="p-2 hover:bg-white/30 rounded-full transition"
                >
                  <Icons name="bell" className="w-8 h-8" />
                </button>
                {notifOpen && (
                  <Notification
                    isOpen={notifOpen}
                    onClose={() => setNotifOpen(false)}
                    anchorRef={notifAnchorRef}
                  />
                )}
              </div>

              {/* 프로필/유저 메뉴 (계정관리, 로그아웃) */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={handleMenuClick}
                  className="p-2 hover:bg-white/30 rounded-full transition"
                >
                  <Icons name="user" className="w-8 h-8" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white text-black rounded shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-2 border-b border-gray-200 font-semibold truncate">
                      {user?.name || "사용자"}
                    </div>
                    <Link
                      to="/settings" // 계정 관리 페이지로 이동
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      계정관리
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100"
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
              <button className="p-2 hover:bg-white/30 rounded-full transition flex items-center space-x-2 px-4">
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