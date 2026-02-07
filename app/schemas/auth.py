# -*- coding: utf-8 -*-
"""
인증 관련 Pydantic 스키마
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import date

class LoginRequest(BaseModel):
    """로그인 요청"""
    company_cd: Optional[str] = Field(None, description="회사 코드 (미입력 시 기본값 사용)")
    login_id: str = Field(..., min_length=3, max_length=50, description="로그인 ID")
    password: str = Field(..., min_length=4, description="비밀번호")

class TokenResponse(BaseModel):
    """토큰 응답"""
    access_token: str = Field(..., description="액세스 토큰")
    refresh_token: str = Field(..., description="리프레시 토큰")
    token_type: str = Field(default="bearer", description="토큰 타입")
    expires_in: int = Field(..., description="만료 시간(초)")
    company_cd: str = Field(..., description="회사 코드")
    
class RefreshTokenRequest(BaseModel):
    """리프레시 토큰 요청"""
    refresh_token: str = Field(..., description="리프레시 토큰")

class SwitchCompanyRequest(BaseModel):
    """회사 전환 요청"""
    company_cd: str = Field(..., min_length=1, max_length=20, description="회사 코드")

class UserInfo(BaseModel):
    """사용자 정보"""
    user_no: int
    login_id: str
    user_name: str
    role: str
    is_sales_rep: Optional[bool] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    org_id: Optional[int] = None
    org_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    
    class Config:
        from_attributes = True

class UserProfileUpdate(BaseModel):
    """내정보 수정 요청"""
    user_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    is_sales_rep: Optional[bool] = None

class ChangePasswordRequest(BaseModel):
    """비밀번호 변경 요청"""
    old_password: str = Field(..., min_length=4, description="기존 비밀번호")
    new_password: str = Field(..., min_length=8, description="새 비밀번호")
