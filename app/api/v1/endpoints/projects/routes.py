"""
app/api/v1/endpoints/projects/routes.py
프로젝트 API 라우트 - 버그 수정 (2026-01-30)

수정 내용:
- get_projects_list: search_field, search_text, manager_id 파라미터 추가
- update_project: notes, win_probability 필드 추가
- 속성/이력 통합 저장 처리
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, date

from app.core.database import get_db
from app.core.logger import app_logger
from app.core.tenant import get_company_cd

router = APIRouter()

def _parse_list_param(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _apply_in_filter(sql: str, column: str, values: List, params: dict, key_prefix: str) -> str:
    if not values:
        return sql
    placeholders = []
    for idx, value in enumerate(values):
        key = f"{key_prefix}{idx}"
        params[key] = value
        placeholders.append(f":{key}")
    clause = f" AND {column} IN ({', '.join(placeholders)})"
    return sql + clause


# ============================================
# Request/Response 스키마
# ============================================
class ProjectCreateRequest(BaseModel):
    """프로젝트 등록 요청"""
    project_name: str
    field_code: Optional[str] = None
    service_code: Optional[str] = None
    manager_id: Optional[str] = None
    org_id: Optional[int] = None
    customer_id: Optional[int] = None
    ordering_party_id: Optional[int] = None
    current_stage: Optional[str] = None
    quoted_amount: Optional[int] = 0
    win_probability: Optional[int] = 0
    notes: Optional[str] = None
    created_by: Optional[str] = "system"


class ProjectUpdateRequest(BaseModel):
    """프로젝트 수정 요청"""
    project_name: Optional[str] = None
    field_code: Optional[str] = None
    service_code: Optional[str] = None
    manager_id: Optional[str] = None
    org_id: Optional[int] = None
    customer_id: Optional[int] = None
    ordering_party_id: Optional[int] = None
    current_stage: Optional[str] = None
    quoted_amount: Optional[int] = None
    win_probability: Optional[int] = None
    notes: Optional[str] = None
    updated_by: Optional[str] = None
    
    # 속성/이력 데이터
    attributes: Optional[List[dict]] = None
    histories: Optional[List[dict]] = None
    user_id: Optional[str] = None


class ProjectHistoryCreateRequest(BaseModel):
    """프로젝트 이력 등록 요청"""
    pipeline_id: str
    base_date: str = Field(..., description="기준 일자 (YYYY-MM-DD)")
    progress_stage: Optional[str] = Field(None, description="진행 단계")
    activity_type: Optional[str] = Field(None, description="활동유형")
    strategy_content: Optional[str] = Field(None, description="이력 내용")
    creator_id: Optional[str] = Field(None, description="작성자 ID")


class ProjectHistoryUpdateRequest(BaseModel):
    """프로젝트 이력 수정 요청"""
    base_date: Optional[str] = Field(None, description="기준 일자")
    progress_stage: Optional[str] = Field(None, description="진행 단계")
    activity_type: Optional[str] = Field(None, description="활동유형")
    strategy_content: Optional[str] = Field(None, description="이력 내용")
    creator_id: Optional[str] = Field(None, description="작성자 ID")


# ============================================
# 프로젝트 목록 조회
# ⭐ 버그 수정: search_field, search_text, manager_id 파라미터 추가
# ============================================
@router.get("/list")
async def get_projects_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),  # ⭐ 기본값 25로 변경
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    current_stage: Optional[str] = None,
    manager_id: Optional[str] = None,          # ⭐ 추가
    sales_plan_id: Optional[int] = None,
    status: Optional[str] = None,
    search_field: Optional[str] = None,        # ⭐ 추가
    search_text: Optional[str] = None,         # ⭐ 추가
    keyword: Optional[str] = None,             # 기존 호환용
    sort_field: Optional[str] = None,
    sort_dir: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """프로젝트 목록 조회 (/list 경로)"""
    return await get_projects(
        page=page,
        page_size=page_size,
        field_code=field_code,
        service_code=service_code,
        current_stage=current_stage,
        manager_id=manager_id,
        sales_plan_id=sales_plan_id,
        status=status,
        search_field=search_field,
        search_text=search_text,
        keyword=keyword,
        sort_field=sort_field,
        sort_dir=sort_dir,
        db=db
    )


@router.get("")
async def get_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),  # ⭐ 기본값 25로 변경
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    current_stage: Optional[str] = None,
    manager_id: Optional[str] = None,          # ⭐ 추가
    sales_plan_id: Optional[int] = None,
    status: Optional[str] = None,
    search_field: Optional[str] = None,        # ⭐ 추가
    search_text: Optional[str] = None,         # ⭐ 추가
    keyword: Optional[str] = None,             # 기존 호환용
    sort_field: Optional[str] = None,
    sort_dir: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """프로젝트 목록 조회"""
    try:
        app_logger.info(
            f"📋 프로젝트 목록 조회 - page: {page}, page_size: {page_size}, "
            f"field_code: {field_code}, service_code: {service_code}, current_stage: {current_stage}, "
            f"manager_id: {manager_id}, sales_plan_id: {sales_plan_id}, status: {status}, search_field: {search_field}, "
            f"search_text: {search_text}, keyword: {keyword}, "
            f"sort_field: {sort_field}, sort_dir: {sort_dir}"
        )
        company_cd = get_company_cd()
        
        # 기본 쿼리
        base_query = """
            SELECT 
                p.pipeline_id,
                p.project_name,
                p.field_code,
                f.field_name as field_name,
                p.service_code,
                COALESCE(sc.display_name, sc.service_name) as service_name,
                p.current_stage,
                s.code_name as stage_name,
                p.manager_id,
                u.user_name as manager_name,
                p.org_id,
                o.org_name as org_name,
                p.customer_id,
                c1.client_name as customer_name,
                p.ordering_party_id,
                c2.client_name as ordering_party_name,
                p.quoted_amount,
                lh.base_date as latest_base_date,
                lh.strategy_content as latest_history_line,
                h.history_count,
                p.win_probability,
                p.notes,
                p.status,
                p.created_at,
                p.updated_at
            FROM projects p
            LEFT JOIN comm_code s 
              ON s.group_code = 'STAGE' 
             AND s.code = p.current_stage
             AND s.company_cd = p.company_cd
            LEFT JOIN users u 
              ON u.login_id = p.manager_id
             AND u.company_cd = p.company_cd
            LEFT JOIN org_units o 
              ON o.org_id = p.org_id
             AND o.company_cd = p.company_cd
            LEFT JOIN clients c1 
              ON c1.client_id = p.customer_id
             AND c1.company_cd = p.company_cd
            LEFT JOIN clients c2 
              ON c2.client_id = p.ordering_party_id
             AND c2.company_cd = p.company_cd
            LEFT JOIN service_codes sc 
              ON sc.service_code = p.service_code
             AND sc.company_cd = p.company_cd
            LEFT JOIN (
                SELECT company_cd,
                       pipeline_id,
                       COUNT(*) AS history_count,
                       MAX(history_id) AS latest_history_id
                FROM project_history
                WHERE company_cd = :company_cd
                GROUP BY company_cd, pipeline_id
            ) h 
              ON h.pipeline_id = p.pipeline_id
             AND h.company_cd = p.company_cd
            LEFT JOIN project_history lh
                ON lh.pipeline_id = h.pipeline_id
               AND lh.history_id = h.latest_history_id
               AND lh.company_cd = p.company_cd
            LEFT JOIN industry_fields f 
              ON f.field_code = p.field_code
             AND f.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
        """
        
        params = {"company_cd": company_cd}
        
        # 사업분야 필터
        if field_code:
            base_query += " AND p.field_code = :field_code"
            params['field_code'] = field_code

        # 서비스 필터
        if service_code:
            base_query += " AND p.service_code = :service_code"
            params['service_code'] = service_code
        
        # 진행단계 필터
        if current_stage:
            base_query += " AND p.current_stage = :current_stage"
            params['current_stage'] = current_stage

        # 상태 필터 (기본: CLOSED 제외)
        if status:
            base_query += " AND p.status = :status"
            params['status'] = status
        else:
            base_query += " AND (p.status IS NULL OR p.status <> 'CLOSED')"
        
        # ⭐ 담당자 필터 추가
        if manager_id:
            base_query += " AND p.manager_id = :manager_id"
            params['manager_id'] = manager_id

        # 영업계획 필터
        if sales_plan_id:
            base_query += """
                AND EXISTS (
                    SELECT 1
                    FROM sales_plan_line spl
                    WHERE spl.company_cd = p.company_cd
                      AND spl.plan_id = :sales_plan_id
                      AND spl.pipeline_id = p.pipeline_id
                )
            """
            params['sales_plan_id'] = sales_plan_id
        
        # ⭐ 검색 조건 처리 (search_field + search_text)
        if search_text and search_text.strip():
            search_term = f"%{search_text.strip()}%"
            
            if search_field == "pipeline_id":
                # 파이프라인ID 검색
                base_query += " AND p.pipeline_id LIKE :search_text"
                params['search_text'] = search_term
            elif search_field == "project_name":
                # 프로젝트명 검색
                base_query += " AND p.project_name LIKE :search_text"
                params['search_text'] = search_term
            elif search_field == "customer_name":
                # 고객사 검색
                base_query += " AND (c1.client_name LIKE :search_text OR c2.client_name LIKE :search_text)"
                params['search_text'] = search_term
            else:
                # 검색필드가 지정되지 않은 경우 - 프로젝트명 + 고객사 통합 검색
                base_query += """ AND (
                    p.project_name LIKE :search_text 
                    OR c1.client_name LIKE :search_text 
                    OR c2.client_name LIKE :search_text
                    OR p.pipeline_id LIKE :search_text
                )"""
                params['search_text'] = search_term
        
        # 기존 keyword 파라미터 호환 (search_text가 없을 때만)
        elif keyword and keyword.strip():
            base_query += " AND (p.project_name LIKE :keyword OR c1.client_name LIKE :keyword)"
            params['keyword'] = f"%{keyword.strip()}%"
        
        # 카운트 쿼리
        count_query = f"SELECT COUNT(*) as cnt FROM ({base_query}) as t"
        count_result = db.execute(text(count_query), params)
        total = count_result.fetchone().cnt
        
        # 페이징
        offset = (page - 1) * page_size
        allowed_sort_fields = {
            "pipeline_id": "p.pipeline_id",
            "project_name": "p.project_name",
            "field_name": "f.field_name",
            "service_name": "COALESCE(sc.display_name, sc.service_name)",
            "current_stage": "p.current_stage",
            "manager_name": "u.user_name",
            "org_name": "o.org_name",
            "customer_name": "c1.client_name",
            "ordering_party_name": "c2.client_name",
            "quoted_amount": "p.quoted_amount",
            "latest_base_date": "lh.base_date",
            "history_count": "h.history_count",
            "created_at": "p.created_at"
        }
        if sort_field in allowed_sort_fields:
            direction = "ASC" if (sort_dir or "").lower() == "asc" else "DESC"
            base_query += f" ORDER BY {allowed_sort_fields[sort_field]} {direction}"
        else:
            base_query += " ORDER BY p.created_at DESC"
        base_query += " LIMIT :limit OFFSET :offset"
        params['limit'] = page_size
        params['offset'] = offset
        
        result = db.execute(text(base_query), params)
        items = [dict(row._mapping) for row in result.fetchall()]
        
        app_logger.info(f"✅ 프로젝트 목록 조회 완료 - 총 {total}건, 현재 페이지 {len(items)}건")
        
        return {
            "items": items,
            "total": total,
            "total_records": total,  # 프론트엔드 호환용
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
        company_cd = get_company_cd()
        
        # 새 pipeline_id 생성
        year = datetime.now().year
        year_pattern = f"{year}_%"
        
        max_query = text("""
            SELECT MAX(CAST(SUBSTRING(pipeline_id, 6) AS UNSIGNED)) as max_seq
            FROM projects
            WHERE company_cd = :company_cd
              AND pipeline_id LIKE :year_pattern
        """)
        result = db.execute(max_query, {"year_pattern": year_pattern, "company_cd": company_cd})
        max_seq = result.fetchone().max_seq or 0
        
        pipeline_id = f"{year}_{str(max_seq + 1).zfill(3)}"
        
        # 프로젝트 등록
        insert_query = text("""
            INSERT INTO projects (
                company_cd, pipeline_id, project_name, field_code, service_code, manager_id, org_id,
                customer_id, ordering_party_id, current_stage,
                quoted_amount, win_probability, notes, status, created_by
            ) VALUES (
                :company_cd, :pipeline_id, :project_name, :field_code, :service_code, :manager_id, :org_id,
                :customer_id, :ordering_party_id, :current_stage,
                :quoted_amount, :win_probability, :notes, :status, :created_by
            )
        """)
        
        params = {
            "company_cd": company_cd,
            "pipeline_id": pipeline_id,
            "project_name": request.project_name,
            "field_code": request.field_code,
            "service_code": request.service_code,
            "manager_id": request.manager_id,
            "org_id": request.org_id,
            "customer_id": request.customer_id,
            "ordering_party_id": request.ordering_party_id,
            "current_stage": request.current_stage,
            "quoted_amount": request.quoted_amount or 0,
            "win_probability": request.win_probability or 0,
            "notes": request.notes or "",
            "status": "ACTIVE",
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
# 프로젝트 수정
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
        company_cd = get_company_cd()
        
        # 존재 여부 확인
        check_query = text("SELECT pipeline_id FROM projects WHERE company_cd = :company_cd AND pipeline_id = :pipeline_id")
        result = db.execute(check_query, {'pipeline_id': pipeline_id, "company_cd": company_cd})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
        # ===== 1. 기본정보 수정 =====
        update_fields = []
        params = {'pipeline_id': pipeline_id, "company_cd": company_cd}
        
        if request.project_name is not None:
            update_fields.append("project_name = :project_name")
            params['project_name'] = request.project_name
        
        if request.field_code is not None:
            update_fields.append("field_code = :field_code")
            params['field_code'] = request.field_code
        
        if request.service_code is not None:
            update_fields.append("service_code = :service_code")
            params['service_code'] = request.service_code
        
        if request.manager_id is not None:
            update_fields.append("manager_id = :manager_id")
            params['manager_id'] = request.manager_id
        
        if request.org_id is not None:
            update_fields.append("org_id = :org_id")
            params['org_id'] = request.org_id
        
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
        
        if request.win_probability is not None:
            update_fields.append("win_probability = :win_probability")
            params['win_probability'] = request.win_probability
        
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
                SET {', '.join(update_fields)}, updated_at = NOW()
                WHERE company_cd = :company_cd
                  AND pipeline_id = :pipeline_id
            """
            db.execute(text(query_str), params)
        
        # ===== 2. 속성 저장 =====
        if request.attributes is not None:
            # 기존 속성 삭제
            db.execute(text(
                "DELETE FROM project_attributes WHERE company_cd = :company_cd AND pipeline_id = :pipeline_id"
            ), {'pipeline_id': pipeline_id, "company_cd": company_cd})
            
            # 새 속성 추가
            for attr in request.attributes:
                if attr.get('attr_code') and attr.get('attr_value'):
                    db.execute(text("""
                        INSERT INTO project_attributes (company_cd, pipeline_id, attr_code, attr_value, created_by)
                        VALUES (:company_cd, :pipeline_id, :attr_code, :attr_value, :created_by)
                    """), {
                        'company_cd': company_cd,
                        'pipeline_id': pipeline_id,
                        'attr_code': attr['attr_code'],
                        'attr_value': attr['attr_value'],
                        'created_by': request.user_id or 'system'
                    })
        
        # ===== 3. 이력 저장 =====
        if request.histories is not None:
            # 기존 이력 삭제
            db.execute(text(
                "DELETE FROM project_history WHERE company_cd = :company_cd AND pipeline_id = :pipeline_id"
            ), {'pipeline_id': pipeline_id, "company_cd": company_cd})
            
            # 새 이력 추가
            for hist in request.histories:
                if hist.get('base_date'):
                    db.execute(text("""
                        INSERT INTO project_history 
                        (company_cd, pipeline_id, base_date, progress_stage, strategy_content, creator_id, record_date)
                        VALUES 
                        (:company_cd, :pipeline_id, :base_date, :progress_stage, :strategy_content, :creator_id, NOW())
                    """), {
                        'company_cd': company_cd,
                        'pipeline_id': pipeline_id,
                        'base_date': hist['base_date'],
                        'progress_stage': hist.get('progress_stage'),
                        'strategy_content': hist.get('strategy_content', ''),
                        'creator_id': hist.get('creator_id') or request.user_id or 'system'
                    })
        
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 수정 완료: {pipeline_id}")
        
        return {
            "message": "프로젝트가 수정되었습니다",
            "pipeline_id": pipeline_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        error_msg = f"프로젝트 수정 실패: {str(e)}"
        app_logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


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
        app_logger.info(f"📝 프로젝트 이력 등록: {request.pipeline_id}")
        company_cd = get_company_cd()
        
        # 프로젝트 존재 확인
        check_query = text("SELECT pipeline_id FROM projects WHERE company_cd = :company_cd AND pipeline_id = :pipeline_id")
        result = db.execute(check_query, {'pipeline_id': request.pipeline_id, "company_cd": company_cd})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
        # 이력 등록
        insert_query = text("""
            INSERT INTO project_history 
            (company_cd, pipeline_id, base_date, progress_stage, activity_type, strategy_content, creator_id, record_date)
            VALUES 
            (:company_cd, :pipeline_id, :base_date, :progress_stage, :activity_type, :strategy_content, :creator_id, NOW())
        """)
        
        db.execute(insert_query, {
            'company_cd': company_cd,
            'pipeline_id': request.pipeline_id,
            'base_date': request.base_date,
            'progress_stage': request.progress_stage,
            'activity_type': request.activity_type,
            'strategy_content': request.strategy_content,
            'creator_id': request.creator_id or 'system'
        })
        
        # 프로젝트의 현재 단계도 업데이트 (선택적)
        if request.progress_stage:
            db.execute(text("""
                UPDATE projects 
                SET current_stage = :stage, updated_at = NOW()
                WHERE company_cd = :company_cd
                  AND pipeline_id = :pipeline_id
            """), {
                'pipeline_id': request.pipeline_id,
                'company_cd': company_cd,
                'stage': request.progress_stage
            })
        
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 이력 등록 완료: {request.pipeline_id}")
        
        return {
            "message": "이력이 등록되었습니다",
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
        app_logger.info(f"✏️ 프로젝트 이력 수정: history_id={history_id}")
        company_cd = get_company_cd()
        
        # 존재 확인
        check_query = text("SELECT history_id FROM project_history WHERE company_cd = :company_cd AND history_id = :history_id")
        result = db.execute(check_query, {'history_id': history_id, "company_cd": company_cd})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다")
        
        # 수정
        update_fields = []
        params = {'history_id': history_id, "company_cd": company_cd}
        
        if request.base_date is not None:
            update_fields.append("base_date = :base_date")
            params['base_date'] = request.base_date
        
        if request.progress_stage is not None:
            update_fields.append("progress_stage = :progress_stage")
            params['progress_stage'] = request.progress_stage

        if request.activity_type is not None:
            update_fields.append("activity_type = :activity_type")
            params['activity_type'] = request.activity_type

        if request.strategy_content is not None:
            update_fields.append("strategy_content = :strategy_content")
            params['strategy_content'] = request.strategy_content
        
        if update_fields:
            query_str = f"""
                UPDATE project_history
                SET {', '.join(update_fields)}, updated_at = NOW()
                WHERE company_cd = :company_cd
                  AND history_id = :history_id
            """
            db.execute(text(query_str), params)
            db.commit()
        
        app_logger.info(f"✅ 프로젝트 이력 수정 완료: history_id={history_id}")
        
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
        company_cd = get_company_cd()
        
        # 존재 확인
        check_query = text("SELECT history_id FROM project_history WHERE company_cd = :company_cd AND history_id = :history_id")
        result = db.execute(check_query, {'history_id': history_id, "company_cd": company_cd})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다")
        
        # 삭제
        db.execute(
            text("DELETE FROM project_history WHERE company_cd = :company_cd AND history_id = :history_id"),
            {'history_id': history_id, "company_cd": company_cd}
        )
        db.commit()
        
        app_logger.info(f"✅ 프로젝트 이력 삭제 완료: history_id={history_id}")
        
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


# ============================================
# 진행상황 조회 - 필터 데이터
# ============================================
@router.get("/history/filters")
async def get_project_history_filters(
    db: Session = Depends(get_db)
):
    """진행상황 조회용 필터 목록"""
    try:
        company_cd = get_company_cd()

        fields = db.execute(text("""
            SELECT field_code, field_name
            FROM industry_fields
            WHERE company_cd = :company_cd
            ORDER BY field_name ASC
        """), {"company_cd": company_cd}).mappings().all()

        services = db.execute(text("""
            SELECT service_code,
                   COALESCE(display_name, service_name) AS service_name
            FROM service_codes
            WHERE company_cd = :company_cd
              AND parent_code IS NOT NULL
            ORDER BY service_name ASC
        """), {"company_cd": company_cd}).mappings().all()

        managers = db.execute(text("""
            SELECT login_id, user_name
            FROM users
            WHERE company_cd = :company_cd
              AND status = 'ACTIVE'
            ORDER BY user_name ASC
        """), {"company_cd": company_cd}).mappings().all()

        org_units = db.execute(text("""
            SELECT org_id, org_name
            FROM org_units
            WHERE company_cd = :company_cd
            ORDER BY org_name ASC
        """), {"company_cd": company_cd}).mappings().all()

        activity_types = db.execute(text("""
            SELECT code AS activity_type,
                   code_name AS activity_type_name,
                   sort_order
            FROM comm_code
            WHERE company_cd = :company_cd
              AND group_code = 'ACTIVITY_TYPE'
              AND is_use = 'Y'
            ORDER BY sort_order ASC, code ASC
        """), {"company_cd": company_cd}).mappings().all()

        return {
            "fields": [dict(row) for row in fields],
            "services": [dict(row) for row in services],
            "managers": [dict(row) for row in managers],
            "org_units": [dict(row) for row in org_units],
            "activity_types": [dict(row) for row in activity_types]
        }
    except Exception as e:
        app_logger.error(f"❌ 진행상황 조회 필터 로드 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 진행상황 조회 - 프로젝트 검색
# ============================================
@router.get("/history/project-search")
async def search_project_history_targets(
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """진행상황 조회용 프로젝트 검색"""
    try:
        company_cd = get_company_cd()

        where = "WHERE p.company_cd = :company_cd"
        params = {"company_cd": company_cd}

        if keyword:
            params["keyword"] = f"%{keyword}%"
            where += """
                AND (
                    p.project_name LIKE :keyword
                    OR p.pipeline_id LIKE :keyword
                    OR c1.client_name LIKE :keyword
                    OR c2.client_name LIKE :keyword
                )
            """

        count_sql = f"""
            SELECT COUNT(*) AS cnt
            FROM projects p
            LEFT JOIN clients c1
              ON c1.client_id = p.customer_id
             AND c1.company_cd = p.company_cd
            LEFT JOIN clients c2
              ON c2.client_id = p.ordering_party_id
             AND c2.company_cd = p.company_cd
            {where}
        """
        total = db.execute(text(count_sql), params).fetchone().cnt or 0

        offset = (page - 1) * page_size
        params["limit"] = page_size
        params["offset"] = offset

        list_sql = f"""
            SELECT
                p.pipeline_id,
                p.project_name,
                c1.client_name AS customer_name,
                c2.client_name AS ordering_party_name
            FROM projects p
            LEFT JOIN clients c1
              ON c1.client_id = p.customer_id
             AND c1.company_cd = p.company_cd
            LEFT JOIN clients c2
              ON c2.client_id = p.ordering_party_id
             AND c2.company_cd = p.company_cd
            {where}
            ORDER BY p.project_name ASC, p.pipeline_id ASC
            LIMIT :limit OFFSET :offset
        """
        rows = db.execute(text(list_sql), params).mappings().all()
        items = [dict(row) for row in rows]

        total_pages = (total + page_size - 1) // page_size if page_size else 1

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }
    except Exception as e:
        app_logger.error(f"❌ 프로젝트 검색 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 진행상황 조회 - 캘린더 요약 (활동유형 집계)
# ============================================
@router.get("/history/calendar/summary")
async def get_project_history_calendar_summary(
    date_from: date = Query(..., description="조회 시작일 (YYYY-MM-DD)"),
    date_to: date = Query(..., description="조회 종료일 (YYYY-MM-DD)"),
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    manager_id: Optional[str] = None,
    org_id: Optional[str] = None,
    pipeline_id: Optional[str] = None,
    project_keyword: Optional[str] = None,
    activity_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """진행상황 조회용 활동유형 집계"""
    try:
        company_cd = get_company_cd()

        if date_from > date_to:
            date_from, date_to = date_to, date_from

        field_list = _parse_list_param(field_code)
        service_list = _parse_list_param(service_code)
        manager_list = _parse_list_param(manager_id)
        pipeline_list = _parse_list_param(pipeline_id)
        activity_list = _parse_list_param(activity_type)
        org_list_raw = _parse_list_param(org_id)
        org_list = []
        for raw in org_list_raw:
            try:
                org_list.append(int(raw))
            except ValueError:
                continue

        params = {
            "company_cd": company_cd,
            "date_from": date_from,
            "date_to": date_to
        }

        sql = """
            SELECT
                ph.base_date,
                ph.activity_type,
                cc_act.code_name AS activity_type_name,
                COUNT(*) AS activity_count
            FROM project_history ph
            JOIN projects p
              ON p.company_cd = ph.company_cd
             AND p.pipeline_id = ph.pipeline_id
            LEFT JOIN clients c
              ON c.client_id = p.customer_id
             AND c.company_cd = p.company_cd
            LEFT JOIN clients c2
              ON c2.client_id = p.ordering_party_id
             AND c2.company_cd = p.company_cd
            LEFT JOIN comm_code cc_act
              ON cc_act.group_code = 'ACTIVITY_TYPE'
             AND cc_act.code = ph.activity_type
             AND cc_act.company_cd = ph.company_cd
            WHERE ph.company_cd = :company_cd
              AND ph.base_date BETWEEN :date_from AND :date_to
        """

        sql = _apply_in_filter(sql, "p.field_code", field_list, params, "field")
        sql = _apply_in_filter(sql, "p.service_code", service_list, params, "service")
        sql = _apply_in_filter(sql, "p.manager_id", manager_list, params, "manager")
        sql = _apply_in_filter(sql, "p.pipeline_id", pipeline_list, params, "pipeline")
        sql = _apply_in_filter(sql, "ph.activity_type", activity_list, params, "atype")
        sql = _apply_in_filter(sql, "p.org_id", org_list, params, "org")

        if project_keyword:
            params["project_keyword"] = f"%{project_keyword}%"
            sql += """
                AND (
                    p.project_name LIKE :project_keyword
                    OR p.pipeline_id LIKE :project_keyword
                    OR c.client_name LIKE :project_keyword
                    OR c2.client_name LIKE :project_keyword
                )
            """

        sql += """
            GROUP BY ph.base_date, ph.activity_type, cc_act.code_name
            ORDER BY ph.base_date ASC
        """

        rows = db.execute(text(sql), params).mappings().all()
        items = [dict(row) for row in rows]

        return {"items": items}
    except Exception as e:
        app_logger.error(f"❌ 진행상황 요약 로드 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 진행상황 조회 - 캘린더 데이터
# ============================================
@router.get("/history/calendar")
async def get_project_history_calendar(
    date_from: date = Query(..., description="조회 시작일 (YYYY-MM-DD)"),
    date_to: date = Query(..., description="조회 종료일 (YYYY-MM-DD)"),
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    manager_id: Optional[str] = None,
    org_id: Optional[str] = None,
    pipeline_id: Optional[str] = None,
    project_keyword: Optional[str] = None,
    activity_type: Optional[str] = None,
    dates: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """진행상황 조회용 Project History 목록"""
    try:
        company_cd = get_company_cd()

        if date_from > date_to:
            date_from, date_to = date_to, date_from

        date_list = []
        for raw in _parse_list_param(dates):
            try:
                date_list.append(date.fromisoformat(raw))
            except ValueError:
                continue

        field_list = _parse_list_param(field_code)
        service_list = _parse_list_param(service_code)
        manager_list = _parse_list_param(manager_id)
        pipeline_list = _parse_list_param(pipeline_id)
        activity_list = _parse_list_param(activity_type)
        org_list_raw = _parse_list_param(org_id)
        org_list = []
        for raw in org_list_raw:
            try:
                org_list.append(int(raw))
            except ValueError:
                continue

        params = {"company_cd": company_cd}
        sql = """
            SELECT
                ph.history_id,
                ph.pipeline_id,
                ph.base_date,
                ph.progress_stage,
                cc.code_name AS stage_name,
                ph.activity_type,
                cc_act.code_name AS activity_type_name,
                ph.strategy_content,
                ph.created_at,
                ph.updated_at,
                ph.created_by,
                ph.updated_by,
                p.project_name,
                p.field_code,
                f.field_name,
                p.service_code,
                COALESCE(sc.display_name, sc.service_name) AS service_name,
                p.manager_id,
                u.user_name AS manager_name,
                p.org_id,
                o.org_name,
                p.customer_id,
                c.client_name AS customer_name
            FROM project_history ph
            JOIN projects p
              ON p.company_cd = ph.company_cd
             AND p.pipeline_id = ph.pipeline_id
            LEFT JOIN industry_fields f
              ON f.field_code = p.field_code
             AND f.company_cd = p.company_cd
            LEFT JOIN service_codes sc
              ON sc.service_code = p.service_code
             AND sc.company_cd = p.company_cd
            LEFT JOIN comm_code cc
              ON cc.group_code = 'STAGE'
             AND cc.code = ph.progress_stage
             AND cc.company_cd = ph.company_cd
            LEFT JOIN comm_code cc_act
              ON cc_act.group_code = 'ACTIVITY_TYPE'
             AND cc_act.code = ph.activity_type
             AND cc_act.company_cd = ph.company_cd
            LEFT JOIN users u
              ON u.login_id = p.manager_id
             AND u.company_cd = p.company_cd
            LEFT JOIN org_units o
              ON o.org_id = p.org_id
             AND o.company_cd = p.company_cd
            LEFT JOIN clients c
              ON c.client_id = p.customer_id
             AND c.company_cd = p.company_cd
            LEFT JOIN clients c2
              ON c2.client_id = p.ordering_party_id
             AND c2.company_cd = p.company_cd
            WHERE ph.company_cd = :company_cd
              AND ph.base_date IS NOT NULL
        """

        if date_list:
            sql = _apply_in_filter(sql, "ph.base_date", date_list, params, "d")
            date_from = min(date_list)
            date_to = max(date_list)
        else:
            sql += " AND ph.base_date BETWEEN :date_from AND :date_to"
            params["date_from"] = date_from
            params["date_to"] = date_to

        sql = _apply_in_filter(sql, "p.field_code", field_list, params, "field")
        sql = _apply_in_filter(sql, "p.service_code", service_list, params, "service")
        sql = _apply_in_filter(sql, "p.manager_id", manager_list, params, "manager")
        sql = _apply_in_filter(sql, "p.pipeline_id", pipeline_list, params, "pipeline")
        sql = _apply_in_filter(sql, "ph.activity_type", activity_list, params, "atype")
        sql = _apply_in_filter(sql, "p.org_id", org_list, params, "org")
        if project_keyword:
            params["project_keyword"] = f"%{project_keyword}%"
            sql += """
                AND (
                    p.project_name LIKE :project_keyword
                    OR p.pipeline_id LIKE :project_keyword
                    OR c.client_name LIKE :project_keyword
                    OR c2.client_name LIKE :project_keyword
                )
            """

        sql += " ORDER BY ph.base_date ASC, ph.history_id ASC"

        rows = db.execute(text(sql), params).mappings().all()
        items = [dict(row) for row in rows]

        return {
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "total": len(items),
            "items": items
        }
    except Exception as e:
        app_logger.error(f"❌ 진행상황 조회 데이터 로드 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
