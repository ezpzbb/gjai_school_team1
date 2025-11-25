import asyncio
import base64
import os
import time
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any

import cv2
import numpy as np
import requests
from PIL import ImageFont, ImageDraw, Image
from fastapi import APIRouter, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from infra.adapters.cctv_stream import FrameStream
from vision.inference.engines.yolo_ultralytics import YOLOEngine
from vision.pipelines.preprocess import enhance_frame
from vision.pipelines.postprocess import summarize_tracks
from infra.configs.roi_store import get_roi_polygon

router = APIRouter(prefix="/view", tags=["view"])

# 한글 폰트 캐시
_FONT: Optional[ImageFont.FreeTypeFont] = None

# 백엔드 URL
BACKEND_BASE = os.getenv("BACKEND_BASE", "http://backend:3001")

# FPS 제한 (최대 30fps)
TARGET_FPS: float = 30.0
_FRAME_INTERVAL: float = 1.0 / TARGET_FPS

# cctv_id -> (url, expires_at)
_STREAM_URL_CACHE: Dict[int, Tuple[str, float]] = {}
_CACHE_TTL_SECONDS: float = 60.0  # 또는 backend의 cachedUntil을 사용할 수 있으면 그걸로
_BACKOFF_SECONDS_ON_429: float = 30.0
_LAST_429_AT: Dict[int, float] = {}  # cctv_id -> last 429 timestamp


def _get_stream_url_from_backend(cctv_id: int) -> str:
    """
    backend의 CCTV 스트림 API(/api/cctv/:id/stream)를 통해
    cctvStreamResolver가 해석한 실제 스트림 URL(HLS 등)을 조회한다.
    """
    now = time.time()

    # 1) 429 직후에는 일정 시간 동안 바로 재시도하지 않기 (백오프)
    last_429 = _LAST_429_AT.get(cctv_id)
    if last_429 is not None and now - last_429 < _BACKOFF_SECONDS_ON_429:
        raise HTTPException(
            status_code=503,
            detail=f"cctv_id={cctv_id} 스트림 조회가 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.",
        )

    # 2) 캐시에 유효한 url 있으면 재사용
    cached = _STREAM_URL_CACHE.get(cctv_id)
    if cached is not None:
        url, expires_at = cached
        if now < expires_at:
            return url
        else:
            # 만료된 캐시는 제거
            _STREAM_URL_CACHE.pop(cctv_id, None)

    # 3) 백엔드에 요청
    try:
        resp = requests.get(
            f"{BACKEND_BASE}/api/cctv/{cctv_id}/stream", timeout=2.0
        )
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        # 429 인 경우 -> 백오프 시간 기록
        if resp is not None and resp.status_code == 429:
            _LAST_429_AT[cctv_id] = now
        raise HTTPException(
            status_code=502,
            detail=f"backend CCTV 스트림 API 호출 실패: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"backend CCTV 스트림 API 호출 실패: {e}",
        ) from e

    payload = resp.json()

    # { success: true, data: { cctv, streamUrl, cachedUntil } }
    if not payload.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"backend CCTV 스트림 API 응답 오류: {payload.get('message', 'unknown error')}",
        )

    data = payload.get("data") or {}
    url = data.get("streamUrl")
    if not url:
        raise HTTPException(
            status_code=502,
            detail=f"cctv_id={cctv_id}에 대한 streamUrl이 없습니다.",
        )

    # backend에서 cachedUntil 제공한다면, TTL로 사용
    cached_until = data.get("cachedUntil")
    if cached_until is not None:
        # 숫자(UNIX timestamp)인 경우
        if isinstance(cached_until, (int, float)):
            expires_at = float(cached_until)
        # 문자열(예: "2025-11-23T21:50:20.474Z")인 경우
        elif isinstance(cached_until, str):
            try:
                # 'Z' -> '+00:00' 으로 바꿔서 UTC로 파싱
                dt = datetime.fromisoformat(
                    cached_until.replace("Z", "+00:00"))
                expires_at = dt.replace(tzinfo=timezone.utc).timestamp()
            except ValueError:
                # 파싱 실패 시 기본 TTL 사용
                expires_at = time.time() + _CACHE_TTL_SECONDS
        else:
            # 예상치 못한 타입이면 기본 TTL 사용
            expires_at = time.time() + _CACHE_TTL_SECONDS
    else:
        expires_at = time.time() + _CACHE_TTL_SECONDS

    _STREAM_URL_CACHE[cctv_id] = (url, expires_at)

    return url


def _send_detection_to_backend(
    cctv_id: int,
    preds: List[dict],
    roi_polygon: Optional[np.ndarray],
) -> None:
    """모델에서 검출 결과를 백엔드로 전송 (실시간 시각화와 통계용)"""
    try:
        payload = {
            "cctvId": cctv_id,
            "timestamp": time.time(),
            "detections": [
                {
                    "cls": d["cls"],
                    "conf": d["conf"],
                    "bbox": d["bbox"],
                }
                for d in preds
            ],
            "roiPolygon": roi_polygon.tolist() if roi_polygon is not None else None,
        }
        requests.post(
            f"{BACKEND_BASE}/api/detection",
            json=payload,
            timeout=0.5,
        )
        # 디버깅용 로그
        print(
            f"[stream_view] backend 전송 완료: cctv_id={cctv_id}, count={len(preds)}")
    except Exception as e:
        print("[stream_view] 객체 검출 결과 전송 실패:", e)


def _load_korean_font(font_size: int = 20) -> ImageFont.FreeTypeFont:
    """한글 폰트 로드 (없으면 기본 폰트로 fallback)"""
    global _FONT
    if _FONT is not None:
        return _FONT

    candidates: List[str] = [
        "/Library/Fonts/AppleGothic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansKR-Regular.otf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/custom/NanumGothic.ttf",
        "/usr/local/share/fonts/NanumGothic.ttf",
    ]
    for p in candidates:
        try:
            _FONT = ImageFont.truetype(p, font_size)
            return _FONT
        except Exception:
            continue

    # 폰트 없으면 기본 폰트
    print("[stream_view] 한글 폰트를 찾지 못해 기본 폰트 사용")
    _FONT = ImageFont.load_default()
    return _FONT


def draw_text_korean(
    img: np.ndarray,
    text: str,
    pos: Tuple[int, int],
    font: Optional[ImageFont.FreeTypeFont] = None,
    color: Tuple[int, int, int] = (0, 0, 0),
) -> np.ndarray:
    img_pil: Image.Image = Image.fromarray(
        cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    )
    draw: ImageDraw.ImageDraw = ImageDraw.Draw(img_pil)
    if font is None:
        font = _load_korean_font(20)
    x, y = pos
    if y < 0:
        y = 0
    draw.text((x, y), text, font=font, fill=color)
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)


def _is_inside_polygon(cx: float, cy: float, polygon: np.ndarray) -> bool:
    result: float = cv2.pointPolygonTest(polygon, (cx, cy), False)
    return result >= 0.0


def _process_frame(
    frame: np.ndarray,
    eng: YOLOEngine,
    font: ImageFont.FreeTypeFont,
    roi_polygon: Optional[np.ndarray],
    cctv_id: int,
) -> Tuple[np.ndarray, Optional[np.ndarray], List[dict]]:
    """
    한 프레임에 대해:
    - ROI 갱신/시각화
    - YOLO 추론 + ROI 필터링
    - vis_frame에 bbox/라벨/센터점까지 그린 결과
    를 반환
    """
    vis_frame = frame.copy()

    x = enhance_frame(frame)
    preds = eng.predict(x)

    # 1) ROI 갱신
    if roi_polygon is None:
        roi_polygon = get_roi_polygon(cctv_id)

    # 2) ROI 시각화
    if roi_polygon is not None:
        overlay = vis_frame.copy()
        cv2.fillPoly(overlay, [roi_polygon], (0, 255, 0))
        vis_frame = cv2.addWeighted(overlay, 0.2, vis_frame, 0.8, 0.0)
        cv2.polylines(vis_frame, [roi_polygon], True, (0, 255, 0), 2)

    # 5) ROI 안의 디텍션만 사용 + 박스/라벨 그리기
    filtered: List[dict] = []
    for d in preds:
        x1, y1, x2, y2 = map(int, d["bbox"])
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0

        if roi_polygon is not None and not _is_inside_polygon(cx, cy, roi_polygon):
            continue

        filtered.append(d)

    # 요약 정보 로그
    if filtered:
        report = summarize_tracks(filtered)
        print("[stream_view] 탐지 결과 보고:", report)

    return vis_frame, roi_polygon, filtered


def _mjpeg_gen(url: str, cctv_id: int):
    """
    디버깅용 MJPEG 제너레이터.
    브라우저에서 /view/mjpeg?cctv_id=... 로 직접 확인할 때 사용.
    """
    eng = YOLOEngine()
    fs = FrameStream(url)
    font = _load_korean_font(20)

    roi_polygon: Optional[np.ndarray] = None
    last_processed_ts: float = 0.0

    while True:
        frame = fs.read_one()
        if frame is None:
            time.sleep(0.02)
            continue

        now = time.time()
        if now - last_processed_ts < _FRAME_INTERVAL:
            continue
        last_processed_ts = now

        vis_frame, roi_polygon, filtered = _process_frame(
            frame, eng, font, roi_polygon, cctv_id)

        if filtered:
            _send_detection_to_backend(cctv_id, filtered, roi_polygon)

        ok, jpg = cv2.imencode(".jpg", vis_frame)
        if not ok:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpg.tobytes() + b"\r\n"
        )


@router.get("/mjpeg")
def mjpeg_auto(
    cctv_id: int = Query(..., ge=1),
):
    """
    디버깅용 HTTP MJPEG 스트림:
    브라우저에서 바로 오버레이된 영상을 보고 싶을 때 사용.\n
    url 기준 요청: http://localhost:8080/model/view/mjpeg?cctv_id=149416\n
    cctv_id= 맨 앞: 149416, 맨 뒤: 149539
    """
    url = _get_stream_url_from_backend(cctv_id)
    return StreamingResponse(
        _mjpeg_gen(url, cctv_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.websocket("/ws")
async def view_ws(websocket: WebSocket, cctv_id: int = Query(..., ge=1)):
    """
    WebSocket 기반 실사용 스트림:
    - 모델이 처리한 프레임(JPEG) + detections + ROI를 JSON으로 전송.
    - 프론트는 이 데이터를 canvas에 바로 그려 사용.
    """
    await websocket.accept()
    try:
        url = _get_stream_url_from_backend(cctv_id)
        print(f"[detections_ws] stream url: {url}")
    except HTTPException as e:
        print(f"[detections_ws] failed to get stream url: {e.detail}")
        await websocket.send_json({"error": e.detail})
        await websocket.close(code=1011, reason=e.detail)
        return

    fs = FrameStream(url)
    eng = YOLOEngine()
    font = _load_korean_font(20)
    roi_polygon: Optional[np.ndarray] = None
    last_processed_ts: float = 0.0

    try:
        while True:
            frame = fs.read_one()
            if frame is None:
                await asyncio.sleep(0.02)
                continue

            now = time.time()
            if now - last_processed_ts < _FRAME_INTERVAL:
                continue
            last_processed_ts = now

            raw_frame, roi_polygon, filtered = _process_frame(
                frame, eng, font, roi_polygon, cctv_id)

            if filtered:
                _send_detection_to_backend(cctv_id, filtered, roi_polygon)

            ok, jpg = cv2.imencode(".jpg", raw_frame)
            if not ok:
                continue

            b64 = base64.b64encode(jpg.tobytes()).decode("ascii")
            roi_payload = roi_polygon.tolist() if roi_polygon is not None else None

            detections_payload = [
                {
                    "trackId": d.get("track_id"),
                    "cls": d["cls"],
                    "conf": d["conf"],
                    "bbox": d["bbox"],
                }
                for d in filtered
            ]

            await websocket.send_json(
                {
                    "timestamp": now,
                    "image": f"data:image/jpeg;base64,{b64}",
                    "detections": detections_payload,
                    "roiPolygon": roi_payload,
                }
            )
    except WebSocketDisconnect:
        return
    except Exception as e:
        detail = str(e.detail)
        print("[stream_view] WebSocket view error:", detail)
        try:
            await websocket.send_json({"error": detail})
        except Exception:
            pass

        try:
            await websocket.close(code=1011, reason="")
        except Exception:
            pass


@router.get("/debug/detections")
def debug_detections(cctv_id: int = Query(..., ge=1)):
    '''
    ws 디버깅 용으로 사용 -> 데이터가 잘 전달되고 있는지 확인
    http://localhost:8080/model/view/debug/detections?cctv_id=149416
    '''
    url = _get_stream_url_from_backend(cctv_id)
    fs = FrameStream(url)
    eng = YOLOEngine()
    font = _load_korean_font(20)

    frame = fs.read_one()
    if frame is None:
        raise HTTPException(502, "no frame from stream")

    vis_frame, roi_polygon, filtered = _process_frame(
        frame, eng, font, None, cctv_id)
    detections = [
        {
            "trackId": d.get("track_id"),
            "cls": d["cls"],
            "conf": d["conf"],
            "bbox": d["bbox"],
        }
        for d in filtered
    ]
    roi_payload = roi_polygon.tolist() if roi_polygon is not None else None

    return {
        "timestamp": time.time(),
        "detections": detections,
        "roiPolygon": roi_payload,
    }
