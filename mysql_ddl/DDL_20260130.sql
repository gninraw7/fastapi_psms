-- 1. 사용자 정보 (users)
CREATE TABLE `users` (
  `user_no` int NOT NULL AUTO_INCREMENT COMMENT '사용자 내부 일련번호',
  `login_id` varchar(50) NOT NULL COMMENT '로그인 아이디',
  `password` varchar(255) NOT NULL COMMENT '암호화된 비밀번호',
  `user_name` varchar(100) NOT NULL COMMENT '사용자 성명',
  `role` varchar(20) NOT NULL COMMENT '사용자 권한 (ADMIN, USER 등)',
  `is_sales_rep` TINYINT(1) DEFAULT 0 NOT NULL COMMENT '영업담당 여부 (1: 담당, 0: 미담당)'
  `email` varchar(100) DEFAULT NULL COMMENT '이메일 주소',
  `phone` varchar(20) DEFAULT NULL COMMENT '연락처',
  `headquarters` varchar(100) DEFAULT NULL COMMENT '소속 본부',
  `department` varchar(100) DEFAULT NULL COMMENT '소속 부서',
  `team` varchar(100) DEFAULT NULL COMMENT '소속 팀',
  `start_date` date NOT NULL COMMENT '입사일/권한시작일',
  `end_date` date DEFAULT '9999-12-31' COMMENT '퇴사일/권한종료일',
  `status` varchar(20) DEFAULT 'ACTIVE' COMMENT '계정 상태 (ACTIVE, INACTIVE, LOCK)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`user_no`),
  UNIQUE KEY `login_id` (`login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='시스템 사용자 마스터 정보';

-- 2. 공통 코드 (comm_code)
CREATE TABLE `comm_code` (
  `group_code` varchar(20) NOT NULL COMMENT '그룹 코드 (예: STAGE, FIELD)',
  `code` varchar(20) NOT NULL COMMENT '상세 코드 값',
  `code_name` varchar(100) NOT NULL COMMENT '코드 명칭',
  `sort_order` int DEFAULT '0' COMMENT '정렬 순서',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`group_code`,`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='시스템 공통 코드 관리';

-- 3. 고객사 정보 (clients)
CREATE TABLE `clients` (
  `client_id` int NOT NULL AUTO_INCREMENT COMMENT '고객사 일련번호',
  `client_name` varchar(100) NOT NULL COMMENT '고객사/협력사 명칭',
  `business_number` VARCHAR(20) NULL COMMENT '사업자등록번호'
  `ceo_name` VARCHAR(50) NULL COMMENT '대표자명',
  `address` VARCHAR(200) NULL COMMENT '주소',
  `phone` VARCHAR(20) NULL COMMENT '전화번호',
  `email` VARCHAR(100) NULL COMMENT '이메일',
  `fax` VARCHAR(20) NULL COMMENT '팩스번호',
  `homepage` VARCHAR(200) NULL COMMENT '홈페이지 URL',
  `industry_type` VARCHAR(50) NULL COMMENT '업종',
  `employee_count` INT NULL COMMENT '직원 수',
  `established_date` DATE NULL COMMENT '설립일자',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '활성 상태 (TRUE: 활성, FALSE: 비활성)',
  `remarks` TEXT NULL COMMENT '비고',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`client_id`),
  UNIQUE KEY `client_name` (`client_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='고객사 및 발주처 정보 마스터';

-- 6. 사업자등록번호에 인덱스 추가 (검색 성능 향상)
ALTER TABLE clients 
ADD INDEX idx_business_number (business_number);

-- 7. 전화번호에 인덱스 추가 (검색 성능 향상)
ALTER TABLE clients 
ADD INDEX idx_phone (phone);

-- 8. 활성 상태에 인덱스 추가 (필터링 성능 향상)
ALTER TABLE clients 
ADD INDEX idx_is_active (is_active);

-- 4. 프로젝트 기본 (projects)
CREATE TABLE `projects` (
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호 (YYYY_SEQ)',
  `project_name` varchar(255) NOT NULL COMMENT '프로젝트 명칭',
  `field_code` varchar(20) DEFAULT NULL COMMENT '사업분야 코드 (FIELD)',
  `manager_id` varchar(50) DEFAULT NULL COMMENT '담당 영업대표 ID',
  `customer_id` int DEFAULT NULL COMMENT '최종 고객사 ID',
  `ordering_party_id` int DEFAULT NULL COMMENT '발주처 ID',
  `current_stage` varchar(20) DEFAULT NULL COMMENT '현재 진행 단계 (STAGE)',
  `quoted_amount` decimal(18,2) DEFAULT '0.00' COMMENT '제안/견적 금액',
  `win_probability` INT DEFAULT 0 COMMENT '수주확률 (0-100%)',
  `notes` TEXT COMMENT '비고',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`pipeline_id`),
  KEY `customer_id` (`customer_id`),
  KEY `ordering_party_id` (`ordering_party_id`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `clients` (`client_id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`ordering_party_id`) REFERENCES `clients` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='프로젝트 파이프라인 기본 정보';

-- 5. 프로젝트 계약 상세 (project_contracts)
CREATE TABLE `project_contracts` (
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호',
  `contract_date` date DEFAULT NULL COMMENT '계약 체결일',
  `start_date` date DEFAULT NULL COMMENT '수행 시작일',
  `end_date` date DEFAULT NULL COMMENT '수행 종료일',
  `order_amount` decimal(18,2) DEFAULT '0.00' COMMENT '수주 금액 (원가 포함)',
  `contract_amount` decimal(18,2) DEFAULT '0.00' COMMENT '최종 계약 금액',
  `remarks` text COMMENT '계약 관련 비고 사항',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`pipeline_id`),
  CONSTRAINT `project_contracts_ibfk_1` FOREIGN KEY (`pipeline_id`) REFERENCES `projects` (`pipeline_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='프로젝트 계약 및 기간 상세 정보';

-- 6. 매출 실적 (sales_performance)
CREATE TABLE `sales_performance` (
  `sales_id` int NOT NULL AUTO_INCREMENT COMMENT '매출 실적 일련번호',
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호',
  `sales_date` date NOT NULL COMMENT '매출 발생/인식 일자',
  `sales_amount` decimal(18,2) DEFAULT '0.00' COMMENT '매출 금액',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`sales_id`),
  UNIQUE KEY `uk_pipeline_date` (`pipeline_id`,`sales_date`),
  CONSTRAINT `sales_performance_ibfk_1` FOREIGN KEY (`pipeline_id`) REFERENCES `projects` (`pipeline_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='월별/분기별 매출 실적 기록';

-- 7. 프로젝트 변경 이력 (project_history)
CREATE TABLE `project_history` (
  `history_id` int NOT NULL AUTO_INCREMENT COMMENT '이력 일련번호',
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호',
  `base_date` date DEFAULT NULL COMMENT '기준 일자',
  `record_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '기록 일시',
  `progress_stage` varchar(20) DEFAULT NULL COMMENT '당시 진행 단계',
  `strategy_content` text COMMENT '영업 전략 및 진행 상황 상세',
  `creator_id` varchar(50) DEFAULT NULL COMMENT '작성자 ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`history_id`),
  KEY `pipeline_id` (`pipeline_id`),
  CONSTRAINT `project_history_ibfk_1` FOREIGN KEY (`pipeline_id`) REFERENCES `projects` (`pipeline_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='프로젝트 단계별 진행 및 전략 이력';

-- 8. 접속 이력 (login_history)
CREATE TABLE `login_history` (
  `history_id` int NOT NULL AUTO_INCREMENT COMMENT '접속 로그 일련번호',
  `login_id` varchar(50) DEFAULT NULL COMMENT '사용자 로그인 ID',
  `action_type` varchar(20) DEFAULT NULL COMMENT '수행 작업 (LOGIN/LOGOUT)',
  `action_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수행 시각',
  `pc_name` varchar(100) DEFAULT NULL COMMENT '접속 PC/단말기 명칭',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`history_id`),
  KEY `login_id` (`login_id`),
  CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`login_id`) REFERENCES `users` (`login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자 시스템 접속 로그';

-- 2026.01.14 Auth CONTROL 
-- 1. 시스템 화면(UserForm) 마스터 테이블
CREATE TABLE `auth_forms` (
    `form_id` varchar(50) NOT NULL COMMENT 'VBA UserForm 객체 이름',
    `form_name` varchar(100) NOT NULL COMMENT '화면 한글명',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성일시',
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일시',
    `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
    `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
    PRIMARY KEY (`form_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='시스템 화면 마스터';

-- 2. 역할별 화면 접근 권한 설정 테이블
CREATE TABLE `auth_permissions` (
    `role` varchar(20) NOT NULL COMMENT '사용자 역할 (ADMIN, USER 등)',
    `form_id` varchar(50) NOT NULL COMMENT '화면 ID',
    `can_view` char(1) DEFAULT 'N' COMMENT '조회 권한',
    `can_create` char(1) DEFAULT 'N' COMMENT '신규 추가 권한',
    `can_update` char(1) DEFAULT 'N' COMMENT '수정/저장 권한',
    `can_delete` char(1) DEFAULT 'N' COMMENT '삭제 권한',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성일시',
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일시',
    `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
    `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
    PRIMARY KEY (`role`, `form_id`),
    CONSTRAINT `fk_auth_form` FOREIGN KEY (`form_id`) REFERENCES `auth_forms` (`form_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='역할별 세부 권한 설정';

-- 초기 데이터 예시 (일반 사용자는 조회만, 관리자는 CUD 가능)
INSERT INTO auth_forms (form_id, form_name) VALUES 
('FrmProjectReg', '사업 파이프라인 등록 및 관리'),
('FrmProjectPopup', '프로젝트 검색'),
('FrmHistoryReg', '진행상황 및 영업전략 관리'),
('FrmClientReg', '거래처 관리'),
('FrmClientPopup', '거래처 검색'),
('FrmCommCode', '공통코드 설정'),
('FrmExportOptions', '프로젝트 정보 출력'),
('FrmUsers', '사용자관리'),
('FrmAdminConfig', 'DB연결 설정');

INSERT INTO auth_role_permissions (role, form_id, can_view, can_create, can_update, can_delete) 
VALUES ('Viewer', 'FrmProjectReg', 'Y', 'N', 'N', 'N'),
       ('User', 'FrmProjectReg', 'Y', 'Y', 'Y', 'Y'),
       ('Admin', 'FrmProjectReg', 'Y', 'Y', 'Y', 'Y'),
	   ('Viewer', 'FrmProjectPopup', 'Y', 'N', 'N', 'N'),
	   ('User', 'FrmProjectPopup', 'Y', 'N', 'N', 'N' ),
       ('Admin', 'FrmProjectPopup', 'Y', 'N', 'N', 'N'),
	   ('Viewer', 'FrmHistoryReg', 'Y', 'N', 'N', 'N'),
	   ('User', 'FrmHistoryReg', 'Y', 'Y', 'Y', 'Y'),
       ('Admin', 'FrmHistoryReg', 'Y', 'Y', 'Y', 'Y'),
	   ('Viewer', 'FrmClientReg', 'Y', 'N', 'N', 'N'),
	   ('User', 'FrmClientReg', 'Y', 'Y', 'Y', 'Y'),
       ('Admin', 'FrmClientReg', 'Y', 'Y', 'Y', 'Y'),
	   ('Viewer', 'FrmClientPopup', 'Y', 'N', 'N', 'N'),
	   ('User', 'FrmClientPopup', 'Y', 'N', 'N', 'N'),
       ('Admin', 'FrmClientPopup', 'Y', 'N', 'N', 'N'),
	   ('Viewer', 'FrmCommCode', 'Y', 'N', 'N', 'N'),
	   ('User', 'FrmCommCode', 'Y', 'N', 'N', 'N'),
       ('Admin', 'FrmCommCode', 'Y', 'Y', 'Y', 'Y'),
	   ('Viewer', 'FrmUsers', 'Y', 'N', 'N', 'N'),
	   ('User', 'FrmUsers', 'Y', 'N', 'N', 'N'),
       ('Admin', 'FrmUsers', 'Y', 'Y', 'Y', 'Y'),
	   ('Viewer', 'FrmAdminConfig', 'Y', 'N', 'N', 'N'),
	   ('User', 'FrmAdminConfig', 'Y', 'N', 'N', 'N'),
       ('Admin', 'FrmAdminConfig', 'Y', 'Y', 'Y', 'Y');
	   

-- 1. 역할별 화면 권한 (기존 auth_permissions 역할)
CREATE TABLE `auth_role_permissions` (
    `role` varchar(20) NOT NULL,
    `form_id` varchar(50) NOT NULL,
    `can_view` char(1) DEFAULT 'N',
    `can_create` char(1) DEFAULT 'N',
    `can_update` char(1) DEFAULT 'N',
    `can_delete` char(1) DEFAULT 'N',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성일시',
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일시',
    `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
    `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
    PRIMARY KEY (`role`, `form_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='역할별 기본 권한';

-- 2. 사용자별 화면 권한 (신규: 역할 권한을 덮어씀)
CREATE TABLE `auth_user_permissions` (
    `login_id` varchar(50) NOT NULL,
    `form_id` varchar(50) NOT NULL,
    `can_view` char(1) DEFAULT NULL,   -- NULL이면 역할 설정을 따름
    `can_create` char(1) DEFAULT NULL,
    `can_update` char(1) DEFAULT NULL,
    `can_delete` char(1) DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성일시',
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일시',
    `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
    `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
    PRIMARY KEY (`login_id`, `form_id`),
    CONSTRAINT `fk_user_auth` FOREIGN KEY (`login_id`) REFERENCES `users` (`login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자별 개별 권한 (우선순위 높음)';

-- 공지사항 게시판 테이블 (board_notices) 2026.01.16
CREATE TABLE `board_notices` (
  `notice_id` int NOT NULL AUTO_INCREMENT COMMENT '공지사항 일련번호',
  `title` varchar(255) NOT NULL COMMENT '공지 제목',
  `content` text NOT NULL COMMENT '공지 내용(상세)',
  `is_fixed` char(1) DEFAULT 'N' COMMENT '상단 고정 여부 (Y/N)',
  `category` varchar(50) DEFAULT 'GENERAL' COMMENT '공지 분류 (시스템, 영업기획, 긴급 등)',
  `author_id` varchar(50) NOT NULL COMMENT '작성자 ID',
  `view_count` int DEFAULT '0' COMMENT '조회수',
  `start_date` date DEFAULT NULL COMMENT '게시 시작일',
  `end_date` date DEFAULT NULL COMMENT '게시 종료일',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`notice_id`),
  KEY `idx_author` (`author_id`),
  CONSTRAINT `fk_notice_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='시스템 공지사항 및 게시판';

-- 파일저장용 테이블 (tbl_file_storage) 2026.01.20
CREATE TABLE tbl_file_storage (
  `file_id` INT AUTO_INCREMENT COMMENT 'FILE ID',
  `file_name` VARCHAR(255) NOT NULL COMMENT '파일명',
  `file_extension` VARCHAR(50) COMMENT '파일확장자',
  `file_size` BIGINT COMMENT '파일크기',
  `file_data` LONGBLOB NOT NULL COMMENT '파일내용',
  `upload_date` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '업로드일시',
  `upload_user` VARCHAR(100) COMMENT '업로드사용자',
  `description` TEXT COMMENT '파일 설명',
  `mime_type` VARCHAR(100) COMMENT 'mime_type',
  PRIMARY KEY (`file_id`),
  INDEX idx_file_name (file_name),
  INDEX idx_upload_date (upload_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='파일저장소';
