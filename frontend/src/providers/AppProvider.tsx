// 앱 프로바이더 - 전역 상태 관리 및 컨텍스트 제공
import React from "react";
import type { ReactNode } from "react";

interface AppProviderProps {
  children: ReactNode;
}

const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (<>{children}</>);
};

export default AppProvider;