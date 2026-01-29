"""
API v1 라우터 통합
"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth
from app.api.v1.endpoints.clients import routes as clients_routes
from app.api.v1.endpoints.common_codes import routes as common_routes
from app.api.v1.endpoints.projects import routes as projects_routes
from app.api.v1.endpoints.project_detail import routes as project_detail_routes

# API v1 메인 라우터
api_router = APIRouter()

# 인증 관련
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"]
)

# 공통 코드 및 담당자
api_router.include_router(
    common_routes.router,
    prefix="/common",
    tags=["common"]
)

# 고객사
api_router.include_router(
    clients_routes.router,
    prefix="/clients",
    tags=["clients"]
)

# 프로젝트
api_router.include_router(
    projects_routes.router,
    prefix="/projects",
    tags=["projects"]
)

# 프로젝트 상세
api_router.include_router(
    project_detail_routes.router,
    prefix="/project-detail",
    tags=["project-detail"]
)
