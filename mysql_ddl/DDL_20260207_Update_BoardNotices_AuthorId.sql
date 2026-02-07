-- DDL_20260207_Update_BoardNotices_AuthorId.sql
-- board_notices.author_id 를 users.login_id 중 임의값으로 업데이트 (company_cd=TESTCOMP)

UPDATE board_notices n
SET n.author_id = (
    SELECT u.login_id
    FROM users u
    WHERE u.company_cd = n.company_cd
    ORDER BY RAND()
    LIMIT 1
)
WHERE n.company_cd = 'TESTCOMP';
