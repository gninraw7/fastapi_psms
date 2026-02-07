# main.py
# -*- coding: utf-8 -*-
"""
FastAPI 메인 애플리케이션 - VBA + Web 통합 (방식1: api.py 사용)
버전: 2.0.0
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
import os
import time
from datetime import datetime
from app.api.v1.endpoints import auth

from app.core.config import settings
from app.core.database import test_connection
from app.core.tenant import set_company_cd
from app.core.security import decode_token
from app.core.logger import app_logger, access_logger, db_logger, log_startup_info, log_shutdown_info
from app.api.v1.api import api_router  # ⭐ api.py에서 통합 라우터 import


# ============================================
# Lifespan Events
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 이벤트"""
    # Startup
    log_startup_info()
    app_logger.info(f"📦 Project: {settings.PROJECT_NAME}")
    app_logger.info(f"📊 Database: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    app_logger.info(f"🌐 API Docs: http://0.0.0.0:8000/docs")
    app_logger.info(f"📱 Web App: http://0.0.0.0:8000/")
    app_logger.info(f"🔧 VBA Client: Supported")
    
    # DB 연결 테스트
    try:
        db_status = test_connection()
        if db_status["connected"]:
            db_logger.info(f"✅ Database connected: MySQL {db_status['mysql_version']}")
            db_logger.info(f"✅ Database name: {db_status['database']}")
            app_logger.info("✅ Database connection successful")
        else:
            db_logger.error(f"❌ Database connection failed: {db_status.get('error')}")
            app_logger.error("❌ Database connection failed")
    except Exception as e:
        db_logger.error(f"Database connection error: {e}", exc_info=True)
        app_logger.error(f"Database initialization error: {e}")
    
    app_logger.info("=" * 70)
    
    yield
    
    # Shutdown
    log_shutdown_info()


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
# 미들웨어: company_cd 주입
# ============================================
@app.middleware("http")
async def inject_company_cd(request: Request, call_next):
    """
    요청 컨텍스트에 company_cd 주입
    - 로그인 전: 요청 바디의 company_cd 또는 기본값
    - 로그인 후: JWT 토큰의 company_cd
    - 헤더 X-Company-CD는 보조(토큰이 우선)
    """
    company_cd = None

    # 1) Authorization 토큰에서 company_cd 추출 (우선)
    auth_header = request.headers.get("Authorization") or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        if token:
            try:
                payload = decode_token(token)
                company_cd = payload.get("company_cd") or company_cd
            except Exception:
                # 토큰이 유효하지 않으면 무시 (인증은 별도 처리)
                pass

    # 2) 로그인 요청 바디에서 company_cd 추출
    if company_cd is None and request.url.path.endswith("/auth/login"):
        try:
            body = await request.body()
            if body:
                import json
                data = json.loads(body)
                if isinstance(data, dict):
                    company_cd = data.get("company_cd") or company_cd
            # downstream에서 body 재사용 가능하도록 설정
            request._body = body
        except Exception:
            pass

    # 3) 헤더 보조
    if company_cd is None:
        header_cd = request.headers.get("X-Company-CD")
        if header_cd:
            company_cd = header_cd.strip()

    # 4) 기본값 사용
    if company_cd is None:
        company_cd = settings.DEFAULT_COMPANY_CD

    set_company_cd(company_cd)
    request.state.company_cd = company_cd

    return await call_next(request)


# ============================================
# 미들웨어: 요청/응답 로깅
# ============================================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """모든 HTTP 요청/응답 로깅"""
    start_time = time.time()
    
    # 요청 정보
    client_ip = request.client.host if request.client else "unknown"
    method = request.method
    url = str(request.url)
    path = request.url.path
    
    # 정적 파일 요청은 간단히 로깅
    if path.startswith(("/static", "/css", "/js", "/favicon")):
        access_logger.info(f"{method} {path} - IP: {client_ip}")
        response = await call_next(request)
        return response
    
    # API 요청 상세 로깅
    access_logger.info(f"📥 {method} {path} - IP: {client_ip}")
    app_logger.debug(f"Request URL: {url}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # 응답 로깅
        status_code = response.status_code
        log_level = "info" if status_code < 400 else "warning" if status_code < 500 else "error"
        
        log_msg = (
            f"📤 {method} {path} | "
            f"Status: {status_code} | "
            f"Time: {process_time:.3f}s | "
            f"IP: {client_ip}"
        )
        
        if log_level == "info":
            access_logger.info(log_msg)
        elif log_level == "warning":
            access_logger.warning(log_msg)
        else:
            access_logger.error(log_msg)
        
        return response
        
    except Exception as e:
        process_time = time.time() - start_time
        app_logger.error(
            f"❌ {method} {path} | Error: {str(e)} | "
            f"Time: {process_time:.3f}s | IP: {client_ip}",
            exc_info=True
        )
        raise


# ============================================
# 전역 예외 핸들러
# ============================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 처리 및 로깅"""
    client_ip = request.client.host if request.client else "unknown"
    app_logger.error(
        f"🔥 Global Exception | "
        f"Path: {request.url.path} | "
        f"Method: {request.method} | "
        f"IP: {client_ip} | "
        f"Error: {str(exc)}",
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": str(exc),
            "timestamp": datetime.now().isoformat()
        }
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
app_logger.info(f"✅ CORS configured: {settings.CORS_ORIGINS_LIST}")


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
        app_logger.info(f"✅ CSS directory mounted: {css_dir}")
    
    # JS 파일
    js_dir = os.path.join(STATIC_DIR, "js")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
        app_logger.info(f"✅ JS directory mounted: {js_dir}")
    
    # 나머지 정적 파일
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")    
    app_logger.info(f"✅ Static files mounted: {STATIC_DIR}")
else:
    app_logger.warning(f"⚠️  Static directory not found: {STATIC_DIR}")
    app_logger.warning(f"   Web UI will not be available")


# ============================================
# API 라우터 등록 (통합 라우터 사용)
# ============================================
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app_logger.info(f"✅ API Router registered: {settings.API_V1_PREFIX}")


# ============================================
# 루트 엔드포인트
# ============================================
@app.get("/")
async def root():
    """루트 엔드포인트 - Web UI 또는 API 정보 반환"""
    app_logger.debug("Root endpoint accessed")
    
    # login.html이 있으면 반환 (우선순위 1)
    login_path = os.path.join(STATIC_DIR, "login.html")
    if os.path.exists(login_path):
        return FileResponse(login_path)
    
    # 없으면 index.html 시도 (기존 동작)
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    # 둘 다 없으면 정보 반환
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
    
@app.get("/app")
async def main_app():
    """메인 애플리케이션 (인증 후 접근)"""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        app_logger.info("Main application accessed")
        return FileResponse(index_path)
    
    app_logger.warning("Main application not found")
    return {
        "error": "Main application not found",
        "message": "Please place index.html in the 'static' directory"
    }

@app.get("/web")
async def web_app():
    """Web 애플리케이션 직접 접근"""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        app_logger.info("Web application accessed")
        return FileResponse(index_path)
    
    app_logger.warning("Web application not found")
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
    app_logger.debug("Health check requested")
    
    try:
        db_status = test_connection()
        
        is_healthy = db_status["connected"]
        
        if is_healthy:
            app_logger.debug("Health check: OK")
        else:
            app_logger.warning(f"Health check: Database disconnected - {db_status.get('error')}")
        
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "version": "2.0.0",
            "timestamp": datetime.now().isoformat(),
            "clients": {
                "web": os.path.exists(STATIC_DIR),
                "vba": True
            },
            "database": db_status
        }
    except Exception as e:
        app_logger.error(f"Health check failed: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


# ============================================
# 로그 조회 엔드포인트 (관리용)
# ============================================
@app.get("/admin/logs/recent")
async def get_recent_logs(log_type: str = "app", lines: int = 100):
    """
    최근 로그 조회
    
    Args:
        log_type: 로그 타입 (app, error, access, db)
        lines: 조회할 라인 수
    """
    log_files = {
        "app": "logs/psms_app.log",
        "error": "logs/psms_error.log",
        "access": "logs/psms_access.log",
        "db": "logs/psms_db.log"
    }
    
    log_file = log_files.get(log_type, "logs/psms_app.log")
    
    try:
        if not os.path.exists(log_file):
            return {"error": f"Log file not found: {log_file}"}
        
        with open(log_file, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
        app_logger.info(f"Log file accessed: {log_type} ({lines} lines)")
        
        return {
            "log_type": log_type,
            "lines_requested": lines,
            "lines_returned": len(recent_lines),
            "logs": recent_lines
        }
    except Exception as e:
        app_logger.error(f"Failed to read log file: {e}", exc_info=True)
        return {"error": str(e)}


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
    print(f"  📝 Logs: ./logs/")
    print("=" * 70 + "\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
