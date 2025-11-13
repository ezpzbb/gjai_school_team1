# 추후 여러 엔진을 등록하려면 여기로.
from vision.inference.engines.yolo_ultralytics import YOLOEngine


def get_default_engine():
    return YOLOEngine()
