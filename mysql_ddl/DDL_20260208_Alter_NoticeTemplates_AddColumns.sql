-- DDL_20260208_Alter_NoticeTemplates_AddColumns.sql
-- notice_templates 컬럼/인덱스 추가 (기존 테이블용)

SET @schema = DATABASE();
SET @table = 'notice_templates';

-- category 컬럼 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE notice_templates ADD COLUMN `category` varchar(50) DEFAULT NULL COMMENT ''분류''',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = @table AND column_name = 'category'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sort_order 컬럼 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE notice_templates ADD COLUMN `sort_order` int DEFAULT 0 COMMENT ''정렬 순서''',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = @table AND column_name = 'sort_order'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_shared 컬럼 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE notice_templates ADD COLUMN `is_shared` char(1) DEFAULT ''N'' COMMENT ''공유 여부 (Y/N)''',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = @table AND column_name = 'is_shared'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 인덱스 추가 (company_cd, sort_order)
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE notice_templates ADD KEY `idx_notice_templates_sort` (`company_cd`, `sort_order`)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = @schema AND table_name = @table AND index_name = 'idx_notice_templates_sort'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
