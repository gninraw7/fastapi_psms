# PSMS FastAPI Copilot Instructions

## Project Overview
VBA + FastAPI + MySQL 3-Tier project management system. Excel VBA clients communicate with Python FastAPI backend for project/sales pipeline management.

## Architecture

### 3-Tier Structure
- **Presentation**: VBA UserForms in Excel (FrmProjectList_FastAPI.frm)
- **Application**: FastAPI Python backend at `/api/v1/`
- **Data**: MySQL database with tables: `projects`, `clients`, `users`, `comm_code`, `project_contracts`

### Key Data Flows
1. VBA calls HTTP endpoints via `ModFastAPI` module → receives JSON responses
2. FastAPI routes parse requests → services execute business logic → raw SQL queries via SQLAlchemy
3. Database returns data → response schemas (Pydantic) → JSON back to VBA

## Critical Architecture Patterns

### Service Layer Pattern
- All business logic lives in `app/services/` (e.g., `project_service.py`)
- Services use **raw SQL with `text()` queries**, NOT ORM (important for complex JOINs)
- Services return Pydantic response models
- Example: `ProjectService.get_project_list(db, request)` constructs WHERE clauses dynamically

### Router/Endpoint Pattern
- Routes in `app/api/v1/endpoints/{entity}/routes.py`
- Each endpoint imports service, calls it with `db: Session = Depends(get_db)` dependency
- Endpoints define Pydantic request/response models
- All routes included in `app/api/v1/api.py` via `include_router()`

### Schema/Model Pattern
- **Schemas** (`app/schemas/`): Pydantic `BaseModel` for request/response validation (NOT database models)
- Use `Optional[]` and `Field()` for documentation
- Response models typically have calculated/joined fields from multiple tables

## Project-Specific Patterns

### Database Access
- Use `Session.execute(text(sql_query), params_dict)` for queries
- Always use parameterized queries: `WHERE field = :param_name`
- Join multiple tables (projects + clients + users + comm_code) for denormalized responses
- Example: Get field_code from projects, join comm_code for field_name

### Field Name Mappings (CRITICAL)
Database fields often differ from what VBA expects:
- `stage` → `current_stage` (DB field)
- `field` → `field_code` (DB field) 
- API includes computed fields: `field_name` (from comm_code join), `stage_name`, `manager_name`
- VBA receives denormalized response with all human-readable names

### Filtering/Pagination Pattern
- Request model has optional filters: `field_code`, `current_stage`, `manager_id`, `search_field`, `search_text`
- Service builds WHERE clauses conditionally
- Always calculate `total_pages = math.ceil(total_records / page_size)`
- OFFSET = `(page - 1) * page_size`

### Logging
- Import from `app.core.logger`: `app_logger`, `db_logger`, `access_logger`
- Use `app_logger.info()` for business events, `db_logger.error()` for DB issues
- Logs written to `logs/` directory

## Configuration & Deployment

### Environment Setup
- `.env` file: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `app/core/config.py` loads via `python-dotenv`
- Supports Aiven Cloud MySQL with `DB_SSL_DISABLED`, `DB_SSL_CA` options
- SQLAlchemy connection string built in `config.DATABASE_URL` property

### Server Launch
- Development: `python main.py` or `uvicorn main:app --reload`
- Production scripts: `start_server.sh`, `stop_server.sh`
- API docs at `/docs` (Swagger), `/redoc` (ReDoc)
- Health check: GET `/health`

## Common Development Tasks

### Adding New API Endpoint
1. Create schema in `app/schemas/{entity}.py` (Pydantic models)
2. Add service method in `app/services/{entity}_service.py` (SQL logic)
3. Add route in `app/api/v1/endpoints/{entity}/routes.py` (HTTP handler)
4. Include router in `app/api/v1/api.py` → app imports in `main.py`

### Adding Filters to List Endpoint
1. Add optional filter to request schema (e.g., `field_code: Optional[str] = None`)
2. In service, add WHERE clause conditionally: `if request.field_code: where_clauses.append("p.field_code = :field_code")`
3. Add to params dict: `params["field_code"] = request.field_code`

### Database Query Debugging
- Enable SQL logging: Set `DEBUG=true` in config (shows all SQLAlchemy queries)
- Test queries directly: See `test_data_real_schema.sql` for sample data
- Check logs in `logs/` directory for runtime issues

## Dependencies & Stack
- **Framework**: FastAPI 0.128+, Uvicorn
- **Database**: SQLAlchemy 2.0, PyMySQL
- **Validation**: Pydantic 2.12+
- **Authentication**: JWT via python-jose (configured but not actively used yet)
- **Frontend**: Static files in `static/` (index.html, detail.html, CSS/JS)

## File Organization Rules
- Python files: UTF-8 with `# -*- coding: utf-8 -*-` header (Korean comments common)
- Backup files: `.backup` extension (ignore in code reviews)
- Version backups: Named like `file.py.backup_YYYYMMDD_HHMMSS` (safe to delete)
- Test data: `test_data.sql`, `test_data_real_schema.sql` (real schema version preferred)
