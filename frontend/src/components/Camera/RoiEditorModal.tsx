import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { CircularProgress } from "../common/CircularProgress";

interface RoiEditorModalProps {
  cctvId: number;
  streamUrl: string;
  onClose: () => void;
}

type DirectionKey = "upstream" | "downstream";
const DIR_LABEL: Record<DirectionKey, string> = { downstream: "하행", upstream: "상행" };
const DIR_COLOR: Record<DirectionKey, { stroke: string; fill: string; point: string }> = {
  downstream: { stroke: "#3b82f6", fill: "rgba(59,130,246,0.25)", point: "#2563eb" }, // blue
  upstream: { stroke: "#22c55e", fill: "rgba(34,197,94,0.2)", point: "#16a34a" }, // green
};

const RoiEditorModal: React.FC<RoiEditorModalProps> = ({ cctvId, streamUrl, onClose }) => {
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDir, setActiveDir] = useState<DirectionKey>("upstream");
  const [upPoints, setUpPoints] = useState<[number, number][]>([]);
  const [downPoints, setDownPoints] = useState<[number, number][]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // hls 초기화를 통해 모달창에서 비디오 재생 안정화
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    // 이전 HLS 인스턴스 정리
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = streamUrl.toLowerCase().includes(".m3u8");

    const attemptPlay = () => {
      const p = video.play();
      if (p && typeof p.then === "function") {
        p.catch(() => {
          // 자동재생 차단 등은 무시
        });
      }
    };

    if (isHls) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // 사파리 등 네이티브 HLS 지원
        video.src = streamUrl;
        video.load();
        attemptPlay();
      } else if (Hls.isSupported()) {
        // 크롬/엣지 등: Hls.js 사용
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.attachMedia(video);
        hls.loadSource(streamUrl);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          attemptPlay();
        });
      } else {
        // 마지막 fallback
        video.src = streamUrl;
        video.load();
        attemptPlay();
      }
    } else {
      // mp4/webm 등 일반 파일
      video.src = streamUrl;
      video.load();
      attemptPlay();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      // 모달 닫힐 때 정리
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl]);

  /* ------ roi 좌표 최적화 헬퍼 함수 start --------------- */

  // 공통 헬퍼: video 좌표 -> 캔버스 좌표
  function videoToCanvas(vx: number, vy: number, vw: number, vh: number, cw: number, ch: number): { x: number; y: number } {
    const scale = Math.min(cw / vw, ch / vh);
    const drawnW = vw * scale;
    const drawnH = vh * scale;
    const offsetX = (cw - drawnW) / 2;
    const offsetY = (ch - drawnH) / 2;
    return {
      x: offsetX + vx * scale,
      y: offsetY + vy * scale,
    };
  }

  // 공통 헬퍼: 캔버스 좌표 -> video 좌표
  function canvasToVideo(px: number, py: number, vw: number, vh: number, cw: number, ch: number): { x: number; y: number } {
    const scale = Math.min(cw / vw, ch / vh);
    const drawnW = vw * scale;
    const drawnH = vh * scale;
    const offsetX = (cw - drawnW) / 2;
    const offsetY = (ch - drawnH) / 2;

    const vx = (px - offsetX) / scale;
    const vy = (py - offsetY) / scale;
    return { x: vx, y: vy };
  }

  /* ------ roi 좌표 최적화 헬퍼 함수 end --------------- */

  // 비디오 크기에 맞게 캔버스 크기 맞추기
  useEffect(() => {
    const syncSize = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.clientWidth || video.videoWidth || 0;
      canvas.height = video.clientHeight || video.videoHeight || 0;
    };

    syncSize();
    window.addEventListener("resize", syncSize);
    return () => {
      window.removeEventListener("resize", syncSize);
    };
  }, []);

  // ROI 폴리곤 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = video.videoWidth || canvas.width || 1;
    const vh = video.videoHeight || canvas.height || 1;
    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // 11/28: 상행 및 하행 구분하여 표현
    const drawPoly = (points: [number, number][], dir: DirectionKey) => {
      if (points.length === 0) return;
      const color = DIR_COLOR[dir];
      ctx.save();
      ctx.strokeStyle = color.stroke;
      ctx.fillStyle = color.fill;
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach(([vx, vy], idx) => {
        const { x, y } = videoToCanvas(vx, vy, vw, vh, cw, ch);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (points.length >= 3) ctx.closePath();
      ctx.stroke();
      if (points.length >= 3) ctx.fill();
      ctx.restore();

      ctx.fillStyle = color.point;
      points.forEach(([vx, vy]) => {
        const { x, y } = videoToCanvas(vx, vy, vw, vh, cw, ch);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    drawPoly(upPoints, "upstream");
    drawPoly(downPoints, "downstream");
  }, [upPoints, downPoints]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const vw = video.videoWidth || canvas.width || 1;
    const vh = video.videoHeight || canvas.height || 1;
    const cw = canvas.width;
    const ch = canvas.height;

    const { x: vx, y: vy } = canvasToVideo(px, py, vw, vh, cw, ch);

    // 11/28: 상행 및 하행 포인트
    const point: [number, number] = [Math.round(vx), Math.round(vy)];

    if (activeDir === "upstream") setUpPoints((prev) => [...prev, point]);
    else setDownPoints((prev) => [...prev, point]);
  };

  // 11/28: 상행 및 하행 코드 추가
  const clearCurrent = () => {
    if (activeDir === "upstream") setUpPoints([]);
    else setDownPoints([]);
  };
  const clearAll = () => {
    setUpPoints([]);
    setDownPoints([]);
  };

  // 11/28: 상행 및 하행 handleSave 코드 수정 및 개선
  const handleSave = async () => {
    if (upPoints.length < 3 && downPoints.length < 3) {
      alert("상행 또는 하행 중 하나 이상 3포인트 이상 지정해야 합니다.");
      return;
    }
    setSavingProgress(0);
    setIsSaving(true);
    const start = Date.now();
    const timer = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 1000) * 100);
      setSavingProgress(pct);
      if (pct >= 100) window.clearInterval(timer);
    }, 100);

    try {
      const res = await fetch(`/model/view/roi?cctv_id=${cctvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upstream: upPoints, downstream: downPoints }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("ROI가 저장되었습니다.");
      onClose();
    } catch (e) {
      console.error("Failed to save ROI:", e);
      alert("ROI 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
      setSavingProgress(100);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9997,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "80vw",
          height: "70vh",
          maxWidth: "1200px",
          maxHeight: "800px",
          backgroundColor: "#f0f0f0",
          border: "1px solid rgba(0,0,0,0)",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단/하단에 게이지 표시 */}
        {isSaving && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9998,
              background: "rgba(15,23,42,0.4)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                padding: "16px 24px",
                borderRadius: 12,
                background: "rgba(15,23,42,0.9)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                color: "#e5e7eb",
                fontSize: 13,
              }}
            >
              <CircularProgress size={56} strokeWidth={5} progress={savingProgress} />
              <span>지정 영역 저장 중입니다...</span>
            </div>
          </div>
        )}
        <div
          style={{
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#fff",
            fontSize: 13,
          }}
        >
          <span
            style={{
              padding: "6px",
              fontSize: "12px",
              fontWeight: "600",
              color: "#000000",
              border: "none",
              borderRadius: "6px",
              cursor: "default",
              width: "auto",
              height: "28px",
            }}
          >
            📍 cctvId: {cctvId} ROI 편집
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {(["upstream", "downstream"] as DirectionKey[]).map((dir) => (
              <button
                key={dir}
                onClick={() => setActiveDir(dir)}
                style={{
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: activeDir === dir ? "#fff" : "#111",
                  background: activeDir === dir ? DIR_COLOR[dir].stroke : "#e5e7eb",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  minWidth: 68,
                }}
              >
                {DIR_LABEL[dir]} 그리기
              </button>
            ))}
          </div>

          <button
            onClick={clearCurrent}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#fff",
              background: "#ef4444",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            현재모드 초기화
          </button>
          <button
            onClick={clearAll}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#fff",
              background: "#9ca3af",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            전체 초기화
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "6px 10px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#fff",
              background: "rgba(16, 185, 129, 0.9)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              minWidth: 72,
            }}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
          <button onClick={onClose} style={{ marginLeft: "auto", color: "#666", border: "none", fontSize: 24, cursor: "pointer" }} aria-label="Close ROI Editor">
            ×
          </button>
        </div>

        <div style={{ marginBottom: 6, fontSize: 12, color: "#374151", display: "flex", gap: 12 }}>
          <span>• 상행(녹색)과 하행(파랑)을 각각 선택 후 캔버스를 클릭해 다각형을 만듭니다.</span>
          <span>• ESC 키를 눌러 모달을 닫을 수 있습니다.</span>
        </div>

        <div style={{ flex: 1, position: "relative", backgroundColor: "#000", overflow: "hidden" }}>
          <video ref={videoRef} autoPlay muted playsInline controls style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#000" }} />
          <canvas ref={canvasRef} onClick={handleCanvasClick} style={{ position: "absolute", inset: 0, cursor: "crosshair" }} />
        </div>
      </div>
    </div>
  );
};

export default RoiEditorModal;
