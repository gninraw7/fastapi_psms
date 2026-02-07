# -*- coding: utf-8 -*-
"""
거래처 관리 API 엔드포인트 - 완전 버전
app/api/v1/endpoints/clients/routes.py

기존 모든 기능 유지 + 페이징/필터링 기능 강화
검색 개선 (2026-02-01):
- search_field가 없으면 전체 필드 검색 (client_name, business_number, ceo_name, phone)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Form, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.tenant import get_company_cd
from app.core.logger import app_logger

router = APIRouter()


# ============================================
# Request 모델
# ============================================
class ClientCreateRequest(BaseModel):
    """거래처 등록 요청"""
    client_name: str
    business_number: Optional[str] = None
    ceo_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None
    homepage: Optional[str] = None
    industry_type: Optional[str] = None
    employee_count: Optional[int] = None
    established_date: Optional[str] = None
    is_active: bool = True
    remarks: Optional[str] = None
    created_by: str = "system"


class ClientUpdateRequest(BaseModel):
    """거래처 수정 요청"""
    client_name: Optional[str] = None
    business_number: Optional[str] = None
    ceo_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    fax: Optional[str] = None
    homepage: Optional[str] = None
    industry_type: Optional[str] = None
    employee_count: Optional[int] = None
    established_date: Optional[str] = None
    is_active: Optional[bool] = None
    remarks: Optional[str] = None
    updated_by: str = "system"


# ============================================
# 거래처 목록 조회 (페이징 + 강화된 필터링) - 검색 로직 개선
# ============================================
@router.get("/list")
async def get_clients_list(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(25, ge=1, le=200, description="페이지 크기"),
    search_field: Optional[str] = Query(None, description="검색 필드 (client_name, business_number, ceo_name, phone)"),
    search_text: Optional[str] = Query(None, description="검색어"),
    industry_type: Optional[str] = Query(None, description="업종 필터"),
    is_active: Optional[bool] = Query(None, description="활성 상태 필터"),
    sort_field: Optional[str] = Query(None, description="정렬 필드"),
    sort_dir: Optional[str] = Query(None, description="정렬 방향 (asc/desc)"),
    db: Session = Depends(get_db)
):
    """
    거래처 목록 조회 (페이징, 다중 필터, 통계 포함)
    
    ⭐ 개선: search_field가 없으면 전체 필드 검색
    
    Args:
        page: 페이지 번호 (기본: 1)
        page_size: 페이지 크기 (기본: 25, 최대: 200)
        search_field: 검색 필드 선택 (없으면 전체 검색)
        search_text: 검색어
        industry_type: 업종 필터
        is_active: 활성 상태 필터
        db: 데이터베이스 세션
    
    Returns:
        dict: {items, total, page, page_size, total_pages, active_count, inactive_count, filtered_count}
    """
    try:
        app_logger.info(
            f"📋 거래처 목록 조회 - page: {page}, size: {page_size}, "
            f"field: {search_field}, text: {search_text}, "
            f"sort_field: {sort_field}, sort_dir: {sort_dir}"
        )
        company_cd = get_company_cd()
        
        # 기본 쿼리
        base_query = """
            SELECT 
                c.client_id,
                c.client_name,
                c.business_number,
                c.ceo_name,
                c.address,
                c.phone,
                c.email,
                c.fax,
                c.homepage,
                c.industry_type,
                f.field_name as industry_name,
                c.employee_count,
                c.established_date,
                c.is_active,
                c.remarks,
                c.created_at,
                c.updated_at
            FROM clients c
            LEFT JOIN industry_fields f 
              ON f.field_code = c.industry_type
             AND f.company_cd = c.company_cd
            WHERE c.company_cd = :company_cd
        """
        
        count_query = "SELECT COUNT(*) as total FROM clients c WHERE c.company_cd = :company_cd"
        
        # 통계 쿼리
        stats_query = """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 OR is_active IS NULL THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_count
            FROM clients
            WHERE company_cd = :company_cd
        """
        
        params = {"company_cd": company_cd}
        filter_condition = ""
        
        # ===================================
        # ⭐ 검색 조건 개선 (전체 필드 검색 지원)
        # ===================================
        if search_text and search_text.strip():
            search_value = f"%{search_text.strip()}%"
            
            if search_field:
                # 특정 필드 검색
                if search_field == "client_name":
                    filter_condition += " AND c.client_name LIKE :search"
                elif search_field == "business_number":
                    filter_condition += " AND c.business_number LIKE :search"
                elif search_field == "ceo_name":
                    filter_condition += " AND c.ceo_name LIKE :search"
                elif search_field == "phone":
                    filter_condition += " AND c.phone LIKE :search"
                else:
                    # 알 수 없는 필드는 전체 검색으로 처리
                    filter_condition += """
                        AND (
                            c.client_name LIKE :search
                            OR c.business_number LIKE :search
                            OR c.ceo_name LIKE :search
                            OR c.phone LIKE :search
                        )
                    """
            else:
                # ⭐ search_field가 없으면 전체 필드 검색
                filter_condition += """
                    AND (
                        c.client_name LIKE :search
                        OR c.business_number LIKE :search
                        OR c.ceo_name LIKE :search
                        OR c.phone LIKE :search
                    )
                """
            
            params['search'] = search_value
        
        # ===================================
        # 업종 필터
        # ===================================
        if industry_type:
            filter_condition += " AND c.industry_type = :industry_type"
            params['industry_type'] = industry_type
        
        # ===================================
        # 활성 상태 필터
        # ===================================
        if is_active is not None:
            if is_active:
                filter_condition += " AND (c.is_active = 1 OR c.is_active IS NULL)"
            else:
                filter_condition += " AND c.is_active = 0"
        
        # 쿼리 완성
        base_query += filter_condition
        count_query += filter_condition
        
        # 정렬 및 페이징
        allowed_sort_fields = {
            "client_id": "c.client_id",
            "client_name": "c.client_name",
            "business_number": "c.business_number",
            "ceo_name": "c.ceo_name",
            "industry_type": "c.industry_type",
            "industry_name": "f.field_name",
            "phone": "c.phone",
            "email": "c.email",
            "employee_count": "c.employee_count",
            "established_date": "c.established_date",
            "created_at": "c.created_at",
            "updated_at": "c.updated_at"
        }
        if sort_field in allowed_sort_fields:
            direction = "ASC" if (sort_dir or "").lower() == "asc" else "DESC"
            base_query += f" ORDER BY {allowed_sort_fields[sort_field]} {direction}"
        else:
            base_query += " ORDER BY created_at DESC, client_id DESC"
        offset = (page - 1) * page_size
        base_query += f" LIMIT {page_size} OFFSET {offset}"
        
        app_logger.debug(f"📡 Query: {base_query}")
        app_logger.debug(f"📡 Params: {params}")
        
        # ===================================
        # 데이터 조회
        # ===================================
        result = db.execute(text(base_query), params)
        rows = result.fetchall()
        
        # 전체 개수 조회
        count_result = db.execute(text(count_query), params)
        total = count_result.fetchone()[0]
        
        # 통계 조회
        stats_result = db.execute(text(stats_query), {"company_cd": company_cd})
        stats = stats_result.fetchone()
        
        # ===================================
        # 데이터 변환
        # ===================================
        items = []
        for row in rows:
            data = row._mapping
            items.append({
                'client_id': data.get('client_id'),
                'client_name': data.get('client_name') or '',
                'business_number': data.get('business_number') or '',
                'ceo_name': data.get('ceo_name') or '',
                'address': data.get('address') or '',
                'phone': data.get('phone') or '',
                'email': data.get('email') or '',
                'fax': data.get('fax') or '',
                'homepage': data.get('homepage') or '',
                'industry_type': data.get('industry_type') or '',
                'industry_name': data.get('industry_name') or '',
                'employee_count': data.get('employee_count'),
                'established_date': data.get('established_date').isoformat() if data.get('established_date') else None,
                'is_active': bool(data.get('is_active')) if data.get('is_active') is not None else True,
                'remarks': data.get('remarks') or '',
                'created_at': data.get('created_at').isoformat() if data.get('created_at') else None,
                'updated_at': data.get('updated_at').isoformat() if data.get('updated_at') else None,
            })
        
        # 페이지 계산
        total_pages = (total + page_size - 1) // page_size
        
        app_logger.info(f"✅ 거래처 목록 조회 성공 - {len(items)}개 (total: {total})")
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "active_count": int(stats[1] or 0),
            "inactive_count": int(stats[2] or 0),
            "filtered_count": total
        }
        
    except Exception as e:
        app_logger.error(f"❌ 거래처 목록 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"거래처 목록 조회 실패: {str(e)}")


# ============================================
# 거래처 간단 검색 (프로젝트 폼용) - 기존 유지
# ============================================
@router.get("/search/simple")
async def search_clients_simple(
    search_text: str = Query("", description="검색어 (고객사명)"),
    db: Session = Depends(get_db)
):
    """
    거래처 간단 검색 - 프로젝트 생성/수정 폼용
    
    프로젝트 폼의 드롭다운에서 사용하는 간단한 검색 API
    최소한의 필드만 반환하여 성능 최적화
    """
    try:
        app_logger.info(f"🔍 거래처 간단 검색 - search_text: '{search_text}'")
        company_cd = get_company_cd()
        
        # 활성 거래처만 조회, 최소 필드만
        query_str = """
            SELECT 
                client_id,
                client_name,
                business_number,
                is_active
            FROM clients
            WHERE company_cd = :company_cd
              AND (is_active IS NULL OR is_active = 1)
        """
        
        params = {"company_cd": company_cd}
        
        # 검색어가 있으면 필터링
        if search_text and search_text.strip():
            query_str += """
                AND (
                    client_name LIKE :search 
                    OR business_number LIKE :search_exact
                )
                ORDER BY 
                    CASE 
                        WHEN client_name LIKE :search_start THEN 1
                        ELSE 2
                    END,
                    client_name ASC
            """
            search_term = search_text.strip()
            params['search'] = f"%{search_term}%"
            params['search_exact'] = search_term
            params['search_start'] = f"{search_term}%"
        else:
            query_str += " ORDER BY client_name ASC"
        
        # 프로젝트 폼용이므로 최대 100개로 제한
        query_str += " LIMIT 100"
        
        # 쿼리 실행
        result = db.execute(text(query_str), params)
        rows = result.fetchall()
        
        # 간단한 형태로 변환
        clients = []
        for row in rows:
            clients.append({
                'client_id': row[0],
                'client_name': row[1] or '',
                'business_number': row[2] or '',
                'is_active': bool(row[3]) if row[3] is not None else True
            })
        
        app_logger.info(f"✅ 거래처 간단 검색 성공 - {len(clients)}개")
        
        # Flutter 앱이 기대하는 형식으로 직접 반환 (리스트 형태)
        return clients
        
    except Exception as e:
        app_logger.error(f"❌ 거래처 간단 검색 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"거래처 간단 검색 실패: {str(e)}")


# ============================================
# 거래처 검색 (자동완성용) - 기존 유지
# ============================================
@router.get("/search")
async def search_clients(
    search: str = Query("", description="검색어"),
    limit: int = Query(50, ge=1, le=100, description="조회 개수"),
    db: Session = Depends(get_db)
):
    """
    거래처 검색 (자동완성용)
    
    Args:
        search: 검색어 (거래처명, 사업자번호, 대표자명)
        limit: 조회 개수
        db: 데이터베이스 세션
    
    Returns:
        검색된 거래처 목록
    """
    try:
        app_logger.info(f"🔍 거래처 검색 - search: '{search}', limit: {limit}")
        company_cd = get_company_cd()
        
        query_str = """
            SELECT 
                client_id,
                client_name,
                business_number,
                ceo_name,
                phone,
                address,
                email,
                industry_type,
                is_active
            FROM clients
            WHERE company_cd = :company_cd
              AND (is_active IS NULL OR is_active = 1)
        """
        
        params = {'limit': limit, "company_cd": company_cd}
        
        if search and search.strip():
            query_str += """
                AND (
                    client_name LIKE :search 
                    OR business_number LIKE :search_exact
                    OR ceo_name LIKE :search
                )
                ORDER BY 
                    CASE 
                        WHEN client_name LIKE :search_start THEN 1
                        ELSE 2
                    END,
                    client_name ASC
            """
            search_term = search.strip()
            params['search'] = f"%{search_term}%"
            params['search_exact'] = search_term
            params['search_start'] = f"{search_term}%"
        else:
            query_str += " ORDER BY client_name ASC"
        
        query_str += " LIMIT :limit"
        
        # 쿼리 실행
        result = db.execute(text(query_str), params)
        rows = result.fetchall()
        
        # 결과 변환
        clients = []
        for row in rows:
            clients.append({
                'client_id': row[0],
                'client_name': row[1] or '',
                'business_number': row[2] or '',
                'ceo_name': row[3] or '',
                'phone': row[4] or '',
                'address': row[5] or '',
                'email': row[6] or '',
                'industry_type': row[7] or '',
                'is_active': bool(row[8]) if row[8] is not None else True
            })
        
        app_logger.info(f"✅ 거래처 검색 성공 - {len(clients)}개")
        
        return {
            "clients": clients,
            "total": len(clients)
        }
        
    except Exception as e:
        app_logger.error(f"❌ 거래처 검색 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"거래처 검색 실패: {str(e)}")


# ============================================
# 거래처 상세 조회 - 기존 유지
# ============================================
@router.get("/{client_id}")
async def get_client_detail(
    client_id: int,
    db: Session = Depends(get_db)
):
    """
    거래처 상세 정보 조회
    
    Args:
        client_id: 거래처 ID
        db: 데이터베이스 세션
    
    Returns:
        거래처 상세 정보
    """
    try:
        app_logger.info(f"📋 거래처 상세 조회 - client_id: {client_id}")
        company_cd = get_company_cd()
        
        query = text("""
            SELECT 
                c.client_id, c.client_name, c.business_number, c.ceo_name, c.address,
                c.phone, c.email, c.fax, c.homepage, c.industry_type, f.field_name as industry_name,
                c.employee_count, c.established_date, c.is_active, c.remarks, c.created_at, c.updated_at,
                c.created_by, c.updated_by
            FROM clients c
            LEFT JOIN industry_fields f 
              ON f.field_code = c.industry_type
             AND f.company_cd = c.company_cd
            WHERE c.company_cd = :company_cd
              AND c.client_id = :client_id
        """)
        
        result = db.execute(query, {'client_id': client_id, "company_cd": company_cd})
        row = result.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="거래처를 찾을 수 없습니다")
        
        client = {
            'client_id': row[0],
            'client_name': row[1] or '',
            'business_number': row[2] or '',
            'ceo_name': row[3] or '',
            'address': row[4] or '',
            'phone': row[5] or '',
            'email': row[6] or '',
            'fax': row[7] or '',
            'homepage': row[8] or '',
            'industry_type': row[9] or '',
            'industry_name': row[10] or '',
            'employee_count': row[11],
            'established_date': row[12].isoformat() if row[12] else None,
            'is_active': bool(row[13]) if row[13] is not None else True,
            'remarks': row[14] or '',
            'created_at': row[15].isoformat() if row[15] else None,
            'updated_at': row[16].isoformat() if row[16] else None,
            'created_by': row[17] or '',
            'updated_by': row[18] or ''
        }
        
        app_logger.info(f"✅ 거래처 상세 조회 성공")
        return client
        
    except HTTPException:
        raise
    except Exception as e:
        app_logger.error(f"❌ 거래처 상세 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"거래처 조회 실패: {str(e)}")


# ============================================
# 거래처 등록 - 기존 유지
# ============================================
@router.post("")
async def create_client(
    request: ClientCreateRequest,
    db: Session = Depends(get_db)
):
    """
    거래처 등록
    
    Args:
        request: 거래처 등록 요청 (JSON Body)
        db: 데이터베이스 세션
    
    Returns:
        등록된 거래처 ID
    """
    try:
        app_logger.info(f"➕ 거래처 등록 - {request.client_name}")
        company_cd = get_company_cd()
        
        # 중복 체크
        check_query = text("SELECT client_id FROM clients WHERE company_cd = :company_cd AND client_name = :client_name")
        result = db.execute(check_query, {'client_name': request.client_name, "company_cd": company_cd})
        if result.fetchone():
            raise HTTPException(status_code=409, detail="이미 등록된 거래처명입니다")
        
        # INSERT 쿼리
        insert_query = text("""
            INSERT INTO clients (
                company_cd, client_name, business_number, ceo_name, address, phone,
                email, fax, homepage, industry_type, employee_count,
                established_date, is_active, remarks, created_by
            ) VALUES (
                :company_cd, :client_name, :business_number, :ceo_name, :address, :phone,
                :email, :fax, :homepage, :industry_type, :employee_count,
                :established_date, :is_active, :remarks, :created_by
            )
        """)
        
        db.execute(insert_query, {
            'company_cd': company_cd,
            'client_name': request.client_name,
            'business_number': request.business_number,
            'ceo_name': request.ceo_name,
            'address': request.address,
            'phone': request.phone,
            'email': request.email,
            'fax': request.fax,
            'homepage': request.homepage,
            'industry_type': request.industry_type,
            'employee_count': request.employee_count,
            'established_date': request.established_date,
            'is_active': 1 if request.is_active else 0,
            'remarks': request.remarks,
            'created_by': request.created_by
        })
        
        db.commit()
        
        # 등록된 ID 조회
        id_query = text("SELECT LAST_INSERT_ID() as client_id")
        result = db.execute(id_query)
        client_id = result.fetchone()[0]
        
        app_logger.info(f"✅ 거래처 등록 성공 - client_id: {client_id}")
        
        return {
            "message": "거래처가 등록되었습니다",
            "client_id": client_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 거래처 등록 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"거래처 등록 실패: {str(e)}")


# ============================================
# 거래처 수정 - 기존 유지
# ============================================
@router.put("/{client_id}")
async def update_client(
    client_id: int,
    request: ClientUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    거래처 정보 수정
    
    Args:
        client_id: 거래처 ID
        request: 거래처 수정 요청 (JSON Body)
        db: 데이터베이스 세션
    
    Returns:
        수정 결과
    """
    try:
        app_logger.info(f"✏️ 거래처 수정 - client_id: {client_id}")
        company_cd = get_company_cd()
        
        # 존재 여부 확인
        check_query = text("SELECT client_id FROM clients WHERE company_cd = :company_cd AND client_id = :client_id")
        result = db.execute(check_query, {'client_id': client_id, "company_cd": company_cd})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="거래처를 찾을 수 없습니다")
        
        # 수정할 필드만 UPDATE
        update_fields = []
        params = {'client_id': client_id, "company_cd": company_cd}
        
        if request.client_name is not None:
            update_fields.append("client_name = :client_name")
            params['client_name'] = request.client_name
        
        if request.business_number is not None:
            update_fields.append("business_number = :business_number")
            params['business_number'] = request.business_number
        
        if request.ceo_name is not None:
            update_fields.append("ceo_name = :ceo_name")
            params['ceo_name'] = request.ceo_name
        
        if request.address is not None:
            update_fields.append("address = :address")
            params['address'] = request.address
        
        if request.phone is not None:
            update_fields.append("phone = :phone")
            params['phone'] = request.phone
        
        if request.email is not None:
            update_fields.append("email = :email")
            params['email'] = request.email
        
        if request.fax is not None:
            update_fields.append("fax = :fax")
            params['fax'] = request.fax
        
        if request.homepage is not None:
            update_fields.append("homepage = :homepage")
            params['homepage'] = request.homepage
        
        if request.industry_type is not None:
            update_fields.append("industry_type = :industry_type")
            params['industry_type'] = request.industry_type
        
        if request.employee_count is not None:
            update_fields.append("employee_count = :employee_count")
            params['employee_count'] = request.employee_count
        
        if request.established_date is not None:
            update_fields.append("established_date = :established_date")
            params['established_date'] = request.established_date
        
        if request.is_active is not None:
            update_fields.append("is_active = :is_active")
            params['is_active'] = 1 if request.is_active else 0
        
        if request.remarks is not None:
            update_fields.append("remarks = :remarks")
            params['remarks'] = request.remarks
        
        # updated_by 추가
        update_fields.append("updated_by = :updated_by")
        params['updated_by'] = request.updated_by
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다")
        
        query_str = f"""
            UPDATE clients
            SET {', '.join(update_fields)}
            WHERE company_cd = :company_cd
              AND client_id = :client_id
        """
        
        db.execute(text(query_str), params)
        db.commit()
        
        app_logger.info(f"✅ 거래처 수정 성공")
        
        return {
            "message": "거래처 정보가 수정되었습니다",
            "client_id": client_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 거래처 수정 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"거래처 수정 실패: {str(e)}")


# ============================================
# 거래처 삭제 - 기존 유지 (비활성화)
# ============================================
@router.delete("/{client_id}")
async def delete_client(
    client_id: int,
    db: Session = Depends(get_db)
):
    """
    거래처 삭제 (비활성화)
    
    프로젝트 참조를 고려하여 실제 삭제 대신 비활성화 처리
    """
    try:
        app_logger.info(f"🗑️ 거래처 삭제 - client_id: {client_id}")
        company_cd = get_company_cd()
        
        # 존재 여부 확인
        check_query = text("SELECT client_id FROM clients WHERE company_cd = :company_cd AND client_id = :client_id")
        result = db.execute(check_query, {'client_id': client_id, "company_cd": company_cd})
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="거래처를 찾을 수 없습니다")
        
        # 프로젝트 참조 확인
        ref_query = text("""
            SELECT COUNT(*) FROM projects 
            WHERE company_cd = :company_cd
              AND (customer_id = :client_id OR ordering_party_id = :client_id)
        """)
        ref_result = db.execute(ref_query, {'client_id': client_id, "company_cd": company_cd})
        ref_count = ref_result.fetchone()[0]
        
        if ref_count > 0:
            # 프로젝트 참조가 있으면 비활성화만 처리
            app_logger.warning(f"⚠️ 거래처가 {ref_count}개 프로젝트에서 사용 중 - 비활성화 처리")
            query = text("UPDATE clients SET is_active = 0 WHERE company_cd = :company_cd AND client_id = :client_id")
            db.execute(query, {'client_id': client_id, "company_cd": company_cd})
            db.commit()
            
            return {
                "message": f"거래처가 {ref_count}개 프로젝트에서 사용 중이어서 비활성화 처리되었습니다",
                "client_id": client_id,
                "deactivated": True
            }
        else:
            # 참조가 없으면 비활성화 처리 (안전을 위해 삭제하지 않음)
            query = text("UPDATE clients SET is_active = 0 WHERE company_cd = :company_cd AND client_id = :client_id")
            db.execute(query, {'client_id': client_id, "company_cd": company_cd})
            db.commit()
            
            app_logger.info(f"✅ 거래처 삭제(비활성화) 성공")
            
            return {
                "message": "거래처가 삭제되었습니다",
                "client_id": client_id,
                "deactivated": True
            }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error(f"❌ 거래처 삭제 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"거래처 삭제 실패: {str(e)}")
