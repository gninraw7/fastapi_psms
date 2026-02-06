-- DDL_20260203_Create_Only.sql
-- 생성 전용 (CREATE ONLY) - 2026-02-03

-- 1. 분야 코드 (industry_fields)
CREATE TABLE `industry_fields` (
  `field_code` varchar(20) NOT NULL COMMENT '분야 코드',
  `field_name` varchar(100) NOT NULL COMMENT '분야명',
  `org_desc` varchar(200) DEFAULT NULL COMMENT '기관내용',
  `facility_desc` varchar(200) DEFAULT NULL COMMENT '주요 시설',
  `sort_order` int DEFAULT 0 COMMENT '정렬 순서',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`field_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사업 분야 마스터';

-- 2. 서비스 코드 (service_codes)
CREATE TABLE `service_codes` (
  `service_code` varchar(20) NOT NULL COMMENT '서비스 코드',
  `parent_code` varchar(20) DEFAULT NULL COMMENT '상위 서비스 코드',
  `service_name` varchar(100) NOT NULL COMMENT '서비스명',
  `display_name` varchar(150) NOT NULL COMMENT '표시명',
  `sort_order` int DEFAULT 0 COMMENT '정렬 순서',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`service_code`),
  KEY `idx_service_parent` (`parent_code`),
  CONSTRAINT `fk_service_parent` FOREIGN KEY (`parent_code`) REFERENCES `service_codes` (`service_code`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='서비스 코드 마스터';

-- 3. 조직/부서 (org_units)
CREATE TABLE `org_units` (
  `org_id` int NOT NULL AUTO_INCREMENT COMMENT '조직 ID',
  `org_name` varchar(100) NOT NULL COMMENT '조직명',
  `parent_id` int DEFAULT NULL COMMENT '상위 조직 ID',
  `org_type` varchar(20) DEFAULT NULL COMMENT '조직 유형 (HQ/DEPT/TEAM)',
  `sort_order` int DEFAULT 0 COMMENT '정렬 순서',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`org_id`),
  KEY `idx_org_parent` (`parent_id`),
  CONSTRAINT `fk_org_parent` FOREIGN KEY (`parent_id`) REFERENCES `org_units` (`org_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='조직/부서 마스터';

-- 4. 사용자 정보 (users)
CREATE TABLE `users` (
  `user_no` int NOT NULL AUTO_INCREMENT COMMENT '사용자 내부 일련번호',
  `login_id` varchar(50) NOT NULL COMMENT '로그인 아이디',
  `password` varchar(255) NOT NULL COMMENT '암호화된 비밀번호',
  `user_name` varchar(100) NOT NULL COMMENT '사용자 성명',
  `role` varchar(20) NOT NULL COMMENT '사용자 권한 (ADMIN, USER 등)',
  `is_sales_rep` TINYINT(1) DEFAULT 0 NOT NULL COMMENT '영업담당 여부 (1: 담당, 0: 미담당)',
  `email` varchar(100) DEFAULT NULL COMMENT '이메일 주소',
  `phone` varchar(20) DEFAULT NULL COMMENT '연락처',
  -- `headquarters` varchar(100) DEFAULT NULL COMMENT '소속 본부',
  -- `department` varchar(100) DEFAULT NULL COMMENT '소속 부서',
  -- `team` varchar(100) DEFAULT NULL COMMENT '소속 팀',
  `org_id` int DEFAULT NULL COMMENT '소속 조직 ID',
  `start_date` date NOT NULL COMMENT '입사일/권한시작일',
  `end_date` date DEFAULT '9999-12-31' COMMENT '퇴사일/권한종료일',
  `status` varchar(20) DEFAULT 'ACTIVE' COMMENT '계정 상태 (ACTIVE, INACTIVE, LOCK)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`user_no`),
  UNIQUE KEY `login_id` (`login_id`),
  KEY `idx_users_org_id` (`org_id`),
  CONSTRAINT `fk_users_org` FOREIGN KEY (`org_id`) REFERENCES `org_units` (`org_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='시스템 사용자 마스터 정보';

-- 5. 공통 코드 (comm_code)
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

-- 6. 고객사 정보 (clients)
CREATE TABLE `clients` (
  `client_id` int NOT NULL AUTO_INCREMENT COMMENT '고객사 일련번호',
  `client_name` varchar(100) NOT NULL COMMENT '고객사/협력사 명칭',
  `business_number` varchar(20) NULL COMMENT '사업자등록번호',
  `ceo_name` varchar(50) NULL COMMENT '대표자명',
  `address` varchar(200) NULL COMMENT '주소',
  `phone` varchar(20) NULL COMMENT '전화번호',
  `email` varchar(100) NULL COMMENT '이메일',
  `fax` varchar(20) NULL COMMENT '팩스번호',
  `homepage` varchar(200) NULL COMMENT '홈페이지 URL',
  `industry_type` varchar(20) NULL COMMENT '업종(분야) 코드',
  `employee_count` int NULL COMMENT '직원 수',
  `established_date` date NULL COMMENT '설립일자',
  `is_active` boolean DEFAULT TRUE COMMENT '활성 상태 (TRUE: 활성, FALSE: 비활성)',
  `remarks` text NULL COMMENT '비고',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`client_id`),
  UNIQUE KEY `client_name` (`client_name`),
  KEY `idx_business_number` (`business_number`),
  KEY `idx_phone` (`phone`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_industry_type` (`industry_type`),
  CONSTRAINT `fk_clients_industry_type` FOREIGN KEY (`industry_type`) REFERENCES `industry_fields` (`field_code`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='고객사 및 발주처 정보 마스터';

-- 7. 프로젝트 기본 (projects)
CREATE TABLE `projects` (
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호 (YYYY_SEQ)',
  `project_name` varchar(255) NOT NULL COMMENT '프로젝트 명칭',
  `field_code` varchar(20) DEFAULT NULL COMMENT '사업분야 코드',
  `service_code` varchar(20) DEFAULT NULL COMMENT '서비스 코드',
  `manager_id` varchar(50) DEFAULT NULL COMMENT '담당 영업대표 ID',
  `org_id` int DEFAULT NULL COMMENT '담당 조직 ID',
  `customer_id` int DEFAULT NULL COMMENT '최종 고객사 ID',
  `ordering_party_id` int DEFAULT NULL COMMENT '발주처 ID',
  `current_stage` varchar(20) DEFAULT NULL COMMENT '현재 진행 단계 (STAGE)',
  `quoted_amount` decimal(18,2) DEFAULT '0.00' COMMENT '제안/견적 금액',
  `win_probability` int DEFAULT 0 COMMENT '수주확률 (0-100%)',
  `notes` text COMMENT '비고',
  `status` varchar(20) DEFAULT 'ACTIVE' COMMENT '프로젝트 상태 (ACTIVE, CLOSED)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`pipeline_id`),
  KEY `idx_projects_field` (`field_code`),
  KEY `idx_projects_service` (`service_code`),
  KEY `idx_projects_manager` (`manager_id`),
  KEY `idx_projects_org` (`org_id`),
  KEY `customer_id` (`customer_id`),
  KEY `ordering_party_id` (`ordering_party_id`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `clients` (`client_id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`ordering_party_id`) REFERENCES `clients` (`client_id`),
  CONSTRAINT `projects_ibfk_field` FOREIGN KEY (`field_code`) REFERENCES `industry_fields` (`field_code`) ON DELETE SET NULL,
  CONSTRAINT `projects_ibfk_service` FOREIGN KEY (`service_code`) REFERENCES `service_codes` (`service_code`) ON DELETE SET NULL,
  CONSTRAINT `projects_ibfk_org` FOREIGN KEY (`org_id`) REFERENCES `org_units` (`org_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='프로젝트 파이프라인 기본 정보';

CREATE TABLE `project_attributes` (
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호',
  `attr_code` varchar(20) NOT NULL COMMENT '속성 코드',
  `attr_value` text COMMENT '속성 값',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`pipeline_id`,`attr_code`),
  CONSTRAINT `project_attributes_ibfk_1` FOREIGN KEY (`pipeline_id`) REFERENCES `projects` (`pipeline_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci comment='프로젝트 추가 속성 정보';

-- 8. 프로젝트 계약 상세 (project_contracts)
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

-- 10. 프로젝트 변경 이력 (project_history)
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

-- 11. 접속 이력 (login_history)
CREATE TABLE `login_history` (
  `history_id` int NOT NULL AUTO_INCREMENT COMMENT '접속 로그 일련번호',
  `login_id` varchar(50) DEFAULT NULL COMMENT '사용자 로그인 ID',
  `action_type` varchar(20) DEFAULT NULL COMMENT '수행 작업 (LOGIN/LOGOUT)',
  `action_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '수행 시각',
  `pc_name` varchar(100) DEFAULT NULL COMMENT '접속 PC/단말기 명칭',
  `ip_address` varchar(45) DEFAULT NULL COMMENT '접속 IP',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`history_id`),
  KEY `login_id` (`login_id`),
  CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`login_id`) REFERENCES `users` (`login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자 시스템 접속 로그';

-- 12. 시스템 화면 마스터 (auth_forms)
CREATE TABLE `auth_forms` (
  `form_id` varchar(50) NOT NULL COMMENT 'VBA UserForm 객체 이름',
  `form_name` varchar(100) NOT NULL COMMENT '화면 한글명',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`form_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='시스템 화면 마스터';

-- 13. 역할별 화면 접근 권한 설정 (auth_permissions)
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

-- 14. 역할별 기본 권한 (auth_role_permissions)
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

-- 15. 사용자별 화면 권한 (auth_user_permissions)
CREATE TABLE `auth_user_permissions` (
  `login_id` varchar(50) NOT NULL,
  `form_id` varchar(50) NOT NULL,
  `can_view` char(1) DEFAULT NULL,
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

-- 16. 영업 계획 헤더 (sales_plan)
CREATE TABLE `sales_plan` (
  `plan_id` int NOT NULL AUTO_INCREMENT COMMENT '영업 계획 ID',
  `plan_year` int NOT NULL COMMENT '계획 연도',
  `plan_version` varchar(20) DEFAULT 'v1' COMMENT '계획 버전',
  `status_code` varchar(20) DEFAULT 'DRAFT' COMMENT '상태 코드',
  `base_date` date DEFAULT NULL COMMENT '기준 일자',
  `remarks` text COMMENT '비고',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`plan_id`),
  UNIQUE KEY `uk_plan_year_version` (`plan_year`, `plan_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='영업 계획 헤더';

-- 17. 영업 계획 라인 (sales_plan_line, denormalized snapshot)
CREATE TABLE `sales_plan_line` (
  `plan_line_id` int NOT NULL AUTO_INCREMENT COMMENT '계획 라인 ID',
  `plan_id` int NOT NULL COMMENT '영업 계획 ID',
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호',
  `field_code` varchar(20) DEFAULT NULL COMMENT '분야 코드',
  `field_name_snapshot` varchar(100) DEFAULT NULL COMMENT '분야명 스냅샷',
  `service_code` varchar(20) DEFAULT NULL COMMENT '서비스 코드',
  `service_name_snapshot` varchar(150) DEFAULT NULL COMMENT '서비스명 스냅샷',
  `customer_id` int DEFAULT NULL COMMENT '고객사 ID',
  `customer_name_snapshot` varchar(100) DEFAULT NULL COMMENT '고객사명 스냅샷',
  `ordering_party_id` int DEFAULT NULL COMMENT '발주처 ID',
  `ordering_party_name_snapshot` varchar(100) DEFAULT NULL COMMENT '발주처명 스냅샷',
  `project_name_snapshot` varchar(255) DEFAULT NULL COMMENT '사업명 스냅샷',
  `org_id` int DEFAULT NULL COMMENT '담당 조직 ID',
  `org_name_snapshot` varchar(100) DEFAULT NULL COMMENT '담당부서명 스냅샷',
  `manager_id` varchar(50) DEFAULT NULL COMMENT '담당자 ID',
  `manager_name_snapshot` varchar(100) DEFAULT NULL COMMENT '담당자명 스냅샷',
  `contract_plan_date` date DEFAULT NULL COMMENT '계약(예정)일자',
  `start_plan_date` date DEFAULT NULL COMMENT '계약기간 시작',
  `end_plan_date` date DEFAULT NULL COMMENT '계약기간 종료',
  `plan_total` decimal(18,2) DEFAULT '0.00' COMMENT '수주계획 합계',
  `plan_m01` decimal(18,2) DEFAULT '0.00' COMMENT '1월 계획',
  `plan_m02` decimal(18,2) DEFAULT '0.00' COMMENT '2월 계획',
  `plan_m03` decimal(18,2) DEFAULT '0.00' COMMENT '3월 계획',
  `plan_m04` decimal(18,2) DEFAULT '0.00' COMMENT '4월 계획',
  `plan_m05` decimal(18,2) DEFAULT '0.00' COMMENT '5월 계획',
  `plan_m06` decimal(18,2) DEFAULT '0.00' COMMENT '6월 계획',
  `plan_m07` decimal(18,2) DEFAULT '0.00' COMMENT '7월 계획',
  `plan_m08` decimal(18,2) DEFAULT '0.00' COMMENT '8월 계획',
  `plan_m09` decimal(18,2) DEFAULT '0.00' COMMENT '9월 계획',
  `plan_m10` decimal(18,2) DEFAULT '0.00' COMMENT '10월 계획',
  `plan_m11` decimal(18,2) DEFAULT '0.00' COMMENT '11월 계획',
  `plan_m12` decimal(18,2) DEFAULT '0.00' COMMENT '12월 계획',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`plan_line_id`),
  UNIQUE KEY `uk_plan_line` (`plan_id`, `pipeline_id`),
  KEY `idx_plan_line_pipeline` (`pipeline_id`),
  KEY `idx_plan_line_field` (`field_code`),
  KEY `idx_plan_line_service` (`service_code`),
  KEY `idx_plan_line_org` (`org_id`),
  KEY `idx_plan_line_manager` (`manager_id`),
  CONSTRAINT `fk_plan_line_plan` FOREIGN KEY (`plan_id`) REFERENCES `sales_plan` (`plan_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plan_line_project` FOREIGN KEY (`pipeline_id`) REFERENCES `projects` (`pipeline_id`),
  CONSTRAINT `fk_plan_line_field` FOREIGN KEY (`field_code`) REFERENCES `industry_fields` (`field_code`) ON DELETE SET NULL,
  CONSTRAINT `fk_plan_line_service` FOREIGN KEY (`service_code`) REFERENCES `service_codes` (`service_code`) ON DELETE SET NULL,
  CONSTRAINT `fk_plan_line_customer` FOREIGN KEY (`customer_id`) REFERENCES `clients` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_plan_line_ordering` FOREIGN KEY (`ordering_party_id`) REFERENCES `clients` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_plan_line_org` FOREIGN KEY (`org_id`) REFERENCES `org_units` (`org_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_plan_line_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`login_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='영업 계획 라인 (스냅샷 포함)';

-- 18. 영업 실적 라인 (sales_actual_line, denormalized snapshot)
CREATE TABLE `sales_actual_line` (
  `actual_line_id` int NOT NULL AUTO_INCREMENT COMMENT '실적 라인 ID',
  `actual_year` int NOT NULL COMMENT '실적 연도',
  `pipeline_id` varchar(20) NOT NULL COMMENT '파이프라인 관리번호',
  `field_code` varchar(20) DEFAULT NULL COMMENT '분야 코드',
  `field_name_snapshot` varchar(100) DEFAULT NULL COMMENT '분야명 스냅샷',
  `service_code` varchar(20) DEFAULT NULL COMMENT '서비스 코드',
  `service_name_snapshot` varchar(150) DEFAULT NULL COMMENT '서비스명 스냅샷',
  `customer_id` int DEFAULT NULL COMMENT '고객사 ID',
  `customer_name_snapshot` varchar(100) DEFAULT NULL COMMENT '고객사명 스냅샷',
  `ordering_party_id` int DEFAULT NULL COMMENT '발주처 ID',
  `ordering_party_name_snapshot` varchar(100) DEFAULT NULL COMMENT '발주처명 스냅샷',
  `project_name_snapshot` varchar(255) DEFAULT NULL COMMENT '사업명 스냅샷',
  `org_id` int DEFAULT NULL COMMENT '담당 조직 ID',
  `org_name_snapshot` varchar(100) DEFAULT NULL COMMENT '담당부서명 스냅샷',
  `manager_id` varchar(50) DEFAULT NULL COMMENT '담당자 ID',
  `manager_name_snapshot` varchar(100) DEFAULT NULL COMMENT '담당자명 스냅샷',
  `contract_date` date DEFAULT NULL COMMENT '계약일',
  `start_date` date DEFAULT NULL COMMENT '계약기간 시작',
  `end_date` date DEFAULT NULL COMMENT '계약기간 종료',
  `order_total` decimal(18,2) DEFAULT '0.00' COMMENT '수주금액 합계',
  `profit_total` decimal(18,2) DEFAULT '0.00' COMMENT '매출이익 합계',
  `m01_order` decimal(18,2) DEFAULT '0.00' COMMENT '1월 수주금액',
  `m01_profit` decimal(18,2) DEFAULT '0.00' COMMENT '1월 매출이익',
  `m02_order` decimal(18,2) DEFAULT '0.00' COMMENT '2월 수주금액',
  `m02_profit` decimal(18,2) DEFAULT '0.00' COMMENT '2월 매출이익',
  `m03_order` decimal(18,2) DEFAULT '0.00' COMMENT '3월 수주금액',
  `m03_profit` decimal(18,2) DEFAULT '0.00' COMMENT '3월 매출이익',
  `m04_order` decimal(18,2) DEFAULT '0.00' COMMENT '4월 수주금액',
  `m04_profit` decimal(18,2) DEFAULT '0.00' COMMENT '4월 매출이익',
  `m05_order` decimal(18,2) DEFAULT '0.00' COMMENT '5월 수주금액',
  `m05_profit` decimal(18,2) DEFAULT '0.00' COMMENT '5월 매출이익',
  `m06_order` decimal(18,2) DEFAULT '0.00' COMMENT '6월 수주금액',
  `m06_profit` decimal(18,2) DEFAULT '0.00' COMMENT '6월 매출이익',
  `m07_order` decimal(18,2) DEFAULT '0.00' COMMENT '7월 수주금액',
  `m07_profit` decimal(18,2) DEFAULT '0.00' COMMENT '7월 매출이익',
  `m08_order` decimal(18,2) DEFAULT '0.00' COMMENT '8월 수주금액',
  `m08_profit` decimal(18,2) DEFAULT '0.00' COMMENT '8월 매출이익',
  `m09_order` decimal(18,2) DEFAULT '0.00' COMMENT '9월 수주금액',
  `m09_profit` decimal(18,2) DEFAULT '0.00' COMMENT '9월 매출이익',
  `m10_order` decimal(18,2) DEFAULT '0.00' COMMENT '10월 수주금액',
  `m10_profit` decimal(18,2) DEFAULT '0.00' COMMENT '10월 매출이익',
  `m11_order` decimal(18,2) DEFAULT '0.00' COMMENT '11월 수주금액',
  `m11_profit` decimal(18,2) DEFAULT '0.00' COMMENT '11월 매출이익',
  `m12_order` decimal(18,2) DEFAULT '0.00' COMMENT '12월 수주금액',
  `m12_profit` decimal(18,2) DEFAULT '0.00' COMMENT '12월 매출이익',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`actual_line_id`),
  UNIQUE KEY `uk_actual_line` (`actual_year`, `pipeline_id`),
  KEY `idx_actual_line_pipeline` (`pipeline_id`),
  KEY `idx_actual_line_field` (`field_code`),
  KEY `idx_actual_line_service` (`service_code`),
  KEY `idx_actual_line_org` (`org_id`),
  KEY `idx_actual_line_manager` (`manager_id`),
  CONSTRAINT `fk_actual_line_project` FOREIGN KEY (`pipeline_id`) REFERENCES `projects` (`pipeline_id`),
  CONSTRAINT `fk_actual_line_field` FOREIGN KEY (`field_code`) REFERENCES `industry_fields` (`field_code`) ON DELETE SET NULL,
  CONSTRAINT `fk_actual_line_service` FOREIGN KEY (`service_code`) REFERENCES `service_codes` (`service_code`) ON DELETE SET NULL,
  CONSTRAINT `fk_actual_line_customer` FOREIGN KEY (`customer_id`) REFERENCES `clients` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_actual_line_ordering` FOREIGN KEY (`ordering_party_id`) REFERENCES `clients` (`client_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_actual_line_org` FOREIGN KEY (`org_id`) REFERENCES `org_units` (`org_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_actual_line_manager` FOREIGN KEY (`manager_id`) REFERENCES `users` (`login_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='영업 실적 라인 (스냅샷 포함)';
