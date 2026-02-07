-- Table structure for table `auth_forms`

CREATE TABLE `auth_forms` (
  `company_cd` varchar(20) NOT NULL,
  `form_id` varchar(50) NOT NULL COMMENT 'VBA UserForm 객체 이름',
  `form_name` varchar(100) NOT NULL COMMENT '화면 한글명',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`,`form_id`),
  CONSTRAINT `fk_auth_forms_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='시스템 화면 마스터';


-- Table structure for table `auth_permissions`

CREATE TABLE `auth_permissions` (
  `company_cd` varchar(20) NOT NULL,
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
  PRIMARY KEY (`company_cd`,`role`,`form_id`),
  KEY `fk_auth_form` (`form_id`),
  KEY `idx_auth_permissions_form` (`company_cd`,`form_id`),
  CONSTRAINT `fk_auth_form` FOREIGN KEY (`company_cd`, `form_id`) REFERENCES `auth_forms` (`company_cd`, `form_id`),
  CONSTRAINT `fk_auth_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='역할별 세부 권한 설정';


-- Table structure for table `auth_role_permissions`

CREATE TABLE `auth_role_permissions` (
  `company_cd` varchar(20) NOT NULL,
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
  PRIMARY KEY (`company_cd`,`role`,`form_id`),
  CONSTRAINT `fk_auth_role_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='역할별 기본 권한';


-- Table structure for table `auth_user_permissions`

CREATE TABLE `auth_user_permissions` (
  `company_cd` varchar(20) NOT NULL,
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
  PRIMARY KEY (`company_cd`,`login_id`,`form_id`),
  CONSTRAINT `fk_auth_user_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `fk_user_auth` FOREIGN KEY (`company_cd`, `login_id`) REFERENCES `users` (`company_cd`, `login_id`)
) COMMENT='사용자별 개별 권한 (우선순위 높음)';


-- Table structure for table `board_notices`

CREATE TABLE `board_notices` (
  `company_cd` varchar(20) NOT NULL,
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
  PRIMARY KEY (`company_cd`,`notice_id`),
  UNIQUE KEY `uk_board_notices_id` (`notice_id`),
  KEY `idx_author` (`author_id`),
  KEY `fk_notice_author` (`company_cd`,`author_id`),
  CONSTRAINT `fk_board_notices_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `fk_notice_author` FOREIGN KEY (`company_cd`, `author_id`) REFERENCES `users` (`company_cd`, `login_id`)
) COMMENT='시스템 공지사항 및 게시판';


-- Table structure for table `clients`

CREATE TABLE `clients` (
  `company_cd` varchar(20) NOT NULL,
  `client_id` int NOT NULL AUTO_INCREMENT COMMENT '거래처 일련번호(PK)',
  `client_name` varchar(100) NOT NULL,
  `business_number` varchar(20) DEFAULT NULL COMMENT '사업자등록번호',
  `ceo_name` varchar(50) DEFAULT NULL COMMENT '대표자명',
  `address` varchar(200) DEFAULT NULL COMMENT '주소',
  `phone` varchar(20) DEFAULT NULL COMMENT '전화번호',
  `email` varchar(100) DEFAULT NULL COMMENT '이메일',
  `fax` varchar(20) DEFAULT NULL COMMENT '팩스번호',
  `homepage` varchar(200) DEFAULT NULL COMMENT '홈페이지 URL',
  `industry_type` varchar(20) DEFAULT NULL COMMENT '업종(분야) 코드',
  `employee_count` int DEFAULT NULL COMMENT '직원 수',
  `established_date` date DEFAULT NULL COMMENT '설립일자',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '활성 상태 (TRUE: 활성, FALSE: 비활성)',
  `remarks` text COMMENT '비고',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`client_id`),
  UNIQUE KEY `uk_clients_id` (`client_id`),
  UNIQUE KEY `uk_clients_name` (`company_cd`,`client_name`),
  KEY `idx_business_number` (`company_cd`,`business_number`),
  KEY `idx_phone` (`company_cd`,`phone`),
  KEY `idx_is_active` (`company_cd`,`is_active`),
  KEY `idx_industry_type` (`company_cd`,`industry_type`),
  CONSTRAINT `fk_clients_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `fk_clients_industry_type` FOREIGN KEY (`company_cd`, `industry_type`) REFERENCES `industry_fields` (`company_cd`, `field_code`)
);


-- Table structure for table `comm_code`

CREATE TABLE `comm_code` (
  `company_cd` varchar(20) NOT NULL,
  `group_code` varchar(20) NOT NULL,
  `group_name` varchar(100) DEFAULT NULL,
  `code` varchar(20) NOT NULL,
  `code_name` varchar(100) NOT NULL,
  `sort_order` int DEFAULT '0',
  `is_use` char(1) DEFAULT 'Y',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`group_code`,`code`),
  CONSTRAINT `fk_comm_code_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
);


-- Table structure for table `companies`

CREATE TABLE `companies` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `company_name` varchar(100) NOT NULL COMMENT '회사명',
  `company_alias` varchar(100) DEFAULT NULL COMMENT '회사 별칭',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`)
) COMMENT='회사(테넌트) 마스터';


-- Table structure for table `industry_fields`

CREATE TABLE `industry_fields` (
  `company_cd` varchar(20) NOT NULL,
  `field_code` varchar(20) NOT NULL COMMENT '분야 코드',
  `field_name` varchar(100) NOT NULL COMMENT '분야명',
  `org_desc` varchar(200) DEFAULT NULL COMMENT '기관내용',
  `facility_desc` varchar(200) DEFAULT NULL COMMENT '주요 시설',
  `sort_order` int DEFAULT '0' COMMENT '정렬 순서',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`,`field_code`),
  CONSTRAINT `fk_industry_fields_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='사업 분야 마스터';


-- Table structure for table `login_history`

CREATE TABLE `login_history` (
  `company_cd` varchar(20) NOT NULL,
  `history_id` int NOT NULL AUTO_INCREMENT,
  `login_id` varchar(50) DEFAULT NULL,
  `action_type` varchar(20) DEFAULT NULL,
  `action_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `pc_name` varchar(100) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL COMMENT '접속 IP',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`history_id`),
  UNIQUE KEY `uk_login_history_id` (`history_id`),
  KEY `idx_login_history_login` (`company_cd`,`login_id`),
  CONSTRAINT `fk_login_history_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`company_cd`, `login_id`) REFERENCES `users` (`company_cd`, `login_id`)
);


-- Table structure for table `org_units`

CREATE TABLE `org_units` (
  `company_cd` varchar(20) NOT NULL,
  `org_id` int NOT NULL AUTO_INCREMENT COMMENT '조직 ID',
  `org_name` varchar(100) NOT NULL COMMENT '조직명',
  `parent_id` int DEFAULT NULL COMMENT '상위 조직 ID',
  `org_type` varchar(20) DEFAULT NULL COMMENT '조직 유형 (HQ/DEPT/TEAM)',
  `sort_order` int DEFAULT '0' COMMENT '정렬 순서',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`,`org_id`),
  UNIQUE KEY `uk_org_units_id` (`org_id`),
  KEY `idx_org_parent` (`company_cd`,`parent_id`),
  CONSTRAINT `fk_org_parent` FOREIGN KEY (`company_cd`, `parent_id`) REFERENCES `org_units` (`company_cd`, `org_id`),
  CONSTRAINT `fk_org_units_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='조직/부서 마스터';


-- Table structure for table `project_attributes`

CREATE TABLE `project_attributes` (
  `company_cd` varchar(20) NOT NULL,
  `pipeline_id` varchar(20) NOT NULL,
  `attr_code` varchar(20) NOT NULL,
  `attr_value` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`pipeline_id`,`attr_code`),
  CONSTRAINT `fk_project_attributes_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `project_attributes_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE
);


-- Table structure for table `project_contracts`

CREATE TABLE `project_contracts` (
  `company_cd` varchar(20) NOT NULL,
  `pipeline_id` varchar(20) NOT NULL,
  `contract_date` date DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `order_amount` decimal(18,2) DEFAULT '0.00',
  `contract_amount` decimal(18,2) DEFAULT '0.00',
  `remarks` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`pipeline_id`),
  CONSTRAINT `fk_project_contracts_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `project_contracts_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE
);


-- Table structure for table `project_history`

CREATE TABLE `project_history` (
  `company_cd` varchar(20) NOT NULL,
  `history_id` int NOT NULL AUTO_INCREMENT,
  `pipeline_id` varchar(20) NOT NULL,
  `base_date` date DEFAULT NULL,
  `record_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `progress_stage` varchar(20) DEFAULT NULL,
  `strategy_content` text,
  `creator_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '최초 생성일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '최종 수정일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`history_id`),
  UNIQUE KEY `uk_project_history_id` (`history_id`),
  KEY `idx_project_history_pipeline` (`company_cd`,`pipeline_id`),
  CONSTRAINT `fk_project_history_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `project_history_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE
);


-- Table structure for table `project_sales`

CREATE TABLE `project_sales` (
  `company_cd` varchar(20) NOT NULL,
  `pipeline_id` varchar(20) NOT NULL,
  `contract_date` date DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `order_amount` decimal(18,2) DEFAULT '0.00',
  `contract_amount` decimal(18,2) DEFAULT '0.00',
  `quoted_amount` decimal(18,2) DEFAULT '0.00',
  `sales_oct` decimal(18,2) DEFAULT '0.00',
  `sales_nov` decimal(18,2) DEFAULT '0.00',
  `sales_dec` decimal(18,2) DEFAULT '0.00',
  `total_sales` decimal(18,2) DEFAULT '0.00',
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`pipeline_id`),
  CONSTRAINT `fk_project_sales_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `project_sales_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE
);


-- Table structure for table `projects`

CREATE TABLE `projects` (
  `company_cd` varchar(20) NOT NULL,
  `pipeline_id` varchar(20) NOT NULL,
  `project_name` varchar(255) NOT NULL,
  `field_code` varchar(20) DEFAULT NULL,
  `service_code` varchar(20) DEFAULT NULL COMMENT '서비스 코드',
  `manager_id` varchar(50) DEFAULT NULL,
  `org_id` int DEFAULT NULL COMMENT '담당 조직 ID',
  `customer_id` int DEFAULT NULL,
  `ordering_party_id` int DEFAULT NULL,
  `current_stage` varchar(20) DEFAULT NULL,
  `quoted_amount` decimal(18,2) DEFAULT '0.00',
  `win_probability` int DEFAULT '0' COMMENT '수주확률 (0-100%)',
  `notes` text COMMENT '비고',
  `status` varchar(20) DEFAULT 'ACTIVE' COMMENT '프로젝트 상태 (ACTIVE, CLOSED)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`pipeline_id`),
  KEY `idx_projects_field` (`company_cd`,`field_code`),
  KEY `idx_projects_service` (`company_cd`,`service_code`),
  KEY `idx_projects_manager` (`company_cd`,`manager_id`),
  KEY `idx_projects_org` (`company_cd`,`org_id`),
  KEY `idx_projects_customer` (`company_cd`,`customer_id`),
  KEY `idx_projects_ordering` (`company_cd`,`ordering_party_id`),
  CONSTRAINT `fk_projects_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  CONSTRAINT `projects_ibfk_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`),
  CONSTRAINT `projects_ibfk_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`),
  CONSTRAINT `projects_ibfk_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`),
  CONSTRAINT `projects_ibfk_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`)
);


-- Table structure for table `sales_actual_line`

CREATE TABLE `sales_actual_line` (
  `company_cd` varchar(20) NOT NULL,
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
  PRIMARY KEY (`company_cd`,`actual_line_id`),
  UNIQUE KEY `uk_sales_actual_line_id` (`actual_line_id`),
  UNIQUE KEY `uk_actual_line` (`company_cd`,`actual_year`,`pipeline_id`),
  KEY `fk_actual_line_customer` (`customer_id`),
  KEY `fk_actual_line_ordering` (`ordering_party_id`),
  KEY `idx_actual_line_pipeline` (`company_cd`,`pipeline_id`),
  KEY `idx_actual_line_field` (`company_cd`,`field_code`),
  KEY `idx_actual_line_service` (`company_cd`,`service_code`),
  KEY `idx_actual_line_org` (`company_cd`,`org_id`),
  KEY `idx_actual_line_manager` (`company_cd`,`manager_id`),
  KEY `idx_actual_line_customer` (`company_cd`,`customer_id`),
  KEY `idx_actual_line_ordering` (`company_cd`,`ordering_party_id`),
  CONSTRAINT `fk_actual_line_customer` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  CONSTRAINT `fk_actual_line_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`),
  CONSTRAINT `fk_actual_line_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`),
  CONSTRAINT `fk_actual_line_ordering` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  CONSTRAINT `fk_actual_line_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`),
  CONSTRAINT `fk_actual_line_project` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`),
  CONSTRAINT `fk_actual_line_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`),
  CONSTRAINT `fk_sales_actual_line_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='영업 실적 라인 (스냅샷 포함)';


-- Table structure for table `sales_plan`

CREATE TABLE `sales_plan` (
  `company_cd` varchar(20) NOT NULL,
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
  PRIMARY KEY (`company_cd`,`plan_id`),
  UNIQUE KEY `uk_sales_plan_id` (`plan_id`),
  UNIQUE KEY `uk_plan_year_version` (`company_cd`,`plan_year`,`plan_version`),
  CONSTRAINT `fk_sales_plan_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='영업 계획 헤더';


-- Table structure for table `sales_plan_line`

CREATE TABLE `sales_plan_line` (
  `company_cd` varchar(20) NOT NULL,
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
  PRIMARY KEY (`company_cd`,`plan_line_id`),
  UNIQUE KEY `uk_sales_plan_line_id` (`plan_line_id`),
  UNIQUE KEY `uk_plan_line` (`company_cd`,`plan_id`,`pipeline_id`),
  KEY `fk_plan_line_customer` (`customer_id`),
  KEY `fk_plan_line_ordering` (`ordering_party_id`),
  KEY `idx_plan_line_pipeline` (`company_cd`,`pipeline_id`),
  KEY `idx_plan_line_field` (`company_cd`,`field_code`),
  KEY `idx_plan_line_service` (`company_cd`,`service_code`),
  KEY `idx_plan_line_org` (`company_cd`,`org_id`),
  KEY `idx_plan_line_manager` (`company_cd`,`manager_id`),
  KEY `idx_plan_line_customer` (`company_cd`,`customer_id`),
  KEY `idx_plan_line_ordering` (`company_cd`,`ordering_party_id`),
  CONSTRAINT `fk_plan_line_customer` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  CONSTRAINT `fk_plan_line_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`),
  CONSTRAINT `fk_plan_line_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`),
  CONSTRAINT `fk_plan_line_ordering` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  CONSTRAINT `fk_plan_line_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`),
  CONSTRAINT `fk_plan_line_plan` FOREIGN KEY (`company_cd`, `plan_id`) REFERENCES `sales_plan` (`company_cd`, `plan_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plan_line_project` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`),
  CONSTRAINT `fk_plan_line_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`),
  CONSTRAINT `fk_sales_plan_line_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='영업 계획 라인 (스냅샷 포함)';


-- Table structure for table `service_codes`

CREATE TABLE `service_codes` (
  `company_cd` varchar(20) NOT NULL,
  `service_code` varchar(20) NOT NULL COMMENT '서비스 코드',
  `parent_code` varchar(20) DEFAULT NULL COMMENT '상위 서비스 코드',
  `service_name` varchar(100) NOT NULL COMMENT '서비스명',
  `display_name` varchar(150) NOT NULL COMMENT '표시명',
  `sort_order` int DEFAULT '0' COMMENT '정렬 순서',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`,`service_code`),
  KEY `idx_service_parent` (`company_cd`,`parent_code`),
  CONSTRAINT `fk_service_codes_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `fk_service_parent` FOREIGN KEY (`company_cd`, `parent_code`) REFERENCES `service_codes` (`company_cd`, `service_code`)
) COMMENT='서비스 코드 마스터';


-- Table structure for table `tbl_file_storage`

CREATE TABLE `tbl_file_storage` (
  `company_cd` varchar(20) NOT NULL,
  `file_id` int NOT NULL AUTO_INCREMENT COMMENT 'FILE ID',
  `file_name` varchar(255) NOT NULL COMMENT '파일명',
  `file_extension` varchar(50) DEFAULT NULL COMMENT '파일확장자',
  `file_size` bigint DEFAULT NULL COMMENT '파일크기',
  `file_data` longblob NOT NULL COMMENT '파일내용',
  `upload_date` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '업로드일시',
  `upload_user` varchar(100) DEFAULT NULL COMMENT '업로드사용자',
  `description` text COMMENT '파일 설명',
  `mime_type` varchar(100) DEFAULT NULL COMMENT 'mime_type',
  PRIMARY KEY (`company_cd`,`file_id`),
  UNIQUE KEY `uk_file_storage_id` (`file_id`),
  KEY `idx_file_name` (`file_name`),
  KEY `idx_upload_date` (`upload_date`),
  CONSTRAINT `fk_file_storage_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`)
) COMMENT='파일저장소';


-- Table structure for table `tmp_invalid_project_manager_id`

CREATE TABLE `tmp_invalid_project_manager_id` (
  `company_cd` varchar(20) NOT NULL,
  `pipeline_id` varchar(20) NOT NULL,
  `manager_id` varchar(50) NOT NULL,
  `captured_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) COMMENT='projects.manager_id FK 불일치 백업';


-- Table structure for table `users`

CREATE TABLE `users` (
  `company_cd` varchar(20) NOT NULL,
  `user_no` int NOT NULL AUTO_INCREMENT,
  `login_id` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `user_name` varchar(100) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'User',
  `is_sales_rep` tinyint(1) NOT NULL DEFAULT '0' COMMENT '영업담당 여부 (1: 담당, 0: 미담당)',
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `headquarters` varchar(100) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `team` varchar(100) DEFAULT NULL,
  `org_id` int DEFAULT NULL COMMENT '소속 조직 ID',
  `start_date` date NOT NULL,
  `end_date` date DEFAULT '9999-12-31',
  `status` varchar(20) DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자ID',
  PRIMARY KEY (`company_cd`,`user_no`),
  UNIQUE KEY `uk_users_user_no` (`user_no`),
  UNIQUE KEY `uk_users_login_id` (`company_cd`,`login_id`),
  KEY `idx_users_org_id` (`company_cd`,`org_id`),
  CONSTRAINT `fk_users_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  CONSTRAINT `fk_users_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`)
);
