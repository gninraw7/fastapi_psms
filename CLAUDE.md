# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PSMS (Project & Sales Management System) — a multi-tenant project/sales pipeline management system. FastAPI backend serves both Excel VBA clients and a vanilla JS web frontend. Korean comments are common throughout the codebase.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run dev server (auto-reload)
python main.py
# or: uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production start/stop
./start_server.sh
./stop_server.sh

# Test database connection
python app/core/database.py

# Apply database schema
mysql -u <user> -p < mysql_ddl/DDL_20260130.sql
```

No test suite or linter is configured.

## Architecture

**3-Tier**: Vanilla JS SPA (`static/`) → FastAPI API (`app/`) → MySQL (raw SQL via SQLAlchemy `text()`)

### Backend Structure

- `main.py` — App creation, middleware (company_cd injection, request logging), static file mounting, router registration
- `app/api/v1/api.py` — Central router aggregator; all domain routers registered here with `permission_required()` dependency
- `app/api/v1/endpoints/{domain}/routes.py` — Route handlers per domain (projects, clients, users, sales_plans, etc.)
- `app/core/config.py` — Settings loaded from `.env` via `os.getenv()`
- `app/core/database.py` — SQLAlchemy engine/session; `get_db()` dependency yields session with company_cd set
- `app/core/security.py` — JWT creation/validation, bcrypt password hashing, `get_current_user` dependency
- `app/core/tenant.py` — `ContextVar`-based multi-tenant context; `get_company_cd()` / `set_company_cd()`
- `app/core/permissions.py` — `permission_required(form_id)` checks role/user permissions (ADMIN bypasses all)
- `app/schemas/` — Pydantic request/response models (validation only, not ORM models)
- `app/services/` — Optional service layer for complex business logic (e.g., `project_service.py`)

### Frontend Structure

- `static/index.html` — Single-page shell; pages toggled via `data-page`/`data-pageid` attributes
- `static/login.html` — Login page (root `/` serves this)
- `static/js/config.js` — `API_CONFIG` object with all endpoint paths
- `static/js/auth.js` — JWT token storage/refresh via `localStorage`
- Each page has its own JS file (`app.js`, `project-form.js`, `sales-plan.js`, `notices.js`, etc.)

## Key Patterns

### No ORM — Raw SQL Everywhere

All database access uses `db.execute(text("SELECT ..."), params)`. No SQLAlchemy ORM models are defined. Queries use parameterized `:param_name` syntax.

### Multi-Tenant Isolation

Every data table has a `company_cd` column. All queries MUST include `WHERE company_cd = :company_cd`. The company_cd is resolved by middleware in this priority: JWT token → login request body → `X-Company-CD` header → `DEFAULT_COMPANY_CD` env var.

### Dynamic WHERE Clause Building

Endpoints build filter clauses conditionally:
```python
where_clauses = ["p.company_cd = :company_cd"]
params = {"company_cd": get_company_cd()}
if search_text:
    where_clauses.append("p.project_name LIKE :search")
    params["search"] = f"%{search_text}%"
```

### Adding a New Endpoint

1. Create route file at `app/api/v1/endpoints/{domain}/routes.py`
2. Register router in `app/api/v1/api.py` with `permission_required()` dependency
3. Add frontend JS in `static/js/` and page section in `static/index.html`

### Field Name Mappings

Database fields often differ from display names. API responses include computed/joined fields (e.g., `field_code` from projects table → `field_name` via comm_code JOIN, `manager_id` → `manager_name` via users JOIN).

### Logging

Import from `app.core.logger`: `app_logger`, `db_logger`, `access_logger`. Logs go to `logs/psms_app.log`, `logs/psms_error.log`, `logs/psms_access.log`, `logs/psms_db.log`.

## Configuration

All config via `.env` file at project root, loaded in `app/core/config.py`. Key vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_DISABLED`, `DEFAULT_COMPANY_CD`, `SECRET_KEY`, `DEBUG`, `CORS_ORIGINS`.

## URLs

- Web UI: `http://localhost:8000/app`
- Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- API base: `/api/v1/`
