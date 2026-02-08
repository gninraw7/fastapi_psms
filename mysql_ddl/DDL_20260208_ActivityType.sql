-- DDL_20260208_ActivityType.sql
-- 활동유형 컬럼/코드 추가
-- 생성일: 2026-02-08

START TRANSACTION;

-- 1) 프로젝트 이력 활동유형 컬럼 추가
ALTER TABLE project_history
  ADD COLUMN activity_type varchar(20) DEFAULT NULL AFTER progress_stage;

CREATE INDEX idx_project_history_activity
  ON project_history (company_cd, activity_type);

-- 2) 공통코드(ACTIVITY_TYPE) 추가 (회사별로 등록)
INSERT INTO comm_code (
    company_cd, group_code, group_name, code, code_name, sort_order, is_use, created_by, updated_by
)
SELECT company_cd, 'ACTIVITY_TYPE', '활동유형', 'MEETING', '미팅', 1, 'Y', 'system', 'system'
FROM companies
ON DUPLICATE KEY UPDATE
    group_name = VALUES(group_name),
    code_name = VALUES(code_name),
    sort_order = VALUES(sort_order),
    is_use = VALUES(is_use),
    updated_by = VALUES(updated_by);

INSERT INTO comm_code (
    company_cd, group_code, group_name, code, code_name, sort_order, is_use, created_by, updated_by
)
SELECT company_cd, 'ACTIVITY_TYPE', '활동유형', 'PROPOSAL', '제안', 2, 'Y', 'system', 'system'
FROM companies
ON DUPLICATE KEY UPDATE
    group_name = VALUES(group_name),
    code_name = VALUES(code_name),
    sort_order = VALUES(sort_order),
    is_use = VALUES(is_use),
    updated_by = VALUES(updated_by);

INSERT INTO comm_code (
    company_cd, group_code, group_name, code, code_name, sort_order, is_use, created_by, updated_by
)
SELECT company_cd, 'ACTIVITY_TYPE', '활동유형', 'CONTRACT', '계약', 3, 'Y', 'system', 'system'
FROM companies
ON DUPLICATE KEY UPDATE
    group_name = VALUES(group_name),
    code_name = VALUES(code_name),
    sort_order = VALUES(sort_order),
    is_use = VALUES(is_use),
    updated_by = VALUES(updated_by);

INSERT INTO comm_code (
    company_cd, group_code, group_name, code, code_name, sort_order, is_use, created_by, updated_by
)
SELECT company_cd, 'ACTIVITY_TYPE', '활동유형', 'FOLLOWUP', '후속', 4, 'Y', 'system', 'system'
FROM companies
ON DUPLICATE KEY UPDATE
    group_name = VALUES(group_name),
    code_name = VALUES(code_name),
    sort_order = VALUES(sort_order),
    is_use = VALUES(is_use),
    updated_by = VALUES(updated_by);

INSERT INTO comm_code (
    company_cd, group_code, group_name, code, code_name, sort_order, is_use, created_by, updated_by
)
SELECT company_cd, 'ACTIVITY_TYPE', '활동유형', 'SUPPORT', '지원', 5, 'Y', 'system', 'system'
FROM companies
ON DUPLICATE KEY UPDATE
    group_name = VALUES(group_name),
    code_name = VALUES(code_name),
    sort_order = VALUES(sort_order),
    is_use = VALUES(is_use),
    updated_by = VALUES(updated_by);

INSERT INTO comm_code (
    company_cd, group_code, group_name, code, code_name, sort_order, is_use, created_by, updated_by
)
SELECT company_cd, 'ACTIVITY_TYPE', '활동유형', 'ETC', '기타', 6, 'Y', 'system', 'system'
FROM companies
ON DUPLICATE KEY UPDATE
    group_name = VALUES(group_name),
    code_name = VALUES(code_name),
    sort_order = VALUES(sort_order),
    is_use = VALUES(is_use),
    updated_by = VALUES(updated_by);

COMMIT;
