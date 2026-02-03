"""
API v1 라우터 통합
"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth
from app.api.v1.endpoints.clients import routes as clients_routes
from app.api.v1.endpoints.common_codes import routes as common_routes
from app.api.v1.endpoints.industry_fields import routes as industry_fields_routes
from app.api.v1.endpoints.org_units import routes as org_units_routes
from app.api.v1.endpoints.projects import routes as projects_routes
from app.api.v1.endpoints.project_detail import routes as project_detail_routes
from app.api.v1.endpoints.service_codes import routes as service_codes_routes
from app.api.v1.endpoints.users import routes as users_routes

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

# 분야코드
api_router.include_router(
    industry_fields_routes.router,
    prefix="/industry-fields",
    tags=["industry-fields"]
)

# 서비스코드
api_router.include_router(
    service_codes_routes.router,
    prefix="/service-codes",
    tags=["service-codes"]
)

# 조직관리
api_router.include_router(
    org_units_routes.router,
    prefix="/org-units",
    tags=["org-units"]
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

# 사용자 관리
api_router.include_router(
    users_routes.router,
    prefix="/users",
    tags=["users"]
)
