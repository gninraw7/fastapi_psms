# -*- coding: utf-8 -*-
"""
애플리케이션 설정 - Aiven Cloud MySQL 지원
"""
from dotenv import load_dotenv
import os
from pathlib import Path
from typing import List

# ============================================
# .env 파일 로드
# ============================================
BASE_DIR = Path(__file__).resolve().parent.parent.parent
dotenv_path = BASE_DIR / '.env'

load_dotenv(dotenv_path=dotenv_path)

if not dotenv_path.exists():
    print(f"⚠️  .env file not found at: {dotenv_path}")
else:
    print(f"✅ Loading .env from: {dotenv_path}")


class Settings:
    """애플리케이션 설정 클래스"""
    
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "PSMS API")
    API_V1_PREFIX: str = os.getenv("API_V1_PREFIX", "/api/v1")
    VERSION: str = "2.0.0"
    
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "psms")
    DB_CHARSET: str = "utf8mb4"
    
    DB_SSL_DISABLED: bool = os.getenv("DB_SSL_DISABLED", "False").lower() in ("true", "1", "yes")
    DB_SSL_CA: str = os.getenv("DB_SSL_CA", "")

    # JWT 보안 설정
    SECRET_KEY: str = "your-secret-key-change-this"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset={self.DB_CHARSET}"
    
    @property
    def DATABASE_CONNECT_ARGS(self) -> dict:
        connect_args = {}
        
        if self.DB_SSL_DISABLED:
            connect_args["ssl_disabled"] = True
        elif self.DB_SSL_CA:
            connect_args["ssl"] = {"ca": self.DB_SSL_CA}
        else:
            connect_args["ssl"] = {
                "check_hostname": False,
                "verify_mode": False
            }
        
        return connect_args
    
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return [origin for origin in origins if origin]
    
    SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30


settings = Settings()

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  📋 Loaded Configuration")
    print("=" * 70)
    print(f"  DB_HOST: {settings.DB_HOST}")
    print(f"  DB_PORT: {settings.DB_PORT}")
    print(f"  DB_USER: {settings.DB_USER}")
    print(f"  DB_NAME: {settings.DB_NAME}")
    print(f"  SSL_DISABLED: {settings.DB_SSL_DISABLED}")
    print("=" * 70 + "\n")
