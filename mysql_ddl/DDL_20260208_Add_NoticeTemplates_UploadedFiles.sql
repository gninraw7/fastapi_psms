-- DDL_20260208_Add_NoticeTemplates_UploadedFiles.sql
-- 공지 템플릿/업로드 파일 테이블 추가

CREATE TABLE IF NOT EXISTS `notice_templates` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `template_id` int NOT NULL AUTO_INCREMENT COMMENT '템플릿 ID',
  `title` varchar(100) NOT NULL COMMENT '템플릿 제목',
  `content` text NOT NULL COMMENT '템플릿 내용',
  `category` varchar(50) DEFAULT NULL COMMENT '분류',
  `sort_order` int DEFAULT 0 COMMENT '정렬 순서',
  `is_shared` char(1) DEFAULT 'N' COMMENT '공유 여부 (Y/N)',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`, `template_id`),
  UNIQUE KEY `uk_notice_templates_id` (`template_id`),
  KEY `idx_notice_templates_use` (`company_cd`, `is_use`),
  KEY `idx_notice_templates_sort` (`company_cd`, `sort_order`),
  CONSTRAINT `fk_notice_templates_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='공지 템플릿';


CREATE TABLE IF NOT EXISTS `uploaded_files` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `file_id` int NOT NULL AUTO_INCREMENT COMMENT '파일 ID',
  `original_name` varchar(255) NOT NULL COMMENT '원본 파일명',
  `stored_name` varchar(255) NOT NULL COMMENT '저장 파일명',
  `file_path` varchar(500) NOT NULL COMMENT '저장 경로',
  `file_url` varchar(500) NOT NULL COMMENT '접근 URL',
  `mime_type` varchar(100) DEFAULT NULL COMMENT 'MIME 타입',
  `file_size` bigint DEFAULT NULL COMMENT '파일 크기(byte)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`, `file_id`),
  UNIQUE KEY `uk_uploaded_files_id` (`file_id`),
  KEY `idx_uploaded_files_company` (`company_cd`),
  CONSTRAINT `fk_uploaded_files_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='업로드 파일';


CREATE TABLE IF NOT EXISTS `board_notice_replies` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `reply_id` int NOT NULL AUTO_INCREMENT COMMENT '답글 ID',
  `notice_id` int NOT NULL COMMENT '공지 ID',
  `author_id` varchar(50) NOT NULL COMMENT '작성자 ID',
  `content` text NOT NULL COMMENT '답글 내용',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`, `reply_id`),
  UNIQUE KEY `uk_board_notice_replies_id` (`reply_id`),
  KEY `idx_board_notice_replies_notice` (`company_cd`, `notice_id`),
  CONSTRAINT `fk_board_notice_replies_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `fk_board_notice_replies_notice` FOREIGN KEY (`company_cd`, `notice_id`) REFERENCES `board_notices` (`company_cd`, `notice_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_board_notice_replies_author` FOREIGN KEY (`company_cd`, `author_id`) REFERENCES `users` (`company_cd`, `login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='공지 답글';
