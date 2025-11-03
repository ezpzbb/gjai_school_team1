import React from 'react';
import KakaoMap from '../components/KakaoMap';
import Dashboard from '../components/Dashboard/Dashboard';

const KakaoMapPage: React.FC = () => {
  return (
    <>
      <Dashboard />
      <div className="fixed left-[calc(16rem+1rem+0.5rem)] right-[calc(20rem+0.5rem+0.5rem)] top-[calc(2rem+4rem+0.5rem)] bottom-2 p-4">
        <KakaoMap />
      </div>
    </>
  );
};

export default KakaoMapPage;