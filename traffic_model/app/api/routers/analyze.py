from fastapi import APIRouter, Query
from infra.adapters.its_cctv_api import fetch_stream_urls
from infra.adapters.cctv_stream import FrameStream
from vision.pipelines.preprocess import enhance_frame
from vision.pipelines.postprocess import summarize_tracks
from vision.inference.engines.yolo_ultralytics import YOLOEngine

router = APIRouter()
engine = YOLOEngine()


@router.get("/snapshot_from_api")
def snapshot_from_api(
    minX: str = Query("126.800000"), maxX: str = Query("127.890000"),
    minY: str = Query("34.900000"), maxY: str = Query("35.100000")
):
    # 1) API에서 cctvType=1(스트림) URL 목록 가져오기
    urls = fetch_stream_urls({
        "minX": minX, "maxX": maxX, "minY": minY, "maxY": maxY
    })
    if not urls:
        return {"ok": False, "error": "no stream urls from API"}

    # 2) 첫 번째 스트림으로 샘플 프레임 추론
    target = urls[0]
    fs = FrameStream(target["url"])
    f = fs.read_one()
    if f is None:
        return {"ok": False, "error": "cannot read frame", "candidate": target}

    x = enhance_frame(f)
    preds = engine.predict(x)
    report = summarize_tracks(preds)
    return {"ok": True, "meta": target, "report": report}
