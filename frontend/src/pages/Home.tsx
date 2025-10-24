import React from 'react';
import KakaoMap from '../components/KakaoMap';

const Home: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <h1>CCTV 지도</h1>
      <KakaoMap />
    </div>
  );
};

export default Home;