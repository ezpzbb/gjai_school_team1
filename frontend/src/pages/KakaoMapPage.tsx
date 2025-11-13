import React from 'react';
import KakaoMap from '../components/KakaoMap';
import Dashboard from '../components/Dashboard/Dashboard';
import { MapProvider } from '../providers/MapProvider';
import { useLayout } from '../providers/LayoutProvider';

const KakaoMapPage: React.FC = () => {
  const { sidebarCollapsed, dashboardCollapsed } = useLayout();
  
  return (
    <MapProvider>
      <Dashboard />
      <div 
        className={`fixed top-[calc(2rem+4rem+0.5rem)] h-[calc(100vh-2rem-4rem-0.5rem-2rem)] p-4 z-30 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${
          sidebarCollapsed ? 'left-[calc(4rem+1rem+0.5rem)]' : 'left-[calc(16rem+1rem+0.5rem)]'
        } ${
          dashboardCollapsed ? 'right-[calc(4rem+0.5rem+0.5rem)]' : 'right-[calc(20rem+0.5rem+0.5rem)]'
        }`}
      >
        <KakaoMap />
      </div>
    </MapProvider>
  );
};

export default KakaoMapPage;
