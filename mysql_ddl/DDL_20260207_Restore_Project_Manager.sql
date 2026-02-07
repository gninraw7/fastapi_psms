-- DDL_20260207_Restore_Project_Manager.sql
-- tmp_invalid_project_manager_id 기준 manager_id 복구 매핑

-- 0) 매핑 테이블 준비
CREATE TABLE IF NOT EXISTS `tmp_manager_id_map` (
  `company_cd` varchar(20) NOT NULL,
  `old_manager_id` varchar(50) NOT NULL,
  `new_login_id` varchar(50) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`company_cd`, `old_manager_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='manager_id 복구 매핑 테이블';

-- 1) 자동 매핑 시도 (users.user_name = old_manager_id 가정)
-- 충돌(동명이인) 가능하므로 결과를 반드시 확인
INSERT INTO tmp_manager_id_map (company_cd, old_manager_id, new_login_id, note)
SELECT t.company_cd, t.manager_id, u.login_id, 'auto: user_name match'
FROM tmp_invalid_project_manager_id t
JOIN users u
  ON u.company_cd = t.company_cd
 AND u.user_name = t.manager_id
ON DUPLICATE KEY UPDATE new_login_id = VALUES(new_login_id), note = VALUES(note);

-- 2) 매핑 누락/중복 점검
-- 2-1) 매핑 누락
SELECT t.company_cd, t.manager_id, COUNT(m.new_login_id) AS mapped_cnt
FROM tmp_invalid_project_manager_id t
LEFT JOIN tmp_manager_id_map m
  ON m.company_cd = t.company_cd
 AND m.old_manager_id = t.manager_id
GROUP BY t.company_cd, t.manager_id
HAVING mapped_cnt = 0;

-- 2-2) 동명이인(자동 매핑 다중 후보) 확인
SELECT t.company_cd, t.manager_id, COUNT(u.login_id) AS candidate_cnt
FROM tmp_invalid_project_manager_id t
JOIN users u
  ON u.company_cd = t.company_cd
 AND u.user_name = t.manager_id
GROUP BY t.company_cd, t.manager_id
HAVING candidate_cnt > 1;

-- 3) 수동 매핑 예시 (필요 시 추가)
-- INSERT INTO tmp_manager_id_map (company_cd, old_manager_id, new_login_id, note)
-- VALUES ('TESTCOMP', '박현후', 'parkhh', 'manual');

-- 4) 복구 적용 (projects.manager_id 복구)
UPDATE projects p
JOIN tmp_invalid_project_manager_id t
  ON t.company_cd = p.company_cd
 AND t.pipeline_id = p.pipeline_id
JOIN tmp_manager_id_map m
  ON m.company_cd = t.company_cd
 AND m.old_manager_id = t.manager_id
SET p.manager_id = m.new_login_id;

-- 5) 결과 확인
SELECT p.company_cd, p.pipeline_id, p.manager_id
FROM projects p
JOIN tmp_invalid_project_manager_id t
  ON t.company_cd = p.company_cd
 AND t.pipeline_id = p.pipeline_id
ORDER BY p.pipeline_id;

-- 6) (선택) 완료 후 tmp_invalid_project_manager_id 정리
-- DELETE FROM tmp_invalid_project_manager_id;
