# -*- coding: utf-8 -*-
"""
조직(Org Units) 관리 API
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()


class OrgUnitBulkItem(BaseModel):
    org_id: Optional[int] = None
    org_name: Optional[str] = None
    parent_id: Optional[int] = None
    org_type: Optional[str] = None
    sort_order: Optional[int] = 0
    is_use: Optional[str] = "Y"
    row_stat: Optional[str] = None


class OrgUnitBulkRequest(BaseModel):
    items: List[OrgUnitBulkItem]


def _is_org_in_use(db: Session, org_id: int) -> bool:
    queries = [
        "SELECT COUNT(*) AS cnt FROM users WHERE org_id = :org_id",
        "SELECT COUNT(*) AS cnt FROM projects WHERE org_id = :org_id",
        "SELECT COUNT(*) AS cnt FROM sales_plan_line WHERE org_id = :org_id",
        "SELECT COUNT(*) AS cnt FROM sales_actual_line WHERE org_id = :org_id",
    ]
    for q in queries:
        try:
            cnt = db.execute(text(q), {"org_id": org_id}).fetchone().cnt
            if cnt and cnt > 0:
                return True
        except Exception:
            continue
    return False


@router.get("/list")
async def list_org_units(
    is_use: Optional[str] = Query("", description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db),
):
    try:
        query = """
            SELECT u.org_id, u.org_name, u.parent_id, p.org_name AS parent_name,
                   u.org_type, u.sort_order, u.is_use,
                   u.created_at, u.updated_at, u.created_by, u.updated_by
            FROM org_units u
            LEFT JOIN org_units p ON p.org_id = u.parent_id
            WHERE 1=1
        """
        params = {}
        if is_use:
            query += " AND u.is_use = :is_use"
            params["is_use"] = is_use
        query += " ORDER BY u.sort_order ASC, u.org_name ASC, u.org_id ASC"
        rows = db.execute(text(query), params).fetchall()
        items = [dict(row._mapping) for row in rows]
        return {"items": items, "total": len(items)}
    except Exception as e:
        app_logger.error(f"❌ 조직 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"조직 조회 실패: {str(e)}")


@router.post("/bulk-save")
async def bulk_save_org_units(
    request: OrgUnitBulkRequest,
    db: Session = Depends(get_db),
):
    try:
        items = request.items or []
        for item in items:
            row_stat = (item.row_stat or "").upper()
            org_id = item.org_id
            org_name = (item.org_name or "").strip()
            parent_id = item.parent_id
            org_type = (item.org_type or "").strip() or None
            sort_order = item.sort_order or 0
            is_use = (item.is_use or "Y").upper()

            if row_stat == "N":
                if not org_name:
                    raise HTTPException(status_code=400, detail="조직명은 필수입니다.")
                db.execute(
                    text("""
                        INSERT INTO org_units
                        (org_name, parent_id, org_type, sort_order, is_use)
                        VALUES (:org_name, :parent_id, :org_type, :sort_order, :is_use)
                    """),
                    {
                        "org_name": org_name,
                        "parent_id": parent_id,
                        "org_type": org_type,
                        "sort_order": sort_order,
                        "is_use": is_use,
                    },
                )
            elif row_stat == "U":
                if not org_id:
                    continue
                if parent_id == org_id:
                    parent_id = None
                db.execute(
                    text("""
                        UPDATE org_units
                        SET org_name = :org_name,
                            parent_id = :parent_id,
                            org_type = :org_type,
                            sort_order = :sort_order,
                            is_use = :is_use
                        WHERE org_id = :org_id
                    """),
                    {
                        "org_id": org_id,
                        "org_name": org_name,
                        "parent_id": parent_id,
                        "org_type": org_type,
                        "sort_order": sort_order,
                        "is_use": is_use,
                    },
                )
            elif row_stat == "D":
                if not org_id:
                    continue
                if _is_org_in_use(db, org_id):
                    raise HTTPException(status_code=400, detail="다른 테이블에서 사용 중인 조직입니다.")
                db.execute(
                    text("DELETE FROM org_units WHERE org_id = :org_id"),
                    {"org_id": org_id},
                )

        db.commit()
        return {"message": "저장되었습니다."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 조직 저장 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"조직 저장 실패: {str(e)}")
