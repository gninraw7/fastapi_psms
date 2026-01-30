"""
app/api/v1/endpoints/projects/routes.py
프로젝트 API 라우트 - 버그 수정 (2026-01-30)

수정 내용:
- update_project: notes, win_probability 필드 추가
- 속성/이력 통합 저장 처리
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()


# ============================================
# Request/Response 스키마
# ============================================
class ProjectCreateRequest(BaseModel):
    """프로젝트 등록 요청"""
    project_name: str
    field_code: Optional[str] = None
    manager_id: Optional[str] = None
    customer_id: Optional[int] = None
    ordering_party_id: Optional[int] = None
    current_stage: Optional[str] = None
    quoted_amount: Optional[int] = 0
    win_probability: Optional[int] = 0  # ✅ 추가
    notes: Optional[str] = None  # ✅ 추가
    created_by: Optional[str] = "system"


class ProjectUpdateRequest(BaseModel):
    """프로젝트 수정 요청"""
    project_name: Optional[str] = None
    field_code: Optional[str] = None
    manager_id: Optional[str] = None
    customer_id: Optional[int] = None
    ordering_party_id: Optional[int] = None
    current_stage: Optional[str] = None
    quoted_amount: Optional[int] = None
    win_probability: Optional[int] = None  # ✅ 추가
    notes: Optional[str] = None  # ✅ 추가
    updated_by: Optional[str] = None
    
    # ✅ 속성/이력 데이터
    attributes: Optional[List[dict]] = None
    histories: Optional[List[dict]] = None
    user_id: Optional[str] = None


class ProjectHistoryCreateRequest(BaseModel):
    """프로젝트 이력 등록 요청"""
    pipeline_id: str
    base_date: str = Field(..., description="기준 일자 (YYYY-MM-DD)")
    progress_stage: Optional[str] = Field(None, description="진행 단계")
    strategy_content: Optional[str] = Field(None, description="이력 내용")
    creator_id: Optional[str] = Field(None, description="작성자 ID")


class ProjectHistoryUpdateRequest(BaseModel):
    """프로젝트 이력 수정 요청"""
    base_date: Optional[str] = Field(None, description="기준 일자")
    progress_stage: Optional[str] = Field(None, description="진행 단계")
    strategy_content: Optional[str] = Field(None, description="이력 내용")
    creator_id: Optional[str] = Field(None, description="작성자 ID")


# ============================================
# 프로젝트 목록 조회
# ============================================
@router.get("/list")
async def get_projects_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    field_code: Optional[str] = None,
    current_stage: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """프로젝트 목록 조회 (/list 경로)"""
    return await get_projects(page, page_size, field_code, current_stage, keyword, db)


@router.get("")
async def get_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    field_code: Optional[str] = None,
    current_stage: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """프로젝트 목록 조회"""
    try:
        # 기본 쿼리
        base_query = """
            SELECT 
                p.pipeline_id,
                p.project_name,
                p.field_code,
                f.code_name as field_name,
                p.current_stage,
                s.code_name as stage_name,
                p.manager_id,
                u.user_name as manager_name,
                p.customer_id,
                c1.client_name as customer_name,
                p.ordering_party_id,
                c2.client_name as ordering_party_name,
                p.quoted_amount,
                p.win_probability,
                p.notes,
                p.created_at,
                p.updated_at
            FROM projects p
            LEFT JOIN comm_code f ON f.group_code = 'FIELD' AND f.code = p.field_code
            LEFT JOIN comm_code s ON s.group_code = 'STAGE' AND s.code = p.current_stage
            LEFT JOIN users u ON u.login_id = p.manager_id
            LEFT JOIN clients c1 ON c1.client_id = p.customer_id
            LEFT JOIN clients c2 ON c2.client_id = p.ordering_party_id
            WHERE 1=1
        """
        
        params = {}
        
        if field_code:
            base_query += " AND p.field_code = :field_code"
            params['field_code'] = field_code
        
        if current_stage:
            base_query += " AND p.current_stage = :current_stage"
            params['current_stage'] = current_stage
        
        if keyword:
            base_query += " AND (p.project_name LIKE :keyword OR c1.client_name LIKE :keyword)"
            params['keyword'] = f"%{keyword}%"
        
        # 카운트 쿼리
        count_query = f"SELECT COUNT(*) as cnt FROM ({base_query}) as t"
        count_result = db.execute(text(count_query), params)
        total = count_result.fetchone().cnt
        
        # 페이징
        offset = (page - 1) * page_size
        base_query += " ORDER BY p.created_at DESC LIMIT :limit OFFSET :offset"
        params['limit'] = page_size
        params['offset'] = offset
        
        result = db.execute(text(base_query), params)
        items = [dict(row._mapping) for row in result.fetchall()]
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        app_logger.error(f"❌ 프로젝트 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 프로젝트 등록
# ============================================
@router.post("")
async def create_project(
    request: ProjectCreateRequest,
    db: Session = Depends(get_db)
):
    """프로젝트 등록"""
    try:
        app_logger.info(f"📝 프로젝트 등록 시작: {request.project_name}")
        
        # 새 pipeline_id 생성
        year = datetime.now().year
        year_pattern = f"{year}_%"
        
        max_query = text("""
            SELECT MAX(CAST(SUBSTRING(pipeline_id, 6) AS UNSIGNED)) as max_seq
            FROM projects
            WHERE pipeline_id LIKE :year_pattern
        """)
        result = db.execute(max_query, {"year_pattern": year_pattern})
        max_seq = result.fetchone().max_seq or 0
        
        pipeline_id = f"{year}_{str(max_seq + 1).zfill(3)}"
        
        # 프로젝트 등록
        insert_query = text("""
            INSERT INTO projects (
                pipeline_id, project_name, field_code, manager_id,
                customer_id, ordering_party_id, current_stage,
                quoted_amount, win_probability, notes, created_by
            ) VALUES (
                :pipeline_id, :project_name, :field_code, :manager_id,
                :customer_id, :ordering_party_id, :current_stage,
                :quoted_amount, :win_probability, :notes, :created_by
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
            "win_probability": request.win_probability or 0,
            "notes": request.notes or "",
            "created_by": request.created_by or "system"
        }
        
        db.execute(insert_query, params)
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 등록 성공: {pipeline_id}")
        
        return {
            "message": "프로젝트가 등록되었습니다",
            "pipeline_id": pipeline_id,
            "project_name": request.project_name
        }
        
    except Exception as e:
        db.rollback()
        error_msg = f"프로젝트 등록 실패: {str(e)}"
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


# ============================================
# 프로젝트 수정 (✅ 버그 수정: notes, win_probability 추가)
# ============================================
@router.put("/{pipeline_id}")
async def update_project(
    pipeline_id: str,
    request: ProjectUpdateRequest,
    db: Session = Depends(get_db)
):
    """프로젝트 수정 (기본정보 + 속성 + 이력)"""
    try:
        app_logger.info(f"✏️ 프로젝트 수정 - pipeline_id: {pipeline_id}")
        
        # 존재 여부 확인
        check_query = text("SELECT pipeline_id FROM projects WHERE pipeline_id = :pipeline_id")
        result = db.execute(check_query, {'pipeline_id': pipeline_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
        # ===== 1. 기본정보 수정 =====
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
        
        # ✅ 버그 수정: win_probability 필드 추가
        if request.win_probability is not None:
            update_fields.append("win_probability = :win_probability")
            params['win_probability'] = request.win_probability
        
        # ✅ 버그 수정: notes 필드 추가
        if request.notes is not None:
            update_fields.append("notes = :notes")
            params['notes'] = request.notes
        
        if request.updated_by is not None:
            update_fields.append("updated_by = :updated_by")
            params['updated_by'] = request.updated_by
        elif request.user_id:
            update_fields.append("updated_by = :updated_by")
            params['updated_by'] = request.user_id
        
        if update_fields:
            query_str = f"""
                UPDATE projects
                SET {', '.join(update_fields)}
                WHERE pipeline_id = :pipeline_id
            """
            db.execute(text(query_str), params)
        
        # ===== 2. 속성 저장 =====
        attr_count = 0
        if request.attributes:
            for attr in request.attributes:
                row_stat = attr.get("row_stat", "")
                attr_code = attr.get("attr_code")
                
                if not attr_code:
                    continue
                
                if row_stat == "N":  # 신규
                    db.execute(text("""
                        INSERT INTO project_attributes (pipeline_id, attr_code, attr_value, created_by)
                        VALUES (:pipeline_id, :attr_code, :attr_value, :user_id)
                    """), {
                        "pipeline_id": pipeline_id,
                        "attr_code": attr_code,
                        "attr_value": attr.get("attr_value", ""),
                        "user_id": request.user_id or "system"
                    })
                    attr_count += 1
                    
                elif row_stat == "U":  # 수정
                    db.execute(text("""
                        UPDATE project_attributes 
                        SET attr_value = :attr_value, updated_by = :user_id
                        WHERE pipeline_id = :pipeline_id AND attr_code = :attr_code
                    """), {
                        "pipeline_id": pipeline_id,
                        "attr_code": attr_code,
                        "attr_value": attr.get("attr_value", ""),
                        "user_id": request.user_id or "system"
                    })
                    attr_count += 1
                    
                elif row_stat == "D":  # 삭제
                    db.execute(text("""
                        DELETE FROM project_attributes 
                        WHERE pipeline_id = :pipeline_id AND attr_code = :attr_code
                    """), {
                        "pipeline_id": pipeline_id,
                        "attr_code": attr_code
                    })
                    attr_count += 1
        
        # ===== 3. 이력 저장 =====
        hist_count = 0
        if request.histories:
            for hist in request.histories:
                row_stat = hist.get("row_stat", "")
                
                if row_stat == "N":  # 신규
                    db.execute(text("""
                        INSERT INTO project_history (
                            pipeline_id, base_date, progress_stage, strategy_content, creator_id, created_by
                        ) VALUES (
                            :pipeline_id, :base_date, :progress_stage, :strategy_content, :creator_id, :created_by
                        )
                    """), {
                        "pipeline_id": pipeline_id,
                        "base_date": hist.get("base_date"),
                        "progress_stage": hist.get("progress_stage"),
                        "strategy_content": hist.get("strategy_content", ""),
                        "creator_id": request.user_id or "system",
                        "created_by": request.user_id or "system"
                    })
                    hist_count += 1
                    
                elif row_stat == "U":  # 수정
                    history_id = hist.get("history_id")
                    if history_id:
                        db.execute(text("""
                            UPDATE project_history 
                            SET base_date = :base_date, 
                                progress_stage = :progress_stage, 
                                strategy_content = :strategy_content,
                                updated_by = :user_id
                            WHERE history_id = :history_id
                        """), {
                            "history_id": history_id,
                            "base_date": hist.get("base_date"),
                            "progress_stage": hist.get("progress_stage"),
                            "strategy_content": hist.get("strategy_content", ""),
                            "user_id": request.user_id or "system"
                        })
                        hist_count += 1
                    
                elif row_stat == "D":  # 삭제
                    history_id = hist.get("history_id")
                    if history_id:
                        db.execute(text("""
                            DELETE FROM project_history WHERE history_id = :history_id
                        """), {
                            "history_id": history_id
                        })
                        hist_count += 1
        
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 수정 성공 - 기본정보, 속성: {attr_count}건, 이력: {hist_count}건")
        
        return {
            "message": "프로젝트 정보가 수정되었습니다",
            "pipeline_id": pipeline_id,
            "attributes_saved": attr_count,
            "histories_saved": hist_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 프로젝트 수정 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"프로젝트 수정 실패: {str(e)}")


# ============================================
# 프로젝트 이력 등록
# ============================================
@router.post("/history")
async def create_project_history(
    request: ProjectHistoryCreateRequest,
    db: Session = Depends(get_db)
):
    """프로젝트 이력 등록"""
    try:
        app_logger.info(f"📝 프로젝트 이력 등록: pipeline_id={request.pipeline_id}")
        
        # 프로젝트 존재 여부 확인
        check_query = text("SELECT pipeline_id FROM projects WHERE pipeline_id = :pipeline_id")
        result = db.execute(check_query, {"pipeline_id": request.pipeline_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
        # 이력 등록
        insert_query = text("""
            INSERT INTO project_history (
                pipeline_id, base_date, progress_stage, strategy_content, creator_id, created_by
            ) VALUES (
                :pipeline_id, :base_date, :progress_stage, :strategy_content, :creator_id, :created_by
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
        
        app_logger.info(f"✅ 프로젝트 이력 등록 성공: history_id={history_id}")
        
        return {
            "message": "이력이 등록되었습니다",
            "history_id": history_id,
            "pipeline_id": request.pipeline_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_msg = f"이력 등록 실패: {str(e)}"
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


# ============================================
# 프로젝트 이력 수정
# ============================================
@router.put("/history/{history_id}")
async def update_project_history(
    history_id: int,
    request: ProjectHistoryUpdateRequest,
    db: Session = Depends(get_db)
):
    """프로젝트 이력 수정"""
    try:
        app_logger.info(f"📝 프로젝트 이력 수정: history_id={history_id}")
        
        # 이력 존재 여부 확인
        check_query = text("SELECT history_id FROM project_history WHERE history_id = :history_id")
        result = db.execute(check_query, {"history_id": history_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다")
        
        # 수정할 필드 구성
        update_fields = []
        params = {"history_id": history_id}
        
        if request.base_date is not None:
            update_fields.append("base_date = :base_date")
            params['base_date'] = request.base_date
        
        if request.progress_stage is not None:
            update_fields.append("progress_stage = :progress_stage")
            params['progress_stage'] = request.progress_stage
        
        if request.strategy_content is not None:
            update_fields.append("strategy_content = :strategy_content")
            params['strategy_content'] = request.strategy_content
        
        if request.creator_id is not None:
            update_fields.append("updated_by = :updated_by")
            params['updated_by'] = request.creator_id
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다")
        
        update_query = text(f"""
            UPDATE project_history
            SET {', '.join(update_fields)}
            WHERE history_id = :history_id
        """)
        
        db.execute(update_query, params)
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 이력 수정 성공: history_id={history_id}")
        
        return {
            "message": "이력이 수정되었습니다",
            "history_id": history_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_msg = f"이력 수정 실패: {str(e)}"
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


# ============================================
# 프로젝트 이력 삭제
# ============================================
@router.delete("/history/{history_id}")
async def delete_project_history(
    history_id: int,
    db: Session = Depends(get_db)
):
    """프로젝트 이력 삭제"""
    try:
        app_logger.info(f"🗑️ 프로젝트 이력 삭제: history_id={history_id}")
        
        # 이력 존재 여부 확인
        check_query = text("SELECT history_id FROM project_history WHERE history_id = :history_id")
        result = db.execute(check_query, {"history_id": history_id})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다")
        
        # 삭제
        delete_query = text("DELETE FROM project_history WHERE history_id = :history_id")
        db.execute(delete_query, {"history_id": history_id})
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 이력 삭제 성공: history_id={history_id}")
        
        return {
            "message": "이력이 삭제되었습니다",
            "history_id": history_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_msg = f"이력 삭제 실패: {str(e)}"
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)
