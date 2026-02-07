# -*- coding: utf-8 -*-
"""
프로젝트 관련 비즈니스 로직
실제 DB 스키마에 맞춰 수정됨
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import math

from app.schemas.project import ProjectListRequest, ProjectListResponse, ProjectItem
from app.core.tenant import get_company_cd

class ProjectService:
    """프로젝트 서비스 클래스"""
    
    @staticmethod
    def get_project_list(db: Session, request: ProjectListRequest) -> ProjectListResponse:
        """
        프로젝트 목록 조회 (페이징, 검색, 필터링)
        
        VBA의 LoadGridData 기능을 대체
        실제 스키마: projects, clients, users, comm_code 테이블 JOIN
        """
        company_cd = get_company_cd()

        # WHERE 조건 생성
        where_clauses = ["p.company_cd = :company_cd"]
        params = {"company_cd": company_cd}
        
        # 검색어 조건 (프로젝트명 또는 고객사명)
        if request.search_text:
            if request.search_field == "project_name":
                where_clauses.append("p.project_name LIKE :search")
                params["search"] = f"%{request.search_text}%"
            elif request.search_field == "customer_name":
                where_clauses.append("(c1.client_name LIKE :search OR c2.client_name LIKE :search)")
                params["search"] = f"%{request.search_text}%"
            else:
                # 기본: 프로젝트명으로 검색
                where_clauses.append("p.project_name LIKE :search")
                params["search"] = f"%{request.search_text}%"
        
        # 사업분야 필터
        if request.field_code:
            where_clauses.append("p.field_code = :field_code")
            params["field_code"] = request.field_code
        
        # 진행단계 필터
        if request.current_stage:
            where_clauses.append("p.current_stage = :current_stage")
            params["current_stage"] = request.current_stage
        
        # 담당자 필터
        if request.manager_id:
            where_clauses.append("p.manager_id = :manager_id")
            params["manager_id"] = request.manager_id
        
        # WHERE 절 조합
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        # 전체 레코드 수 조회
        count_query = f"""
            SELECT COUNT(*) as total
            FROM projects p
            LEFT JOIN clients c1 
              ON p.customer_id = c1.client_id 
             AND c1.company_cd = p.company_cd
            LEFT JOIN clients c2 
              ON p.ordering_party_id = c2.client_id 
             AND c2.company_cd = p.company_cd
            WHERE {where_sql}
        """
        count_result = db.execute(text(count_query), params).fetchone()
        total_records = count_result[0] if count_result else 0
        
        # 총 페이지 수 계산
        total_pages = math.ceil(total_records / request.page_size) if total_records > 0 else 1
        
        # OFFSET 계산
        offset = (request.page - 1) * request.page_size
        params["limit"] = request.page_size
        params["offset"] = offset
        
        # 데이터 조회 쿼리 (실제 스키마 기준)
        data_query = f"""
            SELECT 
                p.pipeline_id,
                p.project_name,
                p.field_code,
                ifield.field_name as field_name,
                p.service_code,
                sc.service_name as service_name,
                p.current_stage,
                cc_stage.code_name as stage_name,
                p.manager_id,
                u.user_name as manager_name,
                p.org_id,
                o.org_name as org_name,
                c1.client_name as customer_name,
                c2.client_name as ordering_party_name,
                p.quoted_amount,
                pc.contract_date,
                pc.start_date,
                pc.end_date,
                pc.order_amount,
                pc.contract_amount,
                p.created_at,
                p.updated_at
            FROM projects p
            LEFT JOIN users u 
              ON p.manager_id = u.login_id
             AND u.company_cd = p.company_cd
            LEFT JOIN org_units o 
              ON p.org_id = o.org_id
             AND o.company_cd = p.company_cd
            LEFT JOIN clients c1 
              ON p.customer_id = c1.client_id
             AND c1.company_cd = p.company_cd
            LEFT JOIN clients c2 
              ON p.ordering_party_id = c2.client_id
             AND c2.company_cd = p.company_cd
            LEFT JOIN project_contracts pc 
              ON p.pipeline_id = pc.pipeline_id
             AND pc.company_cd = p.company_cd
            LEFT JOIN service_codes sc 
              ON p.service_code = sc.service_code
             AND sc.company_cd = p.company_cd
            LEFT JOIN industry_fields ifield
              ON p.field_code = ifield.field_code
             AND ifield.company_cd = p.company_cd
            LEFT JOIN comm_code cc_stage 
              ON p.current_stage = cc_stage.code 
             AND cc_stage.group_code = 'STAGE'
             AND cc_stage.company_cd = p.company_cd
            WHERE {where_sql}
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        
        result = db.execute(text(data_query), params)
        rows = result.fetchall()
        
        # 결과를 ProjectItem으로 변환
        items = []
        if rows:
            columns = result.keys()
            for row in rows:
                item_dict = dict(zip(columns, row))
                items.append(ProjectItem(**item_dict))
        
        return ProjectListResponse(
            total_records=total_records,
            total_pages=total_pages,
            current_page=request.page,
            page_size=request.page_size,
            items=items
        )
    
    @staticmethod
    def get_combo_data(db: Session, group_code: str) -> List[dict]:
        """
        콤보박스 데이터 조회
        
        VBA의 SetMyComboBox 기능을 대체
        """
        company_cd = get_company_cd()
        query = """
            SELECT code, code_name, sort_order
            FROM comm_code
            WHERE company_cd = :company_cd
              AND group_code = :group_code 
              AND is_use = 'Y'
            ORDER BY sort_order
        """
        result = db.execute(text(query), {"group_code": group_code, "company_cd": company_cd})
        rows = result.fetchall()
        
        if rows:
            columns = result.keys()
            return [dict(zip(columns, row)) for row in rows]
        return []
    
    @staticmethod
    def get_managers(db: Session) -> List[dict]:
        """
        담당자 목록 조회 (영업대표만)
        
        VBA의 SetCmbManager 기능을 대체
        """
        company_cd = get_company_cd()
        query = """
            SELECT 
                u.login_id, 
                u.user_name,
                u.org_id,
                o.org_name
            FROM users u
            LEFT JOIN org_units o 
              ON o.org_id = u.org_id
             AND o.company_cd = u.company_cd
            WHERE u.company_cd = :company_cd
              AND is_sales_rep = 1
              AND status = 'ACTIVE'
              AND (end_date IS NULL OR end_date >= CURDATE())
            ORDER BY user_name
        """
        result = db.execute(text(query), {"company_cd": company_cd})
        rows = result.fetchall()
        
        if rows:
            columns = result.keys()
            return [dict(zip(columns, row)) for row in rows]
        return []
