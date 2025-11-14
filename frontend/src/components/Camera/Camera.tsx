import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { socketService } from "../../services/socket";

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

const sanitizeStreamCandidate = (candidate: string): string | null => {
  if (!candidate) {
    return null;
  }

  let cleaned = candidate.trim();
  cleaned = cleaned.replace(/--+>?$/, "");
  cleaned = cleaned.replace(/;+$/, "");
  cleaned = cleaned.replace(/\)+$/, "");
  cleaned = cleaned.replace(/&amp;/gi, "&");
  cleaned = cleaned.replace(/\\u0026/g, "&");

  if (!/^https?:\/\//i.test(cleaned)) {
    return null;
  }

  try {
    return decodeURI(cleaned);
  } catch {
    return cleaned;
  }
};

const extractStreamFromHtml = (html: string): string | null => {
  const hlsRegex = /https?:\/\/[^"'<>\\s]+\.m3u8[^"'<>\\s]*/gi;
  let match: RegExpExecArray | null;
  while ((match = hlsRegex.exec(html)) !== null) {
    const sanitized = sanitizeStreamCandidate(match[0]);
    if (sanitized && !sanitized.toLowerCase().includes("undefined")) {
      return sanitized;
    }
  }

  const mp4Regex = /https?:\/\/[^"'<>\\s]+\.mp4[^"'<>\\s]*/gi;
  while ((match = mp4Regex.exec(html)) !== null) {
    const sanitized = sanitizeStreamCandidate(match[0]);
    if (sanitized && !sanitized.toLowerCase().includes("undefined")) {
      return sanitized;
    }
  }

  return null;
};

const buildGwangjuFallback = (endpoint: URL): string | null => {
  const kind = endpoint.searchParams.get("kind")?.toLowerCase();
  const channelRaw = endpoint.searchParams.get("cctvch");
  const idRaw = endpoint.searchParams.get("id");

  if (kind !== "v" || !channelRaw || !idRaw) {
    return null;
  }

  const channel = channelRaw.match(/\d+/)?.[0];
  const id = idRaw.match(/\d+/)?.[0];

  if (!channel || !id) {
    return null;
  }

  return `https://gjtic.go.kr/cctv${channel}/livehttp/${id}_video2/chunklist.m3u8`;
};

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
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const hlsInstanceRef = useRef<Hls | null>(null);
  const streamCacheRef = useRef<Record<string, string>>({});

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolveStreamUrl = useCallback(async (endpoint: string): Promise<string> => {
    const normalized = (() => {
      try {
        return new URL(endpoint, window.location.origin).toString();
      } catch {
        return endpoint;
      }
    })();

    if (streamCacheRef.current[normalized]) {
      return streamCacheRef.current[normalized];
    }

    const lower = normalized.toLowerCase();
    if (lower.includes(".m3u8")) {
      streamCacheRef.current[normalized] = normalized;
      return normalized;
    }

    const endpointUrl = new URL(normalized, window.location.origin);
    const fallbackCandidate = buildGwangjuFallback(endpointUrl);

    try {
      const response = await fetch(normalized, {
        mode: "cors",
        credentials: "omit",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const extracted = extractStreamFromHtml(html);

      if (extracted) {
        streamCacheRef.current[normalized] = extracted;
        return extracted;
      }
    } catch (error) {
      console.warn("Camera: Failed to fetch UTIC stream page", error);
    }

    if (fallbackCandidate) {
      streamCacheRef.current[normalized] = fallbackCandidate;
      return fallbackCandidate;
    }

    throw new Error("STREAM_URL_NOT_FOUND");
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!apiEndpoint) {
      setStreamUrl(null);
      setErrorMessage(null);
      setIsVideoReady(false);
      return () => {
        cancelled = true;
      };
    }

    setIsResolving(true);
    setErrorMessage(null);

    resolveStreamUrl(apiEndpoint)
      .then((resolved) => {
        if (cancelled) return;
        setStreamUrl(resolved);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Camera: Unable to resolve stream URL", error);
        setStreamUrl(null);
        setErrorMessage("영상 스트림 URL을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiEndpoint, resolveStreamUrl]);

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
    };

    const handleError = () => {
      setErrorMessage("영상 재생 중 오류가 발생했습니다.");
    };

    videoElement.addEventListener("loadeddata", handleLoaded);
    videoElement.addEventListener("error", handleError);

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

      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
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
        payload.roiPolygon.forEach(([x, y], idx) => {
          const sx = x * scaleX;
          const sy = y * scaleY;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.stroke();
      }

      // bbox 그리기
      payload.detections.forEach((det) => {
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

  const videoObjectFit = useMemo(() => {
    if (pageType === "kakao-map") {
      return "cover";
    }
    return isExpanded ? "cover" : "contain";
  }, [isExpanded, pageType]);

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
                padding: "4px 12px",
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
              {isAnalyzing ? "분석종료" : "분석하기"}
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
                padding: "4px 12px",
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
              크게보기
            </button>
          )}
          {onExpand && isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              style={{
                padding: "4px 12px",
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
              되돌리기
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
              borderRadius: "8px",
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
              {streamUrl && resolvedMimeType && <source src={streamUrl} type={resolvedMimeType} />}
            </video>
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            />
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
                {errorMessage}
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
