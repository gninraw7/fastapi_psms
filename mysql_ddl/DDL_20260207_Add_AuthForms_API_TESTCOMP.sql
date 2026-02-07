-- DDL_20260207_Add_AuthForms_API_TESTCOMP.sql
-- API 권한(form_id) 목록을 auth_forms에 등록 (company_cd = 'TESTCOMP')
-- 기존에 존재하면 form_name만 업데이트

INSERT INTO auth_forms (company_cd, form_id, form_name, created_by, updated_by)
VALUES
  ('TESTCOMP', 'common', '공통 API', 'system', 'system'),
  ('TESTCOMP', 'clients', '거래처 API', 'system', 'system'),
  ('TESTCOMP', 'industry-fields', '분야코드 API', 'system', 'system'),
  ('TESTCOMP', 'service-codes', '서비스코드 API', 'system', 'system'),
  ('TESTCOMP', 'org-units', '조직관리 API', 'system', 'system'),
  ('TESTCOMP', 'projects', '프로젝트 API', 'system', 'system'),
  ('TESTCOMP', 'sales-plans', '영업계획 API', 'system', 'system'),
  ('TESTCOMP', 'sales-actuals', '실적관리 API', 'system', 'system'),
  ('TESTCOMP', 'reports', '리포트 API', 'system', 'system'),
  ('TESTCOMP', 'login-history', '접속이력 API', 'system', 'system'),
  ('TESTCOMP', 'permissions', '권한관리 API', 'system', 'system'),
  ('TESTCOMP', 'notices', '게시판 API', 'system', 'system'),
  ('TESTCOMP', 'notice-templates', '공지 템플릿 API', 'system', 'system'),
  ('TESTCOMP', 'companies', '회사관리 API', 'system', 'system'),
  ('TESTCOMP', 'data-management', '데이터관리 API', 'system', 'system'),
  ('TESTCOMP', 'users', '사용자관리 API', 'system', 'system')
ON DUPLICATE KEY UPDATE
  form_name = VALUES(form_name),
  updated_by = VALUES(updated_by);
