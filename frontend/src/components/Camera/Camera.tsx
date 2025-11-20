import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { createApiUrl } from "../../config/apiConfig";
import { socketService } from "../../services/socket";
import { VehicleDetectionItem } from "../../types/vehicle";

// 아이콘 컴포넌트들
const FullscreenIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18 4.654v.291a10 10 0 0 0-1.763 1.404l-2.944 2.944a1 1 0 0 0 1.414 1.414l2.933-2.932A9.995 9.995 0 0 0 19.05 6h.296l-.09.39A9.998 9.998 0 0 0 19 8.64v.857a1 1 0 1 0 2 0V4.503a1.5 1.5 0 0 0-1.5-1.5L14.5 3a1 1 0 1 0 0 2h.861a10 10 0 0 0 2.249-.256l.39-.09zM4.95 18a10 10 0 0 1 1.41-1.775l2.933-2.932a1 1 0 0 1 1.414 1.414l-2.944 2.944A9.998 9.998 0 0 1 6 19.055v.291l.39-.09A9.998 9.998 0 0 1 8.64 19H9.5a1 1 0 1 1 0 2l-5-.003a1.5 1.5 0 0 1-1.5-1.5V14.5a1 1 0 1 1 2 0v.861a10 10 0 0 1-.256 2.249l-.09.39h.295z"
      fill={color}
    />
  </svg>
);

const FullscreenExitIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M19.293 3.293a1 1 0 1 1 1.414 1.414l-2.944 2.944A10 10 0 0 1 16 9.055v.291l.39-.09A10 10 0 0 1 18.64 9h.861a1 1 0 1 1 0 2l-5-.003a1.5 1.5 0 0 1-1.5-1.5V4.5a1 1 0 1 1 2 0v.861c0 .757-.086 1.511-.256 2.249l-.09.39h.295a9.995 9.995 0 0 1 1.411-1.775l2.933-2.932zM8 14.653v.292c-.638.4-1.23.87-1.763 1.404l-2.944 2.944a1 1 0 1 0 1.414 1.414l2.933-2.932A10 10 0 0 0 9.05 16h.296l-.09.39A10 10 0 0 0 9 18.64v.861a1 1 0 1 0 2 0v-4.997a1.5 1.5 0 0 0-1.5-1.5L4.5 13a1 1 0 1 0 0 2h.861c.757 0 1.511-.086 2.249-.256l.39-.09z"
      fill={color}
    />
  </svg>
);

const SearchIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="4" stroke={color} strokeWidth="1.5" fill="none" />
    <line x1="10" y1="10" x2="13" y2="13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface CameraProps {
  apiEndpoint: string | null;
  location?: string;
  cctv_id: number;
  isPopup?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClose?: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  isPlacementMode?: boolean;
  pageType?: "kakao-map" | "favorite";
  onAnalyze?: () => void;
  isAnalyzing?: boolean;
}

const Camera: React.FC<CameraProps> = ({
  apiEndpoint,
  location,
  cctv_id,
  isPopup,
  isFavorite,
  onToggleFavorite,
  onClose,
  onExpand,
  isExpanded,
  isPlacementMode = false,
  pageType,
  onAnalyze,
  isAnalyzing = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamCacheRef = useRef<Record<number, { url: string; expiresAt: number }>>({});
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stallStartTimeRef = useRef<number | null>(null);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchStreamUrl = useCallback(async (): Promise<string> => {
    const cached = streamCacheRef.current[cctv_id];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    const token = localStorage.getItem("token");
    const response = await fetch(createApiUrl(`/api/cctv/${cctv_id}/stream`), {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`스트림 요청 실패: ${response.status} ${body}`);
    }

    const result = await response.json();
    if (!result.success || !result.data?.streamUrl) {
      throw new Error(result.message || "스트림 URL을 가져오지 못했습니다.");
    }

    const expiresAt = result.data.cachedUntil ? new Date(result.data.cachedUntil).getTime() : Date.now() + 5 * 60 * 1000;

    streamCacheRef.current[cctv_id] = {
      url: result.data.streamUrl,
      expiresAt,
    };

    return result.data.streamUrl;
  }, [cctv_id]);

  const retryStreamLoad = useCallback(() => {
    // 기존 타이머 정리
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // 멈춤 감지 타이머도 정리
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    stallStartTimeRef.current = null;

    const MAX_RETRIES = 3;
    if (retryCountRef.current >= MAX_RETRIES) {
      setErrorMessage("영상 재생 중 오류가 발생했습니다. 재시도 횟수를 초과했습니다.");
      setIsRetrying(false);
      retryCountRef.current = 0;
      setRetryCount(0);
      return;
    }

    setIsRetrying(true);
    retryCountRef.current += 1;
    setRetryCount(retryCountRef.current);

    // 캐시 무효화하여 새로운 스트림 URL 요청
    delete streamCacheRef.current[cctv_id];

    // 5초 후 재시도
    retryTimeoutRef.current = setTimeout(() => {
      setIsResolving(true);
      setErrorMessage(null);

      fetchStreamUrl()
        .then((resolved) => {
          setStreamUrl(null); // 강제로 재로드하기 위해 null로 설정 후
          setTimeout(() => {
            setStreamUrl(resolved);
            retryCountRef.current = 0; // 성공 시 재시도 카운터 리셋
            setRetryCount(0);
            setIsRetrying(false);
          }, 100);
        })
        .catch((error) => {
          console.error("Camera: Retry failed", error);
          setIsRetrying(false);
          // 재시도 실패 시 다시 재시도 로직 호출
          if (retryCountRef.current < MAX_RETRIES) {
            retryStreamLoad();
          } else {
            setErrorMessage("영상 재생 중 오류가 발생했습니다. 재시도 횟수를 초과했습니다.");
            retryCountRef.current = 0;
            setRetryCount(0);
          }
        })
        .finally(() => {
          setIsResolving(false);
        });
    }, 5000);
  }, [cctv_id, fetchStreamUrl]);

  useEffect(() => {
    let cancelled = false;

    if (!apiEndpoint) {
      setStreamUrl(null);
      setErrorMessage(null);
      setIsVideoReady(false);
      setIsRetrying(false);
      retryCountRef.current = 0;
      setRetryCount(0);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      // 멈춤 감지 타이머도 정리
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      stallStartTimeRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    // 재시도 카운터 리셋
    retryCountRef.current = 0;
    setRetryCount(0);
    setIsResolving(true);
    setErrorMessage(null);
    setIsRetrying(false);

    fetchStreamUrl()
      .then((resolved) => {
        if (cancelled) return;
        setStreamUrl(resolved);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Camera: Unable to load stream URL", error);
        setStreamUrl(null);
        setErrorMessage("영상 스트림을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolving(false);
        }
      });

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [apiEndpoint, fetchStreamUrl]);

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    if (!streamUrl) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      videoElement.pause();
      videoElement.removeAttribute("src");
      videoElement.load();
      setIsVideoReady(false);
      return;
    }

    setIsVideoReady(false);
    setErrorMessage(null);

    videoElement.muted = true;
    videoElement.defaultMuted = true;
    videoElement.controls = true;
    videoElement.playsInline = true;

    const handleLoaded = () => {
      setIsVideoReady(true);
      setIsRetrying(false);
      retryCountRef.current = 0; // 성공 시 재시도 카운터 리셋
      setRetryCount(0);
    };

    const handleError = () => {
      setErrorMessage("영상 재생 중 오류가 발생했습니다.");
      // 5초 후 자동 재시도
      retryStreamLoad();
    };

    const STALL_TIMEOUT = 10000; // 10초 이상 멈춰있으면 재시도

    const handleStalled = () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;

      // 일시정지 상태가 아니고, 재생 중이어야 함
      if (videoEl.paused) return;

      if (!stallStartTimeRef.current) {
        stallStartTimeRef.current = Date.now();
      }

      // 기존 타이머가 있으면 정리
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
      }

      // 10초 후에도 여전히 멈춰있으면 재시도
      stallTimerRef.current = setTimeout(() => {
        const currentVideoEl = videoRef.current;
        if (!currentVideoEl) return;

        // 여전히 멈춰있고, 재생 중이어야 함 (일시정지가 아님)
        // readyState < 3: HAVE_FUTURE_DATA 미만이면 데이터 부족 상태
        if (!currentVideoEl.paused && currentVideoEl.readyState < 3) {
          console.log('Camera: Video stalled for too long, retrying...');
          setErrorMessage('영상 재생이 멈췄습니다. 자동으로 재시도합니다.');
          retryStreamLoad();
        }
      }, STALL_TIMEOUT);
    };

    const handleWaiting = () => {
      // waiting도 stalled와 동일한 로직 적용
      handleStalled();
    };

    const handlePlaying = () => {
      // 재생 재개 시 타이머 정리
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      stallStartTimeRef.current = null;
    };

    const handleCanPlay = () => {
      // 재생 가능 상태면 타이머 정리
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      stallStartTimeRef.current = null;
    };

    videoElement.addEventListener("loadeddata", handleLoaded);
    videoElement.addEventListener("error", handleError);
    videoElement.addEventListener("waiting", handleWaiting);
    videoElement.addEventListener("playing", handlePlaying);
    videoElement.addEventListener("canplay", handleCanPlay);

    const isHlsStream = streamUrl.toLowerCase().includes(".m3u8");

    const attemptAutoplay = () => {
      const playPromise = videoElement.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch(() => {
          setErrorMessage("자동 재생이 차단되었습니다. 브라우저 설정을 확인해주세요.");
        });
      }
    };

    if (isHlsStream && videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      videoElement.src = streamUrl;
      videoElement.load();
      attemptAutoplay();
    } else if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsInstanceRef.current = hls;
      hls.attachMedia(videoElement);
      hls.loadSource(streamUrl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        attemptAutoplay();
      });

      // HLS 프래그먼트 로딩 완료 시 타이머 리셋
      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (stallTimerRef.current) {
          clearTimeout(stallTimerRef.current);
          stallTimerRef.current = null;
        }
        stallStartTimeRef.current = null;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data) {
          return;
        }

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setErrorMessage("HLS 스트림을 불러오지 못했습니다.");
              hls.destroy();
              hlsInstanceRef.current = null;
              // HLS fatal 에러 발생 시 재시도 로직 호출
              retryStreamLoad();
              break;
          }
        }
      });
    } else {
      videoElement.src = streamUrl;
      videoElement.load();
      attemptAutoplay();
    }

    return () => {
      videoElement.pause();
      videoElement.removeEventListener("loadeddata", handleLoaded);
      videoElement.removeEventListener("error", handleError);
      videoElement.removeEventListener("waiting", handleWaiting);
      videoElement.removeEventListener("playing", handlePlaying);
      videoElement.removeEventListener("canplay", handleCanPlay);

      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }

      // 재시도 타이머 정리
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // 멈춤 감지 타이머 정리
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      stallStartTimeRef.current = null;
    };
  }, [streamUrl, retryStreamLoad]);

  const videoObjectFit = useMemo(() => {
    if (pageType === "kakao-map") {
      return "cover";
    }
    return "contain";
  }, [pageType]);

  const resolvedMimeType = useMemo(() => {
    if (!streamUrl) {
      return undefined;
    }
    const lower = streamUrl.toLowerCase();
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".ogg")) return "video/ogg";
    if (lower.endsWith(".mov")) return "video/quicktime";
    return undefined;
  }, [streamUrl]);

  // 모델의 바운딩 박스 값으로 오버레이 시각화
  useEffect(() => {
    // 소켓 연결 및 vehicle-updates 구독
    const unsubscribe = socketService.onVehicleUpdate(cctv_id, (payload) => {
      const canvas = overlayCanvasRef.current;
      const videoEl = videoRef.current;
      if (!canvas || !videoEl) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // canvas 크기를 video와 동기화
      canvas.width = videoEl.clientWidth;
      canvas.height = videoEl.clientHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;

      // ROI 폴리곤 그리기
      if (payload.roiPolygon) {
        const scaleX = canvas.width / videoEl.videoWidth;
        const scaleY = canvas.height / videoEl.videoHeight;
        ctx.beginPath();
        payload.roiPolygon.forEach(([x, y]: [number, number], idx: number) => {
          const sx = x * scaleX;
          const sy = y * scaleY;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.stroke();
      }

      // bbox 그리기
      payload.detections.forEach((det: VehicleDetectionItem) => {
        const [x1, y1, x2, y2] = det.bbox;
        const scaleX = canvas.width / videoEl.videoWidth;
        const scaleY = canvas.height / videoEl.videoHeight;
        ctx.strokeStyle = "yellow";
        ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x1 * scaleX, (y1 - 18) * scaleY, 80, 18);
        ctx.fillStyle = "white";
        ctx.fillText(`${det.cls} ${(det.conf * 100).toFixed(1)}%`, x1 * scaleX + 4, (y1 - 6) * scaleY);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [cctv_id]);

  const isLoading = isResolving || (!!streamUrl && !isVideoReady && !errorMessage);

  if (!apiEndpoint) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f0f0f0",
          borderRadius: "6px",
          fontSize: "14px",
          color: "#333",
        }}
      >
        영상을 선택하려면 CCTV 마커를 클릭하세요.
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "rgba(255, 255, 255, 0.01)",
        backdropFilter: "blur(25px)",
        WebkitBackdropFilter: "blur(25px)",
        borderRadius: "6px",
        overflow: "hidden",
        position: "relative",
        minHeight: 0,
      }}
    >
      {isPopup && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "#ff4444",
            color: "white",
            border: "none",
            fontSize: "16px",
            cursor: "pointer",
            zIndex: 20,
          }}
        >
          ×
        </button>
      )}

      <div
        style={{
          height: "40px",
          padding: "0 15px",
          background: "rgba(255, 255, 255, 0.015)",
          backdropFilter: "blur(25px)",
          WebkitBackdropFilter: "blur(25px)",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "14px",
          fontWeight: "bold",
          borderBottom: "1px solid rgba(53, 122, 189, 0.1)",
        }}
      >
        <span>📍 {location || "CCTV 위치"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onAnalyze && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze();
              }}
              style={{
                padding: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "white",
                background: isAnalyzing ? "rgba(220, 38, 38, 0.85)" : "rgba(59, 130, 246, 0.8)",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
                transform: "scale(1)",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 4px 10px rgba(0, 0, 0, 0.2)";
                e.currentTarget.style.background = isAnalyzing ? "rgba(185, 28, 28, 0.9)" : "rgba(37, 99, 235, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.15)";
                e.currentTarget.style.background = isAnalyzing ? "rgba(220, 38, 38, 0.85)" : "rgba(59, 130, 246, 0.8)";
              }}
            >
              <SearchIcon size={16} color="white" />
            </button>
          )}
          {onExpand && !isExpanded && (
            <button
              onClick={(e) => {
                if (isPlacementMode) return;
                e.stopPropagation();
                onExpand();
              }}
              disabled={isPlacementMode}
              style={{
                padding: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: isPlacementMode ? "rgba(255, 255, 255, 0.5)" : "white",
                background: isPlacementMode ? "rgba(156, 163, 175, 0.5)" : "rgba(53, 122, 189, 0.8)",
                border: "none",
                borderRadius: "6px",
                cursor: isPlacementMode ? "not-allowed" : "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
                transform: "scale(1)",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                opacity: isPlacementMode ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
              }}
              onMouseEnter={(e) => {
                if (isPlacementMode) return;
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(53, 122, 189, 0.25)";
                e.currentTarget.style.background = "rgba(37, 99, 235, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                e.currentTarget.style.background = "rgba(53, 122, 189, 0.8)";
              }}
            >
              <FullscreenIcon size={16} color="white" />
            </button>
          )}
          {onExpand && isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              style={{
                padding: "6px",
                fontSize: "12px",
                fontWeight: "600",
                color: "white",
                background: "rgba(107, 114, 128, 0.8)",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
                transform: "scale(1)",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(107, 114, 128, 0.25)";
                e.currentTarget.style.background = "rgba(75, 85, 99, 0.9)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                e.currentTarget.style.background = "rgba(107, 114, 128, 0.8)";
              }}
            >
              <FullscreenExitIcon size={16} color="white" />
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          backgroundColor: "#000",
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              maxWidth: isExpanded ? "100%" : "640px",
              maxHeight: "100%",
              backgroundColor: "#000",
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              controls
              title={`CCTV ${location || cctv_id}`}
              data-cctv-id={cctv_id}
              style={{
                width: "100%",
                height: "100%",
                objectFit: videoObjectFit,
                backgroundColor: "#000",
              }}
            >
              <canvas
                ref={overlayCanvasRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                }}
              />
              {streamUrl && resolvedMimeType && <source src={streamUrl} type={resolvedMimeType} />}
            </video>

            {isLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f9fafb",
                  fontSize: "14px",
                  background: "linear-gradient(180deg, rgba(17, 24, 39, 0.82) 0%, rgba(17, 24, 39, 0.7) 50%, rgba(17, 24, 39, 0.82) 100%)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                }}
              >
                영상 로딩 중...
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "16px",
                  color: "#ffe4e6",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "linear-gradient(180deg, rgba(127, 29, 29, 0.75) 0%, rgba(127, 29, 29, 0.6) 50%, rgba(127, 29, 29, 0.75) 100%)",
                  border: "1px solid rgba(248, 113, 113, 0.5)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                <div>{errorMessage}</div>
                {isRetrying && (
                  <div
                    style={{
                      marginTop: "12px",
                      fontSize: "12px",
                      fontWeight: 400,
                      color: "#fecaca",
                    }}
                  >
                    5초 후 자동으로 재시도합니다... ({retryCount}/3)
                  </div>
                )}
              </div>
            )}

            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "12px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  transform: "scale(1)",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 5,
                  background: "rgba(17, 24, 39, 0.65)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  color: isFavorite ? "#FACC15" : "#D1D5DB",
                  fontSize: "18px",
                }}
              >
                {isFavorite ? "★" : "☆"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Camera;
