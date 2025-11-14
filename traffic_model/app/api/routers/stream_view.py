import time
import os
import requests
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import ImageFont, ImageDraw, Image
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

from infra.adapters.its_cctv_api import fetch_stream_urls
from infra.adapters.cctv_stream import FrameStream
from vision.inference.engines.yolo_ultralytics import YOLOEngine
from vision.pipelines.preprocess import enhance_frame
from vision.pipelines.postprocess import summarize_tracks

router = APIRouter(prefix="/view", tags=["view"])

_FONT: Optional[ImageFont.FreeTypeFont] = None

# 프레임 해상도에 맞춰 계산할 ROI 폴리곤
_ROI_POLYGON: Optional[np.ndarray] = None


BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:3001")


def _send_detection_to_backend(

    cctv_id: int,
    preds: List[dict],
    roi_polygon: Optional[np.ndarray],
) -> None:
    """ 
    헬퍼 함수: model(stream_view.py)에서 backend로 결과 전송
    """
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
            f"{BACKEND_BASE}/api/vehicle/analysis",
            json=payload,
            timeout=0.5,
        )
    except Exception as e:
        # 네트워크 오류 등은 로깅만으로 익셉션(중간에 멈춰버리면 스트리밍을 깨기 때문에 상태 로그만 출력)
        print("객체 검출 결과 전송에 실패하였습니다:", e)


def _load_korean_font(font_size: int = 20) -> ImageFont.FreeTypeFont:
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
    last_err: Optional[Exception] = None
    for p in candidates:
        try:
            _FONT = ImageFont.truetype(p, font_size)
            return _FONT
        except Exception as e:
            last_err = e
    raise RuntimeError(
        "한글 폰트를 찾을 수 없습니다. 설치가 필요합니다!!"
    ) from last_err


def draw_text_korean(
    img: np.ndarray,
    text: str,
    pos: Tuple[int, int],
    font: Optional[ImageFont.FreeTypeFont] = None,
    color: Tuple[int, int, int] = (0, 0, 0),
) -> np.ndarray:
    img_pil: Image.Image = Image.fromarray(
        cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw: ImageDraw.ImageDraw = ImageDraw.Draw(img_pil)
    if font is None:
        font = _load_korean_font(20)
    x: int
    y: int
    x, y = pos
    if y < 0:
        y = 0
    draw.text((x, y), text, font=font, fill=color)
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)


def _build_road_roi_from_edges(frame: np.ndarray) -> Optional[np.ndarray]:
    """
    Canny + HoughLinesP로 도로 양쪽 에지 선을 찾고,
    이 두 선을 기반으로 사다리꼴 ROI 폴리곤을 계산한다.
    CCTV 상단 시점에서도 도로 방향에 맞게 x1, x2, y1, y2가 변하도록 설계.
    """
    height: int
    width: int
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

    # 3. 세로 방향(도로 진행 방향)에 가까운 선만 필터링
    #    x = a*y + b 형태로 쓰기 위해, dy가 충분히 큰 것만 사용
    left_lines: List[Tuple[float, float]] = []
    right_lines: List[Tuple[float, float]] = []

    mid_x: float = width / 2.0

    for line in lines:
        x1_l: int
        y1_l: int
        x2_l: int
        y2_l: int
        x1_l, y1_l, x2_l, y2_l = line[0]

        # roi 좌표를 전체 프레임 좌표로 보정
        y1: int = y1_l + y_start
        y2: int = y2_l + y_start
        x1: int = x1_l
        x2: int = x2_l

        dy: int = y2 - y1
        if abs(dy) < 20:
            # 너무 수평에 가까운 선은 무시
            continue

        # x = a*y + b 꼴로 표현 (수직선에 강함)
        a: float = (x2 - x1) / float(dy)
        b: float = x1 - a * float(y1)

        # 선분의 중심 x 위치 기준으로 좌/우 그룹 분리
        cx_line: float = (x1 + x2) / 2.0
        if cx_line < mid_x:
            left_lines.append((a, b))
        else:
            right_lines.append((a, b))

    if not left_lines or not right_lines:
        # 한쪽 에지를 못 찾은 경우 ROI 생성 포기
        return None

    # 4. 좌/우 그룹에 대해 a, b 평균으로 대표 직선 하나씩 생성
    def _avg_line(lines_ab: List[Tuple[float, float]]) -> Tuple[float, float]:
        a_vals: np.ndarray = np.array(
            [ab[0] for ab in lines_ab], dtype=np.float32)
        b_vals: np.ndarray = np.array(
            [ab[1] for ab in lines_ab], dtype=np.float32)
        return float(a_vals.mean()), float(b_vals.mean())

    a_left: float
    b_left: float
    a_right: float
    b_right: float
    a_left, b_left = _avg_line(left_lines)
    a_right, b_right = _avg_line(right_lines)

    # 5. 관심 y 범위 설정
    bottom_y: int = height - 1
    top_y: int = int(height * 0.5)

    # 6. 각 y에서의 x 좌표 계산
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


def _gen(url: str, cctv_id: int):
    eng: YOLOEngine = YOLOEngine()
    fs: FrameStream = FrameStream(url)
    font: ImageFont.FreeTypeFont = _load_korean_font(20)

    global _ROI_POLYGON

    while True:
        f: Optional[np.ndarray] = fs.read_one()
        if f is None:
            time.sleep(0.2)
            continue

        height: int
        width: int
        height, width = f.shape[:2]

        vis_frame: np.ndarray = f.copy()

        # 1) 도로 에지를 기반으로 ROI 폴리곤이 아직 없다면 한 번 추정
        if _ROI_POLYGON is None:
            roi_polygon: Optional[np.ndarray] = _build_road_roi_from_edges(f)
            if roi_polygon is not None:
                _ROI_POLYGON = roi_polygon

        # 2) ROI 시각화
        if _ROI_POLYGON is not None:
            overlay: np.ndarray = vis_frame.copy()
            cv2.fillPoly(overlay, [_ROI_POLYGON], (0, 255, 0))
            alpha: float = 0.2
            vis_frame = cv2.addWeighted(
                overlay, alpha, vis_frame, 1.0 - alpha, 0.0)

            cv2.polylines(
                vis_frame,
                [_ROI_POLYGON],
                isClosed=True,
                color=(0, 255, 0),
                thickness=2,
            )

        # 3) 모델 입력용 전처리
        x: np.ndarray = enhance_frame(f)

        # 4) 추론
        preds = eng.predict(x)

        # 5) ROI 안에 들어온 검출만 사용
        filtered_preds: List[dict] = []

        for d in preds:
            x1, y1, x2, y2 = map(int, d["bbox"])
            cx: float = (x1 + x2) / 2.0
            cy: float = (y1 + y2) / 2.0

            if _ROI_POLYGON is not None:
                if not _is_inside_polygon(cx, cy, _ROI_POLYGON):
                    continue

            filtered_preds.append(d)

            cv2.rectangle(vis_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            label: str = f'{d["cls"]} {d["conf"]:.2f}'
            vis_frame = draw_text_korean(
                vis_frame, label, (x1, y1 - 5), font=font)

            cv2.circle(vis_frame, (int(cx), int(cy)), 4, (0, 0, 255), -1)

            # 요약 정보 출력
            report = summarize_tracks(filtered_preds)
            print(report)

            # backend로 raw detection + ROI 전달
            _send_detection_to_backend(cctv_id, filtered_preds, _ROI_POLYGON)

        ok: bool
        jpg: np.ndarray
        ok, jpg = cv2.imencode(".jpg", vis_frame)
        if not ok:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpg.tobytes() + b"\r\n"
        )


@router.get("/mjpeg")
def mjpeg_auto(
    index: int = Query(0, ge=0),
    cctv_id: int = Query(..., ge=0),
    minX: str = "126.900000",
    maxX: str = "128.890000",
    minY: str = "35.900000",
    maxY: str = "45.100000",
    cctvType: str = "1",
    roadType: str = "its",
):
    urls = fetch_stream_urls(
        {
            "minX": minX,
            "maxX": maxX,
            "minY": minY,
            "maxY": maxY,
            "cctvType": cctvType,
            "type": roadType,
            "getType": "json",
        }
    )
    if not urls:
        raise HTTPException(502, "no stream urls from API")
    if index >= len(urls):
        raise HTTPException(400, f"index out of range (0..{len(urls)-1})")

    url: str = urls[index]["url"]
    return StreamingResponse(
        _gen(url, cctv_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
