from fastapi import APIRouter, UploadFile, File, Form
from vision.pipelines.preprocess import enhance_frame
from infra.configs.roi_store import get_roi_polygon, get_directional_roi
from vision.inference.engines.yolo_ultralytics import YOLOEngine
import numpy as np
from PIL import Image
import io
import requests
import os
import time
import cv2
from PIL import ImageFont, Image, ImageDraw
from typing import List, Optional


router = APIRouter()
engine = YOLOEngine()

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:3001")
_FONT: Optional[ImageFont.FreeTypeFont] = None


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


def _is_inside_polygon(cx: float, cy: float, polygon: np.ndarray) -> bool:
    return cv2.pointPolygonTest(polygon, (cx, cy), False) >= 0.0


def _draw_live_style(img_rgb: np.ndarray, detections, roi_dir=None) -> np.ndarray:
    """
    디텍팅한 결과 시각화 스타일 -> 이미지에 입혀서 전송
    """
    vis = img_rgb.copy()

    # 방향별 ROI 오버레이
    def _overlay_roi(vis, pts, color):
        cv2.polylines(vis, [pts], True, color, 2)
        overlay = vis.copy()
        cv2.fillPoly(overlay, [pts], color)
        return cv2.addWeighted(overlay, 0.2, vis, 0.8, 0.0)

    if roi_dir:
        if roi_dir.get("upstream") is not None:
            vis = _overlay_roi(vis, roi_dir["upstream"], (16, 185, 129))  # 녹색톤
        if roi_dir.get("downstream") is not None:
            vis = _overlay_roi(
                vis, roi_dir["downstream"], (59, 130, 246))  # 파랑톤

    # PIL로 bbox/텍스트/중심점 처리
    base_img = Image.fromarray(vis).convert("RGBA")
    overlay_img = Image.new("RGBA", base_img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay_img, "RGBA")
    font = _load_korean_font(10)  # 폰트 크기 조절

    for d in detections:
        x1, y1, x2, y2 = map(int, d["bbox"])
        base = d.get("track_id") or 0

        # ID별 색상 (bbox와 동일하게 사용)
        r = 50 + ((base * 73) % 205)
        g = 80 + ((base * 41) % 175)
        b = 120 + ((base * 29) % 135)
        color_rgba = (r, g, b, 255)

        # 바운딩 박스 (PIL로 그려도 충분)
        draw.rectangle((x1, y1, x2, y2), outline=color_rgba, width=2)

        # 라벨 텍스트 구성
        id_text = f"ID:{base} " if base else ""
        cls_text = f"{d['cls']} {(float(d['conf']) * 100):.1f}%"
        full_label = id_text + cls_text

        # 바운딩 박스 상단 중앙에 텍스트 박스 위치
        cx = (x1 + x2) / 2.0
        # 전체 텍스트 크기 측정
        full_left, full_top, full_right, full_bottom = draw.textbbox(
            (0, 0), full_label, font=font)
        text_w = full_right - full_left
        text_h = full_bottom - full_top

        padding_x = 4
        padding_y = 4
        box_w = text_w + padding_x * 2
        box_h = text_h + padding_y * 2

        box_left = int(cx - box_w / 2)
        box_top = max(0, y1 - box_h)
        box_right = box_left + box_w
        box_bottom = box_top + box_h

        # 반투명 배경 박스
        draw.rectangle(
            (box_left, box_top, box_right, box_bottom),
            fill=(0, 0, 0, 150),
        )

        # 텍스트 박스 내부 중앙 정렬
        text_x = box_left + padding_x
        text_y = box_top + padding_y
        text_x = box_left + (box_w - text_w) / 2 - full_left
        text_y = box_top + (box_h - text_h) / 2 - full_top

        cursor_x = text_x
        # ID 부분은 bbox 색상과 동일
        if id_text:
            id_left, id_top, id_right, id_bottom = draw.textbbox(
                (0, 0), id_text, font=font)
            id_w = id_right - id_left
            draw.text(
                (cursor_x, text_y),
                id_text,
                font=font,
                fill=color_rgba,  # bbox와 동일 색상
            )
            cursor_x += id_w

        # 나머지 텍스트는 흰색
        draw.text(
            (cursor_x, text_y),
            cls_text,
            font=font,
            fill=(255, 255, 255, 255),
        )

        # 중심점 (투명도 있는 red)
        center_x = (x1 + x2) / 2.0
        center_y = (y1 + y2) / 2.0
        radius = 4
        draw.ellipse(
            (center_x - radius, center_y - radius,
             center_x + radius, center_y + radius),
            fill=(255, 0, 0, 150),
            outline=None,
        )

    combined = Image.alpha_composite(base_img, overlay_img).convert("RGB")
    return np.array(combined)


@router.post("/frame")
async def analyze_frame(
    image: UploadFile = File(...),
    cctv_id: int = Form(...),
    frame_id: int = Form(None),
):
    """
    백엔드에서 전송한 프레임 이미지를 분석하고 결과를 백엔드로 전송
    """

    try:
        image_bytes = await image.read()

        if not image_bytes or len(image_bytes) < 100:
            return {
                "ok": False,
                "error": f"Invalid image data: too small ({len(image_bytes)} bytes)",
            }

        if image_bytes[0] != 0xFF or image_bytes[1] != 0xD8:
            return {
                "ok": False,
                "error": f"Invalid JPEG format: missing SOI marker (first bytes: {image_bytes[:4].hex()})",
            }

        try:
            img_pil = Image.open(io.BytesIO(image_bytes))
            img_pil.verify()
        except Exception as img_error:
            return {
                "ok": False,
                "error": f"Cannot identify image file: {str(img_error)}",
            }

        img_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(img_pil)

        if img_array.ndim != 3 or img_array.shape[2] not in (3, 4):
            return {
                "ok": False,
                "error": f"Unexpected image shape: {img_array.shape}",
            }

        if img_array.shape[2] == 4:
            img_array = img_array[:, :, :3]

        # {"upstream": np.ndarray|None, "downstream": np.ndarray|None}
        roi_dir = get_directional_roi(cctv_id)
        seen_dir = {"upstream": set(), "downstream": set()}

        def _direction_for_bbox(bbox, roi_dir):
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = (bbox[1] + bbox[3]) / 2.0
            if roi_dir["upstream"] is not None and _is_inside_polygon(cx, cy, roi_dir["upstream"]):
                return "up"
            if roi_dir["downstream"] is not None and _is_inside_polygon(cx, cy, roi_dir["downstream"]):
                return "down"
            return None

        # 프레임 전처리 + 추론
        x = enhance_frame(img_array)
        engine._ensure()
        preds = engine.predict(x)  # track_id 포함

        # ROI 필터링
        filtered = []
        for d in preds:
            direction = _direction_for_bbox(d["bbox"], roi_dir)
            # ROI가 정의되어 있으면 밖은 제외
            if (roi_dir["upstream"] is not None or roi_dir["downstream"] is not None) and direction is None:
                continue

            # track_id 중복 방지 (방향별)
            if direction in ("up", "down") and d.get("track_id") is not None:
                key = "upstream" if direction == "up" else "downstream"
                if d["track_id"] in seen_dir[key]:
                    continue
                seen_dir[key].add(d["track_id"])

            filtered.append({**d, "direction": direction})
        preds = filtered

        # LiveModelViewer 스타일로 annotated 이미지 생성
        annotated_np = _draw_live_style(img_array, preds, roi_dir)
        annotated_img_pil = Image.fromarray(annotated_np)

        img_byte_arr = io.BytesIO()
        annotated_img_pil.save(img_byte_arr, format="JPEG", quality=95)
        annotated_img_bytes = img_byte_arr.getvalue()

        payload = {
            "cctvId": cctv_id,
            "frameId": frame_id,
            "timestamp": time.time(),
            "detections": [
                {"trackId": d.get("track_id"), "cls": d["cls"], "conf": float(d["conf"]), "bbox": d["bbox"].tolist() if hasattr(
                    d["bbox"], "tolist") else d["bbox"], "direction": d.get("direction")}
                for d in preds
            ],
            "roiPolygon": None,
        }

        try:
            requests.post(
                f"{BACKEND_BASE}/api/detection",
                json=payload,
                timeout=1.0,
            )

            form_data = {
                "frame_id": (None, str(frame_id)),
                "image": ("analyzed_image.jpg", annotated_img_bytes, "image/jpeg"),
            }
            requests.post(
                f"{BACKEND_BASE}/api/detection/image",
                files=form_data,
                timeout=5.0,
            )
        except Exception as e:
            print(f"객체 검출 결과 전송에 실패하였습니다: {e}")

        return {
            "ok": True,
            "cctv_id": cctv_id,
            "detections_count": len(preds),
            "detections": [
                {"cls": d["cls"], "conf": float(d["conf"])}
                for d in preds
            ],
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}
