# -*- coding: utf-8 -*-
"""
Report API
- 영업계획/실적/갭 집계
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List
from datetime import date, datetime

from app.core.database import get_db
from app.core.logger import app_logger
from app.core.tenant import get_company_cd

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
    company_cd = get_company_cd()
    if plan_id:
        row = db.execute(
            text("""
                SELECT plan_id
                FROM sales_plan
                WHERE company_cd = :company_cd
                  AND plan_id = :plan_id
                  AND plan_year = :year
                LIMIT 1
            """),
            {"plan_id": plan_id, "year": year, "company_cd": company_cd}
        ).first()
        return [row[0]] if row else []

    if plan_version:
        rows = db.execute(
            text("""
                SELECT plan_id FROM sales_plan
                WHERE company_cd = :company_cd
                  AND plan_year = :year AND plan_version = :plan_version
                ORDER BY updated_at DESC, plan_id DESC
            """),
            {"year": year, "plan_version": plan_version, "company_cd": company_cd}
        ).fetchall()
        return [row[0] for row in rows]

    if status_code:
        rows = db.execute(
            text("""
                SELECT plan_id FROM sales_plan
                WHERE company_cd = :company_cd
                  AND plan_year = :year AND status_code = :status_code
                ORDER BY updated_at DESC, plan_id DESC
            """),
            {"year": year, "status_code": status_code, "company_cd": company_cd}
        ).fetchall()
        return [row[0] for row in rows]

    row = db.execute(
        text("""
            SELECT plan_id FROM sales_plan
            WHERE company_cd = :company_cd
              AND plan_year = :year
            ORDER BY (status_code = 'FINAL') DESC, updated_at DESC, plan_id DESC
            LIMIT 1
        """),
        {"year": year, "company_cd": company_cd}
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
    company_cd = get_company_cd()
    params = {f"pid{i}": plan_id for i, plan_id in enumerate(plan_ids)}
    params["company_cd"] = company_cd

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
        LEFT JOIN org_units o 
          ON o.org_id = spl.org_id
         AND o.company_cd = spl.company_cd
        LEFT JOIN users u 
          ON u.login_id = spl.manager_id
         AND u.company_cd = spl.company_cd
        LEFT JOIN industry_fields f 
          ON f.field_code = spl.field_code
         AND f.company_cd = spl.company_cd
        LEFT JOIN service_codes sc 
          ON sc.service_code = spl.service_code
         AND sc.company_cd = spl.company_cd
        LEFT JOIN clients c 
          ON c.client_id = spl.customer_id
         AND c.company_cd = spl.company_cd
        WHERE spl.company_cd = :company_cd
          AND spl.plan_id IN ({in_clause})
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
        LEFT JOIN org_units o 
          ON o.org_id = sal.org_id
         AND o.company_cd = sal.company_cd
        LEFT JOIN users u 
          ON u.login_id = sal.manager_id
         AND u.company_cd = sal.company_cd
        LEFT JOIN industry_fields f 
          ON f.field_code = sal.field_code
         AND f.company_cd = sal.company_cd
        LEFT JOIN service_codes sc 
          ON sc.service_code = sal.service_code
         AND sc.company_cd = sal.company_cd
        LEFT JOIN clients c 
          ON c.client_id = sal.customer_id
         AND c.company_cd = sal.company_cd
        WHERE sal.company_cd = :company_cd
          AND sal.actual_year = :year
    """
    params = {"year": year, "company_cd": get_company_cd()}
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


def _month_sum_expr(column_prefix: str, column_suffix: str = "") -> str:
    return " + ".join([f"COALESCE({column_prefix}{str(i).zfill(2)}{column_suffix},0)" for i in range(1, 13)])


def _month_sum_select(column_prefix: str, column_suffix: str = "") -> str:
    return ", ".join([
        f"SUM(COALESCE({column_prefix}{str(i).zfill(2)}{column_suffix},0)) AS m{str(i).zfill(2)}"
        for i in range(1, 13)
    ])


def _to_float(value) -> float:
    return float(value or 0)


def _row_months(row: Dict) -> List[float]:
    if not row:
        return [0.0] * 12
    return [_to_float(row.get(f"m{str(i).zfill(2)}")) for i in range(1, 13)]


def _quarter_sums(months: List[float]) -> List[float]:
    return [
        sum(months[0:3]),
        sum(months[3:6]),
        sum(months[6:9]),
        sum(months[9:12]),
    ]


def _build_ordered_in_clause(values: List[int], prefix: str = "id"):
    placeholders = []
    params: Dict[str, int] = {}
    for idx, value in enumerate(values):
        key = f"{prefix}{idx}"
        placeholders.append(f":{key}")
        params[key] = value
    return ", ".join(placeholders), params


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
        company_cd = get_company_cd()
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
                text(f"SELECT org_id, org_name FROM org_units WHERE company_cd = :company_cd AND org_id IN ({in_clause})"),
                {**params, "company_cd": company_cd}
            ).mappings().all()
            org_map = {row["org_id"]: row["org_name"] for row in rows}
            for org_id in org_list:
                org_name = org_map.get(org_id, org_id)
                targets.append({"type": "org", "id": org_id, "name": f"조직: {org_name}"})

        if manager_list:
            in_clause, params = _build_in_clause("mgr", manager_list)
            rows = db.execute(
                text(f"SELECT login_id, user_name FROM users WHERE company_cd = :company_cd AND login_id IN ({in_clause})"),
                {**params, "company_cd": company_cd}
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


# ============================================
# CEO Dashboard
# ============================================
@router.get("/ceo-dashboard")
async def get_ceo_dashboard(
    year: Optional[int] = Query(None, description="기준 연도 (기본: 현재 연도)"),
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        base_year = year or date.today().year
        prev_year = base_year - 1

        active_stage_filter = "(p.current_stage IS NULL OR p.current_stage NOT IN ('S05','S06','S07','S08','S09'))"

        years_rows = db.execute(text("""
            SELECT DISTINCT y
            FROM (
                SELECT actual_year AS y FROM sales_actual_line WHERE company_cd = :company_cd
                UNION
                SELECT plan_year AS y FROM sales_plan WHERE company_cd = :company_cd
                UNION
                SELECT YEAR(created_at) AS y FROM projects WHERE company_cd = :company_cd
            ) t
            WHERE y IS NOT NULL
            ORDER BY y DESC
        """), {"company_cd": company_cd}).fetchall()
        available_years = [int(row[0]) for row in years_rows if row[0] is not None]
        if base_year not in available_years:
            available_years.insert(0, base_year)

        # KPI - 프로젝트 파이프라인
        kpi_project_row = db.execute(text(f"""
            SELECT
                COUNT(*) AS total_projects,
                SUM(COALESCE(p.quoted_amount,0)) AS total_quoted_amount,
                SUM(CASE WHEN {active_stage_filter} THEN 1 ELSE 0 END) AS active_projects,
                SUM(CASE WHEN {active_stage_filter} THEN COALESCE(p.quoted_amount,0) ELSE 0 END) AS active_pipeline_amount,
                SUM(CASE WHEN {active_stage_filter}
                         THEN COALESCE(p.quoted_amount,0) * COALESCE(p.win_probability,0) / 100
                         ELSE 0 END) AS expected_amount,
                AVG(CASE WHEN {active_stage_filter} THEN COALESCE(p.win_probability,0) END) AS avg_win_probability,
                SUM(CASE WHEN p.current_stage IN ('S05','S06') THEN 1 ELSE 0 END) AS lost_projects,
                SUM(CASE WHEN p.current_stage IN ('S07','S08','S09') THEN 1 ELSE 0 END) AS closed_projects
            FROM projects p
            WHERE p.company_cd = :company_cd
        """), {"company_cd": company_cd}).mappings().first()

        # KPI - 위험 신호
        kpi_risk_row = db.execute(text(f"""
            SELECT
                SUM(CASE WHEN {active_stage_filter}
                             AND pc.end_date IS NOT NULL
                             AND pc.end_date < CURDATE()
                         THEN 1 ELSE 0 END) AS overdue_projects,
                SUM(CASE WHEN {active_stage_filter}
                             AND DATEDIFF(CURDATE(), COALESCE(DATE(p.updated_at), DATE(p.created_at))) >= 90
                         THEN 1 ELSE 0 END) AS stale_projects,
                SUM(CASE WHEN {active_stage_filter}
                             AND COALESCE(p.win_probability,0) < 30
                         THEN 1 ELSE 0 END) AS low_probability_projects
            FROM projects p
            LEFT JOIN project_contracts pc 
              ON pc.pipeline_id = p.pipeline_id
             AND pc.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
        """), {"company_cd": company_cd}).mappings().first()

        # KPI - 실적/전년 비교
        actual_sum_expr = _month_sum_expr("m", "_order")
        profit_sum_expr = _month_sum_expr("m", "_profit")

        kpi_actual_row = db.execute(text(f"""
            SELECT
                SUM({actual_sum_expr}) AS order_total,
                SUM({profit_sum_expr}) AS profit_total
            FROM sales_actual_line
            WHERE company_cd = :company_cd
              AND actual_year = :year
        """), {"year": base_year, "company_cd": company_cd}).mappings().first()

        kpi_actual_prev_row = db.execute(text(f"""
            SELECT
                SUM({actual_sum_expr}) AS order_total,
                SUM({profit_sum_expr}) AS profit_total
            FROM sales_actual_line
            WHERE company_cd = :company_cd
              AND actual_year = :year
        """), {"year": prev_year, "company_cd": company_cd}).mappings().first()

        # 계획 합계 (해당 연도 최신 계획)
        plan_ids = _get_latest_plan_ids(db, base_year, None, None, None)
        plan_total = 0.0
        if plan_ids:
            in_clause, in_params = _build_ordered_in_clause(plan_ids, "pid")
            plan_row = db.execute(text(f"""
                SELECT SUM({_plan_sum_expr()}) AS plan_total
                FROM sales_plan_line spl
                WHERE spl.company_cd = :company_cd
                  AND spl.plan_id IN ({in_clause})
            """), {**in_params, "company_cd": company_cd}).mappings().first()
            plan_total = _to_float(plan_row.get("plan_total")) if plan_row else 0.0

        order_total = _to_float(kpi_actual_row.get("order_total")) if kpi_actual_row else 0.0
        prev_order_total = _to_float(kpi_actual_prev_row.get("order_total")) if kpi_actual_prev_row else 0.0
        order_yoy = ((order_total - prev_order_total) / prev_order_total) if prev_order_total else None
        achievement_rate = (order_total / plan_total) if plan_total else None

        # 월별 추이 (실적/전년/계획)
        actual_month_row = db.execute(text(f"""
            SELECT {_month_sum_select('m', '_order')}
            FROM sales_actual_line
            WHERE company_cd = :company_cd
              AND actual_year = :year
        """), {"year": base_year, "company_cd": company_cd}).mappings().first() or {}

        prev_month_row = db.execute(text(f"""
            SELECT {_month_sum_select('m', '_order')}
            FROM sales_actual_line
            WHERE company_cd = :company_cd
              AND actual_year = :year
        """), {"year": prev_year, "company_cd": company_cd}).mappings().first() or {}

        plan_month_row = {}
        if plan_ids:
            in_clause, in_params = _build_ordered_in_clause(plan_ids, "pmid")
            plan_month_row = db.execute(text(f"""
                SELECT {_month_sum_select('plan_m')}
                FROM sales_plan_line
                WHERE company_cd = :company_cd
                  AND plan_id IN ({in_clause})
            """), {**in_params, "company_cd": company_cd}).mappings().first() or {}

        actual_months = _row_months(actual_month_row)
        prev_months = _row_months(prev_month_row)
        plan_months = _row_months(plan_month_row)

        monthly_trend = []
        for i in range(1, 13):
            monthly_trend.append({
                "month": i,
                "actual_order": actual_months[i - 1],
                "previous_order": prev_months[i - 1],
                "plan_order": plan_months[i - 1],
            })

        actual_quarters = _quarter_sums(actual_months)
        plan_quarters = _quarter_sums(plan_months)
        quarter_comparison = []
        for idx in range(4):
            plan_val = plan_quarters[idx]
            actual_val = actual_quarters[idx]
            quarter_comparison.append({
                "quarter": f"Q{idx + 1}",
                "actual_order": actual_val,
                "plan_order": plan_val,
                "achievement_rate": (actual_val / plan_val) if plan_val else None
            })

        # 단계별 파이프라인
        stage_funnel_rows = db.execute(text(f"""
            SELECT
                COALESCE(p.current_stage, '-') AS stage_code,
                COALESCE(cc.code_name, p.current_stage, '미지정') AS stage_name,
                COUNT(*) AS project_count,
                SUM(COALESCE(p.quoted_amount,0)) AS total_amount,
                AVG(COALESCE(p.win_probability,0)) AS avg_probability
            FROM projects p
            LEFT JOIN comm_code cc
              ON cc.group_code = 'STAGE'
             AND cc.code = p.current_stage
             AND cc.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
            GROUP BY COALESCE(p.current_stage, '-'), COALESCE(cc.code_name, p.current_stage, '미지정')
            ORDER BY CASE stage_code
                WHEN 'S01' THEN 1
                WHEN 'S02' THEN 2
                WHEN 'S03' THEN 3
                WHEN 'S04' THEN 4
                WHEN 'S05' THEN 5
                WHEN 'S06' THEN 6
                WHEN 'S07' THEN 7
                WHEN 'S08' THEN 8
                WHEN 'S09' THEN 9
                ELSE 99
            END
        """), {"company_cd": company_cd}).mappings().all()
        stage_funnel = [{
            "stage_code": row["stage_code"],
            "stage_name": row["stage_name"],
            "project_count": int(row["project_count"] or 0),
            "total_amount": _to_float(row["total_amount"]),
            "avg_probability": _to_float(row["avg_probability"]),
        } for row in stage_funnel_rows]

        # 수주확률 분포 (활동중 대상)
        probability_rows = db.execute(text(f"""
            SELECT
                CASE
                    WHEN COALESCE(p.win_probability,0) >= 90 THEN '90-100%'
                    WHEN COALESCE(p.win_probability,0) >= 70 THEN '70-89%'
                    WHEN COALESCE(p.win_probability,0) >= 50 THEN '50-69%'
                    WHEN COALESCE(p.win_probability,0) >= 30 THEN '30-49%'
                    ELSE '0-29%'
                END AS probability_band,
                COUNT(*) AS project_count,
                SUM(COALESCE(p.quoted_amount,0)) AS total_amount
            FROM projects p
            WHERE p.company_cd = :company_cd
              AND {active_stage_filter}
            GROUP BY probability_band
            ORDER BY CASE probability_band
                WHEN '90-100%' THEN 1
                WHEN '70-89%' THEN 2
                WHEN '50-69%' THEN 3
                WHEN '30-49%' THEN 4
                ELSE 5
            END
        """), {"company_cd": company_cd}).mappings().all()
        probability_bands = [{
            "probability_band": row["probability_band"],
            "project_count": int(row["project_count"] or 0),
            "total_amount": _to_float(row["total_amount"]),
        } for row in probability_rows]

        # 담당자 TOP5
        manager_rows = db.execute(text(f"""
            SELECT
                p.manager_id,
                COALESCE(u.user_name, p.manager_id, '미지정') AS manager_name,
                COUNT(*) AS project_count,
                SUM(COALESCE(p.quoted_amount,0)) AS total_amount,
                SUM(COALESCE(p.quoted_amount,0) * COALESCE(p.win_probability,0) / 100) AS expected_amount
            FROM projects p
            LEFT JOIN users u 
              ON u.login_id = p.manager_id
             AND u.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
              AND {active_stage_filter}
            GROUP BY p.manager_id, COALESCE(u.user_name, p.manager_id, '미지정')
            ORDER BY expected_amount DESC
            LIMIT 5
        """), {"company_cd": company_cd}).mappings().all()
        manager_top = [{
            "manager_id": row["manager_id"],
            "manager_name": row["manager_name"],
            "project_count": int(row["project_count"] or 0),
            "total_amount": _to_float(row["total_amount"]),
            "expected_amount": _to_float(row["expected_amount"]),
        } for row in manager_rows]

        # 분야별 파이프라인 비중
        field_rows = db.execute(text(f"""
            SELECT
                p.field_code,
                COALESCE(f.field_name, p.field_code, '미분류') AS field_name,
                COUNT(*) AS project_count,
                SUM(COALESCE(p.quoted_amount,0)) AS total_amount,
                SUM(COALESCE(p.quoted_amount,0) * COALESCE(p.win_probability,0) / 100) AS expected_amount
            FROM projects p
            LEFT JOIN industry_fields f 
              ON f.field_code = p.field_code
             AND f.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
              AND {active_stage_filter}
            GROUP BY p.field_code, COALESCE(f.field_name, p.field_code, '미분류')
            ORDER BY total_amount DESC
            LIMIT 8
        """), {"company_cd": company_cd}).mappings().all()
        field_mix = [{
            "field_code": row["field_code"],
            "field_name": row["field_name"],
            "project_count": int(row["project_count"] or 0),
            "total_amount": _to_float(row["total_amount"]),
            "expected_amount": _to_float(row["expected_amount"]),
        } for row in field_rows]

        # 고객사 TOP10
        customer_rows = db.execute(text(f"""
            SELECT
                p.customer_id,
                COALESCE(c.client_name, '미지정') AS customer_name,
                COUNT(*) AS project_count,
                SUM(COALESCE(p.quoted_amount,0)) AS total_amount,
                SUM(COALESCE(p.quoted_amount,0) * COALESCE(p.win_probability,0) / 100) AS expected_amount
            FROM projects p
            LEFT JOIN clients c 
              ON c.client_id = p.customer_id
             AND c.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
              AND {active_stage_filter}
            GROUP BY p.customer_id, COALESCE(c.client_name, '미지정')
            ORDER BY expected_amount DESC
            LIMIT 10
        """), {"company_cd": company_cd}).mappings().all()
        customer_top = [{
            "customer_id": row["customer_id"],
            "customer_name": row["customer_name"],
            "project_count": int(row["project_count"] or 0),
            "total_amount": _to_float(row["total_amount"]),
            "expected_amount": _to_float(row["expected_amount"]),
        } for row in customer_rows]

        # 리스크 프로젝트 목록
        risk_rows = db.execute(text(f"""
            SELECT
                p.pipeline_id,
                p.project_name,
                COALESCE(cc.code_name, p.current_stage, '-') AS stage_name,
                COALESCE(p.quoted_amount,0) AS quoted_amount,
                COALESCE(p.win_probability,0) AS win_probability,
                pc.end_date,
                p.updated_at,
                DATEDIFF(CURDATE(), COALESCE(DATE(p.updated_at), DATE(p.created_at))) AS stale_days,
                CASE
                    WHEN pc.end_date IS NOT NULL AND pc.end_date < CURDATE() THEN 1 ELSE 0
                END AS is_overdue,
                CASE
                    WHEN DATEDIFF(CURDATE(), COALESCE(DATE(p.updated_at), DATE(p.created_at))) >= 90 THEN 1 ELSE 0
                END AS is_stale,
                CASE
                    WHEN COALESCE(p.win_probability,0) < 30 THEN 1 ELSE 0
                END AS is_low_probability
            FROM projects p
            LEFT JOIN project_contracts pc 
              ON pc.pipeline_id = p.pipeline_id
             AND pc.company_cd = p.company_cd
            LEFT JOIN comm_code cc
              ON cc.group_code = 'STAGE'
             AND cc.code = p.current_stage
             AND cc.company_cd = p.company_cd
            WHERE p.company_cd = :company_cd
              AND {active_stage_filter}
              AND (
                    (pc.end_date IS NOT NULL AND pc.end_date < CURDATE())
                 OR (DATEDIFF(CURDATE(), COALESCE(DATE(p.updated_at), DATE(p.created_at))) >= 90)
                 OR (COALESCE(p.win_probability,0) < 30)
              )
            ORDER BY is_overdue DESC,
                     is_low_probability DESC,
                     stale_days DESC,
                     p.updated_at ASC
            LIMIT 12
        """), {"company_cd": company_cd}).mappings().all()

        risk_projects = [{
            "pipeline_id": row["pipeline_id"],
            "project_name": row["project_name"],
            "stage_name": row["stage_name"],
            "quoted_amount": _to_float(row["quoted_amount"]),
            "win_probability": int(row["win_probability"] or 0),
            "end_date": row["end_date"].isoformat() if row.get("end_date") else None,
            "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
            "stale_days": int(row["stale_days"] or 0),
            "is_overdue": bool(row["is_overdue"]),
            "is_stale": bool(row["is_stale"]),
            "is_low_probability": bool(row["is_low_probability"]),
        } for row in risk_rows]

        return {
            "year": base_year,
            "available_years": available_years,
            "kpi": {
                "order_total": order_total,
                "profit_total": _to_float(kpi_actual_row.get("profit_total")) if kpi_actual_row else 0.0,
                "plan_total": plan_total,
                "achievement_rate": achievement_rate,
                "order_yoy_rate": order_yoy,
                "total_projects": int((kpi_project_row or {}).get("total_projects") or 0),
                "active_projects": int((kpi_project_row or {}).get("active_projects") or 0),
                "closed_projects": int((kpi_project_row or {}).get("closed_projects") or 0),
                "lost_projects": int((kpi_project_row or {}).get("lost_projects") or 0),
                "active_pipeline_amount": _to_float((kpi_project_row or {}).get("active_pipeline_amount")),
                "expected_amount": _to_float((kpi_project_row or {}).get("expected_amount")),
                "avg_win_probability": _to_float((kpi_project_row or {}).get("avg_win_probability")),
                "overdue_projects": int((kpi_risk_row or {}).get("overdue_projects") or 0),
                "stale_projects": int((kpi_risk_row or {}).get("stale_projects") or 0),
                "low_probability_projects": int((kpi_risk_row or {}).get("low_probability_projects") or 0),
            },
            "monthly_trend": monthly_trend,
            "quarter_comparison": quarter_comparison,
            "stage_funnel": stage_funnel,
            "probability_bands": probability_bands,
            "manager_top": manager_top,
            "field_mix": field_mix,
            "customer_top": customer_top,
            "risk_projects": risk_projects,
            "generated_at": datetime.now().isoformat(timespec="seconds")
        }
    except HTTPException:
        raise
    except Exception as e:
        app_logger.exception("❌ CEO dashboard 조회 실패")
        raise HTTPException(status_code=500, detail=str(e))
