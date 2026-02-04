# -*- coding: utf-8 -*-
"""
프로젝트 관련 Pydantic 스키마
실제 DB 스키마에 맞춰 수정됨
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

class ProjectListRequest(BaseModel):
    """프로젝트 목록 조회 요청"""
    page: int = Field(1, ge=1, description="페이지 번호")
    page_size: int = Field(25, ge=1, le=200, description="페이지당 레코드 수")
    search_field: Optional[str] = Field(None, description="검색 필드 (project_name, customer_name 등)")
    search_text: Optional[str] = Field(None, description="검색어")
    field_code: Optional[str] = Field(None, description="사업분야 코드")
    current_stage: Optional[str] = Field(None, description="현재 진행 단계")
    manager_id: Optional[str] = Field(None, description="담당자 로그인 ID")

class ProjectItem(BaseModel):
    """프로젝트 항목"""
    pipeline_id: str
    project_name: Optional[str] = None
    field_code: Optional[str] = None
    field_name: Optional[str] = None  # 코드명
    service_code: Optional[str] = None
    service_name: Optional[str] = None
    org_id: Optional[int] = None
    org_name: Optional[str] = None
    current_stage: Optional[str] = None
    stage_name: Optional[str] = None  # 단계명
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    customer_name: Optional[str] = None  # JOIN으로 가져옴
    ordering_party_name: Optional[str] = None  # 발주처명
    quoted_amount: Optional[Decimal] = None
    latest_base_date: Optional[date] = None
    latest_history_line: Optional[str] = None
    history_count: Optional[int] = None
    contract_date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    order_amount: Optional[Decimal] = None
    contract_amount: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    """프로젝트 목록 조회 응답"""
    total_records: int
    total_pages: int
    current_page: int
    page_size: int
    items: List[ProjectItem]

class ComboItem(BaseModel):
    """콤보박스 아이템"""
    code: str
    code_name: str
    sort_order: Optional[int] = None

class ComboResponse(BaseModel):
    """콤보박스 데이터 응답"""
    group_code: str
    items: List[ComboItem]

class ManagerItem(BaseModel):
    """담당자 아이템"""
    login_id: str
    user_name: str
    org_id: Optional[int] = None
    org_name: Optional[str] = None

class ManagerResponse(BaseModel):
    """담당자 목록 응답"""
    items: List[ManagerItem]
