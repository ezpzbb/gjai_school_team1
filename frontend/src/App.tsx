import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import MainPage from './pages/MainPage';
import LoginForm from './components/LoginForm';
import Home from './pages/Home';
import KakaoMapPage from './pages/KakaoMapPage'; // KakaoMapPage 컴포넌트 임포트

const App: React.FC = () => {
  const { isLoggedIn } = useAuth();

  return (
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
          path="/kakao-map" // 지도 페이지 라우트 추가
          element={isLoggedIn ? <KakaoMapPage /> : <Navigate to="/auth/login" />}
        />
      </Route>
      <Route path="/auth/login" element={<LoginForm />} />
    </Routes>
  );
};

export default App;