import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import MainPage from './pages/MainPage';
import LoginForm from './components/LoginForm';
import Home from './pages/Home';
import Header from './components/Layout/Header';
//import Management from './components/Management';
//import Settings from './components/Settings';

const App: React.FC = () => {
  const { isLoggedIn } = useAuth();
  return (
    <>
      <Header />
      <div className="pt-20">
        <Routes>
          <Route path="/" element={<MainPage />}>
            <Route index element={isLoggedIn ? <Navigate to="/home" /> : <Navigate to="/auth/login" />} />
            <Route path="/home" element={isLoggedIn ? <Home /> : <Navigate to="/auth/login" />} />
            <Route path="/auth/login" element={<LoginForm />} />
  
  
          </Route>
        </Routes>
      </div>
    </>
  );
};

export default App;