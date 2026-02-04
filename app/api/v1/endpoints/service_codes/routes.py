# -*- coding: utf-8 -*-
"""
서비스 코드 관리 API
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()


class ServiceCodeBulkItem(BaseModel):
    service_code: str
    parent_code: Optional[str] = None
    service_name: Optional[str] = None
    display_name: Optional[str] = None
    sort_order: Optional[int] = 0
    is_use: Optional[str] = "Y"
    row_stat: Optional[str] = None


class ServiceCodeBulkRequest(BaseModel):
    items: List[ServiceCodeBulkItem]


def _is_service_in_use(db: Session, service_code: str) -> bool:
    queries = [
        "SELECT COUNT(*) AS cnt FROM projects WHERE service_code = :code",
        "SELECT COUNT(*) AS cnt FROM sales_plan_line WHERE service_code = :code",
        "SELECT COUNT(*) AS cnt FROM sales_actual_line WHERE service_code = :code",
    ]
    for q in queries:
        try:
            cnt = db.execute(text(q), {"code": service_code}).fetchone().cnt
            if cnt and cnt > 0:
                return True
        except Exception:
            continue
    return False


@router.get("/list")
async def list_service_codes(
    is_use: Optional[str] = Query("", description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db)
):
    try:
        query = """
            SELECT s.service_code, s.parent_code, p.service_name AS parent_name,
                   s.service_name, s.display_name,
                   s.sort_order, s.is_use, s.created_at, s.updated_at, s.created_by, s.updated_by
            FROM service_codes s
            LEFT JOIN service_codes p ON p.service_code = s.parent_code
            WHERE 1=1
        """
        params = {}
        if is_use:
            query += " AND s.is_use = :is_use"
            params["is_use"] = is_use
        query += " ORDER BY s.sort_order ASC, s.service_code ASC"
        rows = db.execute(text(query), params).fetchall()
        items = [dict(row._mapping) for row in rows]
        return {"items": items, "total": len(items)}
    except Exception as e:
        app_logger.error(f"❌ 서비스코드 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"서비스코드 조회 실패: {str(e)}")


@router.post("/bulk-save")
async def bulk_save_service_codes(
    request: ServiceCodeBulkRequest,
    db: Session = Depends(get_db)
):
    try:
        items = request.items or []
        for item in items:
            row_stat = (item.row_stat or "").upper()
            code = (item.service_code or "").strip()
            parent = (item.parent_code or "").strip() or None
            name = (item.service_name or "").strip()
            display_name = (item.display_name or "").strip() or name
            sort_order = item.sort_order or 0
            is_use = (item.is_use or "Y").upper()

            if not code:
                continue
            if parent == code:
                parent = None

            if row_stat == "N":
                if not name:
                    raise HTTPException(status_code=400, detail="서비스명은 필수입니다.")
                exists = db.execute(
                    text("SELECT 1 FROM service_codes WHERE service_code = :code"),
                    {"code": code}
                ).fetchone()
                if exists:
                    raise HTTPException(status_code=409, detail="이미 존재하는 서비스코드입니다.")
                db.execute(
                    text("""
                        INSERT INTO service_codes
                        (service_code, parent_code, service_name, display_name, sort_order, is_use)
                        VALUES (:code, :parent, :name, :display_name, :sort_order, :is_use)
                    """),
                    {
                        "code": code,
                        "parent": parent,
                        "name": name,
                        "display_name": display_name,
                        "sort_order": sort_order,
                        "is_use": is_use,
                    },
                )
            elif row_stat == "U":
                db.execute(
                    text("""
                        UPDATE service_codes
                        SET parent_code = :parent,
                            service_name = :name,
                            display_name = :display_name,
                            sort_order = :sort_order,
                            is_use = :is_use
                        WHERE service_code = :code
                    """),
                    {
                        "code": code,
                        "parent": parent,
                        "name": name,
                        "display_name": display_name,
                        "sort_order": sort_order,
                        "is_use": is_use,
                    },
                )
            elif row_stat == "D":
                if _is_service_in_use(db, code):
                    raise HTTPException(status_code=400, detail="다른 테이블에서 사용 중인 서비스코드입니다.")
                db.execute(
                    text("DELETE FROM service_codes WHERE service_code = :code"),
                    {"code": code},
                )

        db.commit()
        return {"message": "저장되었습니다."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 서비스코드 저장 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"서비스코드 저장 실패: {str(e)}")
