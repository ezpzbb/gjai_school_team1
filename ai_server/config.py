from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """FastAPI 서버에서 사용할 설정값을 관리합니다."""

    # 추론에 사용할 모델 가중치 파일 경로
    model_path: Path = Path("./models/test.pt")
    # 실행 디바이스(cpu/cuda)
    device: str = "cpu"
    # 판별 결과 이미지를 저장할지 여부
    save_annotations: bool = False
    # 어노테이션 이미지를 저장할 디렉터리
    annotation_dir: Path = Path("./ai_server_outputs/annotated")
    # 모델 버전 정보(없으면 파일명 기반)
    model_version: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

