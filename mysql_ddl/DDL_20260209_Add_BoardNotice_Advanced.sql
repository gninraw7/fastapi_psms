-- DDL_20260209_Add_BoardNotice_Advanced.sql
-- 게시판 확장: 상태/해시태그/읽음/반응/대댓글

SET @schema = DATABASE();

-- board_notices: status 컬럼 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE board_notices ADD COLUMN `status` varchar(20) DEFAULT ''NORMAL'' COMMENT ''상태 (NORMAL/IN_PROGRESS/DONE/HOLD)''',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = 'board_notices' AND column_name = 'status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- board_notices: hashtags 컬럼 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE board_notices ADD COLUMN `hashtags` varchar(500) DEFAULT NULL COMMENT ''해시태그(#tag #tag2)''',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = 'board_notices' AND column_name = 'hashtags'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- board_notices: status 인덱스 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE board_notices ADD KEY `idx_board_notices_status` (`company_cd`, `status`)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = @schema AND table_name = 'board_notices' AND index_name = 'idx_board_notices_status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 해시태그 테이블
CREATE TABLE IF NOT EXISTS `board_notice_tags` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `notice_id` int NOT NULL COMMENT '공지 ID',
  `tag` varchar(50) NOT NULL COMMENT '해시태그',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  PRIMARY KEY (`company_cd`, `notice_id`, `tag`),
  KEY `idx_board_notice_tags_tag` (`company_cd`, `tag`),
  CONSTRAINT `fk_board_notice_tags_notice` FOREIGN KEY (`company_cd`, `notice_id`) REFERENCES `board_notices` (`company_cd`, `notice_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='게시판 해시태그';

-- 읽음 테이블
CREATE TABLE IF NOT EXISTS `board_notice_reads` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `notice_id` int NOT NULL COMMENT '공지 ID',
  `reader_id` varchar(50) NOT NULL COMMENT '읽은 사용자 ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '읽음 일시',
  PRIMARY KEY (`company_cd`, `notice_id`, `reader_id`),
  KEY `idx_board_notice_reads_notice` (`company_cd`, `notice_id`),
  KEY `idx_board_notice_reads_reader` (`company_cd`, `reader_id`),
  CONSTRAINT `fk_board_notice_reads_notice` FOREIGN KEY (`company_cd`, `notice_id`) REFERENCES `board_notices` (`company_cd`, `notice_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_board_notice_reads_reader` FOREIGN KEY (`company_cd`, `reader_id`) REFERENCES `users` (`company_cd`, `login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='게시판 읽음 기록';

-- 반응 테이블
CREATE TABLE IF NOT EXISTS `board_notice_reactions` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `notice_id` int NOT NULL COMMENT '공지 ID',
  `user_id` varchar(50) NOT NULL COMMENT '사용자 ID',
  `reaction` varchar(20) NOT NULL COMMENT '반응 유형(LIKE/CHECK)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '반응 일시',
  PRIMARY KEY (`company_cd`, `notice_id`, `user_id`, `reaction`),
  KEY `idx_board_notice_reactions_notice` (`company_cd`, `notice_id`),
  KEY `idx_board_notice_reactions_type` (`company_cd`, `reaction`),
  CONSTRAINT `fk_board_notice_reactions_notice` FOREIGN KEY (`company_cd`, `notice_id`) REFERENCES `board_notices` (`company_cd`, `notice_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_board_notice_reactions_user` FOREIGN KEY (`company_cd`, `user_id`) REFERENCES `users` (`company_cd`, `login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='게시판 반응';

-- board_notice_replies: parent_reply_id 컬럼 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE board_notice_replies ADD COLUMN `parent_reply_id` int DEFAULT NULL COMMENT ''대댓글 대상 답글 ID''',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = @schema AND table_name = 'board_notice_replies' AND column_name = 'parent_reply_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- board_notice_replies: parent_reply_id 인덱스 추가
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE board_notice_replies ADD KEY `idx_board_notice_replies_parent` (`company_cd`, `parent_reply_id`)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = @schema AND table_name = 'board_notice_replies' AND index_name = 'idx_board_notice_replies_parent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK용 단일 컬럼 인덱스 추가 (parent_reply_id)
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE board_notice_replies ADD KEY `idx_board_notice_replies_parent_id` (`parent_reply_id`)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = @schema AND table_name = 'board_notice_replies' AND index_name = 'idx_board_notice_replies_parent_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- board_notice_replies: 잘못된 FK 제거 (있다면)
SET @sql := (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE board_notice_replies DROP FOREIGN KEY `fk_board_notice_replies_parent`',
    'SELECT 1')
  FROM information_schema.table_constraints
  WHERE table_schema = @schema AND table_name = 'board_notice_replies' AND constraint_name = 'fk_board_notice_replies_parent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- board_notice_replies: parent_reply_id FK 추가 (reply_id 단일 참조)
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE board_notice_replies ADD CONSTRAINT `fk_board_notice_replies_parent` FOREIGN KEY (`parent_reply_id`) REFERENCES `board_notice_replies` (`reply_id`) ON DELETE SET NULL',
    'SELECT 1')
  FROM information_schema.table_constraints
  WHERE table_schema = @schema AND table_name = 'board_notice_replies' AND constraint_name = 'fk_board_notice_replies_parent'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
