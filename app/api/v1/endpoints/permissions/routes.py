"""
권한 관리 API
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.logger import app_logger

router = APIRouter()


class BulkSaveRequest(BaseModel):
    items: List[dict]
    user_id: Optional[str] = None


@router.get("/forms")
async def list_forms(db: Session = Depends(get_db)):
    try:
        rows = db.execute(text("""
            SELECT form_id, form_name, created_at, updated_at
            FROM auth_forms
            ORDER BY form_id
        """)).fetchall()
        return {"items": [dict(r._mapping) for r in rows]}
    except Exception as e:
        app_logger.error(f"❌ 화면 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forms/bulk-save")
async def bulk_save_forms(
    payload: BulkSaveRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.user_id or current_user.get("login_id") or "system"
        for item in payload.items:
            row_stat = item.get("row_stat")
            form_id = item.get("form_id")
            form_name = item.get("form_name")

            if row_stat == "N":
                db.execute(text("""
                    INSERT INTO auth_forms (form_id, form_name, created_by)
                    VALUES (:form_id, :form_name, :created_by)
                """), {
                    "form_id": form_id,
                    "form_name": form_name,
                    "created_by": user_id
                })
            elif row_stat == "U":
                db.execute(text("""
                    UPDATE auth_forms
                    SET form_name = :form_name, updated_by = :updated_by
                    WHERE form_id = :form_id
                """), {
                    "form_id": form_id,
                    "form_name": form_name,
                    "updated_by": user_id
                })
            elif row_stat == "D":
                db.execute(text("""
                    DELETE FROM auth_forms WHERE form_id = :form_id
                """), {"form_id": form_id})

        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 화면 저장 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/roles")
async def list_role_permissions(db: Session = Depends(get_db)):
    try:
        rows = db.execute(text("""
            SELECT
                p.role,
                p.form_id,
                f.form_name,
                p.can_view,
                p.can_create,
                p.can_update,
                p.can_delete,
                p.created_at,
                p.updated_at
            FROM auth_permissions p
            LEFT JOIN auth_forms f ON f.form_id = p.form_id
            ORDER BY p.role, p.form_id
        """)).fetchall()
        return {"items": [dict(r._mapping) for r in rows]}
    except Exception as e:
        app_logger.error(f"❌ 역할 권한 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/roles/bulk-save")
async def bulk_save_role_permissions(
    payload: BulkSaveRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.user_id or current_user.get("login_id") or "system"
        for item in payload.items:
            row_stat = item.get("row_stat")
            role = item.get("role")
            form_id = item.get("form_id")
            can_view = item.get("can_view")
            can_create = item.get("can_create")
            can_update = item.get("can_update")
            can_delete = item.get("can_delete")

            if row_stat == "N":
                db.execute(text("""
                    INSERT INTO auth_permissions (
                        role, form_id, can_view, can_create, can_update, can_delete, created_by
                    ) VALUES (
                        :role, :form_id, :can_view, :can_create, :can_update, :can_delete, :created_by
                    )
                """), {
                    "role": role,
                    "form_id": form_id,
                    "can_view": can_view or 'N',
                    "can_create": can_create or 'N',
                    "can_update": can_update or 'N',
                    "can_delete": can_delete or 'N',
                    "created_by": user_id
                })
            elif row_stat == "U":
                db.execute(text("""
                    UPDATE auth_permissions
                    SET
                        can_view = :can_view,
                        can_create = :can_create,
                        can_update = :can_update,
                        can_delete = :can_delete,
                        updated_by = :updated_by
                    WHERE role = :role AND form_id = :form_id
                """), {
                    "role": role,
                    "form_id": form_id,
                    "can_view": can_view or 'N',
                    "can_create": can_create or 'N',
                    "can_update": can_update or 'N',
                    "can_delete": can_delete or 'N',
                    "updated_by": user_id
                })
            elif row_stat == "D":
                db.execute(text("""
                    DELETE FROM auth_permissions WHERE role = :role AND form_id = :form_id
                """), {"role": role, "form_id": form_id})

        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 역할 권한 저장 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def list_user_permissions(db: Session = Depends(get_db)):
    try:
        rows = db.execute(text("""
            SELECT
                p.login_id,
                u.user_name,
                p.form_id,
                f.form_name,
                p.can_view,
                p.can_create,
                p.can_update,
                p.can_delete,
                p.created_at,
                p.updated_at
            FROM auth_user_permissions p
            LEFT JOIN users u ON u.login_id = p.login_id
            LEFT JOIN auth_forms f ON f.form_id = p.form_id
            ORDER BY p.login_id, p.form_id
        """)).fetchall()
        return {"items": [dict(r._mapping) for r in rows]}
    except Exception as e:
        app_logger.error(f"❌ 사용자 권한 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/bulk-save")
async def bulk_save_user_permissions(
    payload: BulkSaveRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.user_id or current_user.get("login_id") or "system"
        for item in payload.items:
            row_stat = item.get("row_stat")
            login_id = item.get("login_id")
            form_id = item.get("form_id")
            can_view = item.get("can_view")
            can_create = item.get("can_create")
            can_update = item.get("can_update")
            can_delete = item.get("can_delete")

            if row_stat == "N":
                db.execute(text("""
                    INSERT INTO auth_user_permissions (
                        login_id, form_id, can_view, can_create, can_update, can_delete, created_by
                    ) VALUES (
                        :login_id, :form_id, :can_view, :can_create, :can_update, :can_delete, :created_by
                    )
                """), {
                    "login_id": login_id,
                    "form_id": form_id,
                    "can_view": can_view,
                    "can_create": can_create,
                    "can_update": can_update,
                    "can_delete": can_delete,
                    "created_by": user_id
                })
            elif row_stat == "U":
                db.execute(text("""
                    UPDATE auth_user_permissions
                    SET
                        can_view = :can_view,
                        can_create = :can_create,
                        can_update = :can_update,
                        can_delete = :can_delete,
                        updated_by = :updated_by
                    WHERE login_id = :login_id AND form_id = :form_id
                """), {
                    "login_id": login_id,
                    "form_id": form_id,
                    "can_view": can_view,
                    "can_create": can_create,
                    "can_update": can_update,
                    "can_delete": can_delete,
                    "updated_by": user_id
                })
            elif row_stat == "D":
                db.execute(text("""
                    DELETE FROM auth_user_permissions WHERE login_id = :login_id AND form_id = :form_id
                """), {"login_id": login_id, "form_id": form_id})

        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 사용자 권한 저장 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
