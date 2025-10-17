import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AuthService from '../services/auth';

interface User {
  user_id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  register: (username: string, password: string, email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);

  // 초기 인증 상태 확인
  useEffect(() => {
    const initializeAuth = async () => {
      if (AuthService.isAuthenticated()) {
        try {
          const user = await AuthService.getProfile();
          setUser(user);
          setIsLoggedIn(true);
        } catch {
          setIsLoggedIn(false);
          setUser(null);
        }
      }
    };
    initializeAuth();
  }, []);

  const register = async (username: string, password: string, email: string) => {
    const { user } = await AuthService.register(username, password, email);
    setUser(user);
    setIsLoggedIn(true);
  };

  const login = async (identifier: string, password: string) => {
    const { user } = await AuthService.login(identifier, password);
    setUser(user);
    setIsLoggedIn(true);
  };

  const logout = () => {
    AuthService.logout();
    setIsLoggedIn(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;