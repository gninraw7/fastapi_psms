# -*- coding: utf-8 -*-
"""
분야 코드(Industry Fields) 관리 API
"""
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_company_cd
from app.core.logger import app_logger

router = APIRouter()


class IndustryFieldBulkItem(BaseModel):
    field_code: str
    field_name: Optional[str] = None
    org_desc: Optional[str] = None
    facility_desc: Optional[str] = None
    sort_order: Optional[int] = 0
    is_use: Optional[str] = "Y"
    row_stat: Optional[str] = None


class IndustryFieldBulkRequest(BaseModel):
    items: List[IndustryFieldBulkItem]


def _is_field_in_use(db: Session, field_code: str) -> bool:
    company_cd = get_company_cd()
    queries = [
        "SELECT COUNT(*) AS cnt FROM projects WHERE company_cd = :company_cd AND field_code = :code",
        "SELECT COUNT(*) AS cnt FROM sales_plan_line WHERE company_cd = :company_cd AND field_code = :code",
        "SELECT COUNT(*) AS cnt FROM sales_actual_line WHERE company_cd = :company_cd AND field_code = :code",
    ]
    for q in queries:
        try:
            cnt = db.execute(text(q), {"code": field_code, "company_cd": company_cd}).fetchone().cnt
            if cnt and cnt > 0:
                return True
        except Exception:
            continue
    return False


@router.get("/list")
async def list_industry_fields(
    is_use: Optional[str] = Query("", description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        query = """
            SELECT field_code, field_name, org_desc, facility_desc, sort_order, is_use,
                   created_at, updated_at, created_by, updated_by
            FROM industry_fields
            WHERE company_cd = :company_cd
        """
        params = {"company_cd": company_cd}
        if is_use:
            query += " AND is_use = :is_use"
            params["is_use"] = is_use
        query += " ORDER BY sort_order ASC, field_code ASC"
        rows = db.execute(text(query), params).fetchall()
        items = [dict(row._mapping) for row in rows]
        return {"items": items, "total": len(items)}
    except Exception as e:
        app_logger.error(f"❌ 분야코드 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"분야코드 조회 실패: {str(e)}")


@router.post("/bulk-save")
async def bulk_save_industry_fields(
    request: IndustryFieldBulkRequest,
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        items = request.items or []
        for item in items:
            row_stat = (item.row_stat or "").upper()
            code = (item.field_code or "").strip()
            name = (item.field_name or "").strip()
            sort_order = item.sort_order or 0
            is_use = (item.is_use or "Y").upper()

            if not code:
                continue

            if row_stat == "N":
                if not name:
                    raise HTTPException(status_code=400, detail="분야명은 필수입니다.")
                exists = db.execute(
                    text("SELECT 1 FROM industry_fields WHERE company_cd = :company_cd AND field_code = :code"),
                    {"code": code, "company_cd": company_cd}
                ).fetchone()
                if exists:
                    raise HTTPException(status_code=409, detail="이미 존재하는 분야코드입니다.")
                db.execute(
                    text("""
                        INSERT INTO industry_fields
                        (company_cd, field_code, field_name, org_desc, facility_desc, sort_order, is_use)
                        VALUES (:company_cd, :code, :name, :org_desc, :facility_desc, :sort_order, :is_use)
                    """),
                    {
                        "company_cd": company_cd,
                        "code": code,
                        "name": name,
                        "org_desc": item.org_desc,
                        "facility_desc": item.facility_desc,
                        "sort_order": sort_order,
                        "is_use": is_use,
                    },
                )
            elif row_stat == "U":
                db.execute(
                    text("""
                        UPDATE industry_fields
                        SET field_name = :name,
                            org_desc = :org_desc,
                            facility_desc = :facility_desc,
                            sort_order = :sort_order,
                            is_use = :is_use
                        WHERE company_cd = :company_cd
                          AND field_code = :code
                    """),
                    {
                        "company_cd": company_cd,
                        "code": code,
                        "name": name,
                        "org_desc": item.org_desc,
                        "facility_desc": item.facility_desc,
                        "sort_order": sort_order,
                        "is_use": is_use,
                    },
                )
            elif row_stat == "D":
                if _is_field_in_use(db, code):
                    raise HTTPException(status_code=400, detail="다른 테이블에서 사용 중인 분야코드입니다.")
                db.execute(
                    text("DELETE FROM industry_fields WHERE company_cd = :company_cd AND field_code = :code"),
                    {"code": code, "company_cd": company_cd},
                )

        db.commit()
        return {"message": "저장되었습니다."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 분야코드 저장 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"분야코드 저장 실패: {str(e)}")
