# -*- coding: utf-8 -*-
"""
프로젝트 관련 API 엔드포인트
실제 DB 스키마에 맞춰 수정됨
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.schemas.project import (
    ProjectListRequest, 
    ProjectListResponse, 
    ComboResponse, 
    ComboItem,
    ManagerResponse,
    ManagerItem
)
from app.services.project_service import ProjectService

router = APIRouter(tags=["Projects"])

@router.get("/list", response_model=ProjectListResponse)
async def get_project_list(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(25, ge=1, le=200, description="페이지당 레코드 수"),
    search_field: Optional[str] = Query(None, description="검색 필드 (project_name, customer_name)"),
    search_text: Optional[str] = Query(None, description="검색어"),
    field_code: Optional[str] = Query(None, description="사업분야 코드"),
    current_stage: Optional[str] = Query(None, description="현재 진행 단계"),
    manager_id: Optional[str] = Query(None, description="담당자 ID"),
    db: Session = Depends(get_db)
):
    """
    프로젝트 목록 조회 (페이징, 검색, 필터링)
    
    VBA에서 호출 예:
    GET /api/v1/projects/list?page=1&page_size=25&current_stage=CONTRACT&manager_id=user01
    """
    request = ProjectListRequest(
        page=page,
        page_size=page_size,
        search_field=search_field,
        search_text=search_text,
        field_code=field_code,
        current_stage=current_stage,
        manager_id=manager_id
    )
    
    return ProjectService.get_project_list(db, request)

@router.get("/combo/{group_code}", response_model=ComboResponse)
async def get_combo_data(
    group_code: str,
    db: Session = Depends(get_db)
):
    """
    콤보박스 데이터 조회
    
    VBA에서 호출 예:
    GET /api/v1/projects/combo/FIELD
    GET /api/v1/projects/combo/STAGE
    """
    items = ProjectService.get_combo_data(db, group_code)
    
    return ComboResponse(
        group_code=group_code,
        items=[ComboItem(**item) for item in items]
    )

@router.get("/managers", response_model=ManagerResponse)
async def get_managers(db: Session = Depends(get_db)):
    """
    담당자 목록 조회 (영업대표만)
    
    VBA에서 호출 예:
    GET /api/v1/projects/managers
    """
    items = ProjectService.get_managers(db)
    
    return ManagerResponse(
        items=[ManagerItem(**item) for item in items]
    )
