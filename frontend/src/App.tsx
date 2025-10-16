import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainPage from "./pages/MainPage";

// 1. 필요한 컴포넌트 및 프로바이더 임포트
import AppProvider from "./providers/AppProvider";
import AuthProvider from "./providers/AuthProvider"; // AuthProvider 임포트
import Header from "./components/Layout/Header"; // Header 컴포넌트 임포트 (경로 확인 필요)

// 임시 페이지 컴포넌트 정의 (화면 테스트용)
const Management = () => <div className="p-10"><h1>대시보드 페이지 (Management.tsx)</h1></div>;
const Settings = () => <div className="p-10"><h1>계정관리 페이지 (Settings.tsx)</h1></div>;
const News = () => <div className="p-10"><h1>뉴스 페이지</h1></div>;
const Market = () => <div className="p-10"><h1>마켓 페이지</h1></div>;
const Community = () => <div className="p-10"><h1>커뮤니티 페이지</h1></div>;
const AuthLogin = () => <div className="p-10"><h1>로그인 페이지 (/auth/login)</h1><p>이곳에서 AuthProvider의 login() 함수를 실행하면 로그인 상태가 됩니다.</p></div>;


const App: React.FC = () => {
  return (
    <AppProvider>
      {/* 2. Header가 사용하는 useAuth를 위해 AuthProvider로 감싸기 */}
      <AuthProvider>
        <BrowserRouter>
          {/* 3. Header를 Routes 밖에 배치하여 모든 페이지 상단에 고정 */}
          <Header />
          
          {/* fixed Header에 가려지지 않도록 메인 콘텐츠에 여백 추가 (테일윈드 기준) */}
          <div className="pt-20"> 
            <Routes>
              <Route path="/" element={<MainPage />} />
              {/* Header의 네비게이션 및 버튼 경로 추가 */}
              <Route path="/news" element={<News />} />
              <Route path="/market" element={<Market />} />
              <Route path="/community" element={<Community />} />
              <Route path="/management" element={<Management />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/auth/login" element={<AuthLogin />} />
              
              {/* Header의 경로 활성화 로직을 위해 필요한 서브 경로들도 추가 */}
              <Route path="/asset/*" element={<Market />} />
              <Route path="/post/*" element={<Community />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </AppProvider>
  );
};

export default App;