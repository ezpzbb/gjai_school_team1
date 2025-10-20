import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import MainPage from './pages/MainPage';
import LoginForm from './components/LoginForm';
import Home from './pages/Home';

const App: React.FC = () => {
  const { isLoggedIn } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<MainPage />}>
        <Route index element={isLoggedIn ? <Navigate to="/home" /> : <Navigate to="/auth/login" />} />
        <Route path="/home" element={isLoggedIn ? <Home /> : <Navigate to="/auth/login" />} />
      </Route>
      <Route path="/auth/login" element={<LoginForm />} />
    </Routes>
  );
};

export default App;