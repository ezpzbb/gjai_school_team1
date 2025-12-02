from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from ultralytics import YOLO

from infra.configs.settings import MODEL_PATH, YOLO_CLASSES, CONF_THRES, IOU_THRES, MODEL_NAME
from vision.inference.engines.base import InferenceEngine


class YOLOEngine(InferenceEngine):
    def __init__(self) -> None:
        self.model: YOLO | None = None
        self.model_path: Path = Path(MODEL_PATH)
        self.names: Dict[int, str] | None = None
        self.want: List[str] = [c.strip()
                                for c in YOLO_CLASSES.split(",") if c.strip()]
        # 바이트트랙
        self.tracker_config: str = "bytetrack.yaml"

    def _ensure(self) -> None:
        if self.model is not None:
            return

        if not self.model_path.exists():
            print(f"모델을 찾지 못하였습니다. {self.model_path} 경로에 다운로드 실행!")

            self.model_path.parent.mkdir(parents=True, exist_ok=True)

            load_model: YOLO = YOLO(str(MODEL_NAME))
            load_model.save(str(self.model_path))

        self.model = YOLO(str(self.model_path))
        self.names = self.model.names if hasattr(self.model, "names") else {}

    def predict(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        단일 프레임에 대해 YOLO + ByteTrack 추론을 수행하고,
        각 객체에 track_id 를 포함한 결과 리스트를 반환하는 원리
        """
        self._ensure()
        assert self.model is not None

        # track 사용
        res = self.model.track(
            source=frame,
            conf=CONF_THRES,
            iou=IOU_THRES,
            verbose=False,
            persist=True,                # ByteTrack 상태 유지
            tracker=self.tracker_config  # ByteTrack 설정 사용
        )[0]

        out: List[Dict[str, Any]] = []
        if not hasattr(res, "boxes"):
            return out

        # names가 None인 경우를 방어
        names: Dict[int, str] = self.names if self.names is not None else {}

        for b in res.boxes:
            cls_id: int = int(b.cls[0])
            name: str = names.get(cls_id, str(cls_id))
            if name not in self.want:
                continue

            # tracking id (ByteTrack가 부여)
            track_id: int | None
            if hasattr(b, "id") and b.id is not None:
                # b.id 는 Tensor이므로 첫 번째 값만 사용
                track_id = int(b.id[0])
            else:
                track_id = None

            x1, y1, x2, y2 = b.xyxy[0].tolist()
            conf: float = float(b.conf[0])

            out.append(
                {
                    "track_id": track_id,
                    "cls": name,
                    "conf": conf,
                    "bbox": [x1, y1, x2, y2],
                }
            )

        return out
