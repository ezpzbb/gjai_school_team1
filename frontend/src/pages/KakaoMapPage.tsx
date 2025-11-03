import React from 'react';
import KakaoMap from '../components/KakaoMap';
import Dashboard from '../components/Dashboard/Dashboard';

const KakaoMapPage: React.FC = () => {
  return (
    <>
      <Dashboard />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', paddingRight: '340px' }}>
        <h1>CCTV 지도</h1>
        <KakaoMap />
      </div>
    </>
  );
};

export default KakaoMapPage;