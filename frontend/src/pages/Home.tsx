import React from 'react';
import { useAuth } from '../providers/AuthProvider';
import KakaoMap from '../components/KakaoMap'; // 👈 추가!

const Home: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="p-8">
      {/* 👈 상단: 사용자 정보 + 로그아웃 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">
          Welcome, <span className="text-blue-400">{user?.username}</span>!
        </h1>
        <p className="text-gray-300 mb-4">Email: {user?.email}</p>
        
      </div>

      {/* 👈 메인: CCTV 실시간 지도 */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">🚨 실시간 CCTV 모니터링</h2>
          <p className="text-gray-400">지도에서 CCTV 위치를 클릭하여 실시간 영상을 확인하세요</p>
        </div>
        
        {/* 👈 CCTV 지도 컴포넌트 */}
        <div className="w-full h-[600px] rounded-lg overflow-hidden shadow-xl">
          <KakaoMap />
        </div>
      </div>
    </div>
  );
};

export default Home;