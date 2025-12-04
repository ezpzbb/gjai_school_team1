from typing import List, Optional

import numpy as np
from fastapi import APIRouter, Query
from pydantic import BaseModel

from infra.configs.roi_store import get_directional_roi, set_directional_roi

router = APIRouter(prefix="/view", tags=["view"])


class DirectionalRoiBody(BaseModel):
    upstream: Optional[List[List[float]]] = None
    downstream: Optional[List[List[float]]] = None


@router.get("/roi")
def get_roi(cctv_id: int = Query(..., ge=1)):
    """
    저장된 ROI 폴리곤 조회
    """
    roi = get_directional_roi(cctv_id)
    return {
        "upstream": roi["upstream"].tolist() if roi["upstream"] is not None else None,
        "downstream": roi["downstream"].tolist() if roi["downstream"] is not None else None,
    }


@router.post("/roi")
def set_roi(cctv_id: int, body: DirectionalRoiBody):
    """
    프론트에서 찍은 좌표를 ROI 폴리곤으로 저장
    """
    set_directional_roi(cctv_id, body.upstream, body.downstream)
    return {"success": True}
