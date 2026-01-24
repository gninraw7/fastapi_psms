# -*- coding: utf-8 -*-
"""
API v1 라우터 통합
VBA + Web 클라이언트 지원
"""
from fastapi import APIRouter

# 프로젝트 관련 라우터 import
from app.api.v1.endpoints.projects import routes as project_routes

# 프로젝트 상세 관리 라우터 import (신규)
from app.api.v1.endpoints.project_detail import routes as project_detail_routes


# ============================================
# API 라우터 생성
# ============================================
api_router = APIRouter()


# ============================================
# 라우터 등록
# ============================================

# 프로젝트 목록/검색 API
api_router.include_router(
    project_routes.router,
    prefix="/projects",
    tags=["projects"]
)

# 프로젝트 상세 관리 API (신규)
api_router.include_router(
    project_detail_routes.router,
    prefix="/project-detail",
    tags=["project-detail"]
)


# ============================================
# 추가 라우터 등록 (향후 확장)
# ============================================
# 사용자 관리 API
# from app.api.v1.endpoints.users import routes as user_routes
# api_router.include_router(
#     user_routes.router,
#     prefix="/users",
#     tags=["users"]
# )

# 공통코드 관리 API
# from app.api.v1.endpoints.common import routes as common_routes
# api_router.include_router(
#     common_routes.router,
#     prefix="/common",
#     tags=["common"]
# )

# 클라이언트 관리 API
# from app.api.v1.endpoints.clients import routes as client_routes
# api_router.include_router(
#     client_routes.router,
#     prefix="/clients",
#     tags=["clients"]
# )
