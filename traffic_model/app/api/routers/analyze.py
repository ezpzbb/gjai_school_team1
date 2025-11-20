from fastapi import APIRouter, Query, UploadFile, File, Form
from infra.adapters.its_cctv_api import fetch_stream_urls
from infra.adapters.cctv_stream import FrameStream
from vision.pipelines.preprocess import enhance_frame
from vision.pipelines.postprocess import summarize_tracks
from vision.inference.engines.yolo_ultralytics import YOLOEngine
import numpy as np
from PIL import Image
import io
import requests
import os
import time

router = APIRouter()
engine = YOLOEngine()

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:3001")


@router.get("/snapshot_from_api")
def snapshot_from_api(
    minX: str = Query("126.800000"), maxX: str = Query("127.890000"),
    minY: str = Query("34.900000"), maxY: str = Query("35.100000")
):
    # 1) API에서 cctvType=1(스트림) URL 목록 가져오기
    urls = fetch_stream_urls({
        "minX": minX, "maxX": maxX, "minY": minY, "maxY": maxY
    })
    if not urls:
        return {"ok": False, "error": "no stream urls from API"}

    # 2) 첫 번째 스트림으로 샘플 프레임 추론
    target = urls[0]
    fs = FrameStream(target["url"])
    f = fs.read_one()
    if f is None:
        return {"ok": False, "error": "cannot read frame", "candidate": target}

    x = enhance_frame(f)
    preds = engine.predict(x)
    report = summarize_tracks(preds)
    return {"ok": True, "meta": target, "report": report}


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
        # 이미지 읽기
        image_bytes = await image.read()
        
        # 이미지 바이트 유효성 검증
        if not image_bytes or len(image_bytes) < 100:
            return {
                "ok": False,
                "error": f"Invalid image data: too small ({len(image_bytes)} bytes)",
            }
        
        # JPEG 마커 확인
        if image_bytes[0] != 0xFF or image_bytes[1] != 0xD8:
            return {
                "ok": False,
                "error": f"Invalid JPEG format: missing SOI marker (first bytes: {image_bytes[:4].hex()})",
            }
        
        try:
            img_pil = Image.open(io.BytesIO(image_bytes))
            img_pil.verify()  # 이미지 유효성 검증
        except Exception as img_error:
            return {
                "ok": False,
                "error": f"Cannot identify image file: {str(img_error)}",
            }
        
        # 검증 후 다시 열기 (verify() 후에는 파일 포인터가 끝으로 이동)
        img_pil = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(img_pil)
        
        # RGB로 변환 (RGBA인 경우)
        if img_array.shape[2] == 4:
            img_array = img_array[:, :, :3]
        
        # 프레임 전처리
        x = enhance_frame(img_array)
        
        # 모델 추론 (원본 이미지로 추론하여 plot 가능하도록)
        engine._ensure()  # 모델 로드 확인
        res = engine.model.predict(
            source=img_array, conf=0.25, iou=0.7, verbose=False)[0]
        
        # 분석 결과 추출
        preds = engine.predict(x)
        
        # 분석 완료 이미지 생성 (바운딩 박스 그리기)
        annotated_img = res.plot()  # YOLO의 plot 메서드로 바운딩 박스가 그려진 이미지 생성
        annotated_img_pil = Image.fromarray(annotated_img)
        
        # PIL Image를 바이트로 변환
        img_byte_arr = io.BytesIO()
        annotated_img_pil.save(img_byte_arr, format='JPEG', quality=95)
        annotated_img_bytes = img_byte_arr.getvalue()
        
        # ROI 폴리곤은 None으로 설정 (필요시 추가)
        roi_polygon = None
        
        # 결과를 백엔드로 전송 (분석 완료 이미지 포함)
        payload = {
            "cctvId": cctv_id,
            "frameId": frame_id,  # frame_id 포함
            "timestamp": time.time(),
            "detections": [
                {
                    "cls": d["cls"],
                    "conf": float(d["conf"]),
                    "bbox": d["bbox"].tolist() if hasattr(d["bbox"], "tolist") else d["bbox"],
                }
                for d in preds
            ],
            "roiPolygon": roi_polygon.tolist() if roi_polygon is not None else None,
        }
        
        try:
            # 분석 결과 JSON 전송
            requests.post(
                f"{BACKEND_BASE}/api/detection",
                json=payload,
                timeout=1.0,
            )
            
            # 분석 완료 이미지 전송
            form_data = {
                'frame_id': (None, str(frame_id)),
                'image': ('analyzed_image.jpg', annotated_img_bytes, 'image/jpeg')
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
                {
                    "cls": d["cls"],
                    "conf": float(d["conf"]),
                }
                for d in preds
            ],
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
        }
