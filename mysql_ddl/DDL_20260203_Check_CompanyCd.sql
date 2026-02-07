-- DDL_20260203_Check_CompanyCd.sql
-- 멀티테넌트(company_cd) 마이그레이션 검증용
-- 결과가 0건이면 정상으로 보는 검증 쿼리 모음

-- 0) 기본 회사 값(선택)
SET @company_cd = 'TESTCOMP';

-- 1) companies에 등록되지 않은 company_cd 사용 여부
SELECT 'industry_fields' AS tbl, company_cd FROM industry_fields WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'service_codes' AS tbl, company_cd FROM service_codes WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'org_units' AS tbl, company_cd FROM org_units WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'users' AS tbl, company_cd FROM users WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'comm_code' AS tbl, company_cd FROM comm_code WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'clients' AS tbl, company_cd FROM clients WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'projects' AS tbl, company_cd FROM projects WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'project_attributes' AS tbl, company_cd FROM project_attributes WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'project_contracts' AS tbl, company_cd FROM project_contracts WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'project_history' AS tbl, company_cd FROM project_history WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'login_history' AS tbl, company_cd FROM login_history WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'auth_forms' AS tbl, company_cd FROM auth_forms WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'auth_permissions' AS tbl, company_cd FROM auth_permissions WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'auth_role_permissions' AS tbl, company_cd FROM auth_role_permissions WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'auth_user_permissions' AS tbl, company_cd FROM auth_user_permissions WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'sales_plan' AS tbl, company_cd FROM sales_plan WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'sales_plan_line' AS tbl, company_cd FROM sales_plan_line WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;
SELECT 'sales_actual_line' AS tbl, company_cd FROM sales_actual_line WHERE company_cd NOT IN (SELECT company_cd FROM companies) LIMIT 5;

-- 2) company_cd NULL 체크
SELECT 'industry_fields' AS tbl, COUNT(*) AS null_cnt FROM industry_fields WHERE company_cd IS NULL;
SELECT 'service_codes' AS tbl, COUNT(*) AS null_cnt FROM service_codes WHERE company_cd IS NULL;
SELECT 'org_units' AS tbl, COUNT(*) AS null_cnt FROM org_units WHERE company_cd IS NULL;
SELECT 'users' AS tbl, COUNT(*) AS null_cnt FROM users WHERE company_cd IS NULL;
SELECT 'comm_code' AS tbl, COUNT(*) AS null_cnt FROM comm_code WHERE company_cd IS NULL;
SELECT 'clients' AS tbl, COUNT(*) AS null_cnt FROM clients WHERE company_cd IS NULL;
SELECT 'projects' AS tbl, COUNT(*) AS null_cnt FROM projects WHERE company_cd IS NULL;
SELECT 'project_attributes' AS tbl, COUNT(*) AS null_cnt FROM project_attributes WHERE company_cd IS NULL;
SELECT 'project_contracts' AS tbl, COUNT(*) AS null_cnt FROM project_contracts WHERE company_cd IS NULL;
SELECT 'project_history' AS tbl, COUNT(*) AS null_cnt FROM project_history WHERE company_cd IS NULL;
SELECT 'login_history' AS tbl, COUNT(*) AS null_cnt FROM login_history WHERE company_cd IS NULL;
SELECT 'auth_forms' AS tbl, COUNT(*) AS null_cnt FROM auth_forms WHERE company_cd IS NULL;
SELECT 'auth_permissions' AS tbl, COUNT(*) AS null_cnt FROM auth_permissions WHERE company_cd IS NULL;
SELECT 'auth_role_permissions' AS tbl, COUNT(*) AS null_cnt FROM auth_role_permissions WHERE company_cd IS NULL;
SELECT 'auth_user_permissions' AS tbl, COUNT(*) AS null_cnt FROM auth_user_permissions WHERE company_cd IS NULL;
SELECT 'sales_plan' AS tbl, COUNT(*) AS null_cnt FROM sales_plan WHERE company_cd IS NULL;
SELECT 'sales_plan_line' AS tbl, COUNT(*) AS null_cnt FROM sales_plan_line WHERE company_cd IS NULL;
SELECT 'sales_actual_line' AS tbl, COUNT(*) AS null_cnt FROM sales_actual_line WHERE company_cd IS NULL;

-- 3) PK에 company_cd 포함 여부 (미포함이면 결과 표시)
SELECT table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
 AND tc.table_name = kcu.table_name
WHERE tc.table_schema = DATABASE()
  AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name
HAVING SUM(kcu.column_name = 'company_cd') = 0;

-- 4) company_cd가 첫 컬럼인지 점검 (아닌 테이블 표시)
SELECT table_name, column_name, ordinal_position
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND column_name = 'company_cd'
  AND ordinal_position <> 1;

-- 5) FK 기준 데이터 불일치 체크
-- 5-1) service_codes.parent_code (동일 company 내 존재 여부)
SELECT sc.company_cd, sc.service_code, sc.parent_code
FROM service_codes sc
WHERE sc.parent_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM service_codes p
    WHERE p.company_cd = sc.company_cd
      AND p.service_code = sc.parent_code
  )
LIMIT 10;

-- 5-2) org_units.parent_id
SELECT c.company_cd, c.org_id, c.parent_id
FROM org_units c
WHERE c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM org_units p
    WHERE p.company_cd = c.company_cd
      AND p.org_id = c.parent_id
  )
LIMIT 10;

-- 5-3) users.org_id
SELECT u.company_cd, u.login_id, u.org_id
FROM users u
WHERE u.org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM org_units o
    WHERE o.company_cd = u.company_cd
      AND o.org_id = u.org_id
  )
LIMIT 10;

-- 5-4) clients.industry_type
SELECT c.company_cd, c.client_id, c.industry_type
FROM clients c
WHERE c.industry_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM industry_fields f
    WHERE f.company_cd = c.company_cd
      AND f.field_code = c.industry_type
  )
LIMIT 10;

-- 5-5) projects 참조 체크
SELECT p.company_cd, p.pipeline_id, p.field_code
FROM projects p
WHERE p.field_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM industry_fields f
    WHERE f.company_cd = p.company_cd
      AND f.field_code = p.field_code
  )
LIMIT 10;

SELECT p.company_cd, p.pipeline_id, p.service_code
FROM projects p
WHERE p.service_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM service_codes s
    WHERE s.company_cd = p.company_cd
      AND s.service_code = p.service_code
  )
LIMIT 10;

SELECT p.company_cd, p.pipeline_id, p.org_id
FROM projects p
WHERE p.org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM org_units o
    WHERE o.company_cd = p.company_cd
      AND o.org_id = p.org_id
  )
LIMIT 10;

SELECT p.company_cd, p.pipeline_id, p.manager_id
FROM projects p
WHERE p.manager_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.company_cd = p.company_cd
      AND u.login_id = p.manager_id
  )
LIMIT 10;

SELECT p.company_cd, p.pipeline_id, p.customer_id
FROM projects p
WHERE p.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM clients c
    WHERE c.company_cd = p.company_cd
      AND c.client_id = p.customer_id
  )
LIMIT 10;

SELECT p.company_cd, p.pipeline_id, p.ordering_party_id
FROM projects p
WHERE p.ordering_party_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM clients c
    WHERE c.company_cd = p.company_cd
      AND c.client_id = p.ordering_party_id
  )
LIMIT 10;

-- 5-6) project_attributes
SELECT pa.company_cd, pa.pipeline_id
FROM project_attributes pa
WHERE NOT EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.company_cd = pa.company_cd
    AND p.pipeline_id = pa.pipeline_id
)
LIMIT 10;

-- 5-7) project_contracts
SELECT pc.company_cd, pc.pipeline_id
FROM project_contracts pc
WHERE NOT EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.company_cd = pc.company_cd
    AND p.pipeline_id = pc.pipeline_id
)
LIMIT 10;

-- 5-8) project_history
SELECT ph.company_cd, ph.pipeline_id
FROM project_history ph
WHERE NOT EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.company_cd = ph.company_cd
    AND p.pipeline_id = ph.pipeline_id
)
LIMIT 10;

-- 5-9) login_history
SELECT lh.company_cd, lh.login_id
FROM login_history lh
WHERE lh.login_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.company_cd = lh.company_cd
      AND u.login_id = lh.login_id
  )
LIMIT 10;

-- 5-10) auth_permissions / auth_role_permissions / auth_user_permissions
SELECT ap.company_cd, ap.form_id
FROM auth_permissions ap
WHERE NOT EXISTS (
  SELECT 1
  FROM auth_forms af
  WHERE af.company_cd = ap.company_cd
    AND af.form_id = ap.form_id
)
LIMIT 10;

SELECT arp.company_cd, arp.form_id
FROM auth_role_permissions arp
WHERE NOT EXISTS (
  SELECT 1
  FROM auth_forms af
  WHERE af.company_cd = arp.company_cd
    AND af.form_id = arp.form_id
)
LIMIT 10;

SELECT aup.company_cd, aup.login_id
FROM auth_user_permissions aup
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.company_cd = aup.company_cd
    AND u.login_id = aup.login_id
)
LIMIT 10;

-- 5-11) sales_plan
SELECT sp.company_cd, sp.plan_id
FROM sales_plan sp
WHERE NOT EXISTS (
  SELECT 1
  FROM companies c
  WHERE c.company_cd = sp.company_cd
)
LIMIT 10;

-- 5-12) sales_plan_line
SELECT spl.company_cd, spl.plan_id
FROM sales_plan_line spl
WHERE NOT EXISTS (
  SELECT 1
  FROM sales_plan sp
  WHERE sp.company_cd = spl.company_cd
    AND sp.plan_id = spl.plan_id
)
LIMIT 10;

SELECT spl.company_cd, spl.pipeline_id
FROM sales_plan_line spl
WHERE NOT EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.company_cd = spl.company_cd
    AND p.pipeline_id = spl.pipeline_id
)
LIMIT 10;

-- 5-13) sales_actual_line
SELECT sal.company_cd, sal.pipeline_id
FROM sales_actual_line sal
WHERE NOT EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.company_cd = sal.company_cd
    AND p.pipeline_id = sal.pipeline_id
)
LIMIT 10;

-- 6) 단일 회사 마이그레이션 확인(옵션)
-- 단일 회사로 이관했다면 모든 테이블에서 company_cd 값이 동일해야 함
SELECT 'industry_fields' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM industry_fields;
SELECT 'service_codes' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM service_codes;
SELECT 'org_units' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM org_units;
SELECT 'users' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM users;
SELECT 'comm_code' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM comm_code;
SELECT 'clients' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM clients;
SELECT 'projects' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM projects;
SELECT 'project_attributes' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM project_attributes;
SELECT 'project_contracts' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM project_contracts;
SELECT 'project_history' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM project_history;
SELECT 'login_history' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM login_history;
SELECT 'auth_forms' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM auth_forms;
SELECT 'auth_permissions' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM auth_permissions;
SELECT 'auth_role_permissions' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM auth_role_permissions;
SELECT 'auth_user_permissions' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM auth_user_permissions;
SELECT 'sales_plan' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM sales_plan;
SELECT 'sales_plan_line' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM sales_plan_line;
SELECT 'sales_actual_line' AS tbl, COUNT(DISTINCT company_cd) AS distinct_company_cnt FROM sales_actual_line;

-- 7) (선택) 특정 company_cd로 필터했을 때 row 존재 확인
SELECT 'industry_fields' AS tbl, COUNT(*) AS rows_for_company FROM industry_fields WHERE company_cd = @company_cd;
SELECT 'service_codes' AS tbl, COUNT(*) AS rows_for_company FROM service_codes WHERE company_cd = @company_cd;
SELECT 'org_units' AS tbl, COUNT(*) AS rows_for_company FROM org_units WHERE company_cd = @company_cd;
SELECT 'users' AS tbl, COUNT(*) AS rows_for_company FROM users WHERE company_cd = @company_cd;
SELECT 'comm_code' AS tbl, COUNT(*) AS rows_for_company FROM comm_code WHERE company_cd = @company_cd;
SELECT 'clients' AS tbl, COUNT(*) AS rows_for_company FROM clients WHERE company_cd = @company_cd;
SELECT 'projects' AS tbl, COUNT(*) AS rows_for_company FROM projects WHERE company_cd = @company_cd;
SELECT 'project_attributes' AS tbl, COUNT(*) AS rows_for_company FROM project_attributes WHERE company_cd = @company_cd;
SELECT 'project_contracts' AS tbl, COUNT(*) AS rows_for_company FROM project_contracts WHERE company_cd = @company_cd;
SELECT 'project_history' AS tbl, COUNT(*) AS rows_for_company FROM project_history WHERE company_cd = @company_cd;
SELECT 'login_history' AS tbl, COUNT(*) AS rows_for_company FROM login_history WHERE company_cd = @company_cd;
SELECT 'auth_forms' AS tbl, COUNT(*) AS rows_for_company FROM auth_forms WHERE company_cd = @company_cd;
SELECT 'auth_permissions' AS tbl, COUNT(*) AS rows_for_company FROM auth_permissions WHERE company_cd = @company_cd;
SELECT 'auth_role_permissions' AS tbl, COUNT(*) AS rows_for_company FROM auth_role_permissions WHERE company_cd = @company_cd;
SELECT 'auth_user_permissions' AS tbl, COUNT(*) AS rows_for_company FROM auth_user_permissions WHERE company_cd = @company_cd;
SELECT 'sales_plan' AS tbl, COUNT(*) AS rows_for_company FROM sales_plan WHERE company_cd = @company_cd;
SELECT 'sales_plan_line' AS tbl, COUNT(*) AS rows_for_company FROM sales_plan_line WHERE company_cd = @company_cd;
SELECT 'sales_actual_line' AS tbl, COUNT(*) AS rows_for_company FROM sales_actual_line WHERE company_cd = @company_cd;
