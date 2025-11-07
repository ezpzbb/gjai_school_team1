import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LayoutContextType {
  sidebarCollapsed: boolean;
  dashboardCollapsed: boolean;
  toggleSidebar: () => void;
  toggleDashboard: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
};

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);
  const toggleDashboard = () => setDashboardCollapsed((prev) => !prev);

  return (
    <LayoutContext.Provider
      value={{
        sidebarCollapsed,
        dashboardCollapsed,
        toggleSidebar,
        toggleDashboard,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

