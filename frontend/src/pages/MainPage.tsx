// 메인 페이지 레이아웃 - 공통 레이아웃 및 네비게이션
import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../components/Layout/Header";
import Sidebar from "../components/Layout/Sidebar";

const MainPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col relative">
      <Header />
      {/* 사이드바와 메인 콘텐츠 영역 */}
      <div className="flex pt-16">
        <Sidebar />
        {/* 사이드바 너비(64)만큼 왼쪽 패딩 추가 */}
        <main className="flex-grow ml-64 container mx-auto px-6 py-4 mt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainPage;