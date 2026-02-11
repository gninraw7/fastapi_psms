# -*- coding: utf-8 -*-
"""
사용자 관리 API 엔드포인트
app/api/v1/endpoints/users/routes.py
"""
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import app_logger
from app.core.tenant import get_company_cd
from app.core.security import get_password_hash, get_current_user

router = APIRouter()


# ============================================
# Request 모델
# ============================================
class UserCreateRequest(BaseModel):
    login_id: str
    user_name: str
    role: str
    is_sales_rep: Optional[bool] = False
    email: Optional[str] = None
    phone: Optional[str] = None
    org_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    created_by: Optional[str] = None


class UserUpdateRequest(BaseModel):
    login_id: Optional[str] = None
    user_name: Optional[str] = None
    role: Optional[str] = None
    is_sales_rep: Optional[bool] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    org_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    updated_by: Optional[str] = None
    allow_login_id_change: Optional[bool] = False


class BulkPasswordResetRequest(BaseModel):
    user_nos: List[int]
    updated_by: Optional[str] = None


# ============================================
# Helper Functions
# ============================================
def _get_today_str() -> str:
    return date.today().isoformat()


def _check_login_id_in_use(db: Session, login_id: str) -> int:
    """
    login_id가 다른 테이블에 사용 중인지 확인
    반환값: 참조 건수 합계
    """
    company_cd = get_company_cd()
    usage_query = text("""
        SELECT
            (SELECT COUNT(*) FROM projects WHERE company_cd = :company_cd AND manager_id = :login_id) +
            (SELECT COUNT(*) FROM project_history WHERE company_cd = :company_cd AND creator_id = :login_id) +
            (SELECT COUNT(*) FROM login_history WHERE company_cd = :company_cd AND login_id = :login_id) +
            (SELECT COUNT(*) FROM clients WHERE company_cd = :company_cd AND (created_by = :login_id OR updated_by = :login_id)) +
            (SELECT COUNT(*) FROM projects WHERE company_cd = :company_cd AND (created_by = :login_id OR updated_by = :login_id)) +
            (SELECT COUNT(*) FROM project_contracts WHERE company_cd = :company_cd AND (created_by = :login_id OR updated_by = :login_id)) AS total_refs
    """)
    result = db.execute(usage_query, {"login_id": login_id, "company_cd": company_cd}).fetchone()
    return int(result[0] or 0)


# ============================================
# 사용자 목록 조회 (페이징 + 필터)
# ============================================
@router.get("/list")
async def get_users_list(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(25, ge=1, le=200, description="페이지 크기"),
    search_field: Optional[str] = Query(None, description="검색 필드"),
    search_text: Optional[str] = Query(None, description="검색어"),
    status: Optional[str] = Query(None, description="상태 필터 (ACTIVE/INACTIVE/LOCK)"),
    sort_field: Optional[str] = Query(None, description="정렬 필드"),
    sort_dir: Optional[str] = Query(None, description="정렬 방향 (asc/desc)"),
    db: Session = Depends(get_db)
):
    """
    사용자 목록 조회 (페이징, 필터)
    """
    try:
        app_logger.info(
            f"📋 사용자 목록 조회 - page: {page}, size: {page_size}, "
            f"sort_field: {sort_field}, sort_dir: {sort_dir}"
        )
        company_cd = get_company_cd()

        base_query = """
            SELECT
                u.user_no,
                u.login_id,
                u.user_name,
                u.role,
                u.is_sales_rep,
                u.email,
                u.phone,
                u.org_id,
                o.org_name,
                u.start_date,
                u.end_date,
                u.status,
                u.created_at,
                u.updated_at,
                u.created_by,
                u.updated_by
            FROM users u
            LEFT JOIN org_units o 
              ON o.org_id = u.org_id
             AND o.company_cd = u.company_cd
            WHERE u.company_cd = :company_cd
        """

        count_query = "SELECT COUNT(*) as total FROM users u LEFT JOIN org_units o ON o.org_id = u.org_id AND o.company_cd = u.company_cd WHERE u.company_cd = :company_cd"

        stats_query = """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) as inactive_count
            FROM users
            WHERE company_cd = :company_cd
        """

        params = {"company_cd": company_cd}
        filter_condition = ""

        if search_text and search_text.strip():
            search_value = f"%{search_text.strip()}%"
            params["search"] = search_value

            if search_field:
                if search_field == "login_id":
                    filter_condition += " AND login_id LIKE :search"
                elif search_field == "user_name":
                    filter_condition += " AND user_name LIKE :search"
                elif search_field == "email":
                    filter_condition += " AND email LIKE :search"
                elif search_field == "phone":
                    filter_condition += " AND phone LIKE :search"
                elif search_field == "org_name":
                    filter_condition += " AND o.org_name LIKE :search"
                else:
                    filter_condition += """
                        AND (
                            u.login_id LIKE :search
                            OR u.user_name LIKE :search
                            OR u.email LIKE :search
                            OR u.phone LIKE :search
                            OR o.org_name LIKE :search
                        )
                    """
            else:
                filter_condition += """
                    AND (
                        u.login_id LIKE :search
                        OR u.user_name LIKE :search
                        OR u.email LIKE :search
                        OR u.phone LIKE :search
                        OR o.org_name LIKE :search
                    )
                """

        status_value = (status or "").strip()
        if not status_value:
            status_value = "ACTIVE"
        if status_value.upper() != "ALL":
            filter_condition += " AND u.status = :status"
            params["status"] = status_value

        base_query += filter_condition
        count_query += filter_condition

        allowed_sort_fields = {
            "user_no": "u.user_no",
            "login_id": "u.login_id",
            "user_name": "u.user_name",
            "role": "u.role",
            "is_sales_rep": "u.is_sales_rep",
            "email": "u.email",
            "phone": "u.phone",
            "org_name": "o.org_name",
            "start_date": "u.start_date",
            "end_date": "u.end_date",
            "status": "u.status",
            "created_at": "u.created_at",
            "updated_at": "u.updated_at",
            "created_by": "u.created_by",
            "updated_by": "u.updated_by"
        }
        if sort_field in allowed_sort_fields:
            direction = "ASC" if (sort_dir or "").lower() == "asc" else "DESC"
            base_query += f" ORDER BY {allowed_sort_fields[sort_field]} {direction}"
        else:
            base_query += " ORDER BY user_no DESC"
        offset = (page - 1) * page_size
        base_query += f" LIMIT {page_size} OFFSET {offset}"

        result = db.execute(text(base_query), params)
        rows = result.fetchall()

        count_result = db.execute(text(count_query), params).fetchone()
        total = int(count_result[0] if count_result else 0)

        stats_result = db.execute(text(stats_query), {"company_cd": company_cd}).fetchone()
        total_count = int(stats_result[0] if stats_result else 0)
        active_count = int(stats_result[1] if stats_result else 0)
        inactive_count = int(stats_result[2] if stats_result else 0)

        items = [dict(row._mapping) for row in rows]
        total_pages = (total + page_size - 1) // page_size if page_size else 1

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "active_count": active_count,
            "inactive_count": inactive_count,
            "filtered_count": total,
            "total_count": total_count
        }
    except Exception as e:
        app_logger.error(f"❌ 사용자 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 목록 조회 실패: {str(e)}")


# ============================================
# 사용자 상세 조회
# ============================================
@router.get("/{user_no}")
async def get_user_detail(
    user_no: int,
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        query = text("""
            SELECT
                u.user_no,
                u.login_id,
                u.user_name,
                u.role,
                u.is_sales_rep,
                u.email,
                u.phone,
                u.org_id,
                o.org_name,
                u.start_date,
                u.end_date,
                u.status,
                u.created_at,
                u.updated_at,
                u.created_by,
                u.updated_by
            FROM users u
            LEFT JOIN org_units o 
              ON o.org_id = u.org_id
             AND o.company_cd = u.company_cd
            WHERE u.company_cd = :company_cd
              AND u.user_no = :user_no
        """)
        result = db.execute(query, {"user_no": user_no, "company_cd": company_cd}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"❌ 사용자 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 조회 실패: {str(e)}")


# ============================================
# login_id 변경 가능 여부
# ============================================
@router.get("/can-change-login-id")
async def can_change_login_id(
    user_no: int = Query(..., description="사용자 번호"),
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        result = db.execute(
            text("SELECT login_id FROM users WHERE company_cd = :company_cd AND user_no = :user_no"),
            {"user_no": user_no, "company_cd": company_cd}
        ).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        login_id = result[0]
        ref_count = _check_login_id_in_use(db, login_id)
        return {
            "user_no": user_no,
            "login_id": login_id,
            "can_change": ref_count == 0,
            "ref_count": ref_count
        }
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"❌ login_id 변경 가능 여부 확인 실패: {e}")
        raise HTTPException(status_code=500, detail=f"login_id 변경 가능 여부 확인 실패: {str(e)}")


# ============================================
# 사용자 생성
# ============================================
@router.post("")
async def create_user(
    user_data: UserCreateRequest,
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        login_id = user_data.login_id.strip()
        if not login_id:
            raise HTTPException(status_code=400, detail="login_id는 필수입니다.")
        if not user_data.user_name:
            raise HTTPException(status_code=400, detail="user_name은 필수입니다.")
        if not user_data.role:
            raise HTTPException(status_code=400, detail="role은 필수입니다.")

        # 중복 체크
        exists = db.execute(
            text("SELECT 1 FROM users WHERE company_cd = :company_cd AND login_id = :login_id"),
            {"login_id": login_id, "company_cd": company_cd}
        ).fetchone()
        if exists:
            raise HTTPException(status_code=400, detail="이미 존재하는 login_id입니다.")

        password_hash = get_password_hash(login_id)

        start_date = user_data.start_date or _get_today_str()
        end_date = user_data.end_date or "9999-12-31"
        status = user_data.status or "ACTIVE"

        query = text("""
            INSERT INTO users (
                company_cd, login_id, password, user_name, role, is_sales_rep,
                email, phone, org_id,
                start_date, end_date, status,
                created_by, updated_by
            ) VALUES (
                :company_cd, :login_id, :password, :user_name, :role, :is_sales_rep,
                :email, :phone, :org_id,
                :start_date, :end_date, :status,
                :created_by, :updated_by
            )
        """)
        db.execute(query, {
            "company_cd": company_cd,
            "login_id": login_id,
            "password": password_hash,
            "user_name": user_data.user_name,
            "role": user_data.role,
            "is_sales_rep": 1 if user_data.is_sales_rep else 0,
            "email": user_data.email,
            "phone": user_data.phone,
            "org_id": user_data.org_id,
            "start_date": start_date,
            "end_date": end_date,
            "status": status,
            "created_by": user_data.created_by or login_id,
            "updated_by": user_data.created_by or login_id
        })
        db.commit()

        user_no = db.execute(
            text("SELECT user_no FROM users WHERE company_cd = :company_cd AND login_id = :login_id"),
            {"login_id": login_id, "company_cd": company_cd}
        ).fetchone()
        return {"success": True, "user_no": user_no[0] if user_no else None}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 사용자 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 생성 실패: {str(e)}")


# ============================================
# 사용자 수정
# ============================================
@router.put("/{user_no}")
async def update_user(
    user_no: int,
    user_data: UserUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        current = db.execute(
            text("SELECT login_id FROM users WHERE company_cd = :company_cd AND user_no = :user_no"),
            {"user_no": user_no, "company_cd": company_cd}
        ).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        current_login_id = current[0]
        if user_data.login_id is not None:
            new_login_id = user_data.login_id.strip()
            if not new_login_id:
                new_login_id = current_login_id
        else:
            new_login_id = current_login_id

        if new_login_id != current_login_id:
            if not user_data.allow_login_id_change:
                raise HTTPException(status_code=400, detail="login_id 변경은 예외적인 경우에만 가능합니다.")
            ref_count = _check_login_id_in_use(db, current_login_id)
            if ref_count > 0:
                raise HTTPException(status_code=400, detail="login_id가 다른 데이터에 사용 중이라 변경할 수 없습니다.")

            # 중복 체크
            exists = db.execute(
                text("SELECT 1 FROM users WHERE company_cd = :company_cd AND login_id = :login_id AND user_no <> :user_no"),
                {"login_id": new_login_id, "user_no": user_no, "company_cd": company_cd}
            ).fetchone()
            if exists:
                raise HTTPException(status_code=400, detail="이미 존재하는 login_id입니다.")

        update_fields = []
        params = {"user_no": user_no, "company_cd": company_cd}

        def add_field(field_name, value):
            update_fields.append(f"{field_name} = :{field_name}")
            params[field_name] = value

        if new_login_id != current_login_id:
            add_field("login_id", new_login_id)

        if user_data.user_name is not None:
            add_field("user_name", user_data.user_name)
        if user_data.role is not None:
            add_field("role", user_data.role)
        if user_data.is_sales_rep is not None:
            add_field("is_sales_rep", 1 if user_data.is_sales_rep else 0)
        if user_data.email is not None:
            add_field("email", user_data.email)
        if user_data.phone is not None:
            add_field("phone", user_data.phone)
        if user_data.org_id is not None:
            add_field("org_id", user_data.org_id)
        if user_data.start_date is not None:
            add_field("start_date", user_data.start_date)
        if user_data.end_date is not None:
            add_field("end_date", user_data.end_date)
        if user_data.status is not None:
            add_field("status", user_data.status)

        add_field("updated_by", user_data.updated_by or current_login_id)

        if not update_fields:
            return {"success": True, "message": "변경 사항이 없습니다."}

        update_query = text(f"""
            UPDATE users
            SET {", ".join(update_fields)}
            WHERE company_cd = :company_cd
              AND user_no = :user_no
        """)
        db.execute(update_query, params)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 사용자 수정 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 수정 실패: {str(e)}")


# ============================================
# 사용자 삭제
# ============================================
@router.delete("/{user_no}")
async def delete_user(
    user_no: int,
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        result = db.execute(
            text("SELECT login_id FROM users WHERE company_cd = :company_cd AND user_no = :user_no"),
            {"user_no": user_no, "company_cd": company_cd}
        ).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        db.execute(
            text("DELETE FROM users WHERE company_cd = :company_cd AND user_no = :user_no"),
            {"user_no": user_no, "company_cd": company_cd}
        )
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 사용자 삭제 실패: {e}")
        raise HTTPException(status_code=500, detail=f"사용자 삭제 실패: {str(e)}")


# ============================================
# 비밀번호 일괄 리셋
# ============================================
@router.post("/password/reset")
async def bulk_password_reset(
    reset_data: BulkPasswordResetRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        if not reset_data.user_nos:
            raise HTTPException(status_code=400, detail="대상 사용자가 없습니다.")

        company_cd = get_company_cd()
        user_nos = list(reset_data.user_nos)
        placeholders = ",".join([f":user_no_{i}" for i in range(len(user_nos))])
        params = {f"user_no_{i}": user_nos[i] for i in range(len(user_nos))}
        params["company_cd"] = company_cd
        users = db.execute(
            text(f"SELECT user_no, login_id FROM users WHERE company_cd = :company_cd AND user_no IN ({placeholders})"),
            params
        ).fetchall()

        if not users:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        updated_by = (reset_data.updated_by or current_user.get("login_id") or "").strip() or None
        updated_users = 0
        skipped_users = 0

        for user in users:
            user_no, login_id = user
            normalized_login_id = (login_id or "").strip()
            if not normalized_login_id:
                skipped_users += 1
                app_logger.warning(f"⚠️ 비밀번호 리셋 스킵: 빈 login_id (user_no={user_no})")
                continue

            new_password = get_password_hash(normalized_login_id)
            db.execute(
                text("""
                    UPDATE users
                    SET password = :password, updated_by = :updated_by
                    WHERE company_cd = :company_cd
                      AND user_no = :user_no
                """),
                {
                    "password": new_password,
                    "updated_by": updated_by or normalized_login_id,
                    "user_no": user_no,
                    "company_cd": company_cd
                }
            )
            updated_users += 1

        db.commit()
        return {
            "success": True,
            "count": updated_users,
            "skipped": skipped_users
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 비밀번호 일괄 리셋 실패: {e}")
        raise HTTPException(status_code=500, detail=f"비밀번호 일괄 리셋 실패: {str(e)}")
