"""
프로젝트 상세 관리 스키마
app/schemas/project_detail.py

버그 수정 (2026-01-30):
- ProjectDetail, ProjectBase: notes, win_probability 필드 추가
- ProjectSaveRequest: notes, win_probability 필드 추가
"""
from datetime import date, datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field


# ============================================
# 프로젝트 기본 정보 스키마
# ============================================
class ProjectBase(BaseModel):
    """프로젝트 기본 정보"""
    project_name: str = Field(..., description="프로젝트명")
    field_code: Optional[str] = Field(None, description="사업분야 코드")
    manager_id: Optional[str] = Field(None, description="담당자 ID")
    customer_id: Optional[int] = Field(None, description="고객사 ID")
    ordering_party_id: Optional[int] = Field(None, description="발주처 ID")
    current_stage: Optional[str] = Field(None, description="현재 진행단계")
    quoted_amount: Optional[Decimal] = Field(default=Decimal('0.00'), description="견적금액")
    win_probability: Optional[int] = Field(None, description="수주확률")  # ✅ 추가
    notes: Optional[str] = Field(None, description="비고")  # ✅ 추가


class ProjectCreate(ProjectBase):
    """프로젝트 생성 요청"""
    created_by: str = Field(..., description="생성자 ID")


class ProjectUpdate(ProjectBase):
    """프로젝트 수정 요청"""
    updated_by: str = Field(..., description="수정자 ID")


class ProjectDetail(ProjectBase):
    """프로젝트 상세 응답 (JOIN 포함)"""
    pipeline_id: str = Field(..., description="파이프라인 ID")
    field_name: Optional[str] = Field(None, description="사업분야명")
    manager_name: Optional[str] = Field(None, description="담당자명")
    customer_name: Optional[str] = Field(None, description="고객사명")
    ordering_party_name: Optional[str] = Field(None, description="발주처명")
    stage_name: Optional[str] = Field(None, description="진행단계명")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================
# 프로젝트 속성 스키마
# ============================================
class ProjectAttributeBase(BaseModel):
    """프로젝트 속성 기본"""
    attr_code: str = Field(..., description="속성 코드")
    attr_value: Optional[str] = Field(None, description="속성 값")


class ProjectAttributeCreate(ProjectAttributeBase):
    """프로젝트 속성 생성"""
    pipeline_id: str = Field(..., description="파이프라인 ID")
    created_by: str = Field(..., description="생성자 ID")


class ProjectAttributeUpdate(BaseModel):
    """프로젝트 속성 수정"""
    attr_value: Optional[str] = Field(None, description="속성 값")
    updated_by: str = Field(..., description="수정자 ID")


class ProjectAttribute(ProjectAttributeBase):
    """프로젝트 속성 응답"""
    pipeline_id: str
    attr_name: Optional[str] = Field(None, description="속성명")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================
# 프로젝트 이력 스키마
# ============================================
class ProjectHistoryBase(BaseModel):
    """프로젝트 이력 기본"""
    base_date: Optional[date] = Field(None, description="기준일자")
    progress_stage: Optional[str] = Field(None, description="진행단계")
    strategy_content: Optional[str] = Field(None, description="영업전략 및 진행상황")


class ProjectHistoryCreate(ProjectHistoryBase):
    """프로젝트 이력 생성"""
    pipeline_id: str = Field(..., description="파이프라인 ID")
    creator_id: str = Field(..., description="작성자 ID")
    created_by: str = Field(..., description="생성자 ID")


class ProjectHistoryUpdate(ProjectHistoryBase):
    """프로젝트 이력 수정"""
    updated_by: str = Field(..., description="수정자 ID")


class ProjectHistory(ProjectHistoryBase):
    """프로젝트 이력 응답"""
    history_id: int
    pipeline_id: str
    record_date: Optional[datetime] = Field(None, description="기록 일시")
    stage_name: Optional[str] = Field(None, description="진행단계명")
    creator_name: Optional[str] = Field(None, description="작성자명")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================
# 통합 응답 스키마
# ============================================
class ProjectFullDetail(BaseModel):
    """프로젝트 전체 상세 정보 (기본+속성+이력)"""
    project: ProjectDetail
    attributes: List[ProjectAttribute] = []
    histories: List[ProjectHistory] = []


# ============================================
# 프로젝트 저장 요청 (통합)
# ============================================
class ProjectSaveRequest(BaseModel):
    """프로젝트 저장 요청 (신규/수정 통합)"""
    pipeline_id: Optional[str] = Field(None, description="파이프라인 ID (수정 시)")
    project_name: str
    field_code: Optional[str] = None
    manager_id: Optional[str] = None
    customer_id: Optional[int] = None
    ordering_party_id: Optional[int] = None
    current_stage: Optional[str] = None
    quoted_amount: Optional[Decimal] = Decimal('0.00')
    win_probability: Optional[int] = Field(None, description="수주확률")  # ✅ 추가
    notes: Optional[str] = Field(None, description="비고")  # ✅ 추가
    
    # 속성 목록 (row_stat: N=신규, U=수정, D=삭제, ""=변경없음)
    attributes: List[dict] = Field(default_factory=list, description="속성 목록")
    
    # 이력 목록
    histories: List[dict] = Field(default_factory=list, description="이력 목록")
    
    user_id: str = Field(..., description="작업자 ID")


class ProjectSaveResponse(BaseModel):
    """프로젝트 저장 응답"""
    success: bool
    pipeline_id: str
    message: str
    attributes_saved: int = 0
    histories_saved: int = 0
