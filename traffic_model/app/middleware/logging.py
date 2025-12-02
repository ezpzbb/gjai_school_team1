import time


async def logging_middleware(request, call_next):
    t0 = time.time()
    resp = await call_next(request)
    dt = (time.time() - t0) * 1000
    path = request.url.path
    method = request.method
    print(f"[{method}] {path} {resp.status_code} - {dt:.1f}ms")
    return resp
