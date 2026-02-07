# -*- coding: utf-8 -*-
"""
영업계획 API 엔드포인트
- sales_plan, sales_plan_line CRUD
- 프로젝트 기반 라인 초기화 지원
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List, Dict

from app.core.database import get_db
from app.core.logger import app_logger
from app.core.tenant import get_company_cd

router = APIRouter()


# ============================================
# Request 모델
# ============================================
class SalesPlanCreateRequest(BaseModel):
    plan_year: int
    plan_version: Optional[str] = "v1"
    status_code: Optional[str] = "DRAFT"
    base_date: Optional[str] = None
    remarks: Optional[str] = None
    created_by: Optional[str] = "system"


class SalesPlanUpdateRequest(BaseModel):
    plan_version: Optional[str] = None
    status_code: Optional[str] = None
    base_date: Optional[str] = None
    remarks: Optional[str] = None
    updated_by: Optional[str] = "system"


class SalesPlanLineItem(BaseModel):
    pipeline_id: str
    field_code: Optional[str] = None
    service_code: Optional[str] = None
    customer_id: Optional[int] = None
    ordering_party_id: Optional[int] = None
    org_id: Optional[int] = None
    manager_id: Optional[str] = None
    contract_plan_date: Optional[str] = None
    start_plan_date: Optional[str] = None
    end_plan_date: Optional[str] = None
    plan_total: Optional[float] = None
    plan_m01: Optional[float] = 0
    plan_m02: Optional[float] = 0
    plan_m03: Optional[float] = 0
    plan_m04: Optional[float] = 0
    plan_m05: Optional[float] = 0
    plan_m06: Optional[float] = 0
    plan_m07: Optional[float] = 0
    plan_m08: Optional[float] = 0
    plan_m09: Optional[float] = 0
    plan_m10: Optional[float] = 0
    plan_m11: Optional[float] = 0
    plan_m12: Optional[float] = 0


class SalesPlanLineSaveRequest(BaseModel):
    plan_id: int
    updated_by: Optional[str] = "system"
    lines: List[SalesPlanLineItem]


class SalesPlanLineDeleteRequest(BaseModel):
    plan_line_ids: Optional[List[int]] = None
    pipeline_ids: Optional[List[str]] = None
    updated_by: Optional[str] = "system"


# ============================================
# Helper Functions
# ============================================

def _build_in_clause(values: List[str], prefix: str) -> (str, Dict[str, str]):
    params = {}
    placeholders = []
    for idx, value in enumerate(values):
        key = f"{prefix}{idx}"
        placeholders.append(f":{key}")
        params[key] = value
    clause = ", ".join(placeholders) if placeholders else ""
    return clause, params


def _sum_plan_months(line: SalesPlanLineItem) -> float:
    total = 0
    for i in range(1, 13):
        key = f"plan_m{str(i).zfill(2)}"
        total += float(getattr(line, key) or 0)
    return total


def _load_project_snapshots(db: Session, pipeline_ids: List[str]) -> Dict[str, dict]:
    if not pipeline_ids:
        return {}

    clause, params = _build_in_clause(pipeline_ids, "pid")
    if not clause:
        return {}

    company_cd = get_company_cd()
    params["company_cd"] = company_cd
    sql = f"""
        SELECT
            p.pipeline_id,
            f.field_code AS field_code,
            f.field_name AS field_name,
            sc.service_code AS service_code,
            COALESCE(sc.display_name, sc.service_name) AS service_name,
            c1.client_id AS customer_id,
            c1.client_name AS customer_name,
            c2.client_id AS ordering_party_id,
            c2.client_name AS ordering_party_name,
            p.project_name,
            o.org_id AS org_id,
            o.org_name,
            u.login_id AS manager_id,
            u.user_name AS manager_name
        FROM projects p
        LEFT JOIN industry_fields f 
          ON f.field_code = p.field_code
         AND f.company_cd = p.company_cd
        LEFT JOIN service_codes sc 
          ON sc.service_code = p.service_code
         AND sc.company_cd = p.company_cd
        LEFT JOIN clients c1 
          ON c1.client_id = p.customer_id
         AND c1.company_cd = p.company_cd
        LEFT JOIN clients c2 
          ON c2.client_id = p.ordering_party_id
         AND c2.company_cd = p.company_cd
        LEFT JOIN org_units o 
          ON o.org_id = p.org_id
         AND o.company_cd = p.company_cd
        LEFT JOIN users u 
          ON u.login_id = p.manager_id
         AND u.company_cd = p.company_cd
        WHERE p.company_cd = :company_cd
          AND p.pipeline_id IN ({clause})
    """
    rows = db.execute(text(sql), params).mappings().all()
    return {row["pipeline_id"]: dict(row) for row in rows}


def _ensure_plan_editable(db: Session, plan_id: int):
    row = db.execute(
        text("SELECT status_code FROM sales_plan WHERE company_cd = :company_cd AND plan_id = :plan_id"),
        {"plan_id": plan_id, "company_cd": get_company_cd()}
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    if row["status_code"] in ("FINAL", "CANCELLED"):
        raise HTTPException(status_code=403, detail="Plan is not editable")


# ============================================
# 영업계획 헤더
# ============================================
@router.get("/list")
async def list_sales_plans(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    plan_year: Optional[int] = None,
    plan_version: Optional[str] = None,
    status_code: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """영업계획 헤더 목록"""
    try:
        company_cd = get_company_cd()
        base_query = """
            FROM sales_plan sp
            WHERE sp.company_cd = :company_cd
        """
        params = {"company_cd": company_cd}

        if plan_year:
            base_query += " AND sp.plan_year = :plan_year"
            params["plan_year"] = plan_year
        if plan_version:
            base_query += " AND sp.plan_version LIKE :plan_version"
            params["plan_version"] = f"%{plan_version}%"
        if status_code:
            base_query += " AND sp.status_code = :status_code"
            params["status_code"] = status_code
        if keyword:
            base_query += " AND (sp.remarks LIKE :keyword OR sp.plan_version LIKE :keyword)"
            params["keyword"] = f"%{keyword}%"

        count_sql = "SELECT COUNT(*) as total " + base_query
        total = db.execute(text(count_sql), params).scalar() or 0

        stats_sql = """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status_code = 'DRAFT' THEN 1 ELSE 0 END) AS draft_count,
                SUM(CASE WHEN status_code = 'FINAL' THEN 1 ELSE 0 END) AS final_count,
                MAX(plan_year) AS latest_year
            """ + base_query
        stats = db.execute(text(stats_sql), params).mappings().first() or {}

        offset = (page - 1) * page_size
        list_sql = """
            SELECT
                sp.plan_id,
                sp.plan_year,
                sp.plan_version,
                sp.status_code,
                sp.base_date,
                sp.remarks,
                sp.created_at,
                sp.updated_at
            """ + base_query + " ORDER BY sp.plan_year DESC, sp.plan_version DESC LIMIT :offset, :limit"

        rows = db.execute(text(list_sql), {**params, "offset": offset, "limit": page_size}).mappings().all()

        return {
            "items": [dict(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "stats": {
                "total": int(stats.get("total") or 0),
                "draft": int(stats.get("draft_count") or 0),
                "final": int(stats.get("final_count") or 0),
                "latest_year": stats.get("latest_year")
            }
        }
    except Exception as e:
        app_logger.exception("❌ 영업계획 목록 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{plan_id}")
async def get_sales_plan(plan_id: int, db: Session = Depends(get_db)):
    """영업계획 헤더 단건 조회"""
    company_cd = get_company_cd()
    row = db.execute(
        text("""
            SELECT plan_id, plan_year, plan_version, status_code, base_date, remarks, created_at, updated_at
            FROM sales_plan
            WHERE company_cd = :company_cd
              AND plan_id = :plan_id
        """),
        {"plan_id": plan_id, "company_cd": company_cd}
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")

    return dict(row)


@router.post("")
async def create_sales_plan(request: SalesPlanCreateRequest, db: Session = Depends(get_db)):
    """영업계획 헤더 생성"""
    try:
        company_cd = get_company_cd()
        exists = db.execute(
            text("""
                SELECT plan_id FROM sales_plan
                WHERE company_cd = :company_cd
                  AND plan_year = :plan_year AND plan_version = :plan_version
            """),
            {"plan_year": request.plan_year, "plan_version": request.plan_version, "company_cd": company_cd}
        ).first()

        if exists:
            raise HTTPException(status_code=409, detail="Plan year/version already exists")

        result = db.execute(
            text("""
                INSERT INTO sales_plan (
                    company_cd, plan_year, plan_version, status_code, base_date, remarks, created_by, updated_by
                ) VALUES (
                    :company_cd, :plan_year, :plan_version, :status_code, :base_date, :remarks, :created_by, :updated_by
                )
            """),
            {
                "company_cd": company_cd,
                "plan_year": request.plan_year,
                "plan_version": request.plan_version,
                "status_code": request.status_code,
                "base_date": request.base_date,
                "remarks": request.remarks,
                "created_by": request.created_by,
                "updated_by": request.created_by
            }
        )
        db.commit()
        plan_id = result.lastrowid

        return {"plan_id": plan_id, "message": "created"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.exception("❌ 영업계획 생성 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{plan_id}")
async def update_sales_plan(plan_id: int, request: SalesPlanUpdateRequest, db: Session = Depends(get_db)):
    """영업계획 헤더 수정"""
    try:
        company_cd = get_company_cd()
        params = {
            "plan_id": plan_id,
            "company_cd": company_cd,
            "plan_version": request.plan_version,
            "status_code": request.status_code,
            "base_date": request.base_date,
            "remarks": request.remarks,
            "updated_by": request.updated_by
        }
        db.execute(
            text("""
                UPDATE sales_plan
                SET
                    plan_version = COALESCE(:plan_version, plan_version),
                    status_code = COALESCE(:status_code, status_code),
                    base_date = COALESCE(:base_date, base_date),
                    remarks = COALESCE(:remarks, remarks),
                    updated_by = :updated_by
                WHERE company_cd = :company_cd
                  AND plan_id = :plan_id
            """),
            params
        )
        db.commit()
        return {"plan_id": plan_id, "message": "updated"}
    except Exception as e:
        db.rollback()
        app_logger.exception("❌ 영업계획 수정 실패")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 영업계획 라인
# ============================================
@router.get("/{plan_id}/lines")
async def list_sales_plan_lines(
    plan_id: int,
    org_id: Optional[int] = None,
    manager_id: Optional[str] = None,
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """영업계획 라인 목록"""
    try:
        company_cd = get_company_cd()
        sql = """
            SELECT
                spl.plan_line_id,
                spl.plan_id,
                spl.pipeline_id,
                spl.field_code,
                spl.field_name_snapshot,
                spl.service_code,
                spl.service_name_snapshot,
                spl.customer_id,
                spl.customer_name_snapshot,
                spl.ordering_party_id,
                spl.ordering_party_name_snapshot,
                spl.project_name_snapshot,
                spl.org_id,
                spl.org_name_snapshot,
                spl.manager_id,
                spl.manager_name_snapshot,
                spl.contract_plan_date,
                spl.start_plan_date,
                spl.end_plan_date,
                spl.plan_total,
                spl.plan_m01,
                spl.plan_m02,
                spl.plan_m03,
                spl.plan_m04,
                spl.plan_m05,
                spl.plan_m06,
                spl.plan_m07,
                spl.plan_m08,
                spl.plan_m09,
                spl.plan_m10,
                spl.plan_m11,
                spl.plan_m12
            FROM sales_plan_line spl
            WHERE spl.company_cd = :company_cd
              AND spl.plan_id = :plan_id
        """
        params = {"plan_id": plan_id, "company_cd": company_cd}

        if org_id:
            sql += " AND spl.org_id = :org_id"
            params["org_id"] = org_id
        if manager_id:
            sql += " AND spl.manager_id = :manager_id"
            params["manager_id"] = manager_id
        if field_code:
            sql += " AND spl.field_code = :field_code"
            params["field_code"] = field_code
        if service_code:
            sql += " AND spl.service_code = :service_code"
            params["service_code"] = service_code
        if keyword:
            sql += " AND (spl.project_name_snapshot LIKE :keyword OR spl.customer_name_snapshot LIKE :keyword OR spl.pipeline_id LIKE :keyword)"
            params["keyword"] = f"%{keyword}%"

        rows = db.execute(text(sql), params).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except Exception as e:
        app_logger.exception("❌ 영업계획 라인 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{plan_id}/missing-projects")
async def list_missing_projects(
    plan_id: int,
    org_id: Optional[int] = None,
    manager_id: Optional[str] = None,
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """필터 조건에 해당하지만 계획 라인에 없는 프로젝트 목록"""
    try:
        company_cd = get_company_cd()
        sql = """
            SELECT
                p.pipeline_id,
                p.project_name,
                f.field_code,
                f.field_name,
                sc.service_code,
                COALESCE(sc.display_name, sc.service_name) AS service_name,
                c1.client_id AS customer_id,
                c1.client_name AS customer_name,
                c2.client_id AS ordering_party_id,
                c2.client_name AS ordering_party_name,
                o.org_id,
                o.org_name,
                u.login_id AS manager_id,
                u.user_name AS manager_name
            FROM projects p
            LEFT JOIN industry_fields f 
              ON f.field_code = p.field_code
             AND f.company_cd = p.company_cd
            LEFT JOIN service_codes sc 
              ON sc.service_code = p.service_code
             AND sc.company_cd = p.company_cd
            LEFT JOIN clients c1 
              ON c1.client_id = p.customer_id
             AND c1.company_cd = p.company_cd
            LEFT JOIN clients c2 
              ON c2.client_id = p.ordering_party_id
             AND c2.company_cd = p.company_cd
            LEFT JOIN org_units o 
              ON o.org_id = p.org_id
             AND o.company_cd = p.company_cd
            LEFT JOIN users u 
              ON u.login_id = p.manager_id
             AND u.company_cd = p.company_cd
            LEFT JOIN sales_plan_line spl
                ON spl.plan_id = :plan_id 
               AND spl.pipeline_id = p.pipeline_id
               AND spl.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
              AND spl.pipeline_id IS NULL
        """
        params = {"plan_id": plan_id, "company_cd": company_cd}

        if org_id:
            sql += " AND p.org_id = :org_id"
            params["org_id"] = org_id
        if manager_id:
            sql += " AND p.manager_id = :manager_id"
            params["manager_id"] = manager_id
        if field_code:
            sql += " AND p.field_code = :field_code"
            params["field_code"] = field_code
        if service_code:
            sql += " AND p.service_code = :service_code"
            params["service_code"] = service_code
        if keyword:
            sql += " AND (p.project_name LIKE :keyword OR c1.client_name LIKE :keyword OR p.pipeline_id LIKE :keyword)"
            params["keyword"] = f"%{keyword}%"

        sql += " ORDER BY p.pipeline_id"

        rows = db.execute(text(sql), params).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except Exception as e:
        app_logger.exception("❌ 미편성 프로젝트 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{plan_id}/lines")
async def save_sales_plan_lines(plan_id: int, request: SalesPlanLineSaveRequest, db: Session = Depends(get_db)):
    """영업계획 라인 저장 (Upsert)"""
    try:
        _ensure_plan_editable(db, plan_id)
        if plan_id != request.plan_id:
            raise HTTPException(status_code=400, detail="plan_id mismatch")

        company_cd = get_company_cd()
        pipeline_ids = [line.pipeline_id for line in request.lines]
        snapshots = _load_project_snapshots(db, pipeline_ids)

        sql = text("""
            INSERT INTO sales_plan_line (
                company_cd, plan_id, pipeline_id,
                field_code, field_name_snapshot,
                service_code, service_name_snapshot,
                customer_id, customer_name_snapshot,
                ordering_party_id, ordering_party_name_snapshot,
                project_name_snapshot,
                org_id, org_name_snapshot,
                manager_id, manager_name_snapshot,
                contract_plan_date, start_plan_date, end_plan_date,
                plan_total,
                plan_m01, plan_m02, plan_m03, plan_m04, plan_m05, plan_m06,
                plan_m07, plan_m08, plan_m09, plan_m10, plan_m11, plan_m12,
                created_by, updated_by
            ) VALUES (
                :company_cd, :plan_id, :pipeline_id,
                :field_code, :field_name_snapshot,
                :service_code, :service_name_snapshot,
                :customer_id, :customer_name_snapshot,
                :ordering_party_id, :ordering_party_name_snapshot,
                :project_name_snapshot,
                :org_id, :org_name_snapshot,
                :manager_id, :manager_name_snapshot,
                :contract_plan_date, :start_plan_date, :end_plan_date,
                :plan_total,
                :plan_m01, :plan_m02, :plan_m03, :plan_m04, :plan_m05, :plan_m06,
                :plan_m07, :plan_m08, :plan_m09, :plan_m10, :plan_m11, :plan_m12,
                :created_by, :updated_by
            )
            ON DUPLICATE KEY UPDATE
                field_code = COALESCE(VALUES(field_code), field_code),
                field_name_snapshot = COALESCE(VALUES(field_name_snapshot), field_name_snapshot),
                service_code = COALESCE(VALUES(service_code), service_code),
                service_name_snapshot = COALESCE(VALUES(service_name_snapshot), service_name_snapshot),
                customer_id = COALESCE(VALUES(customer_id), customer_id),
                customer_name_snapshot = COALESCE(VALUES(customer_name_snapshot), customer_name_snapshot),
                ordering_party_id = COALESCE(VALUES(ordering_party_id), ordering_party_id),
                ordering_party_name_snapshot = COALESCE(VALUES(ordering_party_name_snapshot), ordering_party_name_snapshot),
                project_name_snapshot = COALESCE(VALUES(project_name_snapshot), project_name_snapshot),
                org_id = COALESCE(VALUES(org_id), org_id),
                org_name_snapshot = COALESCE(VALUES(org_name_snapshot), org_name_snapshot),
                manager_id = COALESCE(VALUES(manager_id), manager_id),
                manager_name_snapshot = COALESCE(VALUES(manager_name_snapshot), manager_name_snapshot),
                contract_plan_date = VALUES(contract_plan_date),
                start_plan_date = VALUES(start_plan_date),
                end_plan_date = VALUES(end_plan_date),
                plan_total = VALUES(plan_total),
                plan_m01 = VALUES(plan_m01),
                plan_m02 = VALUES(plan_m02),
                plan_m03 = VALUES(plan_m03),
                plan_m04 = VALUES(plan_m04),
                plan_m05 = VALUES(plan_m05),
                plan_m06 = VALUES(plan_m06),
                plan_m07 = VALUES(plan_m07),
                plan_m08 = VALUES(plan_m08),
                plan_m09 = VALUES(plan_m09),
                plan_m10 = VALUES(plan_m10),
                plan_m11 = VALUES(plan_m11),
                plan_m12 = VALUES(plan_m12),
                updated_by = VALUES(updated_by)
        """)

        saved = 0
        for line in request.lines:
            snap = snapshots.get(line.pipeline_id, {})
            plan_total = line.plan_total if line.plan_total is not None else _sum_plan_months(line)

            params = {
                "company_cd": company_cd,
                "plan_id": plan_id,
                "pipeline_id": line.pipeline_id,
                "field_code": line.field_code or snap.get("field_code"),
                "field_name_snapshot": snap.get("field_name"),
                "service_code": line.service_code or snap.get("service_code"),
                "service_name_snapshot": snap.get("service_name"),
                "customer_id": line.customer_id or snap.get("customer_id"),
                "customer_name_snapshot": snap.get("customer_name"),
                "ordering_party_id": line.ordering_party_id or snap.get("ordering_party_id"),
                "ordering_party_name_snapshot": snap.get("ordering_party_name"),
                "project_name_snapshot": snap.get("project_name"),
                "org_id": line.org_id or snap.get("org_id"),
                "org_name_snapshot": snap.get("org_name"),
                "manager_id": line.manager_id or snap.get("manager_id"),
                "manager_name_snapshot": snap.get("manager_name"),
                "contract_plan_date": line.contract_plan_date,
                "start_plan_date": line.start_plan_date,
                "end_plan_date": line.end_plan_date,
                "plan_total": plan_total,
                "plan_m01": line.plan_m01 or 0,
                "plan_m02": line.plan_m02 or 0,
                "plan_m03": line.plan_m03 or 0,
                "plan_m04": line.plan_m04 or 0,
                "plan_m05": line.plan_m05 or 0,
                "plan_m06": line.plan_m06 or 0,
                "plan_m07": line.plan_m07 or 0,
                "plan_m08": line.plan_m08 or 0,
                "plan_m09": line.plan_m09 or 0,
                "plan_m10": line.plan_m10 or 0,
                "plan_m11": line.plan_m11 or 0,
                "plan_m12": line.plan_m12 or 0,
                "created_by": request.updated_by,
                "updated_by": request.updated_by
            }
            db.execute(sql, params)
            saved += 1

        db.commit()
        return {"saved": saved}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.exception("❌ 영업계획 라인 저장 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{plan_id}/lines/delete")
async def delete_sales_plan_lines(plan_id: int, request: SalesPlanLineDeleteRequest, db: Session = Depends(get_db)):
    """영업계획 라인 삭제 (선택 제외)"""
    try:
        _ensure_plan_editable(db, plan_id)
        company_cd = get_company_cd()

        line_ids = request.plan_line_ids or []
        pipeline_ids = request.pipeline_ids or []

        if not line_ids and not pipeline_ids:
            raise HTTPException(status_code=400, detail="No targets provided")

        conditions = []
        params = {"plan_id": plan_id, "company_cd": company_cd}

        if line_ids:
            clause, id_params = _build_in_clause([str(x) for x in line_ids], "lid")
            conditions.append(f"plan_line_id IN ({clause})")
            params.update(id_params)

        if pipeline_ids:
            clause, pid_params = _build_in_clause(pipeline_ids, "pid")
            conditions.append(f"pipeline_id IN ({clause})")
            params.update(pid_params)

        where_clause = " OR ".join(conditions)
        sql = f"DELETE FROM sales_plan_line WHERE company_cd = :company_cd AND plan_id = :plan_id AND ({where_clause})"

        result = db.execute(text(sql), params)
        db.commit()
        return {"deleted": result.rowcount}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.exception("❌ 영업계획 라인 삭제 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{plan_id}/import-projects")
async def import_plan_lines_from_projects(
    plan_id: int,
    org_id: Optional[int] = None,
    manager_id: Optional[str] = None,
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """프로젝트 목록에서 영업계획 라인 생성 (없는 항목만 추가)"""
    try:
        _ensure_plan_editable(db, plan_id)
        company_cd = get_company_cd()
        sql = """
            INSERT INTO sales_plan_line (
                company_cd, plan_id, pipeline_id,
                field_code, field_name_snapshot,
                service_code, service_name_snapshot,
                customer_id, customer_name_snapshot,
                ordering_party_id, ordering_party_name_snapshot,
                project_name_snapshot,
                org_id, org_name_snapshot,
                manager_id, manager_name_snapshot,
                contract_plan_date, start_plan_date, end_plan_date,
                plan_total,
                plan_m01, plan_m02, plan_m03, plan_m04, plan_m05, plan_m06,
                plan_m07, plan_m08, plan_m09, plan_m10, plan_m11, plan_m12,
                created_by, updated_by
            )
            SELECT
                :company_cd AS company_cd,
                :plan_id AS plan_id,
                p.pipeline_id,
                f.field_code,
                f.field_name,
                sc.service_code,
                COALESCE(sc.display_name, sc.service_name) AS service_name,
                c1.client_id,
                c1.client_name,
                c2.client_id,
                c2.client_name,
                p.project_name,
                o.org_id,
                o.org_name,
                u.login_id,
                u.user_name,
                pc.contract_date,
                pc.start_date,
                pc.end_date,
                0,
                0,0,0,0,0,0,0,0,0,0,0,0,
                'system',
                'system'
            FROM projects p
            LEFT JOIN industry_fields f 
              ON f.field_code = p.field_code
             AND f.company_cd = p.company_cd
            LEFT JOIN service_codes sc 
              ON sc.service_code = p.service_code
             AND sc.company_cd = p.company_cd
            LEFT JOIN clients c1 
              ON c1.client_id = p.customer_id
             AND c1.company_cd = p.company_cd
            LEFT JOIN clients c2 
              ON c2.client_id = p.ordering_party_id
             AND c2.company_cd = p.company_cd
            LEFT JOIN org_units o 
              ON o.org_id = p.org_id
             AND o.company_cd = p.company_cd
            LEFT JOIN users u 
              ON u.login_id = p.manager_id
             AND u.company_cd = p.company_cd
            LEFT JOIN project_contracts pc 
              ON pc.pipeline_id = p.pipeline_id
             AND pc.company_cd = p.company_cd
            LEFT JOIN sales_plan_line spl
                ON spl.plan_id = :plan_id 
               AND spl.pipeline_id = p.pipeline_id
               AND spl.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
              AND spl.pipeline_id IS NULL
        """
        params = {"plan_id": plan_id, "company_cd": company_cd}

        if org_id:
            sql += " AND p.org_id = :org_id"
            params["org_id"] = org_id
        if manager_id:
            sql += " AND p.manager_id = :manager_id"
            params["manager_id"] = manager_id
        if field_code:
            sql += " AND p.field_code = :field_code"
            params["field_code"] = field_code
        if service_code:
            sql += " AND p.service_code = :service_code"
            params["service_code"] = service_code

        result = db.execute(text(sql), params)
        db.commit()
        return {"inserted": result.rowcount}
    except Exception as e:
        db.rollback()
        app_logger.exception("❌ 영업계획 라인 import 실패")
        raise HTTPException(status_code=500, detail=str(e))
