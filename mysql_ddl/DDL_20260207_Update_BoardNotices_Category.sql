-- DDL_20260207_Update_BoardNotices_Category.sql
-- board_notices.category 를 SYSTEM/GENERAL/URGENT 중 임의값으로 업데이트 (company_cd=TESTCOMP)

UPDATE board_notices
SET category = ELT(1 + FLOOR(RAND() * 3), 'SYSTEM', 'GENERAL', 'URGENT')
WHERE company_cd = 'TESTCOMP';
