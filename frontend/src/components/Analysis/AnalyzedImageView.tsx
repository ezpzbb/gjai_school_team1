import React, { useState, useEffect } from 'react';
import { socketService, AnalyzedImagePayload } from '../../services/socket';

interface AnalyzedImageViewProps {
  cctvId: number;
}

const AnalyzedImageView: React.FC<AnalyzedImageViewProps> = ({ cctvId }) => {
  const [analyzedImageUrl, setAnalyzedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // analyzed-image 이벤트 구독 (Camera 컴포넌트와 동일한 방식)
  useEffect(() => {
    if (!cctvId) {
      setAnalyzedImageUrl(null);
      return;
    }

    setIsLoading(true);

    const unsubscribe = socketService.onAnalyzedImage(cctvId, (data: AnalyzedImagePayload) => {
      // Socket.IO로 직접 전송된 이미지 데이터 우선 사용
      if (data.imageData) {
        setAnalyzedImageUrl(data.imageData);
        setIsLoading(false);
      } else {
        // 하위 호환성: URL이 있는 경우 사용 (타임스탬프 추가)
        const imageUrlWithTimestamp = `${data.imageUrl}?t=${data.timestamp}`;
        setAnalyzedImageUrl(imageUrlWithTimestamp);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      setAnalyzedImageUrl(null);
      setIsLoading(false);
    };
  }, [cctvId]);

  return (
    <div className="h-full flex flex-col bg-black rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-800 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">분석 완료 이미지</h4>
        {analyzedImageUrl && (
          <span className="text-xs text-gray-400">
            실시간 업데이트 중...
          </span>
        )}
      </div>

      {/* 이미지 영역 - 항상 영역 유지, 우측과 같은 높이 */}
      <div className="flex-1 relative bg-black flex items-center justify-center min-h-0 overflow-hidden">
        {analyzedImageUrl ? (
          <img
            key={analyzedImageUrl}
            src={analyzedImageUrl}
            alt="Analyzed frame"
            className="max-w-full max-h-full object-contain"
            style={{
              transition: 'opacity 0.1s ease-in-out',
            }}
            onLoad={() => {
              setIsLoading(false);
            }}
            onError={(e) => {
              console.error('[AnalyzedImageView] 이미지 로드 실패:', analyzedImageUrl);
              setIsLoading(false);
              // 에러 발생 시 placeholder 표시
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="text-gray-400 text-sm text-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-gray-600 border-t-white rounded-full animate-spin" />
                <span>분석 이미지를 기다리는 중...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span>분석된 이미지가 표시됩니다</span>
                <span className="text-xs text-gray-500">분석 시작 후 이미지가 나타납니다</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyzedImageView;

