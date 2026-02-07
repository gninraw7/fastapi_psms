-- DDL_20260207_Seed_RolePermissions_TESTCOMP.sql
-- auth_permissions 테이블 제거 후 auth_role_permissions에 기본 권한 생성 (company_cd = 'TESTCOMP')

DROP TABLE IF EXISTS `auth_permissions`;

INSERT INTO `auth_role_permissions` (
  `company_cd`, `role`, `form_id`,
  `can_view`, `can_create`, `can_update`, `can_delete`,
  `created_by`, `updated_by`
)
SELECT
  'TESTCOMP' AS company_cd,
  r.role,
  f.form_id,
  'Y' AS can_view,
  CASE WHEN r.role IN ('ADMIN','USER') THEN 'Y' ELSE 'N' END AS can_create,
  CASE WHEN r.role IN ('ADMIN','USER') THEN 'Y' ELSE 'N' END AS can_update,
  CASE WHEN r.role IN ('ADMIN','USER') THEN 'Y' ELSE 'N' END AS can_delete,
  'system' AS created_by,
  'system' AS updated_by
FROM auth_forms f
CROSS JOIN (
  SELECT 'ADMIN' AS role
  UNION ALL SELECT 'USER'
  UNION ALL SELECT 'VIEWER'
) r
WHERE f.company_cd = 'TESTCOMP'
ON DUPLICATE KEY UPDATE
  can_view = VALUES(can_view),
  can_create = VALUES(can_create),
  can_update = VALUES(can_update),
  can_delete = VALUES(can_delete),
  updated_by = VALUES(updated_by);
