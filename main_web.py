"""
FastAPI 웹 서버 - 정적 파일 서빙 및 API 제공
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os

from app.core.config import settings
from app.core.database import test_connection
from app.api.v1.endpoints import projects
from app.api.v1.endpoints import project_detail

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ============================================
# CORS 설정 (웹 클라이언트 접속 허용)
# ============================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# API 라우터 등록
# ============================================
app.include_router(
    projects.router,
    prefix=f"{settings.API_V1_PREFIX}/projects",
    tags=["projects"]
)

app.include_router(
    project_detail.router,
    prefix=f"{settings.API_V1_PREFIX}/project-detail",
    tags=["project-detail"]
)

# ============================================
# 정적 파일 서빙 (HTML, CSS, JS)
# ============================================
# 프로젝트 루트 디렉토리 확인
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# static 디렉토리가 있으면 서빙
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    print(f"✅ Static files mounted: {STATIC_DIR}")
else:
    print(f"⚠️ Static directory not found: {STATIC_DIR}")

# ============================================
# 웹 루트 라우트
# ============================================
@app.get("/")
async def root():
    """
    웹 애플리케이션 메인 페이지
    """
    # index.html 파일이 있으면 반환
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    # 없으면 API 정보 반환
    return {
        "message": "PSMS FastAPI Server",
        "version": "2.0.0",
        "web_app": "/static/index.html",
        "api_docs": "/docs",
        "api_redoc": "/redoc"
    }

@app.get("/web")
async def web_app():
    """
    웹 애플리케이션 직접 접근
    """
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Web application not found"}

# ============================================
# Health Check
# ============================================
@app.get("/health")
async def health_check():
    """
    시스템 상태 확인
    """
    db_status = test_connection()
    return {
        "status": "healthy",
        "web_app": "enabled" if os.path.exists(STATIC_DIR) else "disabled",
        **db_status
    }

# ============================================
# 서버 시작
# ============================================
if __name__ == "__main__":
    print("=" * 60)
    print("🚀 PSMS FastAPI Server Starting...")
    print("=" * 60)
    print(f"📁 Static Directory: {STATIC_DIR}")
    print(f"🌐 Web App: http://0.0.0.0:8000/")
    print(f"📚 API Docs: http://0.0.0.0:8000/docs")
    print(f"🔧 API Redoc: http://0.0.0.0:8000/redoc")
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
