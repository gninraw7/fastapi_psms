# -*- coding: utf-8 -*-
"""
공지 템플릿 관리 API
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_company_cd
from app.core.security import get_current_user
from app.core.logger import app_logger

router = APIRouter()


class NoticeTemplateCreateRequest(BaseModel):
    title: str
    content: str
    category: Optional[str] = None
    sort_order: Optional[int] = 0
    is_shared: Optional[str] = "N"
    is_use: Optional[str] = "Y"


class NoticeTemplateUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None
    is_shared: Optional[str] = None
    is_use: Optional[str] = None


def _normalize_flag(value: Optional[str]) -> str:
    if value is None:
        return "N"
    if isinstance(value, str):
        return "Y" if value.strip().upper() == "Y" else "N"
    return "N"


@router.get("/list")
async def list_notice_templates(
    is_use: Optional[str] = Query("", description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        query = """
            SELECT template_id, title, content, category, sort_order, is_shared, is_use, created_at, updated_at
            FROM notice_templates
            WHERE company_cd = :company_cd
        """
        params = {"company_cd": company_cd}
        if is_use:
            query += " AND is_use = :is_use"
            params["is_use"] = is_use
        query += " ORDER BY sort_order ASC, updated_at DESC, template_id DESC"
        rows = db.execute(text(query), params).mappings().all()
        return {"items": [dict(row) for row in rows], "total": len(rows)}
    except Exception as e:
        app_logger.error(f"❌ 공지 템플릿 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{template_id}")
async def get_notice_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        row = db.execute(text("""
            SELECT template_id, title, content, category, sort_order, is_shared, is_use, created_at, updated_at
            FROM notice_templates
            WHERE company_cd = :company_cd
              AND template_id = :template_id
        """), {"company_cd": company_cd, "template_id": template_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다.")
        return dict(row._mapping)
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"❌ 공지 템플릿 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_notice_template(
    request: NoticeTemplateCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        title = (request.title or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="title is required")
        content = request.content or ""

        db.execute(text("""
            INSERT INTO notice_templates (
                company_cd, title, content, category, sort_order, is_shared, is_use,
                created_by, updated_by
            ) VALUES (
                :company_cd, :title, :content, :category, :sort_order, :is_shared, :is_use,
                :created_by, :updated_by
            )
        """), {
            "company_cd": company_cd,
            "title": title,
            "content": content,
            "category": (request.category or "").strip() or None,
            "sort_order": request.sort_order or 0,
            "is_shared": _normalize_flag(request.is_shared),
            "is_use": _normalize_flag(request.is_use),
            "created_by": current_user.get("login_id"),
            "updated_by": current_user.get("login_id")
        })
        db.commit()
        template_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        return {"template_id": template_id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 공지 템플릿 등록 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{template_id}")
async def update_notice_template(
    template_id: int,
    request: NoticeTemplateUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        row = db.execute(text("""
            SELECT 1 FROM notice_templates
            WHERE company_cd = :company_cd
              AND template_id = :template_id
        """), {"company_cd": company_cd, "template_id": template_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다.")

        db.execute(text("""
            UPDATE notice_templates
            SET title = COALESCE(:title, title),
                content = COALESCE(:content, content),
                category = COALESCE(:category, category),
                sort_order = COALESCE(:sort_order, sort_order),
                is_shared = COALESCE(:is_shared, is_shared),
                is_use = COALESCE(:is_use, is_use),
                updated_by = :updated_by
            WHERE company_cd = :company_cd
              AND template_id = :template_id
        """), {
            "company_cd": company_cd,
            "template_id": template_id,
            "title": request.title,
            "content": request.content,
            "category": request.category,
            "sort_order": request.sort_order,
            "is_shared": _normalize_flag(request.is_shared) if request.is_shared is not None else None,
            "is_use": _normalize_flag(request.is_use) if request.is_use is not None else None,
            "updated_by": current_user.get("login_id")
        })
        db.commit()
        return {"success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 공지 템플릿 수정 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{template_id}")
async def delete_notice_template(
    template_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        row = db.execute(text("""
            SELECT 1 FROM notice_templates
            WHERE company_cd = :company_cd
              AND template_id = :template_id
        """), {"company_cd": company_cd, "template_id": template_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다.")

        db.execute(text("""
            DELETE FROM notice_templates
            WHERE company_cd = :company_cd
              AND template_id = :template_id
        """), {"company_cd": company_cd, "template_id": template_id})
        db.commit()
        return {"success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 공지 템플릿 삭제 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
