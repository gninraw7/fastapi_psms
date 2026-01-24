# -*- coding: utf-8 -*-
"""
데이터베이스 연결 설정 - Aiven Cloud MySQL 지원
"""
import pymysql
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# ============================================
# PyMySQL을 MySQLdb로 사용
# ============================================
pymysql.install_as_MySQLdb()

# ============================================
# SQLAlchemy Engine 생성 (SSL 설정 포함)
# ============================================
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,          # 연결 전 ping 체크
    pool_recycle=3600,            # 1시간마다 연결 재생성
    pool_size=5,                  # 기본 연결 풀 크기
    max_overflow=10,              # 최대 추가 연결 수
    connect_args=settings.DATABASE_CONNECT_ARGS  # ⭐ SSL 설정 추가
)

# ============================================
# Session 생성
# ============================================
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db():
    """
    데이터베이스 세션 dependency
    
    Usage:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================
# 데이터베이스 연결 테스트
# ============================================
def test_connection():
    """
    데이터베이스 연결 테스트
    
    Returns:
        dict: 연결 상태 정보
    """
    try:
        with engine.connect() as connection:
            # MySQL 버전 확인
            result = connection.execute(text("SELECT VERSION()"))
            version = result.fetchone()[0]
            
            # 현재 데이터베이스 확인
            result = connection.execute(text("SELECT DATABASE()"))
            db_name = result.fetchone()[0]
            
            # SSL 상태 확인
            ssl_mode = "disabled" if settings.DB_SSL_DISABLED else "enabled"
            if settings.DB_SSL_CA:
                ssl_mode = f"enabled (CA: {settings.DB_SSL_CA})"
            
            return {
                "connected": True,
                "mysql_version": version,
                "database": db_name,
                "host": f"{settings.DB_HOST}:{settings.DB_PORT}",
                "ssl_mode": ssl_mode
            }
            
    except Exception as e:
        error_msg = str(e)
        
        # 상세 에러 정보
        error_details = {
            "connected": False,
            "error": error_msg,
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "database": settings.DB_NAME,
            "user": settings.DB_USER
        }
        
        # SSL 관련 에러 힌트
        if "SSL" in error_msg.upper():
            error_details["hint"] = "SSL connection error. Try setting DB_SSL_DISABLED=true in .env"
        elif "Access denied" in error_msg:
            error_details["hint"] = "Check DB_USER and DB_PASSWORD in .env"
        elif "Unknown database" in error_msg:
            error_details["hint"] = "Check DB_NAME in .env"
        elif "Can't connect" in error_msg or "timeout" in error_msg.lower():
            error_details["hint"] = "Check DB_HOST and DB_PORT, or network/firewall settings"
        
        return error_details


# ============================================
# 데이터베이스 초기화 함수 (선택사항)
# ============================================
def init_db():
    """
    데이터베이스 초기화
    테이블 생성 등
    """
    # Base.metadata.create_all(bind=engine)
    pass


# ============================================
# 직접 연결 함수 (pymysql)
# ============================================
def get_pymysql_connection():
    """
    PyMySQL 직접 연결 (raw SQL 사용 시)
    
    Returns:
        pymysql.Connection
    """
    config = {
        "host": settings.DB_HOST,
        "port": settings.DB_PORT,
        "user": settings.DB_USER,
        "password": settings.DB_PASSWORD,
        "database": settings.DB_NAME,
        "charset": settings.DB_CHARSET,
    }
    
    # SSL 설정 추가
    if not settings.DB_SSL_DISABLED:
        if settings.DB_SSL_CA:
            config["ssl"] = {"ca": settings.DB_SSL_CA}
        else:
            config["ssl"] = {"check_hostname": False}
    
    return pymysql.connect(**config)


# ============================================
# 테스트 실행
# ============================================
if __name__ == "__main__":
    print("Testing database connection...")
    result = test_connection()
    
    if result["connected"]:
        print("✅ Connection successful!")
        print(f"   MySQL: {result['mysql_version']}")
        print(f"   Database: {result['database']}")
        print(f"   Host: {result['host']}")
        print(f"   SSL: {result['ssl_mode']}")
    else:
        print("❌ Connection failed!")
        print(f"   Error: {result['error']}")
        if "hint" in result:
            print(f"   Hint: {result['hint']}")
