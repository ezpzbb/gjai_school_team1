import React from 'react';
import KakaoMap from '../components/KakaoMap';
import Dashboard from '../components/Dashboard/Dashboard';

const KakaoMapPage: React.FC = () => {
  return (
    <>
      <Dashboard />
      <div className="fixed left-64 right-[calc(20rem+0.5rem)] top-16 bottom-0 p-4">
        <KakaoMap />
      </div>
    </>
  );
};

export default KakaoMapPage;