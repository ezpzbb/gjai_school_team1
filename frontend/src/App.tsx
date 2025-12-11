import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./providers/AuthProvider";
import { useNotification } from "./providers/NotificationProvider";
import MainPage from "./pages/MainPage";
import LoginForm from "./components/LoginForm";
import FavoritePage from "./pages/FavoritePage";
import KakaoMapPage from "./pages/KakaoMapPage";
import DashBoardPage from "./pages/DashBoardPage";
import NotificationContainer from "./components/Notification/NotificationContainer";

const App: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const { toastNotifications, removeToastNotification } = useNotification();

  console.log("App: Rendering", { isLoading, isLoggedIn });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<MainPage />}>
          {/* ★ 로그인 성공 시 기본 랜딩 페이지 = /kakao-map 으로 변경 ★ */}
          <Route
            index
            element={
              isLoggedIn
                ? <Navigate to="/kakao-map" replace />
                : <Navigate to="/auth/login" replace />
            }
          />

          <Route
            path="/dashboard"
            element={isLoggedIn ? <DashBoardPage /> : <Navigate to="/auth/login" replace />}
          />

          <Route
            path="/kakao-map"
            element={isLoggedIn ? <KakaoMapPage /> : <Navigate to="/auth/login" replace />}
          />

          <Route
            path="/favorite"
            element={isLoggedIn ? <FavoritePage /> : <Navigate to="/auth/login" replace />}
          />

          {/* 기존 /home → dashboard */}
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />

          {/* 알 수 없는 경로 처리 */}
          <Route
            path="*"
            element={
              isLoggedIn
                ? <Navigate to="/kakao-map" replace />   // 기본 경로도 /kakao-map 로 맞춰줌
                : <Navigate to="/auth/login" replace />
            }
          />
        </Route>

        <Route path="/auth/login" element={<LoginForm />} />
      </Routes>

      <NotificationContainer
        notifications={toastNotifications}
        onClose={removeToastNotification}
      />
    </>
  );
};

export default App;
