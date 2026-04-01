"""PdM Backend – core configuration."""

from __future__ import annotations

import os
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # JWT
    JWT_SECRET: str = "change-me-to-a-strong-random-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173"]

    # Environment
    PY_ENV: str = "dev"

    # TDengine
    TDENGINE_HOST: str = "localhost"
    TDENGINE_PORT: int = 6041
    TDENGINE_USER: str = "root"
    TDENGINE_PASSWORD: str = "taosdata"
    TDENGINE_DATABASE: str = "pdm"

    # Notification
    DEFAULT_WEBHOOK_URL: str = "http://localhost:9999/webhook"
    WEBHOOK_SIGNING_SECRET: str = "change-me-webhook-secret"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
