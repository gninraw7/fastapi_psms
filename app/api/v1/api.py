"""
API v1 라우터 통합
"""
from fastapi import APIRouter, Depends
from app.api.v1.endpoints import auth
from app.api.v1.endpoints.clients import routes as clients_routes
from app.api.v1.endpoints.common_codes import routes as common_routes
from app.api.v1.endpoints.industry_fields import routes as industry_fields_routes
from app.api.v1.endpoints.org_units import routes as org_units_routes
from app.api.v1.endpoints.projects import routes as projects_routes
from app.api.v1.endpoints.project_detail import routes as project_detail_routes
from app.api.v1.endpoints.service_codes import routes as service_codes_routes
from app.api.v1.endpoints.users import routes as users_routes
from app.api.v1.endpoints.sales_plans import routes as sales_plans_routes
from app.api.v1.endpoints.sales_actuals import routes as sales_actuals_routes
from app.api.v1.endpoints.reports import routes as reports_routes
from app.api.v1.endpoints.login_history import routes as login_history_routes
from app.api.v1.endpoints.permissions import routes as permissions_routes
from app.core.permissions import permission_required

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
    tags=["common"],
    dependencies=[Depends(permission_required("common"))]
)

# 고객사
api_router.include_router(
    clients_routes.router,
    prefix="/clients",
    tags=["clients"],
    dependencies=[Depends(permission_required("clients"))]
)

# 분야코드
api_router.include_router(
    industry_fields_routes.router,
    prefix="/industry-fields",
    tags=["industry-fields"],
    dependencies=[Depends(permission_required("industry-fields"))]
)

# 서비스코드
api_router.include_router(
    service_codes_routes.router,
    prefix="/service-codes",
    tags=["service-codes"],
    dependencies=[Depends(permission_required("service-codes"))]
)

# 조직관리
api_router.include_router(
    org_units_routes.router,
    prefix="/org-units",
    tags=["org-units"],
    dependencies=[Depends(permission_required("org-units"))]
)

# 프로젝트
api_router.include_router(
    projects_routes.router,
    prefix="/projects",
    tags=["projects"],
    dependencies=[Depends(permission_required("projects"))]
)

# 프로젝트 상세
api_router.include_router(
    project_detail_routes.router,
    prefix="/project-detail",
    tags=["project-detail"],
    dependencies=[Depends(permission_required("projects"))]
)

# 영업계획
api_router.include_router(
    sales_plans_routes.router,
    prefix="/sales-plans",
    tags=["sales-plans"],
    dependencies=[Depends(permission_required("sales-plans"))]
)

# 실적관리
api_router.include_router(
    sales_actuals_routes.router,
    prefix="/sales-actuals",
    tags=["sales-actuals"],
    dependencies=[Depends(permission_required("sales-actuals"))]
)

# Report
api_router.include_router(
    reports_routes.router,
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(permission_required("reports"))]
)

# 접속 이력
api_router.include_router(
    login_history_routes.router,
    prefix="/login-history",
    tags=["login-history"],
    dependencies=[Depends(permission_required("login-history"))]
)

# 권한 관리
api_router.include_router(
    permissions_routes.router,
    prefix="/permissions",
    tags=["permissions"],
    dependencies=[Depends(permission_required("permissions"))]
)

# 사용자 관리
api_router.include_router(
    users_routes.router,
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(permission_required("users"))]
)
