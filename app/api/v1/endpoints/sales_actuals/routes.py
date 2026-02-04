# -*- coding: utf-8 -*-
"""
실적관리 API 엔드포인트
- sales_actual_line 조회/저장
- 집계 조회
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List, Dict

from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()


# ============================================
# Request 모델
# ============================================
class SalesActualLineItem(BaseModel):
    pipeline_id: str
    field_code: Optional[str] = None
    service_code: Optional[str] = None
    customer_id: Optional[int] = None
    ordering_party_id: Optional[int] = None
    org_id: Optional[int] = None
    manager_id: Optional[str] = None
    contract_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    order_total: Optional[float] = None
    profit_total: Optional[float] = None
    m01_order: Optional[float] = 0
    m01_profit: Optional[float] = 0
    m02_order: Optional[float] = 0
    m02_profit: Optional[float] = 0
    m03_order: Optional[float] = 0
    m03_profit: Optional[float] = 0
    m04_order: Optional[float] = 0
    m04_profit: Optional[float] = 0
    m05_order: Optional[float] = 0
    m05_profit: Optional[float] = 0
    m06_order: Optional[float] = 0
    m06_profit: Optional[float] = 0
    m07_order: Optional[float] = 0
    m07_profit: Optional[float] = 0
    m08_order: Optional[float] = 0
    m08_profit: Optional[float] = 0
    m09_order: Optional[float] = 0
    m09_profit: Optional[float] = 0
    m10_order: Optional[float] = 0
    m10_profit: Optional[float] = 0
    m11_order: Optional[float] = 0
    m11_profit: Optional[float] = 0
    m12_order: Optional[float] = 0
    m12_profit: Optional[float] = 0


class SalesActualLineSaveRequest(BaseModel):
    actual_year: int
    updated_by: Optional[str] = "system"
    lines: List[SalesActualLineItem]


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


def _sum_actual_orders(line: SalesActualLineItem) -> float:
    total = 0
    for i in range(1, 13):
        key = f"m{str(i).zfill(2)}_order"
        total += float(getattr(line, key) or 0)
    return total


def _sum_actual_profit(line: SalesActualLineItem) -> float:
    total = 0
    for i in range(1, 13):
        key = f"m{str(i).zfill(2)}_profit"
        total += float(getattr(line, key) or 0)
    return total


def _load_project_snapshots(db: Session, pipeline_ids: List[str]) -> Dict[str, dict]:
    if not pipeline_ids:
        return {}

    clause, params = _build_in_clause(pipeline_ids, "pid")
    if not clause:
        return {}

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
            u.user_name AS manager_name,
            pc.contract_date,
            pc.start_date,
            pc.end_date
        FROM projects p
        LEFT JOIN industry_fields f ON f.field_code = p.field_code
        LEFT JOIN service_codes sc ON sc.service_code = p.service_code
        LEFT JOIN clients c1 ON c1.client_id = p.customer_id
        LEFT JOIN clients c2 ON c2.client_id = p.ordering_party_id
        LEFT JOIN org_units o ON o.org_id = p.org_id
        LEFT JOIN users u ON u.login_id = p.manager_id
        LEFT JOIN project_contracts pc ON pc.pipeline_id = p.pipeline_id
        WHERE p.pipeline_id IN ({clause})
    """
    rows = db.execute(text(sql), params).mappings().all()
    return {row["pipeline_id"]: dict(row) for row in rows}


# ============================================
# 실적 라인 조회
# ============================================
@router.get("/lines")
async def list_sales_actual_lines(
    actual_year: int = Query(..., description="실적 연도"),
    org_id: Optional[int] = None,
    manager_id: Optional[str] = None,
    field_code: Optional[str] = None,
    service_code: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        sql = """
            SELECT
                sal.actual_line_id,
                sal.actual_year,
                sal.pipeline_id,
                sal.field_code,
                sal.field_name_snapshot,
                sal.service_code,
                sal.service_name_snapshot,
                sal.customer_id,
                sal.customer_name_snapshot,
                sal.ordering_party_id,
                sal.ordering_party_name_snapshot,
                sal.project_name_snapshot,
                sal.org_id,
                sal.org_name_snapshot,
                sal.manager_id,
                sal.manager_name_snapshot,
                sal.contract_date,
                sal.start_date,
                sal.end_date,
                sal.order_total,
                sal.profit_total,
                sal.m01_order, sal.m01_profit,
                sal.m02_order, sal.m02_profit,
                sal.m03_order, sal.m03_profit,
                sal.m04_order, sal.m04_profit,
                sal.m05_order, sal.m05_profit,
                sal.m06_order, sal.m06_profit,
                sal.m07_order, sal.m07_profit,
                sal.m08_order, sal.m08_profit,
                sal.m09_order, sal.m09_profit,
                sal.m10_order, sal.m10_profit,
                sal.m11_order, sal.m11_profit,
                sal.m12_order, sal.m12_profit
            FROM sales_actual_line sal
            WHERE sal.actual_year = :actual_year
        """
        params = {"actual_year": actual_year}

        if org_id:
            sql += " AND sal.org_id = :org_id"
            params["org_id"] = org_id
        if manager_id:
            sql += " AND sal.manager_id = :manager_id"
            params["manager_id"] = manager_id
        if field_code:
            sql += " AND sal.field_code = :field_code"
            params["field_code"] = field_code
        if service_code:
            sql += " AND sal.service_code = :service_code"
            params["service_code"] = service_code
        if keyword:
            sql += " AND (sal.project_name_snapshot LIKE :keyword OR sal.customer_name_snapshot LIKE :keyword OR sal.pipeline_id LIKE :keyword)"
            params["keyword"] = f"%{keyword}%"

        rows = db.execute(text(sql), params).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except Exception as e:
        app_logger.exception("❌ 실적 라인 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lines")
async def save_sales_actual_lines(request: SalesActualLineSaveRequest, db: Session = Depends(get_db)):
    """실적 라인 저장 (Upsert)"""
    try:
        pipeline_ids = [line.pipeline_id for line in request.lines]
        snapshots = _load_project_snapshots(db, pipeline_ids)

        sql = text("""
            INSERT INTO sales_actual_line (
                actual_year, pipeline_id,
                field_code, field_name_snapshot,
                service_code, service_name_snapshot,
                customer_id, customer_name_snapshot,
                ordering_party_id, ordering_party_name_snapshot,
                project_name_snapshot,
                org_id, org_name_snapshot,
                manager_id, manager_name_snapshot,
                contract_date, start_date, end_date,
                order_total, profit_total,
                m01_order, m01_profit,
                m02_order, m02_profit,
                m03_order, m03_profit,
                m04_order, m04_profit,
                m05_order, m05_profit,
                m06_order, m06_profit,
                m07_order, m07_profit,
                m08_order, m08_profit,
                m09_order, m09_profit,
                m10_order, m10_profit,
                m11_order, m11_profit,
                m12_order, m12_profit,
                created_by, updated_by
            ) VALUES (
                :actual_year, :pipeline_id,
                :field_code, :field_name_snapshot,
                :service_code, :service_name_snapshot,
                :customer_id, :customer_name_snapshot,
                :ordering_party_id, :ordering_party_name_snapshot,
                :project_name_snapshot,
                :org_id, :org_name_snapshot,
                :manager_id, :manager_name_snapshot,
                :contract_date, :start_date, :end_date,
                :order_total, :profit_total,
                :m01_order, :m01_profit,
                :m02_order, :m02_profit,
                :m03_order, :m03_profit,
                :m04_order, :m04_profit,
                :m05_order, :m05_profit,
                :m06_order, :m06_profit,
                :m07_order, :m07_profit,
                :m08_order, :m08_profit,
                :m09_order, :m09_profit,
                :m10_order, :m10_profit,
                :m11_order, :m11_profit,
                :m12_order, :m12_profit,
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
                contract_date = VALUES(contract_date),
                start_date = VALUES(start_date),
                end_date = VALUES(end_date),
                order_total = VALUES(order_total),
                profit_total = VALUES(profit_total),
                m01_order = VALUES(m01_order),
                m01_profit = VALUES(m01_profit),
                m02_order = VALUES(m02_order),
                m02_profit = VALUES(m02_profit),
                m03_order = VALUES(m03_order),
                m03_profit = VALUES(m03_profit),
                m04_order = VALUES(m04_order),
                m04_profit = VALUES(m04_profit),
                m05_order = VALUES(m05_order),
                m05_profit = VALUES(m05_profit),
                m06_order = VALUES(m06_order),
                m06_profit = VALUES(m06_profit),
                m07_order = VALUES(m07_order),
                m07_profit = VALUES(m07_profit),
                m08_order = VALUES(m08_order),
                m08_profit = VALUES(m08_profit),
                m09_order = VALUES(m09_order),
                m09_profit = VALUES(m09_profit),
                m10_order = VALUES(m10_order),
                m10_profit = VALUES(m10_profit),
                m11_order = VALUES(m11_order),
                m11_profit = VALUES(m11_profit),
                m12_order = VALUES(m12_order),
                m12_profit = VALUES(m12_profit),
                updated_by = VALUES(updated_by)
        """)

        saved = 0
        for line in request.lines:
            snap = snapshots.get(line.pipeline_id, {})
            order_total = line.order_total if line.order_total is not None else _sum_actual_orders(line)
            profit_total = line.profit_total if line.profit_total is not None else _sum_actual_profit(line)

            params = {
                "actual_year": request.actual_year,
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
                "contract_date": line.contract_date or snap.get("contract_date"),
                "start_date": line.start_date or snap.get("start_date"),
                "end_date": line.end_date or snap.get("end_date"),
                "order_total": order_total,
                "profit_total": profit_total,
                "m01_order": line.m01_order or 0,
                "m01_profit": line.m01_profit or 0,
                "m02_order": line.m02_order or 0,
                "m02_profit": line.m02_profit or 0,
                "m03_order": line.m03_order or 0,
                "m03_profit": line.m03_profit or 0,
                "m04_order": line.m04_order or 0,
                "m04_profit": line.m04_profit or 0,
                "m05_order": line.m05_order or 0,
                "m05_profit": line.m05_profit or 0,
                "m06_order": line.m06_order or 0,
                "m06_profit": line.m06_profit or 0,
                "m07_order": line.m07_order or 0,
                "m07_profit": line.m07_profit or 0,
                "m08_order": line.m08_order or 0,
                "m08_profit": line.m08_profit or 0,
                "m09_order": line.m09_order or 0,
                "m09_profit": line.m09_profit or 0,
                "m10_order": line.m10_order or 0,
                "m10_profit": line.m10_profit or 0,
                "m11_order": line.m11_order or 0,
                "m11_profit": line.m11_profit or 0,
                "m12_order": line.m12_order or 0,
                "m12_profit": line.m12_profit or 0,
                "created_by": request.updated_by,
                "updated_by": request.updated_by
            }
            db.execute(sql, params)
            saved += 1

        db.commit()
        return {"saved": saved}
    except Exception as e:
        db.rollback()
        app_logger.exception("❌ 실적 라인 저장 실패")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 실적 집계
# ============================================
@router.get("/summary")
async def sales_actual_summary(
    actual_year: int = Query(..., description="실적 연도"),
    group: str = Query("org", description="org|manager|field|service|customer"),
    db: Session = Depends(get_db)
):
    try:
        group_map = {
            "org": "COALESCE(sal.org_name_snapshot, o.org_name, '-')",
            "manager": "COALESCE(sal.manager_name_snapshot, u.user_name, '-')",
            "field": "COALESCE(sal.field_name_snapshot, f.field_name, '-')",
            "service": "COALESCE(sal.service_name_snapshot, sc.display_name, sc.service_name, '-')",
            "customer": "COALESCE(sal.customer_name_snapshot, c.client_name, '-')"
        }
        group_expr = group_map.get(group)
        if not group_expr:
            raise HTTPException(status_code=400, detail="invalid group")

        sql = f"""
            SELECT
                {group_expr} AS group_name,
                SUM(COALESCE(sal.order_total,0)) AS order_total,
                SUM(COALESCE(sal.profit_total,0)) AS profit_total
            FROM sales_actual_line sal
            LEFT JOIN org_units o ON o.org_id = sal.org_id
            LEFT JOIN users u ON u.login_id = sal.manager_id
            LEFT JOIN industry_fields f ON f.field_code = sal.field_code
            LEFT JOIN service_codes sc ON sc.service_code = sal.service_code
            LEFT JOIN clients c ON c.client_id = sal.customer_id
            WHERE sal.actual_year = :actual_year
            GROUP BY group_name
            ORDER BY group_name
        """

        rows = db.execute(text(sql), {"actual_year": actual_year}).mappings().all()
        return {"items": [dict(row) for row in rows]}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.exception("❌ 실적 집계 실패")
        raise HTTPException(status_code=500, detail=str(e))
