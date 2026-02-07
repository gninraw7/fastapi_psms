# -*- coding: utf-8 -*-
"""
데이터 관리(회사 간 데이터 복제) API
"""
from typing import List, Dict, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()

# 기본 제외 테이블 (복제 대상에서 제외)
EXCLUDED_TABLES = {
    "companies",
    "tmp_invalid_project_manager_id",
    "board_notices",
}


class DataCopyRequest(BaseModel):
    source_company_cd: str = Field(..., description="원본 회사 코드")
    target_company_cd: str = Field(..., description="대상 회사 코드")
    tables: List[str] = Field(default_factory=list, description="복제 대상 테이블 목록")
    exclude_tables: Optional[List[str]] = Field(default_factory=list, description="복제 제외 테이블 목록")


def _build_in_clause(values: List[str], prefix: str) -> Tuple[str, Dict[str, str]]:
    placeholders = []
    params: Dict[str, str] = {}
    for idx, value in enumerate(values):
        key = f"{prefix}{idx}"
        placeholders.append(f":{key}")
        params[key] = value
    return ", ".join(placeholders), params


def _normalize_tables(values: Optional[List[str]]) -> Set[str]:
    if not values:
        return set()
    return {v.strip() for v in values if v and v.strip()}


def _get_company_tables(db: Session, exclude: Optional[Set[str]] = None) -> Tuple[List[str], Dict[str, str]]:
    rows = db.execute(text("""
        SELECT t.table_name, t.table_comment
        FROM information_schema.tables t
        JOIN information_schema.columns c
          ON c.table_schema = t.table_schema
         AND c.table_name = t.table_name
        WHERE t.table_schema = DATABASE()
          AND t.table_type = 'BASE TABLE'
          AND c.column_name = 'company_cd'
        ORDER BY t.table_name
    """)).fetchall()
    tables = [row[0] for row in rows]
    comments = {row[0]: (row[1] or "") for row in rows}
    excluded = set(EXCLUDED_TABLES)
    if exclude:
        excluded.update(exclude)
    return [t for t in tables if t not in excluded], comments


def _get_fk_edges(db: Session, tables: List[str]) -> List[Tuple[str, str]]:
    if not tables:
        return []
    in_clause, params = _build_in_clause(tables, "t")
    rows = db.execute(text(f"""
        SELECT kcu.table_name AS child_table,
               kcu.referenced_table_name AS parent_table
        FROM information_schema.key_column_usage kcu
        WHERE kcu.table_schema = DATABASE()
          AND kcu.referenced_table_name IS NOT NULL
          AND kcu.table_name IN ({in_clause})
          AND kcu.referenced_table_name IN ({in_clause})
    """), params).fetchall()
    return [(row[1], row[0]) for row in rows]  # parent -> child


def _topological_sort(tables: List[str], edges: List[Tuple[str, str]]) -> List[str]:
    table_set = set(tables)
    adj: Dict[str, Set[str]] = {t: set() for t in tables}
    in_deg: Dict[str, int] = {t: 0 for t in tables}

    for parent, child in edges:
        if parent == child:
            continue
        if parent not in table_set or child not in table_set:
            continue
        if child not in adj[parent]:
            adj[parent].add(child)
            in_deg[child] += 1

    queue = [t for t in tables if in_deg[t] == 0]
    result: List[str] = []
    while queue:
        node = queue.pop(0)
        result.append(node)
        for nxt in adj[node]:
            in_deg[nxt] -= 1
            if in_deg[nxt] == 0:
                queue.append(nxt)

    if len(result) < len(tables):
        # 사이클 등으로 인해 누락된 테이블은 원래 순서로 추가
        for t in tables:
            if t not in result:
                result.append(t)
    return result


def _expand_with_parents(selected: Set[str], edges: List[Tuple[str, str]]) -> Set[str]:
    # edges: parent -> child
    parents_map: Dict[str, Set[str]] = {}
    for parent, child in edges:
        parents_map.setdefault(child, set()).add(parent)

    expanded = set(selected)
    queue = list(selected)
    while queue:
        child = queue.pop(0)
        for parent in parents_map.get(child, set()):
            if parent not in expanded:
                expanded.add(parent)
                queue.append(parent)
    return expanded


def _get_columns(db: Session, table: str) -> List[str]:
    rows = db.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = :table
        ORDER BY ordinal_position
    """), {"table": table}).fetchall()
    return [row[0] for row in rows]


@router.get("/tables")
async def list_tables(
    source_company_cd: str = Query(...),
    target_company_cd: str = Query(...),
    exclude_tables: Optional[str] = Query(None, description="복제 제외 테이블 (comma)"),
    db: Session = Depends(get_db)
):
    try:
        exclude = _normalize_tables(exclude_tables.split(",")) if exclude_tables else set()
        tables, comments = _get_company_tables(db, exclude)
        items = []
        for table in tables:
            src_cnt = db.execute(
                text(f"SELECT COUNT(*) FROM `{table}` WHERE company_cd = :company_cd"),
                {"company_cd": source_company_cd}
            ).scalar() or 0
            tgt_cnt = db.execute(
                text(f"SELECT COUNT(*) FROM `{table}` WHERE company_cd = :company_cd"),
                {"company_cd": target_company_cd}
            ).scalar() or 0
            items.append({
                "table_name": table,
                "table_comment": comments.get(table, ""),
                "source_count": int(src_cnt),
                "target_count": int(tgt_cnt)
            })
        return {
            "items": items,
            "excluded_tables": sorted(list(EXCLUDED_TABLES | exclude))
        }
    except Exception as e:
        app_logger.error(f"❌ 테이블 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/copy")
async def copy_tables(
    request: DataCopyRequest,
    db: Session = Depends(get_db)
):
    source = (request.source_company_cd or "").strip()
    target = (request.target_company_cd or "").strip()
    if not source or not target:
        raise HTTPException(status_code=400, detail="source/target company_cd is required")
    if source == target:
        raise HTTPException(status_code=400, detail="source/target company_cd must be different")

    # 회사 존재 확인
    for cd in (source, target):
        exists = db.execute(
            text("SELECT 1 FROM companies WHERE company_cd = :company_cd"),
            {"company_cd": cd}
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=400, detail=f"회사 코드가 존재하지 않습니다: {cd}")

    exclude = _normalize_tables(request.exclude_tables)
    tables, _ = _get_company_tables(db, exclude)
    table_set = set(tables)
    selected = {t for t in request.tables if t in table_set}
    if not selected:
        raise HTTPException(status_code=400, detail="복제할 테이블을 선택하세요.")

    # FK 기반 부모 테이블 자동 포함
    edges = _get_fk_edges(db, tables)
    expanded = _expand_with_parents(selected, edges)
    expanded = {t for t in expanded if t not in EXCLUDED_TABLES and t not in exclude}
    copy_tables_list = [t for t in tables if t in expanded]

    insert_order = _topological_sort(copy_tables_list, edges)
    delete_order = list(reversed(insert_order))

    results = []
    report = {
        "source_company_cd": source,
        "target_company_cd": target,
        "selected_tables": sorted(list(selected)),
        "auto_included_tables": sorted([t for t in expanded if t not in selected]),
        "excluded_tables": sorted(list(EXCLUDED_TABLES | exclude)),
        "totals": {}
    }
    try:
        start_time = db.execute(text("SELECT NOW()")).scalar()

        # 사전 건수 집계
        source_counts: Dict[str, int] = {}
        target_counts_before: Dict[str, int] = {}
        for table in copy_tables_list:
            source_counts[table] = int(db.execute(
                text(f"SELECT COUNT(*) FROM `{table}` WHERE company_cd = :company_cd"),
                {"company_cd": source}
            ).scalar() or 0)
            target_counts_before[table] = int(db.execute(
                text(f"SELECT COUNT(*) FROM `{table}` WHERE company_cd = :company_cd"),
                {"company_cd": target}
            ).scalar() or 0)

        db.execute(text("SET FOREIGN_KEY_CHECKS=0"))

        # delete target data (child -> parent)
        delete_counts: Dict[str, int] = {}
        for table in delete_order:
            res = db.execute(
                text(f"DELETE FROM `{table}` WHERE company_cd = :company_cd"),
                {"company_cd": target}
            )
            delete_counts[table] = int(res.rowcount or 0)

        # insert from source to target (parent -> child)
        insert_counts: Dict[str, int] = {}
        for table in insert_order:
            cols = _get_columns(db, table)
            col_list = ", ".join([f"`{c}`" for c in cols])
            select_list = ", ".join([
                (":target_company AS `company_cd`" if c == "company_cd" else f"`{c}`")
                for c in cols
            ])
            sql = f"""
                INSERT INTO `{table}` ({col_list})
                SELECT {select_list}
                FROM `{table}`
                WHERE company_cd = :source_company
            """
            res = db.execute(text(sql), {
                "source_company": source,
                "target_company": target
            })
            insert_counts[table] = int(res.rowcount or 0)

        # 사후 건수 집계
        target_counts_after: Dict[str, int] = {}
        for table in copy_tables_list:
            target_counts_after[table] = int(db.execute(
                text(f"SELECT COUNT(*) FROM `{table}` WHERE company_cd = :company_cd"),
                {"company_cd": target}
            ).scalar() or 0)

        db.commit()

        for table in copy_tables_list:
            results.append({
                "table_name": table,
                "source_count": source_counts.get(table, 0),
                "target_before": target_counts_before.get(table, 0),
                "target_after": target_counts_after.get(table, 0),
                "deleted": delete_counts.get(table, 0),
                "inserted": insert_counts.get(table, 0),
                "status": "OK" if table in expanded else "SKIP",
                "auto_included": table not in selected
            })

        end_time = db.execute(text("SELECT NOW()")).scalar()
        report["totals"] = {
            "table_count": len(copy_tables_list),
            "deleted_total": sum(delete_counts.values()),
            "inserted_total": sum(insert_counts.values()),
            "source_total": sum(source_counts.values()),
            "target_before_total": sum(target_counts_before.values()),
            "target_after_total": sum(target_counts_after.values()),
            "started_at": str(start_time),
            "ended_at": str(end_time)
        }

        _write_copy_log({
            "status": "OK",
            "report": report,
            "results": results
        })

        return {"results": results, "expanded_tables": list(expanded), "report": report}
    except Exception as e:
        db.rollback()
        _write_copy_log({
            "status": "ERROR",
            "error": str(e),
            "source_company_cd": source,
            "target_company_cd": target,
            "selected_tables": list(selected),
            "excluded_tables": list(EXCLUDED_TABLES | exclude)
        })
        app_logger.error(f"❌ 데이터 복제 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS=1"))
            db.commit()
        except Exception:
            pass


def _write_copy_log(payload: dict) -> None:
    try:
        import json
        from datetime import datetime
        from pathlib import Path

        log_dir = Path("logs")
        log_dir.mkdir(parents=True, exist_ok=True)
        log_path = log_dir / "data_copy.log"
        payload_with_time = {
            "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            **payload
        }
        with log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload_with_time, ensure_ascii=False) + "\n")
    except Exception:
        # 로깅 실패는 무시
        pass
