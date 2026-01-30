from app.core.security import get_password_hash

# 사용할 새 비밀번호 입력
new_password = "1234" 
hashed = get_password_hash(new_password)
print(f"새로운 해시값: {hashed}")

