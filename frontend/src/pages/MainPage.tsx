// 메인 페이지 레이아웃 - 공통 레이아웃 및 네비게이션
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Layout/Header";

const MainPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col relative">
      <Header />
      {/* 헤더 높이에 맞춘 패딩, fixed 헤더를 고려해 pt-16으로 설정 */}
      <main className="pt-16 container mx-auto flex-grow">
        <Outlet />
      </main>
    </div>
  );
};

export default MainPage;