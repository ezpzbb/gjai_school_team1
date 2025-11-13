// 인증 서비스 - JWT 토큰 관리

import axios, { AxiosError } from 'axios';

interface User {
  user_id: number;
  username: string;
  email: string;
  name?: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface ErrorResponse {
  message: string;
}

const API_BASE_URL = '/api/users';

// JWT 토큰 관리 및 인증 API 호출
const AuthService = {
  // 회원가입
  async register(username: string, password: string, email: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/register`, {
        username,
        password,
        email,
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      return { token, user };
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw new Error(axiosError.response?.data?.message || 'Registration failed');
    }
  },

  // 로그인
  async login(identifier: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_BASE_URL}/login`, {
        identifier,
        password,
      });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      return { token, user };
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      throw new Error(axiosError.response?.data?.message || 'Login failed');
    }
  },

  // 프로필 조회
  async getProfile(): Promise<User> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No token found');
    }
    try {
      const response = await axios.get<{ user: User }>(`${API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.user;
    } catch (error) {
      localStorage.removeItem('token');
      throw new Error('Failed to fetch profile');
    }
  },

  // 로그아웃
  logout(): void {
    localStorage.removeItem('token');
  },

  // 토큰 존재 여부 확인
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  // 토큰 가져오기
  getToken(): string | null {
    return localStorage.getItem('token');
  },
};

export default AuthService;