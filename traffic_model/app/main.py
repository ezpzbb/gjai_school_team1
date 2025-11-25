from fastapi import FastAPI
from app.middleware.logging import logging_middleware
from app.middleware.timing import timing_middleware
from app.api.routers import analyze, health, stream_view, roi

app = FastAPI(title="Traffic Intelligence API")

app.middleware("http")(logging_middleware)
app.middleware("http")(timing_middleware)

app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(health.router, prefix="/health", tags=["health"])

app.include_router(stream_view.router)
app.include_router(roi.router)


@app.get("/")
def root():
    return {"ok": True, "service": "traffic-intelligence"}  # 대시보드로 리다이렉팅
