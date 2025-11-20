import requests
from infra.configs.settings import ITS_API_BASE, ITS_API_KEY


def fetch_stream_urls(params=None):
    q = {
        "apiKey": ITS_API_KEY,
        "type": "its",
        # cctvType(1: 실시간 스트리밍(HLS) / 2: 동영상(mp4) / 3: 정지 영상/ 4: 실시간 스트리밍(HLS)(HTTPS) / 5: 동영상(mp4)(HTTPS))
        "cctvType": "1",
        "minX": "126.800000", "maxX": "127.890000",
        "minY": "34.900000", "maxY": "35.100000",
        "getType": "json",
    }
    if params:
        q.update(params)

    r = requests.get(ITS_API_BASE, params=q, headers={
                     "Accept": "application/json"}, timeout=10)
    r.raise_for_status()
    data = r.json()

    items = data.get("response", {}).get("data", [])
    urls = []

    for d in items:
        u = d.get("cctvurl")
        if not u:
            continue
        urls.append({
            "name": d.get("cctvname", ""),
            "url": u,
            "x": d.get("coordx"), "y": d.get("coordy"),
        })

    return urls  # 최종 url 추출
