import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import { useNotification } from './providers/NotificationProvider';
import MainPage from './pages/MainPage';
import LoginForm from './components/LoginForm';
import Home from './pages/Home';
import FavoritePage from './pages/FavoritePage';
import KakaoMapPage from './pages/KakaoMapPage';
import DashBoardPage from './pages/DashBoardPage';
import NotificationContainer from './components/Notification/NotificationContainer';

const App: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const { toastNotifications, removeToastNotification } = useNotification();

  console.log('App: Rendering', { isLoading, isLoggedIn });

  if (isLoading) {
    console.log('App: isLoading=true, showing loading state');
    return <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center justify-center">Loading...</div>;
  }

  return (
    <>
      <Routes>
      <Route path="/" element={<MainPage />}>
        <Route
          index
          element={isLoggedIn ? <Navigate to="/home" /> : <Navigate to="/auth/login" />}
        />
        <Route
          path="/home"
          element={isLoggedIn ? <Home /> : <Navigate to="/auth/login" />}
        />
        <Route
          path="/dashboard"
          element={isLoggedIn ? <DashBoardPage /> : <Navigate to="/auth/login" />}
        />
        <Route
          path="/kakao-map"
          element={isLoggedIn ? <KakaoMapPage /> : <Navigate to="/auth/login" />}
        />
        <Route
          path="/favorite"
          element={isLoggedIn ? <FavoritePage /> : <Navigate to="/auth/login" />}
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