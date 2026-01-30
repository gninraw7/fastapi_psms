#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
비밀번호 해시 생성 스크립트
사용법: python generate_password_hash.py
"""
from app.core.security import get_password_hash

def main():
    print("=" * 60)
    print("🔐 비밀번호 해시 생성기")
    print("=" * 60)
    print()
    
    # 비밀번호 입력 받기
    password = input("생성할 비밀번호를 입력하세요: ")
    
    if not password:
        print("❌ 비밀번호를 입력해주세요.")
        return
    
    # 해시 생성
    print("\n⏳ 해시 생성 중...")
    hashed = get_password_hash(password)
    
    print("\n✅ 해시 생성 완료!")
    print("=" * 60)
    print(f"원본 비밀번호: {password}")
    print(f"해시값:")
    print(hashed)
    print("=" * 60)
    print()
    print("📝 사용법:")
    print("   1. 위의 해시값을 복사하세요")
    print("   2. users 테이블의 password 컬럼에 업데이트하세요")
    print()
    print("   UPDATE users SET password = '위의해시값' WHERE login_id = 'admin';")
    print()

if __name__ == "__main__":
    main()
