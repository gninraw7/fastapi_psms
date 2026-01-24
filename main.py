# -*- coding: utf-8 -*-
"""
FastAPI 메인 애플리케이션 - VBA + Web 통합 (방식1: api.py 사용)
버전: 2.0.0
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os

from app.core.config import settings
from app.core.database import test_connection
from app.api.v1.api import api_router  # ⭐ api.py에서 통합 라우터 import


# ============================================
# Lifespan Events
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 이벤트"""
    # Startup
    print("=" * 70)
    print(f"🚀 {settings.PROJECT_NAME} starting...")
    print("=" * 70)
    print(f"📊 Database: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    print(f"🌐 API Docs: http://0.0.0.0:8000/docs")
    print(f"📱 Web App: http://0.0.0.0:8000/")
    print(f"🔧 VBA Client: Supported")
    
    # DB 연결 테스트
    db_status = test_connection()
    if db_status["connected"]:
        print(f"✅ Database connected: MySQL {db_status['mysql_version']}")
        print(f"✅ Database name: {db_status['database']}")
    else:
        print(f"❌ Database connection failed: {db_status.get('error')}")
    
    print("=" * 70)
    
    yield
    
    # Shutdown
    print(f"🛑 {settings.PROJECT_NAME} shutting down...")


# ============================================
# FastAPI 앱 생성
# ============================================
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="프로젝트 및 매출 관리 시스템 - VBA & Web 통합",
    version="2.0.0",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)


# ============================================
# CORS 설정
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# 정적 파일 서빙 (Web 클라이언트)
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.exists(STATIC_DIR):
    # CSS 파일
    css_dir = os.path.join(STATIC_DIR, "css")
    if os.path.exists(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")
    
    # JS 파일
    js_dir = os.path.join(STATIC_DIR, "js")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    
    # 나머지 정적 파일
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")    
    print(f"✅ Static files mounted: {STATIC_DIR}")
else:
    print(f"⚠️  Static directory not found: {STATIC_DIR}")
    print(f"   Web UI will not be available")


# ============================================
# API 라우터 등록 (통합 라우터 사용)
# ============================================
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# ============================================
# 루트 엔드포인트
# ============================================
@app.get("/")
async def root():
    """루트 엔드포인트 - Web UI 또는 API 정보 반환"""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return {
        "message": "PSMS FastAPI Server - VBA & Web Integrated",
        "version": "2.0.0",
        "clients": {
            "web": "/static/index.html" if os.path.exists(STATIC_DIR) else "Not available",
            "vba": "Supported",
        },
        "docs": {
            "swagger": "/docs",
            "redoc": "/redoc"
        }
    }


@app.get("/web")
async def web_app():
    """Web 애플리케이션 직접 접근"""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "error": "Web application not found",
        "message": "Please place static files in the 'static' directory"
    }


# ============================================
# Health Check
# ============================================
@app.get("/health")
async def health_check():
    """서버 상태 및 DB 연결 체크"""
    db_status = test_connection()
    
    return {
        "status": "healthy" if db_status["connected"] else "unhealthy",
        "version": "2.0.0",
        "clients": {
            "web": os.path.exists(STATIC_DIR),
            "vba": True
        },
        "database": db_status
    }


# ============================================
# 서버 실행
# ============================================
if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  🚀 Starting PSMS FastAPI Server (Method 1: Using api.py)")
    print("=" * 70)
    print(f"  📡 Server: http://0.0.0.0:8000")
    print(f"  📚 API Docs: http://0.0.0.0:8000/docs")
    print(f"  🌐 Web App: http://0.0.0.0:8000/")
    print(f"  🔧 VBA Client: Supported")
    print("=" * 70 + "\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
