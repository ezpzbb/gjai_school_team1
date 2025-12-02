from typing import List, Optional

import numpy as np
from fastapi import APIRouter, Query
from pydantic import BaseModel

from infra.configs.roi_store import load_roi_config, set_roi_polygon

router = APIRouter(prefix="/view", tags=["view"])


class RoiConfigBody(BaseModel):
    roiPolygon: List[List[float]]


@router.get("/roi")
def get_roi(cctv_id: int = Query(..., ge=1)):
    """
    저장된 ROI 폴리곤 조회
    """
    cfg = load_roi_config()
    return cfg.get(str(cctv_id)) or {"roiPolygon": None}


@router.post("/roi")
def set_roi(cctv_id: int, body: RoiConfigBody):
    """
    프론트에서 찍은 좌표를 ROI 폴리곤으로 저장
    """
    set_roi_polygon(cctv_id, body.roiPolygon)
    return {"success": True}
