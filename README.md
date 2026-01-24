# PSMS FastAPI Server

VBA + FastAPI + MySQL 3Tier 아키텍처 프로젝트 관리 시스템

## 📁 프로젝트 구조

```
fastapi_psms/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── projects/       # 프로젝트 관련 API
│   │       │   │   └── routes.py
│   │       │   ├── common_codes/   # 공통코드 API (추가 예정)
│   │       │   └── users/          # 사용자 API (추가 예정)
│   │       └── api.py              # 라우터 통합
│   ├── core/
│   │   ├── config.py               # 설정 관리
│   │   └── database.py             # DB 연결 및 세션
│   ├── models/                     # SQLAlchemy 모델 (추가 예정)
│   ├── schemas/
│   │   └── project.py              # Pydantic 스키마
│   ├── services/
│   │   └── project_service.py      # 비즈니스 로직
│   └── utils/                      # 유틸리티 함수
├── vba_modules/
│   ├── ModFastAPI.bas              # VBA HTTP 요청 모듈
│   └── FrmProjectList_FastAPI.frm  # 변경된 UserForm
├── logs/                           # 로그 파일
├── tests/                          # 테스트 코드
├── .env                            # 환경 변수
├── main.py                         # FastAPI 앱 진입점
└── requirements.txt                # Python 패키지
```

## 🚀 설치 및 실행

### 1. Python 가상환경 생성

```bash
cd C:\Users\KBDS\fastapi_psms
python -m venv venv
venv\Scripts\activate
```

### 2. 패키지 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 설정

`.env` 파일 수정:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=psms_db
```

### 4. 서버 실행

```bash
# 개발 모드 (자동 리로드)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 또는
python main.py
```

### 5. API 문서 확인

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

## 📡 API 엔드포인트

### 프로젝트 관련

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/projects/list` | 프로젝트 목록 조회 (페이징) |
| GET | `/api/v1/projects/combo/{group_code}` | 콤보박스 데이터 조회 |
| GET | `/api/v1/projects/managers` | 담당자 목록 조회 |

### 요청 예시

#### 프로젝트 목록 조회
```
GET /api/v1/projects/list?page=1&page_size=25&stage=PROPOSAL
```

응답:
```json
{
  "total_records": 150,
  "total_pages": 6,
  "current_page": 1,
  "page_size": 25,
  "items": [
    {
      "pipeline_id": "P2024001",
      "project_name": "시스템 구축",
      "customer_name": "ABC회사",
      "field": "IT",
      "stage": "PROPOSAL",
      "manager_name": "홍길동",
      "amount": 50000000,
      "probability": 70,
      "expected_date": "2024-12-31"
    }
  ]
}
```

## 🔧 VBA 설정

### 1. VBA-JSON 라이브러리 설치

1. [VBA-JSON](https://github.com/VBA-tools/VBA-JSON) 다운로드
2. Excel VBA 편집기에서 `JsonConverter.bas` import

### 2. 참조 추가

VBA 편집기 → 도구 → 참조:
- ✅ Microsoft Scripting Runtime
- ✅ Microsoft XML, v6.0

### 3. 모듈 추가

1. `ModFastAPI.bas` import
2. `FrmProjectList` 기존 코드를 `FrmProjectList_FastAPI.frm`으로 교체

### 4. 연결 테스트

VBA 즉시 실행 창에서:
```vb
? ModFastAPI.TestConnection()
```

## 📊 데이터베이스 테이블

### projects (프로젝트)
```sql
CREATE TABLE projects (
    pipeline_id VARCHAR(50) PRIMARY KEY,
    project_name VARCHAR(200),
    customer_name VARCHAR(200),
    field VARCHAR(50),
    stage VARCHAR(50),
    manager_id VARCHAR(50),
    amount DECIMAL(15,2),
    probability INT,
    expected_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### comm_code (공통코드)
```sql
CREATE TABLE comm_code (
    group_code VARCHAR(50),
    code VARCHAR(50),
    code_name VARCHAR(200),
    sort_order INT,
    is_use CHAR(1) DEFAULT 'Y',
    PRIMARY KEY (group_code, code)
);
```

### users (사용자)
```sql
CREATE TABLE users (
    login_id VARCHAR(50) PRIMARY KEY,
    user_name VARCHAR(100),
    is_sales_rep TINYINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);
```

## 🔐 보안 권장사항

1. `.env` 파일은 git에 커밋하지 마세요
2. 운영 환경에서는 강력한 DB 비밀번호 사용
3. API 인증 추가 검토 (JWT 등)

## 🎯 향후 확장 계획

- [ ] 사용자 인증/인가 (JWT)
- [ ] 프로젝트 CRUD API
- [ ] 파일 업로드/다운로드
- [ ] WebSocket 실시간 알림
- [ ] 로깅 및 모니터링
- [ ] Docker 컨테이너화

## 📞 문의

KBDS IT팀
