FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 fontconfig fonts-noto-cjk fonts-nanum \
 && fc-cache -f -v && rm -rf /var/lib/apt/lists/*

    
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 필요 없는 도구 설치를 피하고 바로 설치
COPY traffic_model/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 모델 파일 복사 (프로젝트 루트의 models/test.pt를 컨테이너의 /app/infra/models/yolo/v1/로 복사)
RUN mkdir -p /app/infra/models/yolo/v1
COPY models/test.pt /app/infra/models/yolo/v1/test.pt

# traffic_model 디렉토리 내용을 /app으로 복사
COPY traffic_model/ /app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
