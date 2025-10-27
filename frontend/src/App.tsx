import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import MainPage from './pages/MainPage';
import LoginForm from './components/LoginForm';
import Home from './pages/Home';
import KakaoMapPage from './pages/KakaoMapPage';

const App: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuth();

  console.log('App: Rendering', { isLoading, isLoggedIn }); // 디버깅 로그

  if (isLoading) {
    console.log('App: isLoading=true, showing loading state');
    return <div>Loading...</div>;
  }

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
          path="/kakao-map"
          element={isLoggedIn ? <KakaoMapPage /> : <Navigate to="/auth/login" />}
        />
      </Route>
      <Route path="/auth/login" element={<LoginForm />} />
    </Routes>
  );
};

export default App;