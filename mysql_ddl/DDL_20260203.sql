-- DDL_20260203.sql
-- Upgrade script from DDL_20260130.sql to 2026-02-03 schema
-- 신규 구축은 DDL_20260203_Create_Only.sql 사용

-- 1. 신규 테이블 생성 (코드/조직)
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

-- 2. 기존 테이블 변경 (컬럼/인덱스 먼저)
ALTER TABLE users 
  ADD COLUMN org_id int DEFAULT NULL COMMENT '소속 조직 ID' AFTER team,
  ADD INDEX idx_users_org_id (org_id);

ALTER TABLE clients ADD INDEX idx_business_number (business_number);
ALTER TABLE clients ADD INDEX idx_phone (phone);
ALTER TABLE clients ADD INDEX idx_is_active (is_active);
ALTER TABLE clients MODIFY industry_type varchar(20) DEFAULT NULL COMMENT '업종(분야) 코드';
ALTER TABLE clients ADD INDEX idx_industry_type (industry_type);

ALTER TABLE projects 
  ADD COLUMN service_code varchar(20) DEFAULT NULL COMMENT '서비스 코드' AFTER field_code,
  ADD COLUMN org_id int DEFAULT NULL COMMENT '담당 조직 ID' AFTER manager_id,
  ADD INDEX idx_projects_field (field_code),
  ADD INDEX idx_projects_service (service_code),
  ADD INDEX idx_projects_manager (manager_id),
  ADD INDEX idx_projects_org (org_id);

-- 2-1. 데이터 정합성 점검 (필요 시 선행)
-- SELECT p.field_code FROM projects p LEFT JOIN industry_fields f ON p.field_code = f.field_code
--  WHERE p.field_code IS NOT NULL AND f.field_code IS NULL GROUP BY p.field_code;
-- SELECT p.service_code FROM projects p LEFT JOIN service_codes s ON p.service_code = s.service_code
--  WHERE p.service_code IS NOT NULL AND s.service_code IS NULL GROUP BY p.service_code;
-- SELECT p.org_id FROM projects p LEFT JOIN org_units o ON p.org_id = o.org_id
--  WHERE p.org_id IS NOT NULL AND o.org_id IS NULL GROUP BY p.org_id;

-- 2-1-1. clients.industry_type 값 매핑 (문자열 → field_code)
-- 매핑: 금융/보험→금융, 공공기관→공공, IT/소프트웨어→AICC, 제조업→제조, 교육→교육,
--       의료/헬스케어→의료, 서비스업→문화, 유통/도소매→교통, 기타→문화
UPDATE clients
SET industry_type = CASE
    WHEN industry_type = '금융/보험' THEN '금융'
    WHEN industry_type = '공공기관' THEN '공공'
    WHEN industry_type = 'IT/소프트웨어' THEN 'AICC'
    WHEN industry_type = '제조업' THEN '제조'
    WHEN industry_type = '교육' THEN '교육'
    WHEN industry_type = '의료/헬스케어' THEN '의료'
    WHEN industry_type = '서비스업' THEN '문화'
    WHEN industry_type = '유통/도소매' THEN '교통'
    WHEN industry_type = '기타' THEN '문화'
    ELSE industry_type
END
WHERE industry_type IS NOT NULL AND industry_type <> '';

-- 2-1-2. 매핑 누락 체크 (industry_fields에 없는 코드)
SELECT c.industry_type, COUNT(*) AS cnt
FROM clients c
LEFT JOIN industry_fields f ON f.field_code = c.industry_type
WHERE c.industry_type IS NOT NULL AND c.industry_type <> ''
  AND f.field_code IS NULL
GROUP BY c.industry_type
ORDER BY cnt DESC;

-- 2-2. FK 추가 (마스터 데이터 적재/정합성 확보 후 실행)
ALTER TABLE users
  ADD CONSTRAINT fk_users_org FOREIGN KEY (org_id) REFERENCES org_units (org_id) ON DELETE SET NULL;

ALTER TABLE projects 
  ADD CONSTRAINT projects_ibfk_field FOREIGN KEY (field_code) REFERENCES industry_fields (field_code) ON DELETE SET NULL,
  ADD CONSTRAINT projects_ibfk_service FOREIGN KEY (service_code) REFERENCES service_codes (service_code) ON DELETE SET NULL,
  ADD CONSTRAINT projects_ibfk_org FOREIGN KEY (org_id) REFERENCES org_units (org_id) ON DELETE SET NULL;

ALTER TABLE clients
  ADD CONSTRAINT fk_clients_industry_type FOREIGN KEY (industry_type) REFERENCES industry_fields (field_code) ON DELETE SET NULL;

-- 3. 신규 테이블 생성 (계획/실적)
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
