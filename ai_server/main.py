from __future__ import annotations

import io
import time
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

from .config import settings
from .models.model_runner import ModelRunner
from .schemas import AnalysisResponse, CongestionResult

# FastAPI 앱 인스턴스 생성
app = FastAPI(title="AI Inference API", version="0.1.0")

# 애플리케이션 전역에서 재사용할 모델 실행기
model_runner: ModelRunner | None = None


@app.on_event("startup")
def on_startup() -> None:
    """서버 기동 시 모델을 메모리에 로드합니다."""
    global model_runner
    model_runner = ModelRunner(
        model_path=settings.model_path,
        device=settings.device,
        save_annotations=settings.save_annotations,
        annotation_dir=settings.annotation_dir,
        model_version=settings.model_version,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    """간단한 상태 확인 엔드포인트"""
    return {"status": "ok"}


@app.post("/predict", response_model=AnalysisResponse)
async def predict(file: Annotated[UploadFile, File(...)]) -> AnalysisResponse:
    """이미지 파일을 받아 YOLO 추론 결과를 반환"""
    if model_runner is None:
        raise HTTPException(status_code=500, detail="Model is not loaded.")

    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image file.") from exc

    start_time = time.perf_counter()
    try:
        result = model_runner.run_inference(image)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Inference failed.") from exc
    processing_time_ms = (time.perf_counter() - start_time) * 1000.0

    congestion = result.get("congestion", {"level": 0})
    detections = result.get("detections", [])
    annotated_path = result.get("annotated_image_path")
    model_version = model_runner.get_model_version()

    return AnalysisResponse(
        congestion=CongestionResult(level=congestion.get("level", 0)),
        detections=detections,
        annotated_image_path=annotated_path,
        processing_time_ms=processing_time_ms,
        model_version=model_version,
    )

