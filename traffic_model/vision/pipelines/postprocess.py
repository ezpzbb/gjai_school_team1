# 차종별 카운트, 혼잡도 계산 등등 처리

import math

VEHICLE_WEIGHTS = {
    "승용차": 1.5,
    "버스": 3.5,
    "트럭": 2.5,
    "오토바이(자전거)": 1.0,
    # 미정 클래스는 1.0으로 취급
}


def summarize_tracks(dets):
    # dets: [{"cls": name, "conf": c, "bbox":[x1,y1,x2,y2]}, ...]
    by_cls = {}
    total = 0
    weighted = 0.0

    for d in dets:
        cls = d.get("cls", "unknown")
        by_cls[cls] = by_cls.get(cls, 0) + 1
        total += 1
        w = VEHICLE_WEIGHTS.get(cls, 1.0)
        weighted += w

    # 간단 혼잡도 지표: 0~100 스케일
    # alpha는 하이퍼파라미터. 차량 가중합이 20일 때 100 근사하도록 설정.
    alpha = 5.0
    congestion_index = max(0, min(100, alpha * weighted))

    return {
        "counts_by_class": by_cls,
        "total_vehicles": total,
        "weighted_traffic": weighted,
        "congestion_index": congestion_index
    }
