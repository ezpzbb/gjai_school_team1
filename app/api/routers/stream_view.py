from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from infra.adapters.its_cctv_api import fetch_stream_urls
from infra.adapters.cctv_stream import FrameStream
from vision.inference.engines.yolo_ultralytics import YOLOEngine
from vision.pipelines.preprocess import enhance_frame
from vision.pipelines.postprocess import summarize_tracks
import cv2
import time

router = APIRouter(prefix="/view", tags=["view"])


def _gen(url: str):
    eng = YOLOEngine()
    fs = FrameStream(url)
    while True:
        f = fs.read_one()
        if f is None:
            time.sleep(0.2)
            continue
        x = enhance_frame(f)
        preds = eng.predict(x)
        for d in preds:
            x1, y1, x2, y2 = map(int, d["bbox"])
            cv2.rectangle(f, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(f, f'{d["cls"]} {d["conf"]:.2f}', (x1, y1-5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        ok, jpg = cv2.imencode('.jpg', f)
        if not ok:
            continue
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpg.tobytes() + b'\r\n')


@router.get("/mjpeg")
def mjpeg_auto(
    index: int = Query(0, ge=0),
    minX: str = "126.900000", maxX: str = "128.890000",
    minY: str = "35.900000",  maxY: str = "45.100000",
    cctvType: str = "1",
    roadType: str = "its",
):
    urls = fetch_stream_urls({
        "minX": minX, "maxX": maxX, "minY": minY, "maxY": maxY,
        "cctvType": cctvType, "type": roadType, "getType": "json"
    })
    if not urls:
        raise HTTPException(502, "no stream urls from API")
    if index >= len(urls):
        raise HTTPException(400, f"index out of range (0..{len(urls)-1})")

    url = urls[index]["url"]
    return StreamingResponse(_gen(url),
                             media_type='multipart/x-mixed-replace; boundary=frame')
