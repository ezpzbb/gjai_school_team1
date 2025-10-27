async def timing_middleware(request, call_next):
    response = await call_next(request)
    # 필요 시 헤더 추가
    return response
