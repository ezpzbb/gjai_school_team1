FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 fontconfig fonts-noto-cjk fonts-nanum \
 && fc-cache -f -v && rm -rf /var/lib/apt/lists/*

    
WORKDIR /app
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 필요 없는 도구 설치를 피하고 바로 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


COPY . /app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
