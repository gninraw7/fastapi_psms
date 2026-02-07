-- DDL_20260207_Add_AuthForms_WEB_TESTCOMP.sql
-- WEB 화면(폼) 목록을 auth_forms에 등록 (company_cd = 'TESTCOMP')
-- 기존에 존재하면 form_name만 업데이트

INSERT INTO auth_forms (company_cd, form_id, form_name, created_by, updated_by)
VALUES
  ('TESTCOMP', 'projects-list', '프로젝트 목록', 'system', 'system'),
  ('TESTCOMP', 'projects-new', '신규 프로젝트', 'system', 'system'),
  ('TESTCOMP', 'clients-list', '거래처 관리', 'system', 'system'),
  ('TESTCOMP', 'clients-form', '거래처 등록/수정', 'system', 'system'),
  ('TESTCOMP', 'sales-dashboard', '프로젝트 대시보드', 'system', 'system'),
  ('TESTCOMP', 'sales-plan-list', '계획 목록', 'system', 'system'),
  ('TESTCOMP', 'sales-plan-edit', '계획 입력', 'system', 'system'),
  ('TESTCOMP', 'sales-actual-entry', '실적 등록', 'system', 'system'),
  ('TESTCOMP', 'sales-actual-dashboard', '실적 현황', 'system', 'system'),
  ('TESTCOMP', 'report-hub', '유형별 현황', 'system', 'system'),
  ('TESTCOMP', 'users', '사용자 관리', 'system', 'system'),
  ('TESTCOMP', 'users-form', '사용자 등록/수정', 'system', 'system'),
  ('TESTCOMP', 'login-history', '접속 이력', 'system', 'system'),
  ('TESTCOMP', 'permissions', '권한 관리', 'system', 'system'),
  ('TESTCOMP', 'common-codes', '공통코드 관리', 'system', 'system'),
  ('TESTCOMP', 'industry-fields', '분야코드 관리', 'system', 'system'),
  ('TESTCOMP', 'service-codes', '서비스코드 관리', 'system', 'system'),
  ('TESTCOMP', 'org-units', '조직 관리', 'system', 'system'),
  ('TESTCOMP', 'companies', '회사 관리', 'system', 'system'),
  ('TESTCOMP', 'data-management', '데이터 관리', 'system', 'system'),
  ('TESTCOMP', 'my-info', '내정보', 'system', 'system'),
  ('TESTCOMP', 'mobile-projects', '모바일 프로젝트 목록', 'system', 'system'),
  ('TESTCOMP', 'mobile-project-new', '모바일 프로젝트 등록/수정', 'system', 'system'),
  ('TESTCOMP', 'mobile-history-new', '모바일 이력 등록', 'system', 'system')
ON DUPLICATE KEY UPDATE
  form_name = VALUES(form_name),
  updated_by = VALUES(updated_by);
