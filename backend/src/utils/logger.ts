// 로깅 유틸리티

const DEBUG_MODE = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

export const logger = {
  debug: (...args: any[]) => {
    if (DEBUG_MODE) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    console.log('[INFO]', ...args);
  },
  
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  },
};

