"""
접속 이력 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_company_cd
from app.core.logger import app_logger

router = APIRouter()


@router.get("/list")
async def list_login_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    login_id: Optional[str] = None,
    action_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_dir: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """접속 이력 목록 조회"""
    try:
        company_cd = get_company_cd()
        base_query = """
            SELECT
                history_id,
                login_id,
                action_type,
                action_time,
                pc_name,
                ip_address,
                created_at
            FROM login_history
            WHERE company_cd = :company_cd
        """
        params = {"company_cd": company_cd}

        if login_id:
            base_query += " AND login_id LIKE :login_id"
            params["login_id"] = f"%{login_id}%"

        if action_type:
            base_query += " AND action_type = :action_type"
            params["action_type"] = action_type

        if date_from:
            base_query += " AND action_time >= :date_from"
            params["date_from"] = date_from

        if date_to:
            base_query += " AND action_time <= :date_to"
            params["date_to"] = date_to

        count_query = f"SELECT COUNT(*) as cnt FROM ({base_query}) as t"
        total = db.execute(text(count_query), params).fetchone().cnt

        allowed_sort_fields = {
            "action_time": "action_time",
            "login_id": "login_id",
            "action_type": "action_type"
        }
        if sort_field in allowed_sort_fields:
            direction = "ASC" if (sort_dir or "").lower() == "asc" else "DESC"
            base_query += f" ORDER BY {allowed_sort_fields[sort_field]} {direction}"
        else:
            base_query += " ORDER BY action_time DESC"

        offset = (page - 1) * page_size
        base_query += " LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = offset

        rows = db.execute(text(base_query), params).fetchall()
        items = [dict(row._mapping) for row in rows]

        return {
            "items": items,
            "total": total,
            "total_records": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        app_logger.error(f"❌ 접속 이력 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
