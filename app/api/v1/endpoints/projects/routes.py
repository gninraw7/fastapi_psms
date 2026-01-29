# -*- coding: utf-8 -*-
"""
프로젝트 관련 API 엔드포인트
실제 DB 스키마에 맞춰 수정됨
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.logger import app_logger  # ⭐ 이 줄이 있어야 함

from app.schemas.project import (
    ProjectListRequest, 
    ProjectListResponse, 
    ComboResponse, 
    ComboItem,
    ManagerResponse,
    ManagerItem
)
from app.services.project_service import ProjectService
from app.services import project_detail_service
from app.schemas.project_detail import ProjectDetail, ProjectFullDetail

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

@router.get("/{pipeline_id}", response_model=ProjectDetail)
async def get_project_detail(
    pipeline_id: str,
    db: Session = Depends(get_db)
):
    """
    프로젝트 상세 정보 조회 (Flutter 앱 연동용)
    """
    # project_detail_service를 이용해 데이터 조회
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
    프로젝트 전체 상세 정보 조회 (속성+이력 포함)
    """
    project = project_detail_service.get_project_full_detail(db, pipeline_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    
    return project

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

# app/api/v1/endpoints/projects/routes.py의 /managers 엔드포인트 수정

@router.get("/managers")
async def get_managers(db: Session = Depends(get_db)):
    """
    영업 담당자 목록 조회
    
    Returns:
        영업 담당자 목록 (is_sales_rep = 1인 사용자만)
    """
    try:
        app_logger.info("👥 영업 담당자 목록 조회")
        
        query = text("""
            SELECT 
                login_id,
                user_name,
                email,
                department
            FROM users
            WHERE is_sales_rep = 1
            ORDER BY user_name ASC
        """)
        
        result = db.execute(query)
        rows = result.fetchall()
        
        managers = []
        for row in rows:
            managers.append({
                'login_id': row[0],
                'user_name': row[1] or row[0],
                'email': row[2] or '',
                'department': row[3] or ''
            })
        
        app_logger.info(f"✅ 영업 담당자 조회 성공 - {len(managers)}명")
        
        return {
            "managers": managers,
            "total": len(managers)
        }
        
    except Exception as e:
        app_logger.error(f"❌ 담당자 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"담당자 목록 조회 실패: {str(e)}")

 # Request Model 추가
class ProjectCreateRequest(BaseModel):
    project_name: str = Field(..., description="프로젝트명")
    field_code: str = Field(..., description="분야 코드")
    customer_id: int = Field(..., description="고객사 ID")
    current_stage: str = Field(..., description="진행단계")
    manager_id: Optional[str] = Field(None, description="담당자 ID")
    ordering_party_id: Optional[int] = Field(None, description="발주처 ID")
    quoted_amount: Optional[float] = Field(0.0, description="견적금액")
    created_by: Optional[str] = Field(None, description="생성자")

class ProjectUpdateRequest(BaseModel):
    project_name: Optional[str] = None
    field_code: Optional[str] = None
    customer_id: Optional[int] = None
    current_stage: Optional[str] = None
    manager_id: Optional[str] = None
    ordering_party_id: Optional[int] = None
    quoted_amount: Optional[float] = None
    updated_by: Optional[str] = None


@router.post("")
async def create_project(
    request: ProjectCreateRequest,
    db: Session = Depends(get_db)
):
    """프로젝트 등록"""
    try:
        # f-string을 사용하지 않고 모든 문자열 연결은 + 사용
        project_name = request.project_name
        app_logger.info("프로젝트 등록 시작: " + project_name)
        
        # 현재 연도
        from datetime import datetime
        current_year = datetime.now().year
        
        # 시퀀스 조회
        year_pattern = str(current_year) + "_%"
        
        seq_query = text("""
            SELECT COALESCE(MAX(CAST(SUBSTRING(pipeline_id, 6) AS UNSIGNED)), 0) as max_seq
            FROM projects
            WHERE pipeline_id LIKE :year_pattern
        """)
        
        result = db.execute(seq_query, {"year_pattern": year_pattern})
        max_seq = result.fetchone()[0]
        new_seq = max_seq + 1
        
        # pipeline_id 생성
        pipeline_id = str(current_year) + "_" + str(new_seq).zfill(4)
        
        app_logger.info("생성된 pipeline_id: " + pipeline_id)
        
        # 프로젝트 등록
        insert_query = text("""
            INSERT INTO projects (
                pipeline_id, project_name, field_code, manager_id,
                customer_id, ordering_party_id, current_stage,
                quoted_amount, created_by
            ) VALUES (
                :pipeline_id, :project_name, :field_code, :manager_id,
                :customer_id, :ordering_party_id, :current_stage,
                :quoted_amount, :created_by
            )
        """)
        
        params = {
            "pipeline_id": pipeline_id,
            "project_name": request.project_name,
            "field_code": request.field_code,
            "manager_id": request.manager_id,
            "customer_id": request.customer_id,
            "ordering_party_id": request.ordering_party_id,
            "current_stage": request.current_stage,
            "quoted_amount": request.quoted_amount or 0,
            "created_by": request.created_by or "system"
        }
        
        db.execute(insert_query, params)
        db.commit()
        
        app_logger.info("프로젝트 등록 성공: " + pipeline_id)
        
        return {
            "message": "프로젝트가 등록되었습니다",
            "pipeline_id": pipeline_id,
            "project_name": request.project_name
        }
        
    except Exception as e:
        db.rollback()
        error_msg = "프로젝트 등록 실패: " + str(e)
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


@router.put("/{pipeline_id}")
async def update_project(
    pipeline_id: str,
    request: ProjectUpdateRequest,  # ⭐ Request Body로 받기
    db: Session = Depends(get_db)
):
    """프로젝트 수정"""
    try:
        app_logger.info(f"✏️ 프로젝트 수정 - pipeline_id: {pipeline_id}")
        
        # 존재 여부 확인
        check_query = text("SELECT pipeline_id FROM projects WHERE pipeline_id = :pipeline_id")
        result = db.execute(check_query, {'pipeline_id': pipeline_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
        # 수정할 필드만 UPDATE
        update_fields = []
        params = {'pipeline_id': pipeline_id}
        
        if request.project_name is not None:
            update_fields.append("project_name = :project_name")
            params['project_name'] = request.project_name
        
        if request.field_code is not None:
            update_fields.append("field_code = :field_code")
            params['field_code'] = request.field_code
        
        if request.manager_id is not None:
            update_fields.append("manager_id = :manager_id")
            params['manager_id'] = request.manager_id
        
        if request.customer_id is not None:
            update_fields.append("customer_id = :customer_id")
            params['customer_id'] = request.customer_id
        
        if request.ordering_party_id is not None:
            update_fields.append("ordering_party_id = :ordering_party_id")
            params['ordering_party_id'] = request.ordering_party_id
        
        if request.current_stage is not None:
            update_fields.append("current_stage = :current_stage")
            params['current_stage'] = request.current_stage
        
        if request.quoted_amount is not None:
            update_fields.append("quoted_amount = :quoted_amount")
            params['quoted_amount'] = request.quoted_amount
        
        if request.updated_by is not None:
            update_fields.append("updated_by = :updated_by")
            params['updated_by'] = request.updated_by
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다")
        
        query_str = f"""
            UPDATE projects
            SET {', '.join(update_fields)}
            WHERE pipeline_id = :pipeline_id
        """
        
        db.execute(text(query_str), params)
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 수정 성공")
        
        return {
            "message": "프로젝트 정보가 수정되었습니다",
            "pipeline_id": pipeline_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 프로젝트 수정 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"프로젝트 수정 실패: {str(e)}")
        
# ============================================
# 프로젝트 삭제
# ============================================
@router.delete("/{pipeline_id}")
async def delete_project(
    pipeline_id: str,
    db: Session = Depends(get_db)
):
    """
    프로젝트 삭제
    
    Args:
        pipeline_id: 프로젝트 ID
        db: 데이터베이스 세션
    
    Returns:
        삭제 결과
    """
    try:
        app_logger.info(f"🗑️ 프로젝트 삭제 - pipeline_id: {pipeline_id}")
        
        # 존재 여부 확인
        check_query = text("SELECT pipeline_id FROM projects WHERE pipeline_id = :pipeline_id")
        result = db.execute(check_query, {'pipeline_id': pipeline_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
        # 프로젝트 삭제 (CASCADE로 관련 데이터도 삭제됨)
        delete_query = text("DELETE FROM projects WHERE pipeline_id = :pipeline_id")
        db.execute(delete_query, {'pipeline_id': pipeline_id})
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 삭제 성공")
        
        return {
            "message": "프로젝트가 삭제되었습니다",
            "pipeline_id": pipeline_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 프로젝트 삭제 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"프로젝트 삭제 실패: {str(e)}")
        
# ============================================
# 프로젝트 이력 등록
# ============================================
class ProjectHistoryRequest(BaseModel):
    pipeline_id: str = Field(..., description="프로젝트 ID")
    base_date: str = Field(..., description="기준 일자")
    progress_stage: str = Field(..., description="진행 단계")
    strategy_content: str = Field(..., description="이력 내용")
    creator_id: Optional[str] = Field(None, description="작성자 ID")

@router.post("/history")
async def create_project_history(
    request: ProjectHistoryRequest,
    db: Session = Depends(get_db)
):
    """
    프로젝트 이력 등록
    """
    try:
        app_logger.info("프로젝트 이력 등록 시작: " + request.pipeline_id)
        
        # 1. 프로젝트 존재 여부 확인
        check_query = text("""
            SELECT pipeline_id FROM projects WHERE pipeline_id = :pipeline_id
        """)
        
        result = db.execute(check_query, {"pipeline_id": request.pipeline_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
        # 2. 이력 등록
        insert_query = text("""
            INSERT INTO project_history (
                pipeline_id,
                base_date,
                progress_stage,
                strategy_content,
                creator_id,
                created_by
            ) VALUES (
                :pipeline_id,
                :base_date,
                :progress_stage,
                :strategy_content,
                :creator_id,
                :created_by
            )
        """)
        
        params = {
            "pipeline_id": request.pipeline_id,
            "base_date": request.base_date,
            "progress_stage": request.progress_stage,
            "strategy_content": request.strategy_content,
            "creator_id": request.creator_id or "system",
            "created_by": request.creator_id or "system"
        }
        
        result = db.execute(insert_query, params)
        db.commit()
        
        history_id = result.lastrowid
        
        app_logger.info("프로젝트 이력 등록 성공: history_id=" + str(history_id))
        
        return {
            "message": "이력이 등록되었습니다",
            "history_id": history_id,
            "pipeline_id": request.pipeline_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_msg = "이력 등록 실패: " + str(e)
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


# ============================================
# 프로젝트 이력 조회
# ============================================
@router.get("/{pipeline_id}/history")
async def get_project_history(
    pipeline_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    프로젝트 이력 조회
    """
    try:
        app_logger.info("프로젝트 이력 조회: " + pipeline_id)
        
        query = text("""
            SELECT 
                history_id,
                pipeline_id,
                base_date,
                record_date,
                progress_stage,
                strategy_content,
                creator_id,
                created_at
            FROM project_history
            WHERE pipeline_id = :pipeline_id
            ORDER BY base_date DESC, record_date DESC
            LIMIT :limit
        """)
        
        result = db.execute(query, {"pipeline_id": pipeline_id, "limit": limit})
        rows = result.fetchall()
        
        history_list = []
        for row in rows:
            history_list.append({
                "history_id": row[0],
                "pipeline_id": row[1],
                "base_date": row[2].isoformat() if row[2] else None,
                "record_date": row[3].isoformat() if row[3] else None,
                "progress_stage": row[4] or "",
                "strategy_content": row[5] or "",
                "creator_id": row[6] or "",
                "created_at": row[7].isoformat() if row[7] else None
            })
        
        app_logger.info("이력 조회 성공: " + str(len(history_list)) + "건")
        
        return {
            "history": history_list,
            "total": len(history_list),
            "pipeline_id": pipeline_id
        }
        
    except Exception as e:
        error_msg = "이력 조회 실패: " + str(e)
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)

