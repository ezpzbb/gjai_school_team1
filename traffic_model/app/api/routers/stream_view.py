import cv2
import time
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

_FONT = None

# 첫 프레임 해상도에 맞춰 한 번만 계산할 ROI 폴리곤
_ROI_POLYGON = None


def _load_korean_font(font_size: int = 20):
    global _FONT
    if _FONT is not None:
        return _FONT
    candidates = [
        "/Library/Fonts/AppleGothic.ttf",
    ]
    last_err = None
    for p in candidates:
        try:
            _FONT = ImageFont.truetype(p, font_size)
            return _FONT
        except Exception as e:
            last_err = e
    raise RuntimeError(
        "Korean font not found. Install a CJK font or set a valid font path."
    ) from last_err


def draw_text_korean(img, text, pos, font=None, color=(0, 0, 0)):
    img_pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(img_pil)
    if font is None:
        font = _load_korean_font(20)
    x, y = pos
    if y < 0:
        y = 0
    draw.text((x, y), text, font=font, fill=color)
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

# 프레임 해상도에 맞춰 도로 영역 폴리곤을 한 번 생성. 예시는 영상 하단의 사다리꼴 영역을 도로로 가정한다.


def _build_road_roi_polygon(width: int, height: int) -> np.ndarray:
    left_bottom_x: int = int(width * 0.1)
    right_bottom_x: int = int(width * 0.9)
    bottom_y: int = int(height * 0.95)

    left_top_x: int = int(width * 0.35)
    right_top_x: int = int(width * 0.65)
    top_y: int = int(height * 0.6)

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

# 바운딩 박스 중심점이 폴리곤 내부에 있는지 판별. pointPolygonTest: 내부 양수, 경계 0, 외부 음수.


def _is_inside_polygon(cx: float, cy: float, polygon: np.ndarray) -> bool:
    result: float = cv2.pointPolygonTest(polygon, (cx, cy), False)
    return result >= 0.0


def _gen(url: str):
    eng = YOLOEngine()
    fs = FrameStream(url)
    font = _load_korean_font(20)

    global _ROI_POLYGON

    while True:
        f = fs.read_one()
        if f is None:
            time.sleep(0.2)
            continue

        # f.shape = (480, 720, 3) h, w, c
        # 프레임 크기에 맞춰 ROI 폴리곤을 한 번만 계산
        if _ROI_POLYGON is None:
            height: int
            width: int
            height, width = f.shape[:2]  # h = 480, w = 720
            _ROI_POLYGON = _build_road_roi_polygon(width, height)

        # 원본 프레임을 복사해, 여기에 시각화
        vis_frame = f.copy()

        # 도로 영역 시각화 (반투명 초록색)
        overlay = vis_frame.copy()
        cv2.fillPoly(overlay, [_ROI_POLYGON], (0, 255, 0))
        alpha: float = 0.2
        vis_frame = cv2.addWeighted(
            overlay, alpha, vis_frame, 1.0 - alpha, 0.0)

        # 도로 영역 경계선
        cv2.polylines(
            vis_frame,
            [_ROI_POLYGON],
            isClosed=True,
            color=(0, 255, 0),
            thickness=2,
        )

        # 모델 입력용 전처리
        x = enhance_frame(f)

        # 추론
        preds = eng.predict(x)

        # ROI 안에 들어온 검출만 따로 모아서 로그에 사용
        filtered_preds = []

        for d in preds:
            x1, y1, x2, y2 = map(int, d["bbox"])

            # 바운딩 박스 중심 계산
            cx: float = (x1 + x2) / 2.0
            cy: float = (y1 + y2) / 2.0

            # 중심이 도로 ROI 안에 있는 경우만 유효 검출로 처리
            if not _is_inside_polygon(cx, cy, _ROI_POLYGON):
                continue

            filtered_preds.append(d)

            # 바운딩 박스 그리기 (도로 영역 안에 들어온 것만)
            cv2.rectangle(vis_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            label = f'{d["cls"]} {d["conf"]:.2f}'
            vis_frame = draw_text_korean(
                vis_frame, label, (x1, y1 - 5), font=font)

            # 중심점도 표시 (디버깅용)
            cv2.circle(vis_frame, (int(cx), int(cy)), 4, (0, 0, 255), -1)

        # 도로 영역 안에 들어온 검출 요약만 로그로 출력
        print(summarize_tracks(filtered_preds))

        # MJPEG 인코딩
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
    minX: str = "126.900000", maxX: str = "128.890000",
    minY: str = "35.900000",  maxY: str = "45.100000",
    cctvType: str = "1",
    roadType: str = "its",
):
    urls = fetch_stream_urls({
        "minX": minX, "maxX": maxX, "minY": minY, "maxY": maxY,
        "cctvType": cctvType, "type": roadType, "getType": "json"
    })
    if not urls:
        raise HTTPException(502, "no stream urls from API")
    if index >= len(urls):
        raise HTTPException(400, f"index out of range (0..{len(urls)-1})")

    url = urls[index]["url"]
    return StreamingResponse(
        _gen(url),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
