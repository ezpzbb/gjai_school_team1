import React from 'react';
import KakaoMap from '../components/KakaoMap';
import Dashboard from '../components/Dashboard/Dashboard';

const KakaoMapPage: React.FC = () => {
  return (
    <>
      <Dashboard />
      <div className="fixed left-[calc(16rem+1rem+0.5rem)] right-[calc(20rem+0.5rem+0.5rem)] top-[calc(2rem+4rem+0.5rem)] h-[calc(100vh-2rem-4rem-0.5rem-2rem)] p-4 z-30 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
        <KakaoMap />
      </div>
    </>
  );
};

export default KakaoMapPage;