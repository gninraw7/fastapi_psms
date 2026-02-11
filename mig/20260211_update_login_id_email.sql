-- 사용자 login_id(이름 -> 이메일) 및 연관 컬럼 일괄 업데이트
-- 적용 대상: 모든 company_cd
-- 주의: FK 제약으로 인해 FOREIGN_KEY_CHECKS 를 임시 비활성화 후 진행

SET @OLD_FK_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS tmp_login_id_map_work (
  old_login_id varchar(50) NOT NULL,
  new_login_id varchar(50) NOT NULL,
  PRIMARY KEY (old_login_id),
  UNIQUE KEY uk_tmp_login_id_map_work_new (new_login_id)
);

TRUNCATE TABLE tmp_login_id_map_work;

INSERT INTO tmp_login_id_map_work (old_login_id, new_login_id) VALUES
('함영민', 'ymham@klcube.co.kr'),
('임철현', 'lim9986@klcube.co.kr'),
('이동욱', 'dwlee@klcube.co.kr'),
('윤지선', 'jsyoun@klcube.co.kr'),
('오민규', 'omkyu747@klcube.co.kr'),
('양승구', 'yskyang@klcube.co.kr'),
('심재홍', 'jhsim@klcube.co.kr'),
('박현우', 'hhpark@klcube.co.kr');

-- 사전 확인(필요 시 확인용)
-- 1) 매핑 대상 users 존재 여부
SELECT m.old_login_id
FROM tmp_login_id_map_work m
LEFT JOIN users u ON u.login_id = m.old_login_id
WHERE u.login_id IS NULL;

-- 2) 변경 후 login_id 중복 여부(동일 company_cd 내)
SELECT u.company_cd, u.login_id AS old_login_id, m.new_login_id
FROM users u
JOIN (SELECT * FROM tmp_login_id_map_work) m ON u.login_id = m.old_login_id
JOIN users u2 ON u2.company_cd = u.company_cd AND u2.login_id = m.new_login_id;

START TRANSACTION;

-- ============================================================================
-- FK/사용자 ID 컬럼 업데이트
-- ============================================================================

-- auth_user_permissions
UPDATE auth_user_permissions a
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_login ON a.login_id = m_login.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON a.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON a.updated_by = m_updated.old_login_id
SET a.login_id = COALESCE(m_login.new_login_id, a.login_id),
    a.created_by = COALESCE(m_created.new_login_id, a.created_by),
    a.updated_by = COALESCE(m_updated.new_login_id, a.updated_by)
WHERE m_login.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- login_history
UPDATE login_history lh
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_login ON lh.login_id = m_login.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON lh.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON lh.updated_by = m_updated.old_login_id
SET lh.login_id = COALESCE(m_login.new_login_id, lh.login_id),
    lh.created_by = COALESCE(m_created.new_login_id, lh.created_by),
    lh.updated_by = COALESCE(m_updated.new_login_id, lh.updated_by)
WHERE m_login.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- projects
UPDATE projects p
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_manager ON p.manager_id = m_manager.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON p.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON p.updated_by = m_updated.old_login_id
SET p.manager_id = COALESCE(m_manager.new_login_id, p.manager_id),
    p.created_by = COALESCE(m_created.new_login_id, p.created_by),
    p.updated_by = COALESCE(m_updated.new_login_id, p.updated_by)
WHERE m_manager.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- sales_actual_line
UPDATE sales_actual_line sal
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_manager ON sal.manager_id = m_manager.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON sal.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON sal.updated_by = m_updated.old_login_id
SET sal.manager_id = COALESCE(m_manager.new_login_id, sal.manager_id),
    sal.created_by = COALESCE(m_created.new_login_id, sal.created_by),
    sal.updated_by = COALESCE(m_updated.new_login_id, sal.updated_by)
WHERE m_manager.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- sales_plan_line
UPDATE sales_plan_line spl
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_manager ON spl.manager_id = m_manager.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON spl.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON spl.updated_by = m_updated.old_login_id
SET spl.manager_id = COALESCE(m_manager.new_login_id, spl.manager_id),
    spl.created_by = COALESCE(m_created.new_login_id, spl.created_by),
    spl.updated_by = COALESCE(m_updated.new_login_id, spl.updated_by)
WHERE m_manager.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- board_notices
UPDATE board_notices bn
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_author ON bn.author_id = m_author.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON bn.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON bn.updated_by = m_updated.old_login_id
SET bn.author_id = COALESCE(m_author.new_login_id, bn.author_id),
    bn.created_by = COALESCE(m_created.new_login_id, bn.created_by),
    bn.updated_by = COALESCE(m_updated.new_login_id, bn.updated_by)
WHERE m_author.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- board_notice_replies
UPDATE board_notice_replies br
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_author ON br.author_id = m_author.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON br.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON br.updated_by = m_updated.old_login_id
SET br.author_id = COALESCE(m_author.new_login_id, br.author_id),
    br.created_by = COALESCE(m_created.new_login_id, br.created_by),
    br.updated_by = COALESCE(m_updated.new_login_id, br.updated_by)
WHERE m_author.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- board_notice_reads
UPDATE board_notice_reads brd
JOIN (SELECT * FROM tmp_login_id_map_work) m ON brd.reader_id = m.old_login_id
SET brd.reader_id = m.new_login_id;

-- board_notice_reactions
UPDATE board_notice_reactions brx
JOIN (SELECT * FROM tmp_login_id_map_work) m ON brx.user_id = m.old_login_id
SET brx.user_id = m.new_login_id;

-- project_history
UPDATE project_history ph
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_creator ON ph.creator_id = m_creator.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON ph.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON ph.updated_by = m_updated.old_login_id
SET ph.creator_id = COALESCE(m_creator.new_login_id, ph.creator_id),
    ph.created_by = COALESCE(m_created.new_login_id, ph.created_by),
    ph.updated_by = COALESCE(m_updated.new_login_id, ph.updated_by)
WHERE m_creator.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- tmp_invalid_project_manager_id (백업 테이블)
UPDATE tmp_invalid_project_manager_id t
JOIN (SELECT * FROM tmp_login_id_map_work) m ON t.manager_id = m.old_login_id
SET t.manager_id = m.new_login_id;

-- tbl_file_storage (업로드 사용자)
UPDATE tbl_file_storage tfs
JOIN (SELECT * FROM tmp_login_id_map_work) m ON tfs.upload_user = m.old_login_id
SET tfs.upload_user = m.new_login_id;

-- ============================================================================
-- created_by / updated_by 컬럼 업데이트 (로그인ID 참조 컬럼)
-- ============================================================================

UPDATE auth_forms t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE auth_permissions t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE auth_role_permissions t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE clients t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE comm_code t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE companies t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE industry_fields t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE org_units t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE project_attributes t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE project_contracts t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE project_sales t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE sales_plan t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE service_codes t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE notice_templates t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE uploaded_files t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON t.updated_by = m_updated.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by),
    t.updated_by = COALESCE(m_updated.new_login_id, t.updated_by)
WHERE m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

UPDATE board_notice_files t
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON t.created_by = m_created.old_login_id
SET t.created_by = COALESCE(m_created.new_login_id, t.created_by)
WHERE m_created.old_login_id IS NOT NULL;

-- ============================================================================
-- users (login_id, created_by, updated_by) 업데이트 (마지막에 수행)
-- ============================================================================

UPDATE users u
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_login ON u.login_id = m_login.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_created ON u.created_by = m_created.old_login_id
LEFT JOIN (SELECT * FROM tmp_login_id_map_work) m_updated ON u.updated_by = m_updated.old_login_id
SET u.login_id = COALESCE(m_login.new_login_id, u.login_id),
    u.created_by = COALESCE(m_created.new_login_id, u.created_by),
    u.updated_by = COALESCE(m_updated.new_login_id, u.updated_by)
WHERE m_login.old_login_id IS NOT NULL
   OR m_created.old_login_id IS NOT NULL
   OR m_updated.old_login_id IS NOT NULL;

-- users 비밀번호 초기화 (초기 PW: 1234)
UPDATE users u
JOIN (SELECT * FROM tmp_login_id_map_work) m ON u.login_id = m.new_login_id
SET u.password = '$2b$12$5vwdLcP1ZS7oTvAHF9w5ne3wqZI4w18onsFWs7R9NnrPkMlcC3c0S',
    u.updated_by = u.login_id;

COMMIT;

SET FOREIGN_KEY_CHECKS = @OLD_FK_CHECKS;

DROP TABLE IF EXISTS tmp_login_id_map_work;
