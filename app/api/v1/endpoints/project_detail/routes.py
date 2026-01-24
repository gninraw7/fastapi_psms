"""
프로젝트 상세 관리 API 라우터
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.schemas.project_detail import (
    ProjectDetail, ProjectFullDetail,
    ProjectSaveRequest, ProjectSaveResponse
)
from app.services import project_detail_service

router = APIRouter()


@router.get("/{pipeline_id}", response_model=ProjectDetail)
async def get_project_detail(
    pipeline_id: str,
    db: Session = Depends(get_db)
):
    """
    프로젝트 기본 정보 조회
    """
    project = project_detail_service.get_project_detail(db, pipeline_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    
    return project


@router.get("/{pipeline_id}/full", response_model=ProjectFullDetail)
async def get_project_full_detail(
    pipeline_id: str,
    db: Session = Depends(get_db)
):
    """
    프로젝트 전체 상세 정보 조회 (기본+속성+이력)
    """
    project = project_detail_service.get_project_full_detail(db, pipeline_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    
    return project


@router.post("/save", response_model=ProjectSaveResponse)
async def save_project(
    data: ProjectSaveRequest,
    db: Session = Depends(get_db)
):
    """
    프로젝트 저장 (신규/수정 통합)
    - pipeline_id가 없으면 신규 생성
    - pipeline_id가 있으면 기존 데이터 수정
    - 속성(attributes) 및 이력(histories)도 함께 저장
    """
    try:
        result = project_detail_service.save_project(db, data)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"프로젝트 저장 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/{pipeline_id}")
async def delete_project(
    pipeline_id: str,
    user_id: str = Query(..., description="삭제 요청자 ID"),
    db: Session = Depends(get_db)
):
    """
    프로젝트 삭제
    - CASCADE로 관련 데이터(속성, 이력, 매출실적) 자동 삭제
    """
    try:
        success = project_detail_service.delete_project(db, pipeline_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
        
        return {
            "success": True,
            "message": "정상적으로 삭제되었습니다.",
            "pipeline_id": pipeline_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"프로젝트 삭제 중 오류가 발생했습니다: {str(e)}"
        )
