-- DDL_20260203_Fix_CompanyCd_PK.sql
-- PK에 company_cd 미포함 테이블 정리 및 FK/Index 보강
-- 단일 회사 마이그레이션 가정

-- 0) 회사코드 기본값 (companies 테이블 첫 번째 레코드)
SELECT company_cd INTO @company_cd FROM companies ORDER BY company_cd LIMIT 1;

SET FOREIGN_KEY_CHECKS = 0;

-- 1) board_notices: company_cd 추가 + PK/FK
ALTER TABLE `board_notices`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `board_notices` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `board_notices`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `board_notices`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `notice_id`),
  ADD UNIQUE KEY `uk_board_notices_id` (`notice_id`);
ALTER TABLE `board_notices`
  DROP FOREIGN KEY `fk_notice_author`;
ALTER TABLE `board_notices`
  ADD CONSTRAINT `fk_board_notices_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_notice_author` FOREIGN KEY (`company_cd`, `author_id`) REFERENCES `users` (`company_cd`, `login_id`);

-- 2) project_sales: company_cd 추가 + PK/FK
ALTER TABLE `project_sales`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `project_sales` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `project_sales`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `project_sales`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `pipeline_id`);
ALTER TABLE `project_sales`
  DROP FOREIGN KEY `project_sales_ibfk_1`;
ALTER TABLE `project_sales`
  ADD CONSTRAINT `fk_project_sales_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `project_sales_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE;

-- 3) tbl_file_storage: company_cd 추가 + PK
ALTER TABLE `tbl_file_storage`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `tbl_file_storage` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `tbl_file_storage`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `tbl_file_storage`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `file_id`),
  ADD UNIQUE KEY `uk_file_storage_id` (`file_id`);
ALTER TABLE `tbl_file_storage`
  ADD CONSTRAINT `fk_file_storage_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 4) industry_fields
ALTER TABLE `industry_fields`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `field_code`);
ALTER TABLE `industry_fields`
  ADD CONSTRAINT `fk_industry_fields_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 5) service_codes
ALTER TABLE `service_codes`
  DROP PRIMARY KEY,
  DROP INDEX `idx_service_parent`,
  ADD PRIMARY KEY (`company_cd`, `service_code`),
  ADD KEY `idx_service_parent` (`company_cd`, `parent_code`);
ALTER TABLE `service_codes`
  ADD CONSTRAINT `fk_service_codes_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_service_parent` FOREIGN KEY (`company_cd`, `parent_code`) REFERENCES `service_codes` (`company_cd`, `service_code`) ON DELETE SET NULL;

-- 6) org_units
ALTER TABLE `org_units`
  DROP PRIMARY KEY,
  DROP INDEX `idx_org_parent`,
  ADD PRIMARY KEY (`company_cd`, `org_id`),
  ADD UNIQUE KEY `uk_org_units_id` (`org_id`),
  ADD KEY `idx_org_parent` (`company_cd`, `parent_id`);
ALTER TABLE `org_units`
  ADD CONSTRAINT `fk_org_units_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_org_parent` FOREIGN KEY (`company_cd`, `parent_id`) REFERENCES `org_units` (`company_cd`, `org_id`) ON DELETE SET NULL;

-- 7) users
ALTER TABLE `users`
  DROP PRIMARY KEY,
  DROP INDEX `login_id`,
  DROP INDEX `idx_users_org_id`,
  ADD PRIMARY KEY (`company_cd`, `user_no`),
  ADD UNIQUE KEY `uk_users_user_no` (`user_no`),
  ADD UNIQUE KEY `uk_users_login_id` (`company_cd`, `login_id`),
  ADD KEY `idx_users_org_id` (`company_cd`, `org_id`);
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_users_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`) ON DELETE SET NULL;

-- 8) comm_code (이미 PK에 포함이면 생략 가능하지만 FK 보강)
-- comm_code는 이미 fk_comm_code_company가 존재할 수 있으므로 생략

-- 9) clients
ALTER TABLE `clients`
  DROP PRIMARY KEY,
  DROP INDEX `client_name`,
  DROP INDEX `idx_business_number`,
  DROP INDEX `idx_phone`,
  DROP INDEX `idx_is_active`,
  DROP INDEX `idx_industry_type`,
  ADD PRIMARY KEY (`company_cd`, `client_id`),
  ADD UNIQUE KEY `uk_clients_id` (`client_id`),
  ADD UNIQUE KEY `uk_clients_name` (`company_cd`, `client_name`),
  ADD KEY `idx_business_number` (`company_cd`, `business_number`),
  ADD KEY `idx_phone` (`company_cd`, `phone`),
  ADD KEY `idx_is_active` (`company_cd`, `is_active`),
  ADD KEY `idx_industry_type` (`company_cd`, `industry_type`);
ALTER TABLE `clients`
  ADD CONSTRAINT `fk_clients_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_clients_industry_type` FOREIGN KEY (`company_cd`, `industry_type`) REFERENCES `industry_fields` (`company_cd`, `field_code`) ON DELETE SET NULL;

-- 10) projects
ALTER TABLE `projects`
  DROP FOREIGN KEY `projects_ibfk_1`,
  DROP FOREIGN KEY `projects_ibfk_2`,
  DROP FOREIGN KEY `projects_ibfk_field`,
  DROP PRIMARY KEY,
  DROP INDEX `idx_projects_field`,
  DROP INDEX `idx_projects_service`,
  DROP INDEX `idx_projects_manager`,
  DROP INDEX `idx_projects_org`,
  DROP INDEX `customer_id`,
  DROP INDEX `ordering_party_id`,
  ADD PRIMARY KEY (`company_cd`, `pipeline_id`),
  ADD KEY `idx_projects_field` (`company_cd`, `field_code`),
  ADD KEY `idx_projects_service` (`company_cd`, `service_code`),
  ADD KEY `idx_projects_manager` (`company_cd`, `manager_id`),
  ADD KEY `idx_projects_org` (`company_cd`, `org_id`),
  ADD KEY `idx_projects_customer` (`company_cd`, `customer_id`),
  ADD KEY `idx_projects_ordering` (`company_cd`, `ordering_party_id`);

-- manager_id 불일치 백업 및 정리 (FK 추가 전)
CREATE TABLE IF NOT EXISTS `tmp_invalid_project_manager_id` (
  `company_cd` varchar(20) NOT NULL,
  `pipeline_id` varchar(20) NOT NULL,
  `manager_id` varchar(50) NOT NULL,
  `captured_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='projects.manager_id FK 불일치 백업';
TRUNCATE TABLE `tmp_invalid_project_manager_id`;
INSERT INTO `tmp_invalid_project_manager_id` (`company_cd`, `pipeline_id`, `manager_id`)
SELECT p.company_cd, p.pipeline_id, p.manager_id
FROM projects p
LEFT JOIN users u
  ON u.company_cd = p.company_cd
 AND u.login_id = p.manager_id
WHERE p.manager_id IS NOT NULL
  AND u.login_id IS NULL;
UPDATE projects p
LEFT JOIN users u
  ON u.company_cd = p.company_cd
 AND u.login_id = p.manager_id
SET p.manager_id = NULL
WHERE p.manager_id IS NOT NULL
  AND u.login_id IS NULL;

ALTER TABLE `projects`
  ADD CONSTRAINT `fk_projects_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `projects_ibfk_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `projects_ibfk_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `projects_ibfk_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `projects_ibfk_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`) ON DELETE SET NULL;

-- 11) project_attributes
ALTER TABLE `project_attributes`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `pipeline_id`, `attr_code`);
ALTER TABLE `project_attributes`
  ADD CONSTRAINT `fk_project_attributes_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `project_attributes_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE;

-- 12) project_contracts
ALTER TABLE `project_contracts`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `pipeline_id`);
ALTER TABLE `project_contracts`
  ADD CONSTRAINT `fk_project_contracts_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `project_contracts_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE;

-- 13) project_history
ALTER TABLE `project_history`
  DROP PRIMARY KEY,
  DROP INDEX `pipeline_id`,
  ADD PRIMARY KEY (`company_cd`, `history_id`),
  ADD UNIQUE KEY `uk_project_history_id` (`history_id`),
  ADD KEY `idx_project_history_pipeline` (`company_cd`, `pipeline_id`);
ALTER TABLE `project_history`
  ADD CONSTRAINT `fk_project_history_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `project_history_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE;

-- 14) login_history
ALTER TABLE `login_history`
  DROP PRIMARY KEY,
  DROP INDEX `login_id`,
  ADD PRIMARY KEY (`company_cd`, `history_id`),
  ADD UNIQUE KEY `uk_login_history_id` (`history_id`),
  ADD KEY `idx_login_history_login` (`company_cd`, `login_id`);
ALTER TABLE `login_history`
  ADD CONSTRAINT `fk_login_history_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`company_cd`, `login_id`) REFERENCES `users` (`company_cd`, `login_id`);

-- 15) auth_forms
ALTER TABLE `auth_forms`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `form_id`);
ALTER TABLE `auth_forms`
  ADD CONSTRAINT `fk_auth_forms_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 16) auth_permissions
ALTER TABLE `auth_permissions`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `role`, `form_id`),
  ADD KEY `idx_auth_permissions_form` (`company_cd`, `form_id`);
ALTER TABLE `auth_permissions`
  ADD CONSTRAINT `fk_auth_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_auth_form` FOREIGN KEY (`company_cd`, `form_id`) REFERENCES `auth_forms` (`company_cd`, `form_id`);

-- 17) auth_user_permissions
ALTER TABLE `auth_user_permissions`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `login_id`, `form_id`);
ALTER TABLE `auth_user_permissions`
  ADD CONSTRAINT `fk_auth_user_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_user_auth` FOREIGN KEY (`company_cd`, `login_id`) REFERENCES `users` (`company_cd`, `login_id`);

-- 18) sales_plan_line
ALTER TABLE `sales_plan_line`
  DROP PRIMARY KEY,
  DROP INDEX `uk_plan_line`,
  DROP INDEX `idx_plan_line_pipeline`,
  DROP INDEX `idx_plan_line_field`,
  DROP INDEX `idx_plan_line_service`,
  DROP INDEX `idx_plan_line_org`,
  DROP INDEX `idx_plan_line_manager`,
  ADD PRIMARY KEY (`company_cd`, `plan_line_id`),
  ADD UNIQUE KEY `uk_sales_plan_line_id` (`plan_line_id`),
  ADD UNIQUE KEY `uk_plan_line` (`company_cd`, `plan_id`, `pipeline_id`),
  ADD KEY `idx_plan_line_pipeline` (`company_cd`, `pipeline_id`),
  ADD KEY `idx_plan_line_field` (`company_cd`, `field_code`),
  ADD KEY `idx_plan_line_service` (`company_cd`, `service_code`),
  ADD KEY `idx_plan_line_org` (`company_cd`, `org_id`),
  ADD KEY `idx_plan_line_manager` (`company_cd`, `manager_id`),
  ADD KEY `idx_plan_line_customer` (`company_cd`, `customer_id`),
  ADD KEY `idx_plan_line_ordering` (`company_cd`, `ordering_party_id`);
ALTER TABLE `sales_plan_line`
  ADD CONSTRAINT `fk_sales_plan_line_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_plan_line_plan` FOREIGN KEY (`company_cd`, `plan_id`) REFERENCES `sales_plan` (`company_cd`, `plan_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_plan_line_project` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`),
  ADD CONSTRAINT `fk_plan_line_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_plan_line_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_plan_line_customer` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_plan_line_ordering` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_plan_line_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_plan_line_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`) ON DELETE SET NULL;

-- 19) sales_actual_line
ALTER TABLE `sales_actual_line`
  DROP PRIMARY KEY,
  DROP INDEX `uk_actual_line`,
  DROP INDEX `idx_actual_line_pipeline`,
  DROP INDEX `idx_actual_line_field`,
  DROP INDEX `idx_actual_line_service`,
  DROP INDEX `idx_actual_line_org`,
  DROP INDEX `idx_actual_line_manager`,
  ADD PRIMARY KEY (`company_cd`, `actual_line_id`),
  ADD UNIQUE KEY `uk_sales_actual_line_id` (`actual_line_id`),
  ADD UNIQUE KEY `uk_actual_line` (`company_cd`, `actual_year`, `pipeline_id`),
  ADD KEY `idx_actual_line_pipeline` (`company_cd`, `pipeline_id`),
  ADD KEY `idx_actual_line_field` (`company_cd`, `field_code`),
  ADD KEY `idx_actual_line_service` (`company_cd`, `service_code`),
  ADD KEY `idx_actual_line_org` (`company_cd`, `org_id`),
  ADD KEY `idx_actual_line_manager` (`company_cd`, `manager_id`),
  ADD KEY `idx_actual_line_customer` (`company_cd`, `customer_id`),
  ADD KEY `idx_actual_line_ordering` (`company_cd`, `ordering_party_id`);
ALTER TABLE `sales_actual_line`
  ADD CONSTRAINT `fk_sales_actual_line_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_actual_line_project` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`),
  ADD CONSTRAINT `fk_actual_line_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_actual_line_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_actual_line_customer` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_actual_line_ordering` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_actual_line_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_actual_line_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;
