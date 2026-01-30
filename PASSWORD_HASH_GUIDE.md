# 비밀번호 해시 생성 가이드

FastAPI 프로젝트에서 사용자 비밀번호의 해시값을 생성하는 방법입니다.

## 📦 준비사항

프로젝트의 루트 디렉토리에 있어야 합니다.

```bash
cd /path/to/fastapi_psms
```

## 방법 1: 스크립트 파일 사용 (권장) ⭐

### 1-1. 스크립트 파일 배치

`generate_password_hash.py` 파일을 프로젝트 루트에 배치:

```
fastapi_psms/
├── generate_password_hash.py  ← 여기에 배치
├── app/
├── static/
├── main.py
└── requirements.txt
```

### 1-2. 실행

```bash
# 프로젝트 루트 디렉토리에서
python generate_password_hash.py
```

### 1-3. 실행 결과 예시

```
============================================================
🔐 비밀번호 해시 생성기
============================================================

생성할 비밀번호를 입력하세요: 1234

⏳ 해시 생성 중...

✅ 해시 생성 완료!
============================================================
원본 비밀번호: 1234
해시값:
$2b$12$KIX8qJ.3rZ8Y2hN5vQ9XOeHjK5L7M8nP6rT4sU9wV0xY1zA2bC3dE
============================================================

📝 사용법:
   1. 위의 해시값을 복사하세요
   2. users 테이블의 password 컬럼에 업데이트하세요

   UPDATE users SET password = '위의해시값' WHERE login_id = 'admin';
```

## 방법 2: Python 인터랙티브 셸 사용

### 2-1. Python 셸 실행

```bash
# 프로젝트 루트 디렉토리에서
python
```

### 2-2. 코드 입력

```python
>>> from app.core.security import get_password_hash
>>> 
>>> # 비밀번호 입력
>>> new_password = "1234"
>>> 
>>> # 해시 생성
>>> hashed = get_password_hash(new_password)
>>> 
>>> # 결과 출력
>>> print(f"비밀번호: {new_password}")
비밀번호: 1234
>>> print(f"해시값: {hashed}")
해시값: $2b$12$KIX8qJ.3rZ8Y2hN5vQ9XOeHjK5L7M8nP6rT4sU9wV0xY1zA2bC3dE
>>> 
>>> # 종료
>>> exit()
```

## 방법 3: 명령줄에서 한 줄로 실행

### Linux/Mac:

```bash
python -c "from app.core.security import get_password_hash; print(get_password_hash('1234'))"
```

### Windows (PowerShell):

```powershell
python -c "from app.core.security import get_password_hash; print(get_password_hash('1234'))"
```

### Windows (CMD):

```cmd
python -c "from app.core.security import get_password_hash; print(get_password_hash('1234'))"
```

## 방법 4: 임시 Python 파일 생성 후 실행

### 4-1. 파일 생성

```bash
# temp_hash.py 파일 생성
cat > temp_hash.py << 'EOF'
from app.core.security import get_password_hash

new_password = "1234" 
hashed = get_password_hash(new_password)
print(f"새로운 해시값: {hashed}")
EOF
```

### 4-2. 실행

```bash
python temp_hash.py
```

### 4-3. 파일 삭제 (선택)

```bash
rm temp_hash.py
```

## 🗄️ 데이터베이스에 적용

생성된 해시값을 데이터베이스에 업데이트:

### MySQL Workbench 사용:

```sql
-- admin 계정의 비밀번호를 '1234'로 변경
UPDATE users 
SET password = '$2b$12$KIX8qJ.3rZ8Y2hN5vQ9XOeHjK5L7M8nP6rT4sU9wV0xY1zA2bC3dE'
WHERE login_id = 'admin';

-- 확인
SELECT login_id, user_name, password 
FROM users 
WHERE login_id = 'admin';
```

### Python으로 직접 업데이트:

```python
from app.core.database import engine
from sqlalchemy import text

# 해시 생성
from app.core.security import get_password_hash
hashed = get_password_hash("1234")

# DB 업데이트
with engine.connect() as conn:
    result = conn.execute(
        text("UPDATE users SET password = :pwd WHERE login_id = :login_id"),
        {"pwd": hashed, "login_id": "admin"}
    )
    conn.commit()
    print(f"✅ 업데이트 완료: {result.rowcount}개 행")
```

## ⚠️ 주의사항

### 1. 프로젝트 루트 디렉토리에서 실행
스크립트는 반드시 프로젝트 루트에서 실행해야 합니다:
```bash
# 올바른 위치
/path/to/fastapi_psms$ python generate_password_hash.py

# 잘못된 위치 (에러 발생)
/path/to/fastapi_psms/app$ python ../generate_password_hash.py
```

### 2. 가상환경 활성화 (사용 시)
가상환경을 사용하는 경우 먼저 활성화:
```bash
# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate

# 그 다음 스크립트 실행
python generate_password_hash.py
```

### 3. 의존성 설치 확인
필요한 패키지가 설치되어 있어야 합니다:
```bash
pip install passlib[bcrypt]
```

### 4. ModuleNotFoundError 발생 시
```bash
# 에러: ModuleNotFoundError: No module named 'app'

# 해결: PYTHONPATH 설정
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
python generate_password_hash.py

# 또는
PYTHONPATH=. python generate_password_hash.py
```

## 🧪 테스트

### 1. 해시 생성 테스트
```bash
python generate_password_hash.py
# 비밀번호: 1234 입력
# 해시값 복사
```

### 2. DB 업데이트
```sql
UPDATE users SET password = '복사한해시값' WHERE login_id = 'admin';
```

### 3. 로그인 테스트
- 웹 브라우저에서 `http://localhost:8000/` 접속
- ID: admin, PW: 1234로 로그인 시도
- ✅ 로그인 성공 확인

## 🔒 보안 팁

1. **비밀번호는 절대 평문으로 저장하지 마세요**
2. **해시값은 매번 다릅니다** (같은 비밀번호라도 다른 해시값 생성)
3. **bcrypt는 안전한 해싱 알고리즘입니다** (brute-force 공격 방지)
4. **프로덕션에서는 강력한 비밀번호를 사용하세요**

## 📋 예제: 여러 사용자 비밀번호 일괄 생성

```python
from app.core.security import get_password_hash

users = [
    ("admin", "admin1234"),
    ("user1", "user1234"),
    ("user2", "user2234"),
]

print("=" * 80)
for login_id, password in users:
    hashed = get_password_hash(password)
    print(f"UPDATE users SET password = '{hashed}' WHERE login_id = '{login_id}';")
print("=" * 80)
```

## 🎉 완료!

이제 안전하게 비밀번호 해시를 생성하고 데이터베이스에 저장할 수 있습니다!
