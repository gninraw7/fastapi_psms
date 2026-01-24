"""
프로젝트 상세 관리 API 초기화
"""
from fastapi import APIRouter
from app.api.v1.endpoints.project_detail import routes

router = APIRouter()
router.include_router(routes.router, tags=["project-detail"])
