"""
프로젝트 상세 관리 서비스
app/services/project_detail_service.py

버그 수정 (2026-01-30):
- get_project_detail: notes, win_probability 필드 추가
"""
from typing import Optional, List
from sqlalchemy import text
from sqlalchemy.orm import Session
from decimal import Decimal
import logging

from app.schemas.project_detail import (
    ProjectDetail, ProjectAttribute, ProjectHistory,
    ProjectFullDetail, ProjectSaveRequest, ProjectSaveResponse
)

logger = logging.getLogger(__name__)


def get_project_detail(db: Session, pipeline_id: str) -> Optional[ProjectDetail]:
    """
    프로젝트 상세 정보 조회 (JOIN)
    ✅ 수정: notes, win_probability 필드 추가
    """
    query = text("""
        SELECT 
            p.pipeline_id,
            p.project_name,
            p.field_code,
            cc_field.code_name as field_name,
            p.service_code,
            sc.service_name as service_name,
            p.manager_id,
            u.user_name as manager_name,
            p.org_id,
            o.org_name as org_name,
            p.customer_id,
            c1.client_name as customer_name,
            p.ordering_party_id,
            c2.client_name as ordering_party_name,
            p.current_stage,
            cc_stage.code_name as stage_name,
            p.quoted_amount,
            p.win_probability,
            p.notes,
            p.created_at,
            p.updated_at
        FROM projects p
        LEFT JOIN users u ON p.manager_id = u.login_id
        LEFT JOIN org_units o ON p.org_id = o.org_id
        LEFT JOIN clients c1 ON p.customer_id = c1.client_id
        LEFT JOIN clients c2 ON p.ordering_party_id = c2.client_id
        LEFT JOIN service_codes sc ON p.service_code = sc.service_code
        LEFT JOIN comm_code cc_field ON p.field_code = cc_field.code AND cc_field.group_code = 'FIELD'
        LEFT JOIN comm_code cc_stage ON p.current_stage = cc_stage.code AND cc_stage.group_code = 'STAGE'
        WHERE p.pipeline_id = :pipeline_id
    """)
    
    result = db.execute(query, {"pipeline_id": pipeline_id}).fetchone()
    
    if result:
        return ProjectDetail(
            pipeline_id=result.pipeline_id,
            project_name=result.project_name,
            field_code=result.field_code,
            field_name=result.field_name,
            service_code=result.service_code,
            service_name=result.service_name,
            manager_id=result.manager_id,
            manager_name=result.manager_name,
            org_id=result.org_id,
            org_name=result.org_name,
            customer_id=result.customer_id,
            customer_name=result.customer_name,
            ordering_party_id=result.ordering_party_id,
            ordering_party_name=result.ordering_party_name,
            current_stage=result.current_stage,
            stage_name=result.stage_name,
            quoted_amount=result.quoted_amount,
            win_probability=result.win_probability,  # ✅ 추가
            notes=result.notes,  # ✅ 추가
            created_at=result.created_at,
            updated_at=result.updated_at
        )
    
    return None


def get_project_attributes(db: Session, pipeline_id: str) -> List[ProjectAttribute]:
    """
    프로젝트 속성 목록 조회
    """
    query = text("""
        SELECT 
            pa.pipeline_id,
            pa.attr_code,
            pa.attr_value,
            cc.code_name as attr_name,
            pa.created_at,
            pa.updated_at
        FROM project_attributes pa
        LEFT JOIN comm_code cc ON pa.attr_code = cc.code AND cc.group_code = 'PROJECT_ATTRIBUTE'
        WHERE pa.pipeline_id = :pipeline_id
        ORDER BY pa.created_at
    """)
    
    results = db.execute(query, {"pipeline_id": pipeline_id}).fetchall()
    
    return [
        ProjectAttribute(
            pipeline_id=row.pipeline_id,
            attr_code=row.attr_code,
            attr_value=row.attr_value,
            attr_name=row.attr_name,
            created_at=row.created_at,
            updated_at=row.updated_at
        )
        for row in results
    ]


def get_project_histories(db: Session, pipeline_id: str) -> List[ProjectHistory]:
    """
    프로젝트 이력 목록 조회
    """
    query = text("""
        SELECT 
            ph.history_id,
            ph.pipeline_id,
            ph.base_date,
            ph.record_date,
            ph.progress_stage,
            cc.code_name as stage_name,
            ph.strategy_content,
            ph.creator_id,
            u.user_name as creator_name,
            ph.created_at,
            ph.updated_at
        FROM project_history ph
        LEFT JOIN comm_code cc ON ph.progress_stage = cc.code AND cc.group_code = 'STAGE'
        LEFT JOIN users u ON ph.creator_id = u.login_id
        WHERE ph.pipeline_id = :pipeline_id
        ORDER BY ph.base_date DESC, ph.created_at DESC
    """)
    
    results = db.execute(query, {"pipeline_id": pipeline_id}).fetchall()
    
    return [
        ProjectHistory(
            history_id=row.history_id,
            pipeline_id=row.pipeline_id,
            base_date=row.base_date,
            record_date=row.record_date,
            progress_stage=row.progress_stage,
            stage_name=row.stage_name,
            strategy_content=row.strategy_content,
            creator_name=row.creator_name,
            created_at=row.created_at,
            updated_at=row.updated_at
        )
        for row in results
    ]


def get_project_full_detail(db: Session, pipeline_id: str) -> Optional[ProjectFullDetail]:
    """
    프로젝트 전체 상세 정보 조회 (기본+속성+이력)
    """
    project = get_project_detail(db, pipeline_id)
    if not project:
        return None
    
    attributes = get_project_attributes(db, pipeline_id)
    histories = get_project_histories(db, pipeline_id)
    
    return ProjectFullDetail(
        project=project,
        attributes=attributes,
        histories=histories
    )


def save_project(db: Session, data: ProjectSaveRequest) -> ProjectSaveResponse:
    """
    프로젝트 저장 (신규/수정 통합, 속성/이력 포함)
    """
    try:
        pipeline_id = data.pipeline_id
        mode = "UPDATE" if pipeline_id else "INSERT"

        attr_count = 0
        hist_count = 0        
        
        # 프로젝트 기본 정보 저장
        if mode == "INSERT":
            # 신규 프로젝트 생성
            from datetime import date
            year = date.today().year
            year_pattern = f"{year}_%"
            
            # 새 ID 생성
            max_query = text("""
                SELECT MAX(CAST(SUBSTRING(pipeline_id, 6) AS UNSIGNED)) as max_seq
                FROM projects
                WHERE pipeline_id LIKE :year_pattern
            """)
            max_result = db.execute(max_query, {"year_pattern": year_pattern}).fetchone()
            max_seq = max_result.max_seq if max_result and max_result.max_seq else 0
            pipeline_id = f"{year}_{str(max_seq + 1).zfill(3)}"
            
            insert_query = text("""
                INSERT INTO projects (
                    pipeline_id, project_name, field_code, service_code, manager_id, org_id,
                    customer_id, ordering_party_id, current_stage, 
                    quoted_amount, win_probability, notes, created_by
                ) VALUES (
                    :pipeline_id, :project_name, :field_code, :service_code, :manager_id, :org_id,
                    :customer_id, :ordering_party_id, :current_stage,
                    :quoted_amount, :win_probability, :notes, :user_id
                )
            """)
            
            db.execute(insert_query, {
                "pipeline_id": pipeline_id,
                "project_name": data.project_name,
                "field_code": data.field_code,
                "service_code": getattr(data, 'service_code', None),
                "manager_id": data.manager_id,
                "org_id": getattr(data, 'org_id', None),
                "customer_id": data.customer_id,
                "ordering_party_id": data.ordering_party_id,
                "current_stage": data.current_stage,
                "quoted_amount": data.quoted_amount or 0,
                "win_probability": getattr(data, 'win_probability', 0) or 0,
                "notes": getattr(data, 'notes', '') or '',
                "user_id": data.user_id
            })
            
        else:
            # 기존 프로젝트 수정
            update_query = text("""
                UPDATE projects SET
                    project_name = :project_name,
                    field_code = :field_code,
                    service_code = :service_code,
                    manager_id = :manager_id,
                    org_id = :org_id,
                    customer_id = :customer_id,
                    ordering_party_id = :ordering_party_id,
                    current_stage = :current_stage,
                    quoted_amount = :quoted_amount,
                    win_probability = :win_probability,
                    notes = :notes,
                    updated_by = :user_id
                WHERE pipeline_id = :pipeline_id
            """)
            
            db.execute(update_query, {
                "pipeline_id": pipeline_id,
                "project_name": data.project_name,
                "field_code": data.field_code,
                "service_code": getattr(data, 'service_code', None),
                "manager_id": data.manager_id,
                "org_id": getattr(data, 'org_id', None),
                "customer_id": data.customer_id,
                "ordering_party_id": data.ordering_party_id,
                "current_stage": data.current_stage,
                "quoted_amount": data.quoted_amount or 0,
                "win_probability": getattr(data, 'win_probability', 0) or 0,
                "notes": getattr(data, 'notes', '') or '',
                "user_id": data.user_id
            })
        
        # 프로젝트 속성 저장
        if hasattr(data, 'attributes') and data.attributes is not None and len(data.attributes) > 0:
            # ⚠️ attributes 키가 있고, 빈 배열이 아닐 때만 처리
            attr_count = 0
            for attr in data.attributes:
                row_stat = attr.get("row_stat", "")
                
                if row_stat == "N":  # 신규
                    if attr.get("attr_code"):
                        db.execute(text("""
                            INSERT INTO project_attributes (pipeline_id, attr_code, attr_value, created_by)
                            VALUES (:pipeline_id, :attr_code, :attr_value, :user_id)
                        """), {
                            "pipeline_id": pipeline_id,
                            "attr_code": attr["attr_code"],
                            "attr_value": attr.get("attr_value", ""),
                            "user_id": data.user_id
                        })
                        attr_count += 1
                        
                elif row_stat == "U":  # 수정
                    if attr.get("attr_code"):
                        db.execute(text("""
                            UPDATE project_attributes 
                            SET attr_value = :attr_value, updated_by = :user_id
                            WHERE pipeline_id = :pipeline_id AND attr_code = :attr_code
                        """), {
                            "pipeline_id": pipeline_id,
                            "attr_code": attr["attr_code"],
                            "attr_value": attr.get("attr_value", ""),
                            "user_id": data.user_id
                        })
                        attr_count += 1
                        
                elif row_stat == "D":  # 삭제
                    if attr.get("attr_code"):
                        db.execute(text("""
                            DELETE FROM project_attributes 
                            WHERE pipeline_id = :pipeline_id AND attr_code = :attr_code
                        """), {
                            "pipeline_id": pipeline_id,
                            "attr_code": attr["attr_code"]
                        })
                        attr_count += 1
        
        # 프로젝트 이력 저장
        if hasattr(data, 'histories') and data.histories is not None and len(data.histories) > 0:
            # ⚠️ histories 키가 있고, 빈 배열이 아닐 때만 처리
            hist_count = 0
            for hist in data.histories:
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
                        "creator_id": data.user_id,
                        "created_by": data.user_id
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
                            "user_id": data.user_id
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
        
        logger.info(f"프로젝트 저장 완료: {pipeline_id}, 속성: {attr_count}건, 이력: {hist_count}건")
        
        return ProjectSaveResponse(
            success=True,
            pipeline_id=pipeline_id,
            message=f"프로젝트가 {'등록' if mode == 'INSERT' else '수정'}되었습니다.",
            attributes_saved=attr_count,
            histories_saved=hist_count
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"프로젝트 저장 실패: {e}", exc_info=True)
        raise


def delete_project(db: Session, pipeline_id: str, user_id: str) -> bool:
    """
    프로젝트 삭제
    """
    try:
        # 존재 확인
        check_query = text("SELECT pipeline_id FROM projects WHERE pipeline_id = :pipeline_id")
        result = db.execute(check_query, {"pipeline_id": pipeline_id}).fetchone()
        
        if not result:
            return False
        
        # 관련 데이터 삭제 (CASCADE가 없는 경우 수동 삭제)
        db.execute(text("DELETE FROM project_attributes WHERE pipeline_id = :pipeline_id"), 
                   {"pipeline_id": pipeline_id})
        db.execute(text("DELETE FROM project_history WHERE pipeline_id = :pipeline_id"), 
                   {"pipeline_id": pipeline_id})
        
        # 프로젝트 삭제
        db.execute(text("DELETE FROM projects WHERE pipeline_id = :pipeline_id"), 
                   {"pipeline_id": pipeline_id})
        
        db.commit()
        
        logger.info(f"프로젝트 삭제 완료: {pipeline_id} by {user_id}")
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"프로젝트 삭제 실패: {e}", exc_info=True)
        raise
