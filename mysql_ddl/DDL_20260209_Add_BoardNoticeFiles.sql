-- DDL_20260209_Add_BoardNoticeFiles.sql
-- 게시판 첨부 파일 매핑 테이블 추가

CREATE TABLE IF NOT EXISTS `board_notice_files` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `map_id` int NOT NULL AUTO_INCREMENT COMMENT '매핑 ID',
  `notice_id` int NOT NULL COMMENT '공지 ID',
  `reply_id` int DEFAULT NULL COMMENT '답글 ID',
  `file_id` int NOT NULL COMMENT '파일 ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  PRIMARY KEY (`company_cd`, `map_id`),
  UNIQUE KEY `uk_board_notice_files_id` (`map_id`),
  UNIQUE KEY `uk_board_notice_files_link` (`company_cd`, `notice_id`, `reply_id`, `file_id`),
  KEY `idx_board_notice_files_notice` (`company_cd`, `notice_id`),
  KEY `idx_board_notice_files_reply` (`company_cd`, `reply_id`),
  KEY `idx_board_notice_files_file` (`company_cd`, `file_id`),
  CONSTRAINT `fk_board_notice_files_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `fk_board_notice_files_notice` FOREIGN KEY (`company_cd`, `notice_id`) REFERENCES `board_notices` (`company_cd`, `notice_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_board_notice_files_reply` FOREIGN KEY (`company_cd`, `reply_id`) REFERENCES `board_notice_replies` (`company_cd`, `reply_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_board_notice_files_file` FOREIGN KEY (`company_cd`, `file_id`) REFERENCES `uploaded_files` (`company_cd`, `file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='게시판 첨부 파일 매핑';
