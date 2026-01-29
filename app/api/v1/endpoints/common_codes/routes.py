# -*- coding: utf-8 -*-
"""
공통코드 관련 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()


# ============================================
# 공통코드 조회
# ============================================
@router.get("/codes/{group_code}")
async def get_common_codes(
    group_code: str,
    db: Session = Depends(get_db)
):
    """
    공통코드 조회
    
    Args:
        group_code: 공통코드 그룹 (STAGE, FIELD 등)
        
    Returns:
        List[dict]: 공통코드 목록
    """
    try:
        app_logger.info(f"🔍 공통코드 조회 - group_code: {group_code}")
        
        query = text("""
            SELECT 
                group_code,
                code,
                code_name,
                sort_order
            FROM comm_code
            WHERE group_code = :group_code
            ORDER BY sort_order ASC
        """)
        
        result = db.execute(query, {'group_code': group_code})
        rows = result.fetchall()
        
        codes = []
        for row in rows:
            codes.append({
                "group_code": row[0],
                "code": row[1],
                "code_name": row[2],
                "sort_order": row[3]
            })
        
        app_logger.info(f"✅ 공통코드 조회 성공 - {len(codes)}개")
        
        return codes
        
    except Exception as e:
        app_logger.error(f"❌ 공통코드 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"공통코드 조회 중 오류 발생: {str(e)}"
        )


# ============================================
# 담당자(영업 대표) 목록 조회
# ============================================
@router.get("/managers")
async def get_managers(
    db: Session = Depends(get_db)
):
    """
    담당자(영업 대표) 목록 조회
    
    Returns:
        List[dict]: 담당자 목록
    """
    try:
        app_logger.info(f"🔍 담당자 목록 조회")
        
        # 활성 상태이면서 영업 대표인 사용자만 조회
        query = text("""
            SELECT 
                login_id,
                user_name,
                department
            FROM users
            WHERE status = 'ACTIVE'
              AND (is_sales_rep IS NULL OR is_sales_rep = 1)
            ORDER BY user_name ASC
        """)
        
        result = db.execute(query)
        rows = result.fetchall()
        
        # 데이터가 없으면 모든 활성 사용자 반환
        if not rows:
            app_logger.info("📝 영업 대표가 없어 모든 활성 사용자 조회")
            query = text("""
                SELECT 
                    login_id,
                    user_name,
                    department
                FROM users
                WHERE status = 'ACTIVE'
                ORDER BY user_name ASC
            """)
            result = db.execute(query)
            rows = result.fetchall()
        
        managers = []
        for row in rows:
            managers.append({
                "login_id": row[0],
                "user_name": row[1],
                "department": row[2] if row[2] else "",
                "display_name": f"{row[0]} ({row[1]})"
            })
        
        app_logger.info(f"✅ 담당자 목록 조회 성공 - {len(managers)}개")
        
        return managers
        
    except Exception as e:
        app_logger.error(f"❌ 담당자 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"담당자 목록 조회 중 오류 발생: {str(e)}"
        )


# ============================================
# 공통코드 그룹 목록 조회
# ============================================
@router.get("/code-groups")
async def get_code_groups(
    db: Session = Depends(get_db)
):
    """
    공통코드 그룹 목록 조회
    
    Returns:
        List[str]: 그룹 코드 목록
    """
    try:
        app_logger.info(f"🔍 코드 그룹 목록 조회")
        
        query = text("""
            SELECT DISTINCT group_code
            FROM comm_code
            ORDER BY group_code ASC
        """)
        
        result = db.execute(query)
        rows = result.fetchall()
        
        groups = [row[0] for row in rows]
        
        app_logger.info(f"✅ 코드 그룹 조회 성공 - {len(groups)}개")
        
        return groups
        
    except Exception as e:
        app_logger.error(f"❌ 코드 그룹 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"코드 그룹 조회 중 오류 발생: {str(e)}"
        )
