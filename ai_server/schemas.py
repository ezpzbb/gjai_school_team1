from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """바운딩 박스 위치 정보를 담는 스키마"""

    x: float = Field(..., description="Bounding box X coordinate (pixels)")
    y: float = Field(..., description="Bounding box Y coordinate (pixels)")
    width: float = Field(..., description="Bounding box width (pixels)")
    height: float = Field(..., description="Bounding box height (pixels)")


class Detection(BaseModel):
    """YOLO 탐지 결과 1건에 대한 정보"""

    object_text: str = Field(..., description="Detected object label")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    bounding_box: BoundingBox


class CongestionResult(BaseModel):
    """혼잡도 지표"""

    level: int = Field(..., ge=0, le=100, description="Congestion level 0-100")


class AnalysisResponse(BaseModel):
    """FastAPI /predict 응답 본문 정의"""

    congestion: CongestionResult
    detections: List[Detection] = Field(default_factory=list)
    annotated_image_path: Optional[str] = None
    processing_time_ms: float = Field(..., ge=0, description="Inference latency in milliseconds")
    model_version: Optional[str] = Field(
        default=None, description="Identifier of the model used for inference"
    )

