# -*- coding: utf-8 -*-
"""
공통코드 관련 API 엔드포인트
v1/endpoints/common_codes/routes.py

수정 내용:
1. 공통코드 조회 시 is_use = 'Y' 필터 추가
2. 유사한 SQL 패턴 통합 (헬퍼 함수 사용)
3. 응답 형식 표준화 (items 배열)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.logger import app_logger

router = APIRouter()


class CommonCodeCreateRequest(BaseModel):
    group_code: str
    code: str
    code_name: str
    sort_order: Optional[int] = 0
    is_use: Optional[str] = "Y"
    created_by: Optional[str] = None


class CommonCodeBulkItem(BaseModel):
    code: str
    code_name: Optional[str] = None
    sort_order: Optional[int] = 0
    is_use: Optional[str] = "Y"
    row_stat: Optional[str] = None


class CommonCodeBulkRequest(BaseModel):
    group_code: str
    items: List[CommonCodeBulkItem]


# ============================================
# 공통 헬퍼 함수
# ============================================
def execute_query(db: Session, query_str: str, params: dict = None) -> List[dict]:
    """
    SQL 쿼리 실행 및 결과를 딕셔너리 리스트로 반환
    
    Args:
        db: 데이터베이스 세션
        query_str: SQL 쿼리 문자열
        params: 쿼리 파라미터 딕셔너리
        
    Returns:
        List[dict]: 쿼리 결과
    """
    result = db.execute(text(query_str), params or {})
    rows = result.fetchall()
    
    if not rows:
        return []
    
    # 컬럼명 추출
    columns = result.keys()
    return [dict(zip(columns, row)) for row in rows]


def get_comm_codes(db: Session, group_code: str, is_use: str = 'Y') -> List[dict]:
    """
    공통코드 테이블 조회 (통합 함수)
    
    Args:
        db: 데이터베이스 세션
        group_code: 공통코드 그룹
        is_use: 사용여부 ('Y', 'N', None=전체)
        
    Returns:
        List[dict]: 공통코드 목록
    """
    query = """
        SELECT 
            group_code,
            code,
            code_name,
            sort_order,
            is_use
        FROM comm_code
        WHERE group_code = :group_code
    """
    
    params = {'group_code': group_code}
    
    # is_use 필터 조건 추가
    if is_use:
        query += " AND is_use = :is_use"
        params['is_use'] = is_use
    
    query += " ORDER BY sort_order ASC"
    
    return execute_query(db, query, params)


def get_users_by_condition(
    db: Session, 
    is_sales_rep: Optional[bool] = None,
    status: str = 'ACTIVE'
) -> List[dict]:
    """
    사용자 테이블 조회 (통합 함수)
    
    Args:
        db: 데이터베이스 세션
        is_sales_rep: 영업담당자 여부 (None=전체, True=영업담당자만)
        status: 사용자 상태 ('ACTIVE', 'INACTIVE', None=전체)
        
    Returns:
        List[dict]: 사용자 목록
    """
    query = """
        SELECT 
            u.login_id,
            u.user_name,
            u.email,
            u.org_id,
            o.org_name,
            u.is_sales_rep
        FROM users u
        LEFT JOIN org_units o ON o.org_id = u.org_id
        WHERE 1=1
    """
    
    params = {}
    
    # 상태 필터
    if status:
        query += " AND status = :status"
        params['status'] = status
    
    # 영업담당자 필터
    if is_sales_rep is True:
        query += " AND is_sales_rep = 1"
    elif is_sales_rep is False:
        query += " AND (is_sales_rep IS NULL OR is_sales_rep = 0)"
    
    query += " ORDER BY user_name ASC"
    
    return execute_query(db, query, params)


def check_code_in_use(db: Session, group_code: str, code: str) -> bool:
    """
    공통코드 사용 여부 검사 (주요 참조 테이블 기준)
    """
    try:
        if group_code == "FIELD":
            q = text("SELECT COUNT(*) AS cnt FROM projects WHERE field_code = :code")
            return db.execute(q, {"code": code}).fetchone().cnt > 0
        if group_code == "STAGE":
            q1 = text("SELECT COUNT(*) AS cnt FROM projects WHERE current_stage = :code")
            q2 = text("SELECT COUNT(*) AS cnt FROM project_history WHERE progress_stage = :code")
            return (db.execute(q1, {"code": code}).fetchone().cnt > 0) or \
                   (db.execute(q2, {"code": code}).fetchone().cnt > 0)
        if group_code == "ROLE":
            q = text("SELECT COUNT(*) AS cnt FROM users WHERE role = :code")
            return db.execute(q, {"code": code}).fetchone().cnt > 0
        if group_code == "PROJECT_ATTRIBUTE":
            q = text("SELECT COUNT(*) AS cnt FROM project_attributes WHERE attr_code = :code")
            return db.execute(q, {"code": code}).fetchone().cnt > 0
    except Exception:
        # 참조 테이블이 없는 환경에서도 동작하도록 사용중으로 간주하지 않음
        return False
    return False


# ============================================
# 공통코드 조회 (수정: is_use 필터 추가)
# ============================================
@router.get("/codes/{group_code}")
async def get_common_codes(
    group_code: str,
    is_use: Optional[str] = Query('Y', description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db)
):
    """
    공통코드 조회
    
    Args:
        group_code: 공통코드 그룹 (STAGE, FIELD, PROJECT_ATTRIBUTE 등)
        is_use: 사용여부 필터 ('Y'=사용중만, 'N'=미사용만, 빈값=전체)
        
    Returns:
        dict: 공통코드 목록 {group_code, items, total}
        
    Examples:
        GET /common/codes/STAGE
        GET /common/codes/STAGE?is_use=Y
        GET /common/codes/PROJECT_ATTRIBUTE?is_use=
    """
    try:
        app_logger.info(f"🔍 공통코드 조회 - group_code: {group_code}, is_use: {is_use}")
        
        # is_use가 빈 문자열이면 None으로 처리 (전체 조회)
        use_filter = is_use if is_use else None
        
        codes = get_comm_codes(db, group_code, use_filter)
        
        # 표준화된 응답 형식
        items = [
            {
                "code": row['code'],
                "code_name": row['code_name'],
                "sort_order": row['sort_order'],
                "is_use": row['is_use']
            }
            for row in codes
        ]
        
        app_logger.info(f"✅ 공통코드 조회 성공 - {len(items)}개")
        
        return {
            "group_code": group_code,
            "items": items,
            "total": len(items)
        }
        
    except Exception as e:
        app_logger.error(f"❌ 공통코드 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"공통코드 조회 중 오류 발생: {str(e)}"
        )


# ============================================
# 공통코드 등록 (PROJECT_ATTRIBUTE 전용)
# ============================================
@router.post("/codes")
async def create_common_code(
    request: CommonCodeCreateRequest,
    db: Session = Depends(get_db)
):
    try:
        group_code = request.group_code.strip()
        code = request.code.strip()
        code_name = request.code_name.strip()
        sort_order = request.sort_order or 0
        is_use = (request.is_use or "Y").upper()

        if group_code != "PROJECT_ATTRIBUTE":
            raise HTTPException(status_code=400, detail="PROJECT_ATTRIBUTE만 등록 가능합니다.")
        if not code or not code_name:
            raise HTTPException(status_code=400, detail="code와 code_name은 필수입니다.")
        if is_use not in ("Y", "N"):
            raise HTTPException(status_code=400, detail="is_use는 Y 또는 N만 허용됩니다.")

        # 중복 체크
        exists_query = text("""
            SELECT COUNT(*) as cnt
            FROM comm_code
            WHERE group_code = :group_code AND code = :code
        """)
        exists = db.execute(exists_query, {"group_code": group_code, "code": code}).fetchone().cnt
        if exists:
            raise HTTPException(status_code=409, detail="이미 존재하는 코드입니다.")

        insert_query = text("""
            INSERT INTO comm_code (
                group_code, code, code_name, sort_order, is_use, created_by
            ) VALUES (
                :group_code, :code, :code_name, :sort_order, :is_use, :created_by
            )
        """)
        db.execute(insert_query, {
            "group_code": group_code,
            "code": code,
            "code_name": code_name,
            "sort_order": sort_order,
            "is_use": is_use,
            "created_by": request.created_by
        })
        db.commit()

        app_logger.info(f"✅ 공통코드 등록 완료 - {group_code}:{code}")

        return {
            "message": "공통코드가 등록되었습니다.",
            "group_code": group_code,
            "code": code,
            "code_name": code_name
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 공통코드 등록 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"공통코드 등록 실패: {str(e)}")


# ============================================
# 담당자(영업 대표) 목록 조회 (수정: 응답 형식 표준화)
# ============================================
@router.get("/managers")
async def get_managers(
    sales_only: bool = Query(True, description="영업담당자만 조회"),
    db: Session = Depends(get_db)
):
    """
    담당자(영업 대표) 목록 조회
    
    Args:
        sales_only: True=영업담당자만, False=전체 활성 사용자
        
    Returns:
        dict: 담당자 목록 {items, total}
    """
    try:
        app_logger.info(f"🔍 담당자 목록 조회 - sales_only: {sales_only}")
        
        # 영업담당자 조회
        users = get_users_by_condition(
            db, 
            is_sales_rep=True if sales_only else None, 
            status='ACTIVE'
        )
        
        # 영업담당자가 없으면 전체 활성 사용자 반환
        if not users and sales_only:
            app_logger.info("📝 영업 담당자가 없어 모든 활성 사용자 조회")
            users = get_users_by_condition(db, is_sales_rep=None, status='ACTIVE')
        
        # 표준화된 응답 형식 (프론트엔드 호환)
        items = [
            {
                "manager_id": row['login_id'],
                "manager_name": row['user_name'],
                "login_id": row['login_id'],
                "user_name": row['user_name'],
                "email": row['email'] or '',
                "org_id": row['org_id'],
                "org_name": row['org_name'] or '',
                "display_name": f"{row['login_id']} ({row['user_name']})"
            }
            for row in users
        ]
        
        app_logger.info(f"✅ 담당자 목록 조회 성공 - {len(items)}명")
        
        return {
            "items": items,       # 프론트엔드 표준
            "managers": items,    # 기존 호환성
            "total": len(items)
        }
        
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
    is_use: Optional[str] = Query('Y', description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db)
):
    """
    공통코드 그룹 목록 조회
    
    Args:
        is_use: 사용여부 필터
        
    Returns:
        dict: 그룹 코드 목록 {groups, total}
    """
    try:
        app_logger.info(f"🔍 코드 그룹 목록 조회 - is_use: {is_use}")
        
        query = """
            SELECT DISTINCT group_code
            FROM comm_code
            WHERE 1=1
        """
        params = {}
        
        if is_use:
            query += " AND is_use = :is_use"
            params['is_use'] = is_use
        
        query += " ORDER BY group_code ASC"
        
        rows = execute_query(db, query, params)
        groups = [row['group_code'] for row in rows]
        
        app_logger.info(f"✅ 코드 그룹 조회 성공 - {len(groups)}개")
        
        return {
            "groups": groups,
            "total": len(groups)
        }
        
    except Exception as e:
        app_logger.error(f"❌ 코드 그룹 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"코드 그룹 조회 중 오류 발생: {str(e)}"
        )


# ============================================
# 조직 목록 조회
# ============================================
@router.get("/org-units")
async def get_org_units(
    is_use: Optional[str] = Query('Y', description="사용여부 (Y/N, 빈값=전체)"),
    db: Session = Depends(get_db)
):
    try:
        query = """
            SELECT org_id, org_name, org_type, parent_id, is_use
            FROM org_units
            WHERE 1=1
        """
        params = {}
        if is_use:
            query += " AND is_use = :is_use"
            params["is_use"] = is_use
        query += " ORDER BY org_name ASC"
        rows = execute_query(db, query, params)
        return {
            "items": rows,
            "total": len(rows)
        }
    except Exception as e:
        app_logger.error(f"❌ 조직 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"조직 목록 조회 실패: {str(e)}")


# ============================================
# 특정 그룹의 특정 코드 조회 (신규)
# ============================================
@router.get("/codes/{group_code}/{code}")
async def get_single_code(
    group_code: str,
    code: str,
    db: Session = Depends(get_db)
):
    """
    특정 공통코드 단건 조회
    
    Args:
        group_code: 공통코드 그룹
        code: 코드 값
        
    Returns:
        dict: 공통코드 정보
    """
    try:
        app_logger.info(f"🔍 공통코드 단건 조회 - group_code: {group_code}, code: {code}")
        
        query = """
            SELECT 
                group_code,
                code,
                code_name,
                sort_order,
                is_use
            FROM comm_code
            WHERE group_code = :group_code AND code = :code
        """
        
        rows = execute_query(db, query, {'group_code': group_code, 'code': code})
        
        if not rows:
            raise HTTPException(status_code=404, detail="공통코드를 찾을 수 없습니다.")
        
        row = rows[0]
        
        return {
            "group_code": row['group_code'],
            "code": row['code'],
            "code_name": row['code_name'],
            "sort_order": row['sort_order'],
            "is_use": row['is_use']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"❌ 공통코드 단건 조회 실패: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"공통코드 조회 중 오류 발생: {str(e)}"
        )


# ============================================
# 공통코드 일괄 저장
# ============================================
@router.post("/codes/bulk-save")
async def bulk_save_codes(
    request: CommonCodeBulkRequest,
    db: Session = Depends(get_db)
):
    try:
        group_code = request.group_code.strip()
        items = request.items or []

        if not group_code:
            raise HTTPException(status_code=400, detail="group_code는 필수입니다.")

        for item in items:
            row_stat = (item.row_stat or '').upper()
            code = (item.code or '').strip()
            code_name = (item.code_name or '').strip()
            sort_order = item.sort_order or 0
            is_use = (item.is_use or 'Y').upper()

            if not code:
                continue

            if row_stat == 'N':
                insert_query = text("""
                    INSERT INTO comm_code (group_code, code, code_name, sort_order, is_use)
                    VALUES (:group_code, :code, :code_name, :sort_order, :is_use)
                """)
                db.execute(insert_query, {
                    "group_code": group_code,
                    "code": code,
                    "code_name": code_name,
                    "sort_order": sort_order,
                    "is_use": is_use
                })
            elif row_stat == 'U':
                update_query = text("""
                    UPDATE comm_code
                    SET code_name = :code_name,
                        sort_order = :sort_order,
                        is_use = :is_use
                    WHERE group_code = :group_code AND code = :code
                """)
                db.execute(update_query, {
                    "group_code": group_code,
                    "code": code,
                    "code_name": code_name,
                    "sort_order": sort_order,
                    "is_use": is_use
                })
            elif row_stat == 'D':
                if group_code == "GROUP_CODE":
                    # 그룹 삭제 시 상세코드까지 삭제 (사용중이면 차단)
                    detail_rows = execute_query(db, """
                        SELECT code FROM comm_code WHERE group_code = :group_code
                    """, {"group_code": code})
                    for d in detail_rows:
                        if check_code_in_use(db, code, d['code']):
                            raise HTTPException(status_code=400, detail=f"{code} 그룹 코드가 사용 중입니다.")

                    db.execute(text("DELETE FROM comm_code WHERE group_code = :group_code"), {"group_code": code})
                    db.execute(text("DELETE FROM comm_code WHERE group_code = 'GROUP_CODE' AND code = :code"), {"code": code})
                else:
                    if check_code_in_use(db, group_code, code):
                        raise HTTPException(status_code=400, detail="다른 테이블에서 사용 중인 코드입니다.")
                    db.execute(text("""
                        DELETE FROM comm_code WHERE group_code = :group_code AND code = :code
                    """), {"group_code": group_code, "code": code})

        db.commit()
        app_logger.info(f"✅ 공통코드 일괄 저장 완료 - group_code: {group_code}, items: {len(items)}")
        return {"message": "저장되었습니다.", "group_code": group_code}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 공통코드 일괄 저장 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"공통코드 저장 실패: {str(e)}")
