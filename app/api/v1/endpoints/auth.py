# -*- coding: utf-8 -*-
"""
인증 API 엔드포인트
JWT 토큰 기반 인증
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import timedelta

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user
)
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    UserInfo,
    ChangePasswordRequest
)

router = APIRouter(prefix="/auth", tags=["인증"])

@router.post("/login", response_model=TokenResponse, summary="로그인")
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    사용자 로그인
    
    - **login_id**: 로그인 ID
    - **password**: 비밀번호
    
    Returns:
        TokenResponse: 액세스 토큰 및 리프레시 토큰
    """
    # 사용자 조회
    query = text("""
        SELECT user_no, login_id, password, user_name, role, status
        FROM users
        WHERE login_id = :login_id
    """)
    
    result = db.execute(query, {"login_id": login_data.login_id}).fetchone()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_no, login_id, hashed_password, user_name, role, user_status = result
    
    # 비밀번호 확인
    if not verify_password(login_data.password, hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 계정 상태 확인
    if user_status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다"
        )
    
    # 토큰 생성
    token_data = {
        "sub": login_id,
        "user_no": user_no,
        "user_name": user_name,
        "role": role
    }
    
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)
    
    # 로그인 이력 기록
    try:
        log_query = text("""
            INSERT INTO login_history (login_id, action_type, created_by)
            VALUES (:login_id, 'LOGIN', :created_by)
        """)
        db.execute(log_query, {"login_id": login_id, "created_by": login_id})
        db.commit()
    except Exception as e:
        # 로그 기록 실패해도 로그인은 성공
        print(f"로그인 이력 기록 실패: {e}")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

@router.post("/refresh", response_model=TokenResponse, summary="토큰 갱신")
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    리프레시 토큰을 사용하여 새 액세스 토큰 발급
    
    - **refresh_token**: 리프레시 토큰
    
    Returns:
        TokenResponse: 새 액세스 토큰 및 리프레시 토큰
    """
    try:
        payload = decode_token(refresh_data.refresh_token)
        
        # 토큰 타입 확인
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="잘못된 토큰 타입입니다"
            )
        
        login_id = payload.get("sub")
        
        # 사용자 확인
        query = text("""
            SELECT user_no, user_name, role, status
            FROM users
            WHERE login_id = :login_id
        """)
        
        result = db.execute(query, {"login_id": login_id}).fetchone()
        
        if not result or result[3] != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 사용자입니다"
            )
        
        # 새 토큰 발급
        token_data = {
            "sub": login_id,
            "user_no": result[0],
            "user_name": result[1],
            "role": result[2]
        }
        
        access_token = create_access_token(data=token_data)
        new_refresh_token = create_refresh_token(data=token_data)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"토큰 갱신 실패: {str(e)}"
        )

@router.get("/me", response_model=UserInfo, summary="현재 사용자 정보")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    현재 로그인한 사용자의 정보 조회
    
    Returns:
        UserInfo: 사용자 정보
    """
    return UserInfo(**current_user)

@router.post("/logout", summary="로그아웃")
async def logout(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    로그아웃 (로그인 이력 기록)
    
    Note: JWT는 stateless이므로 클라이언트에서 토큰을 삭제해야 함
    """
    try:
        log_query = text("""
            INSERT INTO login_history (login_id, action_type, created_by)
            VALUES (:login_id, 'LOGOUT', :created_by)
        """)
        db.execute(log_query, {
            "login_id": current_user["login_id"],
            "created_by": current_user["login_id"]
        })
        db.commit()
    except Exception as e:
        print(f"로그아웃 이력 기록 실패: {e}")
    
    return {"message": "로그아웃되었습니다"}

@router.post("/change-password", summary="비밀번호 변경")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    비밀번호 변경
    
    - **old_password**: 기존 비밀번호
    - **new_password**: 새 비밀번호
    """
    # 기존 비밀번호 확인
    query = text("""
        SELECT password
        FROM users
        WHERE login_id = :login_id
    """)
    
    result = db.execute(query, {"login_id": current_user["login_id"]}).fetchone()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )
    
    if not verify_password(password_data.old_password, result[0]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="기존 비밀번호가 올바르지 않습니다"
        )
    
    # 새 비밀번호로 업데이트
    new_hashed_password = get_password_hash(password_data.new_password)
    
    update_query = text("""
        UPDATE users
        SET password = :password, updated_by = :updated_by
        WHERE login_id = :login_id
    """)
    
    db.execute(update_query, {
        "password": new_hashed_password,
        "updated_by": current_user["login_id"],
        "login_id": current_user["login_id"]
    })
    db.commit()
    
    return {"message": "비밀번호가 변경되었습니다"}
