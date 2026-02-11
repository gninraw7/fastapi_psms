-- users.login_id 에서 '@' 이하 도메인 제거 (예: hhpark@klcube.co.kr -> hhpark)
-- 관련 테이블의 login_id/작성자ID 컬럼 동시 업데이트
-- 적용 대상: 모든 company_cd

SET @OLD_FK_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS tmp_login_id_strip_domain_map (
  company_cd varchar(20) NOT NULL,
  old_login_id varchar(50) NOT NULL,
  new_login_id varchar(50) NOT NULL,
  PRIMARY KEY (company_cd, old_login_id),
  KEY idx_tmp_login_id_strip_domain_map_new (company_cd, new_login_id)
);

TRUNCATE TABLE tmp_login_id_strip_domain_map;

INSERT INTO tmp_login_id_strip_domain_map (company_cd, old_login_id, new_login_id)
SELECT
  company_cd,
  login_id AS old_login_id,
  SUBSTRING_INDEX(login_id, '@', 1) AS new_login_id
FROM users
WHERE login_id IS NOT NULL
  AND login_id LIKE '%@%'
  AND SUBSTRING_INDEX(login_id, '@', 1) <> '';

-- 사전 확인(필요 시 확인용)
-- 1) 도메인 제거 후 중복 발생 여부 (company_cd 기준)
SELECT company_cd, new_login_id, COUNT(*) AS dup_cnt
FROM tmp_login_id_strip_domain_map
GROUP BY company_cd, new_login_id
HAVING COUNT(*) > 1;

-- 2) 기존 login_id 와 충돌 여부 (동일 company_cd 내)
SELECT u.company_cd, u.login_id AS existing_login_id, m.old_login_id AS email_login_id, m.new_login_id
FROM users u
JOIN tmp_login_id_strip_domain_map m
  ON u.company_cd = m.company_cd
 AND u.login_id = m.new_login_id
 AND u.login_id <> m.old_login_id;

START TRANSACTION;

-- ============================================================================
-- FK/사용자 ID 컬럼 업데이트
-- ============================================================================

-- auth_user_permissions
UPDATE auth_user_permissions a
LEFT JOIN tmp_login_id_strip_domain_map m_login
  ON a.company_cd = m_login.company_cd AND a.login_id = m_login.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON a.company_cd = m_created.company_cd AND a.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON a.company_cd = m_updated.company_cd AND a.updated_by = m_updated.old_login_id
SET a.login_id = COALESCE(m_login.new_login_id, a.login_id),
    a.created_by = COALESCE(m_created.new_login_id, a.created_by),
    a.updated_by = COALESCE(m_updated.new_login_id, a.updated_by)
WHERE m_login.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- login_history
UPDATE login_history lh
LEFT JOIN tmp_login_id_strip_domain_map m_login
  ON lh.company_cd = m_login.company_cd AND lh.login_id = m_login.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON lh.company_cd = m_created.company_cd AND lh.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON lh.company_cd = m_updated.company_cd AND lh.updated_by = m_updated.old_login_id
SET lh.login_id = COALESCE(m_login.new_login_id, lh.login_id),
    lh.created_by = COALESCE(m_created.new_login_id, lh.created_by),
    lh.updated_by = COALESCE(m_updated.new_login_id, lh.updated_by)
WHERE m_login.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- projects
UPDATE projects p
LEFT JOIN tmp_login_id_strip_domain_map m_manager
  ON p.company_cd = m_manager.company_cd AND p.manager_id = m_manager.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON p.company_cd = m_created.company_cd AND p.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON p.company_cd = m_updated.company_cd AND p.updated_by = m_updated.old_login_id
SET p.manager_id = COALESCE(m_manager.new_login_id, p.manager_id),
    p.created_by = COALESCE(m_created.new_login_id, p.created_by),
    p.updated_by = COALESCE(m_updated.new_login_id, p.updated_by)
WHERE m_manager.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- sales_actual_line
UPDATE sales_actual_line sal
LEFT JOIN tmp_login_id_strip_domain_map m_manager
  ON sal.company_cd = m_manager.company_cd AND sal.manager_id = m_manager.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON sal.company_cd = m_created.company_cd AND sal.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON sal.company_cd = m_updated.company_cd AND sal.updated_by = m_updated.old_login_id
SET sal.manager_id = COALESCE(m_manager.new_login_id, sal.manager_id),
    sal.created_by = COALESCE(m_created.new_login_id, sal.created_by),
    sal.updated_by = COALESCE(m_updated.new_login_id, sal.updated_by)
WHERE m_manager.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- sales_plan_line
UPDATE sales_plan_line spl
LEFT JOIN tmp_login_id_strip_domain_map m_manager
  ON spl.company_cd = m_manager.company_cd AND spl.manager_id = m_manager.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON spl.company_cd = m_created.company_cd AND spl.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON spl.company_cd = m_updated.company_cd AND spl.updated_by = m_updated.old_login_id
SET spl.manager_id = COALESCE(m_manager.new_login_id, spl.manager_id),
    spl.created_by = COALESCE(m_created.new_login_id, spl.created_by),
    spl.updated_by = COALESCE(m_updated.new_login_id, spl.updated_by)
WHERE m_manager.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- board_notices
UPDATE board_notices bn
LEFT JOIN tmp_login_id_strip_domain_map m_author
  ON bn.company_cd = m_author.company_cd AND bn.author_id = m_author.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON bn.company_cd = m_created.company_cd AND bn.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON bn.company_cd = m_updated.company_cd AND bn.updated_by = m_updated.old_login_id
SET bn.author_id = COALESCE(m_author.new_login_id, bn.author_id),
    bn.created_by = COALESCE(m_created.new_login_id, bn.created_by),
    bn.updated_by = COALESCE(m_updated.new_login_id, bn.updated_by)
WHERE m_author.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- board_notice_replies
UPDATE board_notice_replies br
LEFT JOIN tmp_login_id_strip_domain_map m_author
  ON br.company_cd = m_author.company_cd AND br.author_id = m_author.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON br.company_cd = m_created.company_cd AND br.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON br.company_cd = m_updated.company_cd AND br.updated_by = m_updated.old_login_id
SET br.author_id = COALESCE(m_author.new_login_id, br.author_id),
    br.created_by = COALESCE(m_created.new_login_id, br.created_by),
    br.updated_by = COALESCE(m_updated.new_login_id, br.updated_by)
WHERE m_author.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- board_notice_reads
UPDATE board_notice_reads brd
JOIN tmp_login_id_strip_domain_map m
  ON brd.company_cd = m.company_cd AND brd.reader_id = m.old_login_id
SET brd.reader_id = m.new_login_id;

-- board_notice_reactions
UPDATE board_notice_reactions brx
JOIN tmp_login_id_strip_domain_map m
  ON brx.company_cd = m.company_cd AND brx.user_id = m.old_login_id
SET brx.user_id = m.new_login_id;

-- project_history
UPDATE project_history ph
LEFT JOIN tmp_login_id_strip_domain_map m_creator
  ON ph.company_cd = m_creator.company_cd AND ph.creator_id = m_creator.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON ph.company_cd = m_created.company_cd AND ph.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON ph.company_cd = m_updated.company_cd AND ph.updated_by = m_updated.old_login_id
SET ph.creator_id = COALESCE(m_creator.new_login_id, ph.creator_id),
    ph.created_by = COALESCE(m_created.new_login_id, ph.created_by),
    ph.updated_by = COALESCE(m_updated.new_login_id, ph.updated_by)
WHERE m_creator.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- tmp_invalid_project_manager_id (백업 테이블)
UPDATE tmp_invalid_project_manager_id t
JOIN tmp_login_id_strip_domain_map m
  ON t.company_cd = m.company_cd AND t.manager_id = m.old_login_id
SET t.manager_id = m.new_login_id;

-- tbl_file_storage (업로드 사용자)
UPDATE tbl_file_storage tfs
JOIN tmp_login_id_strip_domain_map m
  ON tfs.company_cd = m.company_cd AND tfs.upload_user = m.old_login_id
SET tfs.upload_user = m.new_login_id;

-- ============================================================================
-- created_by / updated_by 컬럼 업데이트 (로그인ID 참조 컬럼)
-- ============================================================================

UPDATE auth_forms t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE auth_permissions t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE auth_role_permissions t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE clients t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE comm_code t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE companies t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE industry_fields t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE org_units t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE project_attributes t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE project_contracts t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE project_sales t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE sales_plan t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE service_codes t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE notice_templates t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE uploaded_files t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON t.company_cd = m_updated.company_cd AND t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE board_notice_files t
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON t.company_cd = m_created.company_cd AND t.created_by = m_created.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by)
WHERE m_created.old_login_id IS NOT NULL;

-- ============================================================================
-- users (login_id, created_by, updated_by) 업데이트 (마지막에 수행)
-- ============================================================================

UPDATE users u
LEFT JOIN tmp_login_id_strip_domain_map m_login
  ON u.company_cd = m_login.company_cd AND u.login_id = m_login.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_created
  ON u.company_cd = m_created.company_cd AND u.created_by = m_created.old_login_id
LEFT JOIN tmp_login_id_strip_domain_map m_updated
  ON u.company_cd = m_updated.company_cd AND u.updated_by = m_updated.old_login_id
SET u.login_id = COALESCE(m_login.new_login_id, u.login_id),
    u.created_by = COALESCE(m_created.new_login_id, u.created_by),
    u.updated_by = COALESCE(m_updated.new_login_id, u.updated_by)
WHERE m_login.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

COMMIT;

SET FOREIGN_KEY_CHECKS = @OLD_FK_CHECKS;

DROP TABLE IF EXISTS tmp_login_id_strip_domain_map;
