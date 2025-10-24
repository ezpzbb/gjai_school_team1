import React, { useState } from 'react';
import KakaoMap from '../components/KakaoMap';
import Camera from '../components/Camera/Camera';

const Home: React.FC = () => {
  const [selectedCCTVUrl, setSelectedCCTVUrl] = useState<string | null>(null);

  const handleMarkerClick = (apiEndpoint: string) => {
    setSelectedCCTVUrl(apiEndpoint);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <h1>CCTV 지도</h1>
      <KakaoMap onMarkerClick={handleMarkerClick} />
      <Camera apiEndpoint={selectedCCTVUrl} />
    </div>
  );
};

export default Home;