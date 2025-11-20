import asyncio
import base64
import os
import time
from typing import List, Optional, Tuple, Dict

import cv2
import numpy as np
import requests
from PIL import ImageFont, ImageDraw, Image
from fastapi import APIRouter, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from infra.adapters.cctv_stream import FrameStream
from vision.inference.engines.yolo_ultralytics import YOLOEngine
from vision.pipelines.preprocess import enhance_frame
from vision.pipelines.postprocess import summarize_tracks  # 필요 없으면 import 제거 가능

router = APIRouter(prefix="/view", tags=["view"])

# 한글 폰트 캐시
_FONT: Optional[ImageFont.FreeTypeFont] = None

# 백엔드 URL
BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:3001")

# FPS 제한 (최대 30fps)
TARGET_FPS: float = 30.0
_FRAME_INTERVAL: float = 1.0 / TARGET_FPS


def _get_stream_url_from_backend(cctv_id: int) -> str:
    """
    backend의 CCTV 스트림 API(/api/cctv/:id/stream)를 통해
    cctvStreamResolver가 해석한 실제 스트림 URL(HLS 등)을 조회한다.
    """
    try:
        resp = requests.get(
            f"{BACKEND_BASE}/api/cctv/{cctv_id}/stream", timeout=2.0
        )
        resp.raise_for_status()
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


def _build_road_roi_from_edges(frame: np.ndarray) -> Optional[np.ndarray]:
    """
    Canny + HoughLinesP로 도로 양쪽 에지 선을 찾고,
    이 두 선을 기반으로 사다리꼴 ROI 폴리곤을 계산한다.
    """
    height, width = frame.shape[:2]

    # 1. 도로가 있을 법한 하단 영역만 사용 (예: 하단 60%)
    roi_y_start_ratio: float = 0.4
    y_start: int = int(height * roi_y_start_ratio)
    roi: np.ndarray = frame[y_start:height, :]

    gray: np.ndarray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blurred: np.ndarray = cv2.GaussianBlur(gray, (5, 5), 1.4)
    edges: np.ndarray = cv2.Canny(blurred, 50, 150)

    # 2. HoughLinesP로 선분 후보 찾기
    lines: Optional[np.ndarray] = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180.0,
        threshold=60,
        minLineLength=40,
        maxLineGap=30,
    )

    if lines is None:
        return None

    left_lines: List[Tuple[float, float]] = []
    right_lines: List[Tuple[float, float]] = []
    mid_x: float = width / 2.0

    for line in lines:
        x1_l, y1_l, x2_l, y2_l = line[0]

        y1 = y1_l + y_start
        y2 = y2_l + y_start
        x1 = x1_l
        x2 = x2_l

        dy = y2 - y1
        if abs(dy) < 20:
            continue

        a: float = (x2 - x1) / float(dy)
        b: float = x1 - a * float(y1)

        cx_line: float = (x1 + x2) / 2.0
        if cx_line < mid_x:
            left_lines.append((a, b))
        else:
            right_lines.append((a, b))

    if not left_lines or not right_lines:
        return None

    def _avg_line(lines_ab: List[Tuple[float, float]]) -> Tuple[float, float]:
        a_vals = np.array([ab[0] for ab in lines_ab], dtype=np.float32)
        b_vals = np.array([ab[1] for ab in lines_ab], dtype=np.float32)
        return float(a_vals.mean()), float(b_vals.mean())

    a_left, b_left = _avg_line(left_lines)
    a_right, b_right = _avg_line(right_lines)

    bottom_y: int = height - 1
    top_y: int = int(height * 0.5)

    def _x_at_y(a: float, b: float, y_val: int) -> int:
        x_val: float = a * float(y_val) + b
        return int(max(0, min(width - 1, x_val)))

    left_bottom_x: int = _x_at_y(a_left, b_left, bottom_y)
    left_top_x: int = _x_at_y(a_left, b_left, top_y)
    right_bottom_x: int = _x_at_y(a_right, b_right, bottom_y)
    right_top_x: int = _x_at_y(a_right, b_right, top_y)

    polygon: np.ndarray = np.array(
        [
            [left_bottom_x, bottom_y],
            [left_top_x, top_y],
            [right_top_x, top_y],
            [right_bottom_x, bottom_y],
        ],
        dtype=np.int32,
    )
    return polygon


def _is_inside_polygon(cx: float, cy: float, polygon: np.ndarray) -> bool:
    result: float = cv2.pointPolygonTest(polygon, (cx, cy), False)
    return result >= 0.0


def _process_frame(
    frame: np.ndarray,
    eng: YOLOEngine,
    font: ImageFont.FreeTypeFont,
    roi_polygon: Optional[np.ndarray],
) -> Tuple[np.ndarray, Optional[np.ndarray], List[dict]]:
    """
    한 프레임에 대해:
    - ROI 갱신/시각화
    - YOLO 추론 + ROI 필터링
    - vis_frame에 bbox/라벨/센터점까지 그린 결과
    를 반환
    """
    vis_frame = frame.copy()

    # 1) ROI 갱신
    if roi_polygon is None:
        cand = _build_road_roi_from_edges(frame)
        if cand is not None:
            roi_polygon = cand

    # 2) ROI 시각화
    if roi_polygon is not None:
        overlay = vis_frame.copy()
        cv2.fillPoly(overlay, [roi_polygon], (0, 255, 0))
        vis_frame = cv2.addWeighted(overlay, 0.2, vis_frame, 0.8, 0.0)
        cv2.polylines(vis_frame, [roi_polygon], True, (0, 255, 0), 2)

    # 3) 추론
    x = enhance_frame(frame)
    preds = eng.predict(x)

    # 4) ROI 안의 디텍션만 사용 + 박스/라벨 그리기
    filtered: List[dict] = []
    for d in preds:
        x1, y1, x2, y2 = map(int, d["bbox"])
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0

        if roi_polygon is not None and not _is_inside_polygon(cx, cy, roi_polygon):
            continue

        filtered.append(d)

        cv2.rectangle(vis_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f'{d["cls"]} {d["conf"]:.2f}'
        vis_frame = draw_text_korean(vis_frame, label, (x1, y1 - 5), font=font)
        cv2.circle(vis_frame, (int(cx), int(cy)), 4, (0, 0, 255), -1)

    # 필요하면 요약 정보 로그
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
            frame, eng, font, roi_polygon)

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
    except HTTPException as e:
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

            vis_frame, roi_polygon, filtered = _process_frame(
                frame, eng, font, roi_polygon)

            if filtered:
                _send_detection_to_backend(cctv_id, filtered, roi_polygon)

            ok, jpg = cv2.imencode(".jpg", vis_frame)
            if not ok:
                continue

            b64 = base64.b64encode(jpg.tobytes()).decode("ascii")
            roi_payload = roi_polygon.tolist() if roi_polygon is not None else None

            await websocket.send_json(
                {
                    "timestamp": now,
                    "image": f"data:image/jpeg;base64,{b64}",
                    "detections": filtered,
                    "roiPolygon": roi_payload,
                }
            )
    except WebSocketDisconnect:
        return
    except Exception as e:
        print("[stream_view] WebSocket view error:", e)
        try:
            await websocket.close(code=1011, reason=str(e))
        except Exception:
            pass
