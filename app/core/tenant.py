# -*- coding: utf-8 -*-
"""
멀티테넌트(company_cd) 컨텍스트 유틸리티
"""
from contextvars import ContextVar
from typing import Optional, Dict, Any
from fastapi import HTTPException, status

from app.core.config import settings


_company_cd_ctx: ContextVar[Optional[str]] = ContextVar("company_cd", default=None)


def set_company_cd(company_cd: Optional[str]) -> None:
    if company_cd:
        _company_cd_ctx.set(company_cd)


def get_company_cd(required: bool = False) -> str:
    company_cd = _company_cd_ctx.get()
    if company_cd:
        return company_cd
    if settings.DEFAULT_COMPANY_CD:
        return settings.DEFAULT_COMPANY_CD
    if required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="company_cd is required"
        )
    return ""


def with_company_cd(params: Optional[Dict[str, Any]] = None, company_cd: Optional[str] = None) -> Dict[str, Any]:
    data = dict(params or {})
    data.setdefault("company_cd", company_cd or get_company_cd())
    return data
