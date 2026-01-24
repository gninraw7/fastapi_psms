# -*- coding: utf-8 -*-
"""
애플리케이션 설정 - Aiven Cloud MySQL 지원
"""
import os
from typing import List


class Settings:
    """애플리케이션 설정 클래스"""
    
    # ============================================
    # 기본 설정
    # ============================================
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "PSMS API")
    API_V1_PREFIX: str = os.getenv("API_V1_PREFIX", "/api/v1")
    VERSION: str = "2.0.0"
    
    # ============================================
    # 데이터베이스 설정
    # ============================================
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "psms")
    DB_CHARSET: str = "utf8mb4"
    
    # ⭐ SSL 설정 (Aiven Cloud MySQL 등 원격 DB용)
    DB_SSL_DISABLED: bool = os.getenv("DB_SSL_DISABLED", "False").lower() in ("true", "1", "yes")
    DB_SSL_CA: str = os.getenv("DB_SSL_CA", "")  # CA 인증서 경로 (선택사항)
    
    @property
    def DATABASE_URL(self) -> str:
        """데이터베이스 연결 URL"""
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset={self.DB_CHARSET}"
    
    @property
    def DATABASE_CONNECT_ARGS(self) -> dict:
        """
        데이터베이스 연결 인자 (SSL 설정 포함)
        
        Returns:
            dict: SQLAlchemy connect_args
        """
        connect_args = {}
        
        if self.DB_SSL_DISABLED:
            # SSL 완전 비활성화 (개발 환경)
            connect_args["ssl_disabled"] = True
        elif self.DB_SSL_CA:
            # CA 인증서 사용 (프로덕션 - 권장)
            connect_args["ssl"] = {
                "ca": self.DB_SSL_CA
            }
        else:
            # SSL 사용하되 인증서 검증 안 함 (Aiven 등)
            connect_args["ssl"] = {
                "check_hostname": False,
                "verify_mode": False
            }
        
        return connect_args
    
    # ============================================
    # CORS 설정
    # ============================================
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        """CORS origins를 리스트로 변환"""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return [origin for origin in origins if origin]
    
    # ============================================
    # 서버 설정
    # ============================================
    SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    
    # ============================================
    # 로깅 설정
    # ============================================
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # ============================================
    # 보안 설정
    # ============================================
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30


# ============================================
# 설정 인스턴스 생성
# ============================================
settings = Settings()


# ============================================
# 설정 정보 출력 (디버깅용)
# ============================================
def print_settings():
    """현재 설정 정보 출력"""
    print("\n" + "=" * 70)
    print("  📋 Current Settings")
    print("=" * 70)
    print(f"  Project: {settings.PROJECT_NAME}")
    print(f"  Version: {settings.VERSION}")
    print(f"  API Prefix: {settings.API_V1_PREFIX}")
    print(f"  Database: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    print(f"  DB User: {settings.DB_USER}")
    print(f"  SSL Disabled: {settings.DB_SSL_DISABLED}")
    if settings.DB_SSL_CA:
        print(f"  SSL CA: {settings.DB_SSL_CA}")
    print(f"  CORS Origins: {settings.CORS_ORIGINS_LIST}")
    print(f"  Debug: {settings.DEBUG}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    # 테스트용
    from dotenv import load_dotenv
    load_dotenv()
    print_settings()
