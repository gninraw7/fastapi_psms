# PSMS (FastAPI + Static UI)

프로젝트 관리 시스템(PSMS) 백엔드(FastAPI)와 정적 프론트(UI)를 함께 제공하는 저장소입니다.

## 주요 기능

- 프로젝트 관리
- 거래처 관리
- 사용자 관리
- 공통코드 관리
- 프로젝트 변경이력/속성 관리
- 그리드 정렬/페이징/엑셀 내보내기

## 실행 방법

### 1) Python 환경 구성

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2) 환경 변수 설정

`.env` 파일에 DB 접속 정보를 입력합니다.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=psms_db
```

### 3) DB 스키마 적용

`mysql_ddl/DDL_20260130.sql` 를 사용해 테이블을 생성합니다.

### 4) 서버 실행

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 접속 경로

- UI: `http://<host>:8000/app`
- Swagger: `http://<host>:8000/docs`
- ReDoc: `http://<host>:8000/redoc`
- Health: `http://<host>:8000/health`

## 프로젝트 구조

```
fastapi_psms/
├── app/
│   ├── api/v1/endpoints/         # API 엔드포인트
│   │   ├── auth/
│   │   ├── common_codes/
│   │   ├── clients/
│   │   ├── projects/
│   │   ├── project_detail/
│   │   └── users/
│   ├── core/                     # DB/설정/로깅
│   ├── schemas/
│   └── services/
├── static/                       # 정적 UI
│   ├── index.html
│   ├── css/
│   └── js/
├── mysql_ddl/                     # DDL
└── main.py
```

## 주요 API 요약

### 인증
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### 공통코드
- `GET /api/v1/common/codes/{group_code}?is_use=`
- `GET /api/v1/common/code-groups?is_use=`
- `GET /api/v1/common/codes/{group_code}/{code}`
- `POST /api/v1/common/codes` (PROJECT_ATTRIBUTE 전용 등록)
- `POST /api/v1/common/codes/bulk-save` (일괄 저장)

### 프로젝트
- `GET /api/v1/projects/list`
- `POST /api/v1/projects`
- `PUT /api/v1/projects/{pipeline_id}`

### 프로젝트 상세
- `GET /api/v1/project-detail/{pipeline_id}/full`
- `POST /api/v1/project-detail/save`

### 거래처
- `GET /api/v1/clients/list`
- `POST /api/v1/clients`
- `PUT /api/v1/clients/{client_id}`

### 사용자
- `GET /api/v1/users/list`
- `GET /api/v1/users/{user_no}`
- `POST /api/v1/users`
- `PUT /api/v1/users/{user_no}`
- `DELETE /api/v1/users/{user_no}`
- `POST /api/v1/users/password/reset`
- `GET /api/v1/users/can-change-login-id`

## 공통코드 관리 화면

- 좌측: 대분류(group_code) 그리드
- 우측: 상세코드(code) 그리드
- 신규/삭제/저장/새로고침/엑셀/업로드 제공
- 대분류 선택 시 상세코드 로드

## 사용자 관리 화면

- 목록 조회/필터/정렬/엑셀
- 관리자 권한 메뉴 표시 제어
- 비밀번호 일괄 리셋

## 개발 메모

- 정렬은 `sort_field`, `sort_dir` 쿼리 파라미터를 통해 서버에서 처리됩니다.
- UI는 `static/index.html` 단일 페이지에서 각 화면을 표시합니다.

## 보안/운영 권장사항

- `.env`는 버전관리에서 제외하세요.
- 운영 환경에서는 DB 계정 권한을 최소화하세요.
- 필요 시 인증(JWT 등) 강화 검토가 필요합니다.
