# -*- coding: utf-8 -*-
"""
권한 체크 유틸리티
"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user


def _map_method_to_action(method: str) -> str:
    method = (method or "").upper()
    if method == "GET":
        return "view"
    if method == "POST":
        return "create"
    if method in ("PUT", "PATCH"):
        return "update"
    if method == "DELETE":
        return "delete"
    return "view"


def permission_required(form_id: str, action: Optional[str] = None):
    """
    권한 체크 의존성
    - user 권한이 없거나 Y가 아니면 403
    - 권한 테이블이 비어있으면 허용
    - ADMIN은 항상 허용
    """
    async def _check(
        request: Request,
        current_user: dict = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        role = (current_user.get("role") or "").upper()
        if role == "ADMIN":
            return

        # 권한 데이터가 없으면 허용
        has_role_perm = db.execute(text("SELECT 1 FROM auth_permissions LIMIT 1")).fetchone()
        has_user_perm = db.execute(text("SELECT 1 FROM auth_user_permissions LIMIT 1")).fetchone()
        if not has_role_perm and not has_user_perm:
            return

        action_key = action or _map_method_to_action(request.method)
        col_map = {
            "view": "can_view",
            "create": "can_create",
            "update": "can_update",
            "delete": "can_delete"
        }
        col = col_map.get(action_key, "can_view")

        # 사용자별 권한 우선
        user_row = db.execute(text("""
            SELECT can_view, can_create, can_update, can_delete
            FROM auth_user_permissions
            WHERE login_id = :login_id AND form_id = :form_id
        """), {
            "login_id": current_user.get("login_id"),
            "form_id": form_id
        }).fetchone()

        if user_row and getattr(user_row, col, None) is not None:
            allowed = getattr(user_row, col) == 'Y'
        else:
            role_row = db.execute(text("""
                SELECT can_view, can_create, can_update, can_delete
                FROM auth_permissions
                WHERE role = :role AND form_id = :form_id
            """), {
                "role": current_user.get("role"),
                "form_id": form_id
            }).fetchone()
            allowed = bool(role_row and getattr(role_row, col) == 'Y')

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="권한이 없습니다."
            )

    return _check
