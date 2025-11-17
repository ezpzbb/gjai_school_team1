// API 설정 파일
// 환경 변수에서 API Base URL을 가져오고, 없으면 상대 경로 사용

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // 환경 변수가 있으면 사용 (끝에 슬래시 제거)
    return envUrl.replace(/\/$/, '');
  }
  // 환경 변수가 없으면 상대 경로 사용 (같은 도메인)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

// API URL 생성 헬퍼 함수
export const createApiUrl = (path: string): string => {
  // path가 이미 /로 시작하는지 확인
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
};

