# -*- coding: utf-8 -*-
"""
게시판(공지) API
"""
from typing import Optional, List
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_company_cd
from app.core.security import get_current_user
from app.core.logger import app_logger

router = APIRouter()


class NoticeCreateRequest(BaseModel):
    title: str
    content: str
    category: Optional[str] = "GENERAL"
    is_fixed: Optional[str] = "N"
    status: Optional[str] = "NORMAL"
    hashtags: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class NoticeUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_fixed: Optional[str] = None
    status: Optional[str] = None
    hashtags: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class NoticeReplyCreateRequest(BaseModel):
    content: str
    parent_reply_id: Optional[int] = None


class NoticeFileAttachRequest(BaseModel):
    file_ids: list[int]


class NoticeReactionRequest(BaseModel):
    reaction: str


def _normalize_flag(value: Optional[str]) -> str:
    if value is None:
        return "N"
    if isinstance(value, str):
        return "Y" if value.strip().upper() == "Y" else "N"
    return "N"


def _is_admin(user: dict) -> bool:
    return (user.get("role") or "").upper() == "ADMIN"


def _get_login_id(user: dict) -> str:
    return (user.get("login_id") or "").strip()


def _normalize_status(value: Optional[str]) -> str:
    if not value:
        return "NORMAL"
    key = value.strip().upper()
    return key if key in {"NORMAL", "IN_PROGRESS", "DONE", "HOLD"} else "NORMAL"


def _parse_hashtags(value: Optional[str]) -> List[str]:
    if not value:
        return []
    tokens = re.split(r"[\s,]+", value)
    seen = set()
    result = []
    for token in tokens:
        token = token.strip()
        if not token:
            continue
        if token.startswith("#"):
            token = token[1:]
        token = token.strip()
        if not token:
            continue
        token = token.lower()
        if token in seen:
            continue
        seen.add(token)
        result.append(token)
    return result


def _normalize_hashtags(value: Optional[str]) -> str:
    tags = _parse_hashtags(value)
    return " ".join([f"#{tag}" for tag in tags])


def _sync_notice_tags(db: Session, company_cd: str, notice_id: int, hashtags: Optional[str]) -> None:
    tags = _parse_hashtags(hashtags)
    db.execute(text("""
        DELETE FROM board_notice_tags
        WHERE company_cd = :company_cd
          AND notice_id = :notice_id
    """), {"company_cd": company_cd, "notice_id": notice_id})
    if not tags:
        return
    rows = [
        {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "tag": tag
        }
        for tag in tags
    ]
    db.execute(text("""
        INSERT INTO board_notice_tags (company_cd, notice_id, tag)
        VALUES (:company_cd, :notice_id, :tag)
    """), rows)


@router.get("/list")
async def list_notices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search_field: Optional[str] = Query(None),
    search_text: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    active_only: Optional[bool] = Query(False),
    author: Optional[str] = Query(None),
    created_from: Optional[str] = Query(None),
    created_to: Optional[str] = Query(None),
    has_files: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_dir: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        where = ["n.company_cd = :company_cd"]
        params = {"company_cd": company_cd}

        if category:
            where.append("n.category = :category")
            params["category"] = category

        if search_text:
            field_map = {
                "title": "n.title",
                "content": "n.content",
                "author_id": "n.author_id",
                "author_name": "u.user_name"
            }
            target = field_map.get(search_field or "title", "n.title")
            where.append(f"{target} LIKE :search")
            params["search"] = f"%{search_text}%"

        if active_only:
            where.append("(n.start_date IS NULL OR n.start_date <= CURDATE())")
            where.append("(n.end_date IS NULL OR n.end_date >= CURDATE())")

        if author:
            where.append("(u.user_name LIKE :author OR n.author_id LIKE :author)")
            params["author"] = f"%{author}%"

        if created_from:
            where.append("DATE(n.created_at) >= :created_from")
            params["created_from"] = created_from
        if created_to:
            where.append("DATE(n.created_at) <= :created_to")
            params["created_to"] = created_to

        if has_files:
            has_files_upper = str(has_files).upper()
            if has_files_upper == "Y":
                where.append("""
                    EXISTS (
                        SELECT 1
                        FROM board_notice_files bf
                        WHERE bf.company_cd = n.company_cd
                          AND bf.notice_id = n.notice_id
                    )
                """)
            elif has_files_upper == "N":
                where.append("""
                    NOT EXISTS (
                        SELECT 1
                        FROM board_notice_files bf
                        WHERE bf.company_cd = n.company_cd
                          AND bf.notice_id = n.notice_id
                    )
                """)

        if status:
            where.append("n.status = :status")
            params["status"] = _normalize_status(status)

        tag_list = _parse_hashtags(tags) if tags else []
        if tag_list:
            where.append("""
                EXISTS (
                    SELECT 1
                    FROM board_notice_tags t
                    WHERE t.company_cd = n.company_cd
                      AND t.notice_id = n.notice_id
                      AND t.tag IN :tags
                )
            """)
            params["tags"] = tag_list

        where_sql = " AND ".join(where) if where else "1=1"

        count_stmt = text(f"""
            SELECT COUNT(*)
            FROM board_notices n
            LEFT JOIN users u
              ON u.login_id = n.author_id
             AND u.company_cd = n.company_cd
            WHERE {where_sql}
        """)
        if tag_list:
            count_stmt = count_stmt.bindparams(bindparam("tags", expanding=True))
        count_row = db.execute(count_stmt, params).fetchone()
        total_records = int(count_row[0]) if count_row else 0
        total_pages = (total_records + page_size - 1) // page_size or 1
        offset = (page - 1) * page_size
        params.update({"limit": page_size, "offset": offset})

        order_by = "n.is_fixed DESC, n.created_at DESC, n.notice_id DESC"
        if sort_field:
            field_map = {
                "notice_id": "n.notice_id",
                "title": "n.title",
                "category": "n.category",
                "status": "n.status",
                "author_name": "u.user_name",
                "start_date": "n.start_date",
                "end_date": "n.end_date",
                "view_count": "n.view_count",
                "created_at": "n.created_at",
            }
            target = field_map.get(sort_field)
            if target:
                direction = "DESC" if (sort_dir or "").lower() == "desc" else "ASC"
                order_by = f"{target} {direction}"

        list_stmt = text(f"""
            SELECT
                n.notice_id,
                n.title,
                n.category,
                n.status,
                n.is_fixed,
                n.author_id,
                u.user_name AS author_name,
                n.start_date,
                n.end_date,
                n.view_count,
                n.created_at,
                COALESCE(r.reply_count, 0) AS reply_count,
                CASE WHEN af.attach_count > 0 THEN 'Y' ELSE 'N' END AS has_attachments
            FROM board_notices n
            LEFT JOIN users u
              ON u.login_id = n.author_id
             AND u.company_cd = n.company_cd
            LEFT JOIN (
                SELECT company_cd, notice_id, COUNT(*) AS reply_count
                FROM board_notice_replies
                GROUP BY company_cd, notice_id
            ) r
              ON r.company_cd = n.company_cd
             AND r.notice_id = n.notice_id
            LEFT JOIN (
                SELECT company_cd, notice_id, COUNT(*) AS attach_count
                FROM board_notice_files
                GROUP BY company_cd, notice_id
            ) af
              ON af.company_cd = n.company_cd
             AND af.notice_id = n.notice_id
            WHERE {where_sql}
            ORDER BY {order_by}
            LIMIT :limit OFFSET :offset
        """)
        if tag_list:
            list_stmt = list_stmt.bindparams(bindparam("tags", expanding=True))
        rows = db.execute(list_stmt, params).fetchall()

        items = [dict(r._mapping) for r in rows]
        return {
            "items": items,
            "total_records": total_records,
            "total_pages": total_pages,
            "current_page": page,
            "page_size": page_size
        }
    except Exception as e:
        app_logger.error(f"❌ 게시판 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notice_id}")
async def get_notice(
    notice_id: int,
    increase_view: bool = Query(True),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        if increase_view:
            db.execute(text("""
                UPDATE board_notices
                SET view_count = view_count + 1
                WHERE company_cd = :company_cd
                  AND notice_id = :notice_id
            """), {"company_cd": company_cd, "notice_id": notice_id})
            login_id = _get_login_id(current_user)
            if login_id:
                db.execute(text("""
                    INSERT IGNORE INTO board_notice_reads (
                        company_cd, notice_id, reader_id
                    ) VALUES (
                        :company_cd, :notice_id, :reader_id
                    )
                """), {"company_cd": company_cd, "notice_id": notice_id, "reader_id": login_id})
            db.commit()

        row = db.execute(text("""
            SELECT
                n.notice_id,
                n.title,
                n.content,
                n.category,
                n.status,
                n.hashtags,
                n.is_fixed,
                n.author_id,
                u.user_name AS author_name,
                n.start_date,
                n.end_date,
                n.view_count,
                n.created_at,
                n.updated_at
            FROM board_notices n
            LEFT JOIN users u
              ON u.login_id = n.author_id
             AND u.company_cd = n.company_cd
            WHERE n.company_cd = :company_cd
              AND n.notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

        can_edit = _is_admin(current_user) or (row.author_id == current_user.get("login_id"))
        data = dict(row._mapping)
        data["can_edit"] = can_edit
        return data
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"❌ 게시글 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notice_id}/reads")
async def get_notice_reads(
    notice_id: int,
    include_users: Optional[bool] = Query(False),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        count_row = db.execute(text("""
            SELECT COUNT(*)
            FROM board_notice_reads
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()
        count = int(count_row[0]) if count_row else 0
        if not include_users:
            return {"count": count}

        rows = db.execute(text("""
            SELECT
                r.reader_id,
                u.user_name AS reader_name,
                r.created_at
            FROM board_notice_reads r
            LEFT JOIN users u
              ON u.company_cd = r.company_cd
             AND u.login_id = r.reader_id
            WHERE r.company_cd = :company_cd
              AND r.notice_id = :notice_id
            ORDER BY r.created_at DESC
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchall()
        items = [dict(row._mapping) for row in rows]
        return {"count": count, "items": items}
    except Exception as e:
        app_logger.error(f"❌ 읽음 수 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notice_id}/reactions")
async def get_notice_reactions(
    notice_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        rows = db.execute(text("""
            SELECT reaction, COUNT(*) AS cnt
            FROM board_notice_reactions
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
            GROUP BY reaction
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchall()
        counts = {row.reaction: int(row.cnt) for row in rows}

        user_rows = db.execute(text("""
            SELECT reaction
            FROM board_notice_reactions
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
              AND user_id = :user_id
        """), {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "user_id": _get_login_id(current_user)
        }).fetchall()
        user_reactions = [row.reaction for row in user_rows]

        return {"counts": counts, "user_reactions": user_reactions}
    except Exception as e:
        app_logger.error(f"❌ 반응 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{notice_id}/reactions")
async def toggle_notice_reaction(
    notice_id: int,
    request: NoticeReactionRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        reaction = (request.reaction or "").strip().upper()
        if reaction not in {"LIKE", "CHECK"}:
            raise HTTPException(status_code=400, detail="invalid reaction")

        user_id = _get_login_id(current_user)
        exists = db.execute(text("""
            SELECT 1
            FROM board_notice_reactions
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
              AND user_id = :user_id
              AND reaction = :reaction
        """), {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "user_id": user_id,
            "reaction": reaction
        }).fetchone()

        if exists:
            db.execute(text("""
                DELETE FROM board_notice_reactions
                WHERE company_cd = :company_cd
                  AND notice_id = :notice_id
                  AND user_id = :user_id
                  AND reaction = :reaction
            """), {
                "company_cd": company_cd,
                "notice_id": notice_id,
                "user_id": user_id,
                "reaction": reaction
            })
        else:
            db.execute(text("""
                INSERT INTO board_notice_reactions (
                    company_cd, notice_id, user_id, reaction
                ) VALUES (
                    :company_cd, :notice_id, :user_id, :reaction
                )
            """), {
                "company_cd": company_cd,
                "notice_id": notice_id,
                "user_id": user_id,
                "reaction": reaction
            })
        db.commit()

        rows = db.execute(text("""
            SELECT reaction, COUNT(*) AS cnt
            FROM board_notice_reactions
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
            GROUP BY reaction
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchall()
        counts = {row.reaction: int(row.cnt) for row in rows}

        user_rows = db.execute(text("""
            SELECT reaction
            FROM board_notice_reactions
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
              AND user_id = :user_id
        """), {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "user_id": user_id
        }).fetchall()
        user_reactions = [row.reaction for row in user_rows]

        return {"counts": counts, "user_reactions": user_reactions}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 반응 처리 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_notice(
    request: NoticeCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        title = (request.title or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="title is required")

        normalized_status = _normalize_status(request.status)
        normalized_hashtags = _normalize_hashtags(request.hashtags)

        db.execute(text("""
            INSERT INTO board_notices (
                company_cd, title, content, category, status, hashtags, is_fixed,
                author_id, start_date, end_date, created_by, updated_by
            ) VALUES (
                :company_cd, :title, :content, :category, :status, :hashtags, :is_fixed,
                :author_id, :start_date, :end_date, :created_by, :updated_by
            )
        """), {
            "company_cd": company_cd,
            "title": title,
            "content": request.content or "",
            "category": (request.category or "GENERAL").strip(),
            "status": normalized_status,
            "hashtags": normalized_hashtags,
            "is_fixed": _normalize_flag(request.is_fixed),
            "author_id": current_user.get("login_id"),
            "start_date": request.start_date,
            "end_date": request.end_date,
            "created_by": current_user.get("login_id"),
            "updated_by": current_user.get("login_id")
        })
        db.commit()

        notice_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        _sync_notice_tags(db, company_cd, int(notice_id), normalized_hashtags)
        db.commit()
        return {"notice_id": notice_id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 게시글 등록 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{notice_id}")
async def update_notice(
    notice_id: int,
    request: NoticeUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        row = db.execute(text("""
            SELECT author_id
            FROM board_notices
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
        if not (_is_admin(current_user) or row.author_id == current_user.get("login_id")):
            raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

        normalized_status = _normalize_status(request.status) if request.status is not None else None
        normalized_hashtags = _normalize_hashtags(request.hashtags) if request.hashtags is not None else None

        db.execute(text("""
            UPDATE board_notices
            SET title = COALESCE(:title, title),
                content = COALESCE(:content, content),
                category = COALESCE(:category, category),
                status = COALESCE(:status, status),
                hashtags = COALESCE(:hashtags, hashtags),
                is_fixed = COALESCE(:is_fixed, is_fixed),
                start_date = :start_date,
                end_date = :end_date,
                updated_by = :updated_by
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "title": request.title,
            "content": request.content,
            "category": request.category,
            "status": normalized_status,
            "hashtags": normalized_hashtags,
            "is_fixed": _normalize_flag(request.is_fixed) if request.is_fixed is not None else None,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "updated_by": current_user.get("login_id")
        })
        if request.hashtags is not None:
            _sync_notice_tags(db, company_cd, notice_id, normalized_hashtags)
        db.commit()
        return {"success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 게시글 수정 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notice_id}")
async def delete_notice(
    notice_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        row = db.execute(text("""
            SELECT author_id
            FROM board_notices
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
        if not (_is_admin(current_user) or row.author_id == current_user.get("login_id")):
            raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

        db.execute(text("""
            DELETE FROM board_notices
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id})
        db.commit()
        return {"success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 게시글 삭제 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notice_id}/replies")
async def list_notice_replies(
    notice_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        count_row = db.execute(text("""
            SELECT COUNT(*)
            FROM board_notice_replies r
            WHERE r.company_cd = :company_cd
              AND r.notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()
        total_records = int(count_row[0]) if count_row else 0
        total_pages = (total_records + page_size - 1) // page_size or 1
        offset = (page - 1) * page_size

        rows = db.execute(text("""
            SELECT
                r.reply_id,
                r.notice_id,
                r.parent_reply_id,
                r.author_id,
                u.user_name AS author_name,
                r.content,
                r.created_at,
                bf.file_id,
                uf.original_name,
                uf.file_url,
                uf.file_size
            FROM (
                SELECT *
                FROM board_notice_replies
                WHERE company_cd = :company_cd
                  AND notice_id = :notice_id
                ORDER BY created_at DESC, reply_id DESC
                LIMIT :limit OFFSET :offset
            ) r
            LEFT JOIN users u
              ON u.company_cd = r.company_cd
             AND u.login_id = r.author_id
            LEFT JOIN board_notice_files bf
              ON bf.company_cd = r.company_cd
             AND bf.reply_id = r.reply_id
            LEFT JOIN uploaded_files uf
              ON uf.company_cd = bf.company_cd
             AND uf.file_id = bf.file_id
            ORDER BY r.created_at DESC, r.reply_id DESC, bf.file_id ASC
        """), {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "limit": page_size,
            "offset": offset
        }).fetchall()

        replies = {}
        for row in rows:
            data = row._mapping
            reply_id = data["reply_id"]
            if reply_id not in replies:
                replies[reply_id] = {
                    "reply_id": reply_id,
                    "notice_id": data["notice_id"],
                    "parent_reply_id": data["parent_reply_id"],
                    "author_id": data["author_id"],
                    "author_name": data["author_name"],
                    "content": data["content"],
                    "created_at": data["created_at"],
                    "attachments": []
                }
            if data["file_id"]:
                replies[reply_id]["attachments"].append({
                    "file_id": data["file_id"],
                    "file_name": data["original_name"],
                    "file_url": data["file_url"],
                    "file_size": data["file_size"]
                })

        items = list(replies.values())
        return {
            "items": items,
            "total_records": total_records,
            "total_pages": total_pages,
            "current_page": page,
            "page_size": page_size
        }
    except Exception as e:
        app_logger.error(f"❌ 답글 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{notice_id}/replies")
async def create_notice_reply(
    notice_id: int,
    request: NoticeReplyCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        author_id = _get_login_id(current_user)
        content = (request.content or "").strip()
        if not content:
            raise HTTPException(status_code=400, detail="content is required")

        exists = db.execute(text("""
            SELECT 1
            FROM board_notices
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

        parent_reply_id = request.parent_reply_id
        if parent_reply_id:
            parent_row = db.execute(text("""
                SELECT notice_id
                FROM board_notice_replies
                WHERE company_cd = :company_cd
                  AND reply_id = :reply_id
            """), {"company_cd": company_cd, "reply_id": parent_reply_id}).fetchone()
            if not parent_row:
                raise HTTPException(status_code=404, detail="대댓글 대상 답글을 찾을 수 없습니다.")
            if int(parent_row.notice_id) != int(notice_id):
                raise HTTPException(status_code=400, detail="대댓글 대상이 다른 게시글에 속합니다.")

        db.execute(text("""
            INSERT INTO board_notice_replies (
                company_cd, notice_id, parent_reply_id, author_id, content, created_by, updated_by
            ) VALUES (
                :company_cd, :notice_id, :parent_reply_id, :author_id, :content, :created_by, :updated_by
            )
        """), {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "parent_reply_id": parent_reply_id,
            "author_id": author_id,
            "content": content,
            "created_by": author_id,
            "updated_by": author_id
        })
        db.commit()
        reply_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        return {"reply_id": reply_id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 답글 등록 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/replies/{reply_id}")
async def delete_notice_reply(
    reply_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        login_id = _get_login_id(current_user)
        row = db.execute(text("""
            SELECT author_id
            FROM board_notice_replies
            WHERE company_cd = :company_cd
              AND reply_id = :reply_id
        """), {"company_cd": company_cd, "reply_id": reply_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="답글을 찾을 수 없습니다.")
        if row.author_id != login_id:
            raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

        db.execute(text("""
            DELETE FROM board_notice_replies
            WHERE company_cd = :company_cd
              AND reply_id = :reply_id
        """), {"company_cd": company_cd, "reply_id": reply_id})
        db.commit()
        return {"success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 답글 삭제 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notice_id}/files")
async def list_notice_files(
    notice_id: int,
    db: Session = Depends(get_db)
):
    try:
        company_cd = get_company_cd()
        rows = db.execute(text("""
            SELECT
                bf.file_id,
                uf.original_name,
                uf.file_url,
                uf.file_size,
                bf.created_at
            FROM board_notice_files bf
            JOIN uploaded_files uf
              ON uf.company_cd = bf.company_cd
             AND uf.file_id = bf.file_id
            WHERE bf.company_cd = :company_cd
              AND bf.notice_id = :notice_id
              AND bf.reply_id IS NULL
            ORDER BY bf.created_at ASC, bf.file_id ASC
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchall()
        items = [
            {
                "file_id": r.file_id,
                "file_name": r.original_name,
                "file_url": r.file_url,
                "file_size": r.file_size,
                "created_at": r.created_at
            }
            for r in rows
        ]
        return {"items": items, "total": len(items)}
    except Exception as e:
        app_logger.error(f"❌ 첨부 파일 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{notice_id}/files")
async def attach_notice_files(
    notice_id: int,
    request: NoticeFileAttachRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        file_ids = [int(fid) for fid in request.file_ids if fid]
        if not file_ids:
            raise HTTPException(status_code=400, detail="file_ids is required")

        exists = db.execute(text("""
            SELECT 1
            FROM board_notices
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

        stmt = text("""
            INSERT IGNORE INTO board_notice_files (
                company_cd, notice_id, reply_id, file_id, created_by
            )
            SELECT
                :company_cd, :notice_id, NULL, uf.file_id, :created_by
            FROM uploaded_files uf
            WHERE uf.company_cd = :company_cd
              AND uf.file_id IN :file_ids
        """).bindparams(bindparam("file_ids", expanding=True))
        db.execute(stmt, {
            "company_cd": company_cd,
            "notice_id": notice_id,
            "created_by": current_user.get("login_id"),
            "file_ids": file_ids
        })
        db.commit()
        return {"success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 첨부 파일 연결 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{notice_id}/files/{file_id}")
async def delete_notice_file(
    notice_id: int,
    file_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        row = db.execute(text("""
            SELECT author_id
            FROM board_notices
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
        """), {"company_cd": company_cd, "notice_id": notice_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")
        if not (_is_admin(current_user) or row.author_id == current_user.get("login_id")):
            raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")

        db.execute(text("""
            DELETE FROM board_notice_files
            WHERE company_cd = :company_cd
              AND notice_id = :notice_id
              AND reply_id IS NULL
              AND file_id = :file_id
        """), {"company_cd": company_cd, "notice_id": notice_id, "file_id": file_id})
        db.commit()
        return {"success": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 첨부 파일 삭제 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _attach_reply_files_internal(
    reply_id: int,
    request: NoticeFileAttachRequest,
    current_user: dict,
    db: Session,
    notice_id: Optional[int] = None
):
    company_cd = current_user.get("company_cd") or get_company_cd()
    file_ids = [int(fid) for fid in request.file_ids if fid]
    if not file_ids:
        raise HTTPException(status_code=400, detail="file_ids is required")

    reply_row = db.execute(text("""
        SELECT notice_id
        FROM board_notice_replies
        WHERE company_cd = :company_cd
          AND reply_id = :reply_id
    """), {"company_cd": company_cd, "reply_id": reply_id}).fetchone()
    if not reply_row:
        raise HTTPException(status_code=404, detail="답글을 찾을 수 없습니다.")
    if notice_id is not None and int(reply_row.notice_id) != int(notice_id):
        raise HTTPException(status_code=400, detail="답글이 해당 게시글에 속하지 않습니다.")

    stmt = text("""
        INSERT IGNORE INTO board_notice_files (
            company_cd, notice_id, reply_id, file_id, created_by
        )
        SELECT
            :company_cd, :notice_id, :reply_id, uf.file_id, :created_by
        FROM uploaded_files uf
        WHERE uf.company_cd = :company_cd
          AND uf.file_id IN :file_ids
    """).bindparams(bindparam("file_ids", expanding=True))
    db.execute(stmt, {
        "company_cd": company_cd,
        "notice_id": reply_row.notice_id,
        "reply_id": reply_id,
        "created_by": current_user.get("login_id"),
        "file_ids": file_ids
    })
    db.commit()
    return {"success": True}


@router.post("/replies/{reply_id}/files")
async def attach_reply_files(
    reply_id: int,
    request: NoticeFileAttachRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return await _attach_reply_files_internal(reply_id, request, current_user, db)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 답글 첨부 파일 연결 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{notice_id}/replies/{reply_id}/files")
async def attach_reply_files_with_notice(
    notice_id: int,
    reply_id: int,
    request: NoticeFileAttachRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return await _attach_reply_files_internal(reply_id, request, current_user, db, notice_id=notice_id)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 답글 첨부 파일 연결 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
