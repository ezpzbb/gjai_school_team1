import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AuthService from '../services/auth';

interface User {
  user_id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean; // 추가
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 초기 인증 상태 확인
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('AuthProvider: Starting auth initialization');
      if (AuthService.isAuthenticated()) {
        console.log('AuthProvider: Token found, fetching profile');
        try {
          const user = await AuthService.getProfile();
          console.log('AuthProvider: Profile fetched, setting state', { user });
          setUser(user);
          setIsLoggedIn(true);
        } catch (error) {
          console.error('AuthProvider: Profile fetch failed', error);
          setIsLoggedIn(false);
          setUser(null);
        }
      } else {
        console.log('AuthProvider: No token found');
        setIsLoggedIn(false);
        setUser(null);
      }
      console.log('AuthProvider: Auth initialization complete, isLoading=false');
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const register = async (username: string, password: string, email: string) => {
    console.log('AuthProvider: Registering user', { username, email });
    const { user } = await AuthService.register(username, password, email);
    setUser(user);
    setIsLoggedIn(true);
  };

  const login = async (identifier: string, password: string) => {
    console.log('AuthProvider: Logging in', { identifier });
    const { user } = await AuthService.login(identifier, password);
    setUser(user);
    setIsLoggedIn(true);
  };

  const logout = () => {
    console.log('AuthProvider: Logging out');
    AuthService.logout();
    setIsLoggedIn(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, user, login, logout, register }}>
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