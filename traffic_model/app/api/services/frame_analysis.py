# 해당 파일은 gpu 사용할 때 사용할 코드임. 삭제하지 말것!!

import io
from typing import Tuple, List

import numpy as np
from PIL import Image
from vision.pipelines.preprocess import enhance_frame
from vision.inference.engines.yolo_ultralytics import YOLOEngine

_engine = YOLOEngine()


def analyze_np_frame(
    img_array: np.ndarray,
) -> Tuple[List[dict], bytes]:
    """
    numpy 이미지 배열(RGB/BGR)을 받아:
    - YOLO 추론
    - 바운딩 박스가 그려진 JPEG 바이트 생성
    를 반환
    """
    # RGB 보장
    if img_array.ndim == 2:
        img_array = np.stack([img_array] * 3, axis=-1)
    if img_array.shape[2] == 4:
        img_array = img_array[:, :, :3]

    x = enhance_frame(img_array)

    _engine._ensure()
    res = _engine.model.predict(
        source=img_array, conf=0.25, iou=0.7, verbose=False
    )[0]
    preds = _engine.predict(x)

    annotated_img = res.plot()
    annotated_pil = Image.fromarray(annotated_img)
    buf = io.BytesIO()
    annotated_pil.save(buf, format="JPEG", quality=95)
    annotated_bytes = buf.getvalue()

    return preds, annotated_bytes
