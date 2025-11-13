from ultralytics import YOLO
from infra.configs.settings import MODEL_PATH, YOLO_CLASSES, CONF_THRES, IOU_THRES, MODEL_NAME
from vision.inference.engines.base import InferenceEngine
from pathlib import Path


class YOLOEngine(InferenceEngine):
    def __init__(self):
        self.model = None
        self.model_path = Path(MODEL_PATH)
        self.names = None
        self.want = [c.strip() for c in YOLO_CLASSES.split(",") if c.strip()]

    def _ensure(self):
        if self.model is not None:
            return

        if not self.model_path.exists():
            print(f"모델을 찾지 못하였습니다. {self.model_path} 경로에 다운로드 실행!")

            self.model_path.parent.mkdir(
                parents=True, exist_ok=True)  # 부모 디렉토리 생성

            load_model = YOLO(str(MODEL_NAME))  # yolo 모델 타겟팅
            load_model.save(str(self.model_path))  # 다운로드할 경로 지정

        self.model = YOLO(str(self.model_path))  # 해당 경로에 저장된 모델 로드
        self.names = self.model.names if hasattr(self.model, "names") else {}

    def predict(self, frame):
        self._ensure()
        res = self.model.predict(
            source=frame, conf=CONF_THRES, iou=IOU_THRES, verbose=False)[0]
        out = []
        if not hasattr(res, "boxes"):  # 안전장치
            return out
        for b in res.boxes:
            cls_id = int(b.cls[0])
            name = self.names.get(cls_id, str(cls_id))
            if name not in self.want:
                continue
            x1, y1, x2, y2 = b.xyxy[0].tolist()
            conf = float(b.conf[0])
            out.append({"cls": name, "conf": conf, "bbox": [x1, y1, x2, y2]})

        return out
