import os
from dotenv import load_dotenv

load_dotenv()

# 모델 경로와 클래스명 설정 (가중치 경로 또는 모델명)
MODEL_PATH = os.getenv(
    "MODEL_PATH", "./traffic_model/infra/models/yolo/v1")  # yolo.pt 또는 커스텀.pt
MODEL_NAME = os.getenv("MODEL_NAME", "model")
YOLO_CLASSES = os.getenv(
    "YOLO_CLASSES", "승용차,버스,트럭,오토바이(자전거),분류없음")  # CSV
# conf_thres 값은 0.25 이상인 detection은 유지. 그 이하는 삭제
CONF_THRES = float(os.getenv("CONF_THRES", "0.25"))
# iou_thres 값은 0.45 이상인 경우 삭제. 그 이하는 유지 -> 중복제거
IOU_THRES = float(os.getenv("IOU_THRES", "0.45"))

# its cctv api
ITS_API_BASE = "https://openapi.its.go.kr:9443/cctvInfo"
ITS_API_KEY = os.getenv("ITS_API_KEY", "not api key")
