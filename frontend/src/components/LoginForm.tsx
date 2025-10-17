import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import validator from 'validator'; // validator 라이브러리 임포트

const LoginForm: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState(''); // 이메일 오류 상태
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // 이메일 검증 함수 (validator 사용)
  const validateEmail = (email: string): boolean => {
    return validator.isEmail(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    // 회원가입 시 이메일 검증
    if (!isLogin && !validateEmail(email)) {
      setEmailError('올바른 이메일 형식을 입력해주세요 (예: user@example.com)');
      return;
    }

    try {
      if (isLogin) {
        console.log('Submitting login:', { identifier });
        await login(identifier, password);
        console.log('Login successful');
        navigate('/home');
      } else {
        console.log('Submitting register:', { username, email });
        await register(username, password, email);
        console.log('Register successful');
        navigate('/home');
      }
    } catch (err: any) {
      console.error('Submit error:', err.message);
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          {isLogin ? '로그인' : '회원가입'}
        </h2>
        <div className="flex justify-center mb-4">
          <button
            className={`px-4 py-2 ${isLogin ? 'bg-blue-600' : 'bg-gray-600'} text-white rounded-l`}
            onClick={() => setIsLogin(true)}
          >
            로그인
          </button>
          <button
            className={`px-4 py-2 ${!isLogin ? 'bg-blue-600' : 'bg-gray-600'} text-white rounded-r`}
            onClick={() => setIsLogin(false)}
          >
            회원가입
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                  사용자 이름
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="사용자 이름"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(''); // 입력 변경 시 오류 초기화
                  }}
                  className={`mt-1 block w-full px-3 py-2 bg-gray-700 border ${emailError ? 'border-red-500' : 'border-gray-600'} rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="이메일"
                  required
                />
                {emailError && <p className="mt-1 text-sm text-red-500">{emailError}</p>}
              </div>
            </>
          )}
          {isLogin && (
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-300">
                사용자 이름 또는 이메일
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="사용자 이름 또는 이메일"
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="비밀번호"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isLogin ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;