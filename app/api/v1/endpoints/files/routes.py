# -*- coding: utf-8 -*-
"""
파일 업로드 API
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.core.database import get_db
from app.core.tenant import get_company_cd
from app.core.security import get_current_user
from app.core.logger import app_logger

router = APIRouter()

UPLOAD_ROOT = Path(BASE_DIR) / "static" / "uploads"
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
ALLOWED_EXTS = {
    ".pdf", ".xlsx", ".xls", ".doc", ".docx", ".ppt", ".pptx",
    ".txt", ".csv", ".zip", ".hwp",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg",
    ".mp4", ".mov", ".avi", ".mkv", ".mp3", ".wav"
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        company_cd = current_user.get("company_cd") or get_company_cd()
        if not file or not file.filename:
            raise HTTPException(status_code=400, detail="file is required")

        original_name = Path(file.filename).name
        ext = Path(original_name).suffix.lower()
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 확장자입니다.")
        stored_name = f"{uuid.uuid4().hex}{ext}"

        company_dir = UPLOAD_ROOT / company_cd
        company_dir.mkdir(parents=True, exist_ok=True)

        file_path = company_dir / stored_name
        total_bytes = 0
        try:
            with file_path.open("wb") as buffer:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > MAX_UPLOAD_BYTES:
                        raise HTTPException(status_code=413, detail="파일 용량 제한을 초과했습니다.")
                    buffer.write(chunk)
        except HTTPException:
            if file_path.exists():
                file_path.unlink(missing_ok=True)
            raise

        file_size = file_path.stat().st_size if file_path.exists() else total_bytes
        mime_type = file.content_type or ""
        file_url = f"/static/uploads/{company_cd}/{stored_name}"

        result = db.execute(text("""
            INSERT INTO uploaded_files (
                company_cd, original_name, stored_name, file_path, file_url,
                mime_type, file_size, created_by, updated_by
            ) VALUES (
                :company_cd, :original_name, :stored_name, :file_path, :file_url,
                :mime_type, :file_size, :created_by, :updated_by
            )
        """), {
            "company_cd": company_cd,
            "original_name": original_name,
            "stored_name": stored_name,
            "file_path": str(file_path),
            "file_url": file_url,
            "mime_type": mime_type,
            "file_size": file_size,
            "created_by": current_user.get("login_id"),
            "updated_by": current_user.get("login_id")
        })
        file_id = None
        try:
            file_id = result.lastrowid
        except Exception:
            file_id = None
        db.commit()
        if not file_id:
            file_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        if not file_id:
            file_id = db.execute(text("""
                SELECT file_id
                FROM uploaded_files
                WHERE company_cd = :company_cd
                  AND stored_name = :stored_name
                ORDER BY file_id DESC
                LIMIT 1
            """), {"company_cd": company_cd, "stored_name": stored_name}).scalar()

        return {
            "file_id": file_id,
            "url": file_url,
            "file_name": original_name,
            "mime_type": mime_type,
            "size": file_size
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        try:
            if "file_path" in locals() and file_path and file_path.exists():
                file_path.unlink(missing_ok=True)
        except Exception:
            pass
        app_logger.error(f"❌ 파일 업로드 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            await file.close()
        except Exception:
            pass
