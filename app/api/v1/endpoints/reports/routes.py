# -*- coding: utf-8 -*-
"""
Report API
- 영업계획/실적/갭 집계
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List

from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()


DIMENSION_MAP_PLAN = {
    "org": "COALESCE(spl.org_name_snapshot, o.org_name, '-')",
    "manager": "COALESCE(spl.manager_name_snapshot, u.user_name, '-')",
    "field": "COALESCE(spl.field_name_snapshot, f.field_name, '-')",
    "service": "COALESCE(spl.service_name_snapshot, sc.display_name, sc.service_name, '-')",
    "customer": "COALESCE(spl.customer_name_snapshot, c.client_name, '-')",
    "pipeline": "spl.pipeline_id"
}

DIMENSION_MAP_ACTUAL = {
    "org": "COALESCE(sal.org_name_snapshot, o.org_name, '-')",
    "manager": "COALESCE(sal.manager_name_snapshot, u.user_name, '-')",
    "field": "COALESCE(sal.field_name_snapshot, f.field_name, '-')",
    "service": "COALESCE(sal.service_name_snapshot, sc.display_name, sc.service_name, '-')",
    "customer": "COALESCE(sal.customer_name_snapshot, c.client_name, '-')",
    "pipeline": "sal.pipeline_id"
}


def _plan_sum_expr():
    return " + ".join([f"COALESCE(spl.plan_m{str(i).zfill(2)},0)" for i in range(1, 13)])


def _actual_order_sum_expr():
    return " + ".join([f"COALESCE(sal.m{str(i).zfill(2)}_order,0)" for i in range(1, 13)])


def _actual_profit_sum_expr():
    return " + ".join([f"COALESCE(sal.m{str(i).zfill(2)}_profit,0)" for i in range(1, 13)])


def _get_latest_plan_ids(
    db: Session,
    year: int,
    plan_version: Optional[str],
    status_code: Optional[str],
    plan_id: Optional[int] = None
) -> List[int]:
    if plan_id:
        row = db.execute(
            text("""
                SELECT plan_id
                FROM sales_plan
                WHERE plan_id = :plan_id
                  AND plan_year = :year
                LIMIT 1
            """),
            {"plan_id": plan_id, "year": year}
        ).first()
        return [row[0]] if row else []

    if plan_version:
        rows = db.execute(
            text("""
                SELECT plan_id FROM sales_plan
                WHERE plan_year = :year AND plan_version = :plan_version
                ORDER BY updated_at DESC, plan_id DESC
            """),
            {"year": year, "plan_version": plan_version}
        ).fetchall()
        return [row[0] for row in rows]

    if status_code:
        rows = db.execute(
            text("""
                SELECT plan_id FROM sales_plan
                WHERE plan_year = :year AND status_code = :status_code
                ORDER BY updated_at DESC, plan_id DESC
            """),
            {"year": year, "status_code": status_code}
        ).fetchall()
        return [row[0] for row in rows]

    row = db.execute(
        text("""
            SELECT plan_id FROM sales_plan
            WHERE plan_year = :year
            ORDER BY (status_code = 'FINAL') DESC, updated_at DESC, plan_id DESC
            LIMIT 1
        """),
        {"year": year}
    ).first()
    return [row[0]] if row else []


def _build_plan_aggregate(
    db: Session,
    plan_ids: List[int],
    dimension: str,
    period: str,
    org_id: Optional[str] = None,
    manager_id: Optional[str] = None
) -> List[Dict]:
    if not plan_ids:
        return []

    group_expr = DIMENSION_MAP_PLAN.get(dimension)
    if not group_expr:
        raise HTTPException(status_code=400, detail="invalid dimension")

    in_clause = ", ".join([f":pid{i}" for i in range(len(plan_ids))])
    params = {f"pid{i}": plan_id for i, plan_id in enumerate(plan_ids)}

    if period == "year":
        select_cols = f"SUM({_plan_sum_expr()}) AS plan_total"
    elif period == "quarter":
        select_cols = (
            "SUM(COALESCE(spl.plan_m01,0)+COALESCE(spl.plan_m02,0)+COALESCE(spl.plan_m03,0)) AS q1,"
            "SUM(COALESCE(spl.plan_m04,0)+COALESCE(spl.plan_m05,0)+COALESCE(spl.plan_m06,0)) AS q2,"
            "SUM(COALESCE(spl.plan_m07,0)+COALESCE(spl.plan_m08,0)+COALESCE(spl.plan_m09,0)) AS q3,"
            "SUM(COALESCE(spl.plan_m10,0)+COALESCE(spl.plan_m11,0)+COALESCE(spl.plan_m12,0)) AS q4"
        )
    elif period == "month":
        month_cols = []
        for i in range(1, 13):
            month_cols.append(f"SUM(COALESCE(spl.plan_m{str(i).zfill(2)},0)) AS m{str(i).zfill(2)}")
        select_cols = ", ".join(month_cols)
    else:
        raise HTTPException(status_code=400, detail="invalid period")

    sql = f"""
        SELECT
            {group_expr} AS group_name,
            {select_cols}
        FROM sales_plan_line spl
        LEFT JOIN org_units o ON o.org_id = spl.org_id
        LEFT JOIN users u ON u.login_id = spl.manager_id
        LEFT JOIN industry_fields f ON f.field_code = spl.field_code
        LEFT JOIN service_codes sc ON sc.service_code = spl.service_code
        LEFT JOIN clients c ON c.client_id = spl.customer_id
        WHERE spl.plan_id IN ({in_clause})
    """
    if org_id:
        sql += " AND spl.org_id = :org_id"
        params["org_id"] = org_id
    if manager_id:
        sql += " AND spl.manager_id = :manager_id"
        params["manager_id"] = manager_id
    sql += " GROUP BY group_name ORDER BY group_name"

    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def _build_actual_aggregate(
    db: Session,
    year: int,
    dimension: str,
    period: str,
    org_id: Optional[str] = None,
    manager_id: Optional[str] = None
) -> List[Dict]:
    group_expr = DIMENSION_MAP_ACTUAL.get(dimension)
    if not group_expr:
        raise HTTPException(status_code=400, detail="invalid dimension")

    if period == "year":
        select_cols = (
            f"SUM({_actual_order_sum_expr()}) AS order_total,"
            f"SUM({_actual_profit_sum_expr()}) AS profit_total"
        )
    elif period == "quarter":
        select_cols = (
            "SUM(COALESCE(sal.m01_order,0)+COALESCE(sal.m02_order,0)+COALESCE(sal.m03_order,0)) AS q1_order,"
            "SUM(COALESCE(sal.m04_order,0)+COALESCE(sal.m05_order,0)+COALESCE(sal.m06_order,0)) AS q2_order,"
            "SUM(COALESCE(sal.m07_order,0)+COALESCE(sal.m08_order,0)+COALESCE(sal.m09_order,0)) AS q3_order,"
            "SUM(COALESCE(sal.m10_order,0)+COALESCE(sal.m11_order,0)+COALESCE(sal.m12_order,0)) AS q4_order,"
            "SUM(COALESCE(sal.m01_profit,0)+COALESCE(sal.m02_profit,0)+COALESCE(sal.m03_profit,0)) AS q1_profit,"
            "SUM(COALESCE(sal.m04_profit,0)+COALESCE(sal.m05_profit,0)+COALESCE(sal.m06_profit,0)) AS q2_profit,"
            "SUM(COALESCE(sal.m07_profit,0)+COALESCE(sal.m08_profit,0)+COALESCE(sal.m09_profit,0)) AS q3_profit,"
            "SUM(COALESCE(sal.m10_profit,0)+COALESCE(sal.m11_profit,0)+COALESCE(sal.m12_profit,0)) AS q4_profit"
        )
    elif period == "month":
        month_cols = []
        for i in range(1, 13):
            month = str(i).zfill(2)
            month_cols.append(f"SUM(COALESCE(sal.m{month}_order,0)) AS m{month}_order")
            month_cols.append(f"SUM(COALESCE(sal.m{month}_profit,0)) AS m{month}_profit")
        select_cols = ", ".join(month_cols)
    else:
        raise HTTPException(status_code=400, detail="invalid period")

    sql = f"""
        SELECT
            {group_expr} AS group_name,
            {select_cols}
        FROM sales_actual_line sal
        LEFT JOIN org_units o ON o.org_id = sal.org_id
        LEFT JOIN users u ON u.login_id = sal.manager_id
        LEFT JOIN industry_fields f ON f.field_code = sal.field_code
        LEFT JOIN service_codes sc ON sc.service_code = sal.service_code
        LEFT JOIN clients c ON c.client_id = sal.customer_id
        WHERE sal.actual_year = :year
    """
    params = {"year": year}
    if org_id:
        sql += " AND sal.org_id = :org_id"
        params["org_id"] = org_id
    if manager_id:
        sql += " AND sal.manager_id = :manager_id"
        params["manager_id"] = manager_id
    sql += " GROUP BY group_name ORDER BY group_name"

    rows = db.execute(text(sql), params).mappings().all()
    return [dict(row) for row in rows]


def _merge_gap(plan_rows: List[Dict], actual_rows: List[Dict], period: str) -> List[Dict]:
    merged = {}
    for row in plan_rows:
        merged[row["group_name"]] = {**row}
    for row in actual_rows:
        entry = merged.setdefault(row["group_name"], {"group_name": row["group_name"]})
        entry.update(row)

    results = []
    for entry in merged.values():
        if period == "year":
            plan_total = float(entry.get("plan_total") or 0)
            order_total = float(entry.get("order_total") or 0)
            entry["ratio"] = (order_total / plan_total) if plan_total else None
        elif period == "quarter":
            for q in ["q1", "q2", "q3", "q4"]:
                plan_val = float(entry.get(q) or 0)
                order_val = float(entry.get(f"{q}_order") or 0)
                entry[f"{q}_ratio"] = (order_val / plan_val) if plan_val else None
        elif period == "month":
            for i in range(1, 13):
                month = f"m{str(i).zfill(2)}"
                plan_val = float(entry.get(month) or 0)
                order_val = float(entry.get(f"{month}_order") or 0)
                entry[f"{month}_ratio"] = (order_val / plan_val) if plan_val else None
        results.append(entry)
    return results


def _build_columns(source: str, metric: str, period: str) -> List[Dict]:
    columns = [{"title": "구분", "field": "group_name", "hozAlign": "left"}]

    def add_col(title, field):
        columns.append({"title": title, "field": field, "hozAlign": "right"})

    if source == "plan":
        if period == "year":
            add_col("계획", "plan_total")
        elif period == "quarter":
            for q in ["q1", "q2", "q3", "q4"]:
                add_col(q.upper(), q)
        else:
            for i in range(1, 13):
                add_col(f"{i}월", f"m{str(i).zfill(2)}")

    elif source == "actual":
        if period == "year":
            if metric in ("order", "both"):
                add_col("수주", "order_total")
            if metric in ("profit", "both"):
                add_col("매출이익", "profit_total")
        elif period == "quarter":
            for q in ["q1", "q2", "q3", "q4"]:
                if metric in ("order", "both"):
                    add_col(f"{q.upper()} 수주", f"{q}_order")
                if metric in ("profit", "both"):
                    add_col(f"{q.upper()} 이익", f"{q}_profit")
        else:
            for i in range(1, 13):
                month = str(i).zfill(2)
                if metric in ("order", "both"):
                    add_col(f"{i}월 수주", f"m{month}_order")
                if metric in ("profit", "both"):
                    add_col(f"{i}월 이익", f"m{month}_profit")

    elif source == "gap":
        if period == "year":
            add_col("계획", "plan_total")
            add_col("수주", "order_total")
            add_col("계획비", "ratio")
            add_col("매출이익", "profit_total")
        elif period == "quarter":
            for q in ["q1", "q2", "q3", "q4"]:
                add_col(f"{q.upper()} 계획", q)
                add_col(f"{q.upper()} 수주", f"{q}_order")
                add_col(f"{q.upper()} 계획비", f"{q}_ratio")
                add_col(f"{q.upper()} 이익", f"{q}_profit")
        else:
            for i in range(1, 13):
                month = str(i).zfill(2)
                add_col(f"{i}월 계획", f"m{month}")
                add_col(f"{i}월 수주", f"m{month}_order")
                add_col(f"{i}월 계획비", f"m{month}_ratio")
                add_col(f"{i}월 이익", f"m{month}_profit")

    return columns


def _parse_id_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _build_in_clause(prefix: str, values: List[str]):
    placeholders = []
    params: Dict[str, str] = {}
    for idx, val in enumerate(values):
        key = f"{prefix}{idx}"
        placeholders.append(f":{key}")
        params[key] = val
    return ", ".join(placeholders), params


def _sum_rows(rows: List[Dict], metric_fields: List[str], period: str) -> Dict:
    totals: Dict[str, float] = {}
    for field in metric_fields:
        if field.endswith("ratio"):
            continue
        totals[field] = 0

    for row in rows:
        for field in metric_fields:
            if field.endswith("ratio"):
                continue
            totals[field] += float(row.get(field) or 0)

    if any(field.endswith("ratio") for field in metric_fields):
        if period == "year":
            plan_total = totals.get("plan_total", 0)
            order_total = totals.get("order_total", 0)
            totals["ratio"] = (order_total / plan_total) if plan_total else None
        elif period == "quarter":
            for q in ["q1", "q2", "q3", "q4"]:
                plan_val = totals.get(q, 0)
                order_val = totals.get(f"{q}_order", 0)
                totals[f"{q}_ratio"] = (order_val / plan_val) if plan_val else None
        elif period == "month":
            for i in range(1, 13):
                month = f"m{str(i).zfill(2)}"
                plan_val = totals.get(month, 0)
                order_val = totals.get(f"{month}_order", 0)
                totals[f"{month}_ratio"] = (order_val / plan_val) if plan_val else None
    return totals


# ============================================
# Report Summary
# ============================================
@router.get("/summary")
async def report_summary(
    source: str = Query("gap", description="plan|actual|gap"),
    year: int = Query(..., description="기준 연도"),
    dimension: str = Query("service", description="org|manager|field|service|customer|pipeline"),
    period: str = Query("year", description="year|quarter|month"),
    metric: str = Query("both", description="order|profit|both"),
    plan_version: Optional[str] = Query(None, description="계획 버전"),
    plan_status: Optional[str] = Query(None, description="계획 상태"),
    plan_id: Optional[int] = Query(None, description="영업계획 ID"),
    org_ids: Optional[str] = Query(None, description="조직 필터 (comma)"),
    manager_ids: Optional[str] = Query(None, description="담당자 필터 (comma)"),
    db: Session = Depends(get_db)
):
    try:
        if source not in ("plan", "actual", "gap"):
            raise HTTPException(status_code=400, detail="invalid source")
        if period not in ("year", "quarter", "month"):
            raise HTTPException(status_code=400, detail="invalid period")
        if metric not in ("order", "profit", "both"):
            raise HTTPException(status_code=400, detail="invalid metric")

        plan_ids = _get_latest_plan_ids(db, year, plan_version, plan_status, plan_id)
        columns = _build_columns(source, metric, period)
        metric_fields = [col["field"] for col in columns if col["field"] != "group_name"]

        org_list = _parse_id_list(org_ids)
        manager_list = _parse_id_list(manager_ids)

        targets = []
        if org_list:
            in_clause, params = _build_in_clause("org", org_list)
            rows = db.execute(
                text(f"SELECT org_id, org_name FROM org_units WHERE org_id IN ({in_clause})"),
                params
            ).mappings().all()
            org_map = {row["org_id"]: row["org_name"] for row in rows}
            for org_id in org_list:
                org_name = org_map.get(org_id, org_id)
                targets.append({"type": "org", "id": org_id, "name": f"조직: {org_name}"})

        if manager_list:
            in_clause, params = _build_in_clause("mgr", manager_list)
            rows = db.execute(
                text(f"SELECT login_id, user_name FROM users WHERE login_id IN ({in_clause})"),
                params
            ).mappings().all()
            manager_map = {row["login_id"]: row["user_name"] for row in rows}
            for manager_id in manager_list:
                manager_name = manager_map.get(manager_id, manager_id)
                targets.append({"type": "manager", "id": manager_id, "name": f"담당자: {manager_name}"})

        if not targets:
            targets = [{"type": "all", "id": None, "name": "전체"}]

        items: List[Dict] = []
        detail_rows: List[Dict] = []

        for target in targets:
            org_filter = target["id"] if target["type"] == "org" else None
            manager_filter = target["id"] if target["type"] == "manager" else None

            plan_rows = _build_plan_aggregate(
                db, plan_ids, dimension, period, org_id=org_filter, manager_id=manager_filter
            ) if source in ("plan", "gap") else []
            actual_rows = _build_actual_aggregate(
                db, year, dimension, period, org_id=org_filter, manager_id=manager_filter
            ) if source in ("actual", "gap") else []

            if source == "plan":
                target_items = plan_rows
            elif source == "actual":
                target_items = actual_rows
            else:
                target_items = _merge_gap(plan_rows, actual_rows, period)

            for row in target_items:
                row["target_type"] = target["type"]
                row["target_id"] = target["id"]
                row["target_name"] = target["name"]

            detail_rows.extend(target_items)
            items.extend(target_items)

            subtotal_metrics = _sum_rows(target_items, metric_fields, period)
            subtotal_row = {
                "target_type": target["type"],
                "target_id": target["id"],
                "target_name": target["name"],
                "group_name": "합계",
                "row_type": "subtotal"
            }
            subtotal_row.update(subtotal_metrics)
            items.append(subtotal_row)

        if targets:
            grand_metrics = _sum_rows(detail_rows, metric_fields, period)
            grand_row = {
                "target_type": "all",
                "target_id": None,
                "target_name": "총합계",
                "group_name": "총합계",
                "row_type": "grand_total"
            }
            grand_row.update(grand_metrics)
            items.append(grand_row)

        return {
            "columns": columns,
            "items": items,
            "targets": targets
        }
    except HTTPException:
        raise
    except Exception as e:
        app_logger.exception("❌ Report summary 실패")
        raise HTTPException(status_code=500, detail=str(e))
