from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

ROI_CONFIG_PATH = Path(__file__).resolve().parent / "roi_config.json"
_ROI_CACHE: Dict[str, Any] | None = None


def load_roi_config() -> Dict[str, Any]:
    global _ROI_CACHE
    if _ROI_CACHE is not None:
        return _ROI_CACHE

    if not ROI_CONFIG_PATH.exists():
        _ROI_CACHE = {}
        return _ROI_CACHE

    try:
        with ROI_CONFIG_PATH.open("r", encoding="utf-8") as f:
            _ROI_CACHE = json.load(f)
    except Exception as e:
        print("[roi_store] ROI config load error:", e)
        _ROI_CACHE = {}
    return _ROI_CACHE


def get_directional_roi(cctv_id: int):
    cfg = load_roi_config().get(str(cctv_id)) or {}
    # 하위 호환: roiPolygon 키가 있으면 상행으로 사용
    upstream = cfg.get("upstream") or cfg.get("roiPolygon")
    downstream = cfg.get("downstream")
    return {
        "upstream": np.array(upstream, dtype=np.int32) if upstream else None,
        "downstream": np.array(downstream, dtype=np.int32) if downstream else None,
    }


def set_directional_roi(cctv_id: int, upstream: List[List[float]] | None, downstream: List[List[float]] | None) -> None:
    cfg = load_roi_config()
    cfg[str(cctv_id)] = {"upstream": upstream, "downstream": downstream}
    save_roi_config(cfg)
    print(
        f"[roi_store] ROI updated for cctv_id={cctv_id}: up={len(upstream or [])}, down={len(downstream or [])}")


def save_roi_config(cfg: Dict[str, Any]) -> None:
    global _ROI_CACHE
    ROI_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with ROI_CONFIG_PATH.open("w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    _ROI_CACHE = cfg


def get_roi_polygon(cctv_id: int) -> Optional[np.ndarray]:
    cfg = load_roi_config()
    entry = cfg.get(str(cctv_id))
    if not entry:
        return None

    pts = entry.get("roiPolygon")
    if not pts:
        return None

    try:
        polygon = np.array(pts, dtype=np.int32)
        if polygon.ndim != 2 or polygon.shape[1] != 2:
            raise ValueError("invalid roiPolygon shape")
        return polygon
    except Exception as e:
        print(f"[roi_store] invalid ROI polygon for cctv_id={cctv_id}:", e)
        return None


def set_roi_polygon(cctv_id: int, roi_polygon: List[List[float]]) -> None:
    cfg = load_roi_config()
    cfg[str(cctv_id)] = {"roiPolygon": roi_polygon}
    save_roi_config(cfg)
    print(
        f"[roi_store] ROI updated for cctv_id={cctv_id}: {len(roi_polygon)} points"
    )
