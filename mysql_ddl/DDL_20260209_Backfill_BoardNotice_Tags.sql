-- DDL_20260209_Backfill_BoardNotice_Tags.sql
-- board_notices.hashtags 값을 board_notice_tags 로 백필
-- MySQL 8.0+ (WITH RECURSIVE 필요)

-- 특정 회사만 처리하려면 아래 값을 설정
SET @company_cd = NULL; -- 예: 'TESTCOMP'

-- (선택) 기존 태그 초기화
-- SET @clear_tags = 1; -- 1이면 삭제
-- IF @clear_tags = 1 THEN
--   DELETE FROM board_notice_tags WHERE (@company_cd IS NULL OR company_cd = @company_cd);
-- END IF;

WITH RECURSIVE seq AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < 30
),
source AS (
    SELECT
        company_cd,
        notice_id,
        TRIM(REPLACE(REPLACE(hashtags, ',', ' '), '  ', ' ')) AS tag_str
    FROM board_notices
    WHERE hashtags IS NOT NULL
      AND hashtags <> ''
      AND (@company_cd IS NULL OR company_cd = @company_cd)
),
split AS (
    SELECT
        s.company_cd,
        s.notice_id,
        TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.tag_str, ' ', seq.n), ' ', -1), '#', '')) AS tag
    FROM source s
    JOIN seq
      ON seq.n <= 1 + (LENGTH(s.tag_str) - LENGTH(REPLACE(s.tag_str, ' ', '')))
)
INSERT IGNORE INTO board_notice_tags (company_cd, notice_id, tag)
SELECT company_cd, notice_id, LOWER(tag)
FROM split
WHERE tag IS NOT NULL
  AND tag <> '';

-- =====================================================================
-- MySQL 5.7용 대체 (WITH RECURSIVE 미지원) - 필요 시 아래 블록 사용
-- =====================================================================
-- INSERT IGNORE INTO board_notice_tags (company_cd, notice_id, tag)
-- SELECT
--     s.company_cd,
--     s.notice_id,
--     LOWER(TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.tag_str, ' ', n.n), ' ', -1), '#', ''))) AS tag
-- FROM (
--     SELECT
--         company_cd,
--         notice_id,
--         TRIM(REPLACE(REPLACE(hashtags, ',', ' '), '  ', ' ')) AS tag_str
--     FROM board_notices
--     WHERE hashtags IS NOT NULL
--       AND hashtags <> ''
--       AND (@company_cd IS NULL OR company_cd = @company_cd)
-- ) s
-- JOIN (
--     SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
--     UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
--     UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15
--     UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 UNION ALL SELECT 20
--     UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 UNION ALL SELECT 25
--     UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 UNION ALL SELECT 30
-- ) n
--   ON n.n <= 1 + (LENGTH(s.tag_str) - LENGTH(REPLACE(s.tag_str, ' ', '')))
-- WHERE TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(s.tag_str, ' ', n.n), ' ', -1), '#', '')) <> '';
