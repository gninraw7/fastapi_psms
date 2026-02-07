# -*- coding: utf-8 -*-
"""
JWT 토큰 및 보안 유틸리티
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db
from ..core.tenant import get_company_cd

# 비밀번호 암호화 컨텍스트
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 스킴
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호 해싱"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    액세스 토큰 생성
    
    Args:
        data: 토큰에 포함할 데이터 (user_id, login_id 등)
        expires_delta: 만료 시간 (기본값: 30분)
    
    Returns:
        JWT 토큰 문자열
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    """
    리프레시 토큰 생성
    
    Args:
        data: 토큰에 포함할 데이터
    
    Returns:
        JWT 리프레시 토큰
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "type": "refresh"
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Dict[str, Any]:
    """
    JWT 토큰 디코딩
    
    Args:
        token: JWT 토큰
    
    Returns:
        토큰 페이로드
    
    Raises:
        HTTPException: 토큰이 유효하지 않은 경우
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 유효하지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    현재 인증된 사용자 정보 가져오기
    
    Args:
        token: JWT 액세스 토큰
        db: 데이터베이스 세션
    
    Returns:
        사용자 정보 딕셔너리
    
    Raises:
        HTTPException: 인증 실패 시
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보를 확인할 수 없습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_token(token)
        login_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        company_cd: str = payload.get("company_cd") or get_company_cd()
        
        if login_id is None or token_type != "access":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    # 데이터베이스에서 사용자 조회
    from sqlalchemy import text
    query = text("""
        SELECT 
            u.user_no,
            u.login_id,
            u.user_name,
            u.role,
            u.email,
            u.org_id,
            o.org_name,
            u.status
        FROM users u
        LEFT JOIN org_units o 
          ON o.org_id = u.org_id
         AND o.company_cd = u.company_cd
        WHERE u.company_cd = :company_cd
          AND u.login_id = :login_id 
          AND u.status = 'ACTIVE'
    """)
    
    result = db.execute(query, {"login_id": login_id, "company_cd": company_cd}).fetchone()
    
    if result is None:
        raise credentials_exception
    
    return {
        "user_no": result[0],
        "login_id": result[1],
        "user_name": result[2],
        "role": result[3],
        "email": result[4],
        "org_id": result[5],
        "org_name": result[6],
        "status": result[7],
        "company_cd": company_cd
    }

async def get_current_active_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    활성 상태 사용자만 허용
    """
    if current_user["status"] != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성 계정입니다"
        )
    return current_user

def check_admin_role(current_user: dict = Depends(get_current_user)) -> dict:
    """
    관리자 권한 확인
    """
    if current_user["role"] not in ["ADMIN", "Admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다"
        )
    return current_user
