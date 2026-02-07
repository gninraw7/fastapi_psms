# -*- coding: utf-8 -*-
"""
데이터베이스 연결 설정 - Aiven Cloud MySQL 지원
"""
import pymysql
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.tenant import get_company_cd

# PyMySQL을 MySQLdb로 사용
pymysql.install_as_MySQLdb()

# SQLAlchemy Engine 생성 (SSL 설정 포함)
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=5,
    max_overflow=10,
    connect_args=settings.DATABASE_CONNECT_ARGS  # ⭐ SSL 설정
)

# Session 생성
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db():
    """데이터베이스 세션 dependency"""
    db = SessionLocal()
    try:
        # 요청 컨텍스트의 company_cd를 세션에 저장 (쿼리 파라미터 기본값으로 사용)
        company_cd = get_company_cd()
        if company_cd:
            db.info["company_cd"] = company_cd
            try:
                db.execute(text("SET @company_cd = :company_cd"), {"company_cd": company_cd})
            except Exception:
                # 세션 변수 설정 실패해도 기본 동작 유지
                pass
        yield db
    finally:
        db.close()


def test_connection():
    """데이터베이스 연결 테스트"""
    try:
        with engine.connect() as connection:
            # MySQL 버전 확인
            result = connection.execute(text("SELECT VERSION()"))
            version = result.fetchone()[0]
            
            # 현재 데이터베이스 확인
            result = connection.execute(text("SELECT DATABASE()"))
            db_name = result.fetchone()[0]
            
            # SSL 상태
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
        
        error_details = {
            "connected": False,
            "error": error_msg,
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "database": settings.DB_NAME,
            "user": settings.DB_USER
        }
        
        # 에러 힌트
        if "SSL" in error_msg.upper():
            error_details["hint"] = "SSL error. Try: DB_SSL_DISABLED=true"
        elif "Access denied" in error_msg:
            error_details["hint"] = "Check DB_USER and DB_PASSWORD"
        elif "Unknown database" in error_msg:
            error_details["hint"] = "Check DB_NAME"
        elif "Can't connect" in error_msg or "timeout" in error_msg.lower():
            error_details["hint"] = "Check network/firewall or DB_HOST/DB_PORT"
        
        return error_details


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
