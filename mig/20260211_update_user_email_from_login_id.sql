-- users.email을 login_id(이메일 형식)로 동기화
-- 적용 대상: 모든 company_cd

START TRANSACTION;

UPDATE users
SET email = login_id,
    updated_by = COALESCE(updated_by, login_id)
WHERE login_id LIKE '%@%'
  AND (email IS NULL OR email <> login_id);

COMMIT;
