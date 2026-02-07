# -*- coding: utf-8 -*-
"""
회사(테넌트) 관리 API
"""
from typing import Optional, List, Dict, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_company_cd
from app.core.security import get_current_user
from app.core.logger import app_logger

router = APIRouter()

COMMON_COPY_TABLES = [
    "comm_code",
    "industry_fields",
    "service_codes",
    "auth_forms",
    "auth_role_permissions",
    "org_units",
]


class CompanyCreateRequest(BaseModel):
    company_cd: str
    company_name: str
    company_alias: Optional[str] = None
    is_use: Optional[str] = "Y"
    copy_comm_codes: Optional[bool] = False
    copy_from_company_cd: Optional[str] = None
    copy_common_tables: Optional[List[str]] = None

class CompanyStatusRequest(BaseModel):
    is_use: str


def _build_in_clause(values: List[str], prefix: str) -> Tuple[str, Dict[str, str]]:
    placeholders = []
    params: Dict[str, str] = {}
    for idx, value in enumerate(values):
        key = f"{prefix}{idx}"
        placeholders.append(f":{key}")
        params[key] = value
    return ", ".join(placeholders), params


def _resolve_common_tables(db: Session) -> Tuple[List[str], Dict[str, str]]:
    if not COMMON_COPY_TABLES:
        return [], {}
    in_clause, params = _build_in_clause(COMMON_COPY_TABLES, "t")
    rows = db.execute(text(f"""
        SELECT t.table_name, t.table_comment
        FROM information_schema.tables t
        JOIN information_schema.columns c
          ON c.table_schema = t.table_schema
         AND c.table_name = t.table_name
        WHERE t.table_schema = DATABASE()
          AND t.table_type = 'BASE TABLE'
          AND t.table_name IN ({in_clause})
          AND c.column_name = 'company_cd'
        ORDER BY t.table_name
    """), params).fetchall()
    tables = [row[0] for row in rows]
    comments = {row[0]: (row[1] or "") for row in rows}
    return tables, comments


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
        for t in tables:
            if t not in result:
                result.append(t)
    return result


def _expand_with_parents(selected: Set[str], edges: List[Tuple[str, str]]) -> Set[str]:
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


def _copy_common_tables(
    db: Session,
    source_company: str,
    target_company: str,
    selected_tables: Set[str],
    actor_id: Optional[str] = None
) -> Dict[str, List[str]]:
    tables, _ = _resolve_common_tables(db)
    if not tables:
        return {"copied_tables": [], "auto_included_tables": []}

    table_set = set(tables)
    selected = {t for t in selected_tables if t in table_set}
    if not selected:
        return {"copied_tables": [], "auto_included_tables": []}

    edges = _get_fk_edges(db, tables)
    expanded = _expand_with_parents(selected, edges)
    copy_tables_list = [t for t in tables if t in expanded]
    insert_order = _topological_sort(copy_tables_list, edges)

    db.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    for table in insert_order:
        cols = _get_columns(db, table)
        col_list = ", ".join([f"`{c}`" for c in cols])
        select_parts = []
        for c in cols:
            if c == "company_cd":
                select_parts.append(":target_company AS `company_cd`")
            elif actor_id and c in ("created_by", "updated_by"):
                select_parts.append(f":actor_id AS `{c}`")
            else:
                select_parts.append(f"`{c}`")
        select_list = ", ".join(select_parts)
        db.execute(
            text(f"""
                INSERT INTO `{table}` ({col_list})
                SELECT {select_list}
                FROM `{table}`
                WHERE company_cd = :source_company
            """),
            {"target_company": target_company, "source_company": source_company, "actor_id": actor_id}
        )
    db.execute(text("SET FOREIGN_KEY_CHECKS=1"))

    return {
        "copied_tables": insert_order,
        "auto_included_tables": sorted([t for t in expanded if t not in selected])
    }


@router.get("/list")
async def list_companies(
    is_use: Optional[str] = Query("", description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db)
):
    try:
        query = """
            SELECT company_cd, company_name, company_alias, is_use, created_at, updated_at
            FROM companies
            WHERE 1=1
        """
        params = {}
        if is_use:
            query += " AND is_use = :is_use"
            params["is_use"] = is_use
        query += " ORDER BY company_name ASC, company_cd ASC"
        rows = db.execute(text(query), params).mappings().all()
        return {"items": [dict(row) for row in rows], "total": len(rows)}
    except Exception as e:
        app_logger.error(f"❌ 회사 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/common-tables")
async def list_common_tables(
    source_company_cd: str = Query(..., description="복사 원본 회사 코드"),
    db: Session = Depends(get_db)
):
    try:
        source = (source_company_cd or "").strip()
        if not source:
            raise HTTPException(status_code=400, detail="source_company_cd is required")

        exists = db.execute(
            text("SELECT 1 FROM companies WHERE company_cd = :company_cd"),
            {"company_cd": source}
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="회사 코드가 존재하지 않습니다.")

        tables, comments = _resolve_common_tables(db)
        items = []
        for table in tables:
            cnt = db.execute(
                text(f"SELECT COUNT(*) FROM `{table}` WHERE company_cd = :company_cd"),
                {"company_cd": source}
            ).scalar() or 0
            items.append({
                "table_name": table,
                "table_comment": comments.get(table, ""),
                "row_count": int(cnt)
            })
        return {"items": items}
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"❌ 공통 테이블 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_company(
    request: CompanyCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        company_cd = (request.company_cd or "").strip()
        company_name = (request.company_name or "").strip()
        if not company_cd or not company_name:
            raise HTTPException(status_code=400, detail="company_cd와 company_name은 필수입니다.")

        exists = db.execute(
            text("SELECT 1 FROM companies WHERE company_cd = :company_cd"),
            {"company_cd": company_cd}
        ).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="이미 존재하는 회사 코드입니다.")

        db.execute(
            text("""
                INSERT INTO companies (
                    company_cd, company_name, company_alias, is_use, created_by, updated_by
                ) VALUES (
                    :company_cd, :company_name, :company_alias, :is_use, :created_by, :updated_by
                )
            """),
            {
                "company_cd": company_cd,
                "company_name": company_name,
                "company_alias": (request.company_alias or "").strip() or None,
                "is_use": (request.is_use or "Y").upper(),
                "created_by": current_user.get("login_id"),
                "updated_by": current_user.get("login_id"),
            }
        )

        # 공통 테이블 복사 (옵션)
        selected_tables = set([t.strip() for t in (request.copy_common_tables or []) if t and t.strip()])
        copy_enabled = bool(request.copy_comm_codes) or bool(selected_tables)
        if copy_enabled and not selected_tables:
            selected_tables = {"comm_code"}

        if copy_enabled and selected_tables:
            source_company = (request.copy_from_company_cd or "").strip() or \
                             (current_user.get("company_cd") or get_company_cd())
            if source_company and source_company != company_cd:
                source_exists = db.execute(
                    text("SELECT 1 FROM companies WHERE company_cd = :company_cd"),
                    {"company_cd": source_company}
                ).fetchone()
                if not source_exists:
                    raise HTTPException(status_code=400, detail="복사 원본 회사가 존재하지 않습니다.")

                copy_result = _copy_common_tables(
                    db,
                    source_company,
                    company_cd,
                    selected_tables,
                    actor_id=current_user.get("login_id")
                )
                app_logger.info(
                    "✅ 회사 공통 테이블 복사 완료",
                    extra={
                        "source_company": source_company,
                        "target_company": company_cd,
                        "copied_tables": copy_result.get("copied_tables", []),
                        "auto_included_tables": copy_result.get("auto_included_tables", [])
                    }
                )

        db.commit()
        return {"message": "회사 등록 완료", "company_cd": company_cd}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 회사 등록 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{company_cd}/status")
async def update_company_status(
    company_cd: str,
    request: CompanyStatusRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        cd = (company_cd or "").strip()
        if not cd:
            raise HTTPException(status_code=400, detail="company_cd is required")
        is_use = (request.is_use or "").strip().upper()
        if is_use not in ("Y", "N"):
            raise HTTPException(status_code=400, detail="is_use must be Y or N")

        exists = db.execute(
            text("SELECT 1 FROM companies WHERE company_cd = :company_cd"),
            {"company_cd": cd}
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="회사 코드가 존재하지 않습니다.")

        db.execute(
            text("""
                UPDATE companies
                SET is_use = :is_use,
                    updated_by = :updated_by
                WHERE company_cd = :company_cd
            """),
            {
                "company_cd": cd,
                "is_use": is_use,
                "updated_by": current_user.get("login_id")
            }
        )
        db.commit()
        return {"message": "회사 상태가 변경되었습니다", "company_cd": cd, "is_use": is_use}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 회사 상태 변경 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
