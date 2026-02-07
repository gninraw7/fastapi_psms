-- DDL_20260203_Add_CompanyCd.sql
-- 기존 단일회사 스키마 -> Shared Schema 멀티테넌트(company_cd) 마이그레이션
-- 가정: 기존 데이터는 단일 회사에 해당하며, 아래 @company_cd로 일괄 지정됨

SET @company_cd = 'COMP001';
SET @company_name = 'Default Company';

-- 0) 회사 마스터 생성 및 기본 회사 등록
CREATE TABLE IF NOT EXISTS `companies` (
  `company_cd` varchar(20) NOT NULL COMMENT '회사 코드',
  `company_name` varchar(100) NOT NULL COMMENT '회사명',
  `company_alias` varchar(100) DEFAULT NULL COMMENT '회사 별칭',
  `is_use` char(1) DEFAULT 'Y' COMMENT '사용 여부 (Y/N)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `created_by` varchar(50) DEFAULT NULL COMMENT '생성자 ID',
  `updated_by` varchar(50) DEFAULT NULL COMMENT '수정자 ID',
  PRIMARY KEY (`company_cd`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='회사(테넌트) 마스터';

INSERT IGNORE INTO `companies` (`company_cd`, `company_name`, `is_use`)
VALUES (@company_cd, @company_name, 'Y');

SET FOREIGN_KEY_CHECKS = 0;

-- 1) industry_fields
ALTER TABLE `industry_fields`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `industry_fields` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `industry_fields`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `industry_fields`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `field_code`),
  ADD CONSTRAINT `fk_industry_fields_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 2) service_codes
ALTER TABLE `service_codes`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `service_codes` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `service_codes`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `service_codes`
  DROP FOREIGN KEY `fk_service_parent`;
ALTER TABLE `service_codes`
  DROP PRIMARY KEY,
  DROP INDEX `idx_service_parent`,
  ADD PRIMARY KEY (`company_cd`, `service_code`),
  ADD KEY `idx_service_parent` (`company_cd`, `parent_code`),
  ADD CONSTRAINT `fk_service_codes_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_service_parent` FOREIGN KEY (`company_cd`, `parent_code`) REFERENCES `service_codes` (`company_cd`, `service_code`);

-- 3) org_units
ALTER TABLE `org_units`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `org_units` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `org_units`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `org_units`
  DROP FOREIGN KEY `fk_org_parent`;
ALTER TABLE `org_units`
  DROP PRIMARY KEY,
  DROP INDEX `idx_org_parent`,
  ADD PRIMARY KEY (`company_cd`, `org_id`),
  ADD UNIQUE KEY `uk_org_units_id` (`org_id`),
  ADD KEY `idx_org_parent` (`company_cd`, `parent_id`),
  ADD CONSTRAINT `fk_org_units_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_org_parent` FOREIGN KEY (`company_cd`, `parent_id`) REFERENCES `org_units` (`company_cd`, `org_id`);

-- 4) users
ALTER TABLE `users`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `users` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `users`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `users`
  DROP FOREIGN KEY `fk_users_org`;
ALTER TABLE `users`
  DROP PRIMARY KEY,
  DROP INDEX `login_id`,
  DROP INDEX `idx_users_org_id`,
  ADD PRIMARY KEY (`company_cd`, `user_no`),
  ADD UNIQUE KEY `uk_users_user_no` (`user_no`),
  ADD UNIQUE KEY `uk_users_login_id` (`company_cd`, `login_id`),
  ADD KEY `idx_users_org_id` (`company_cd`, `org_id`),
  ADD CONSTRAINT `fk_users_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_users_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`);

-- 5) comm_code
ALTER TABLE `comm_code`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `comm_code` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `comm_code`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `comm_code`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `group_code`, `code`),
  ADD CONSTRAINT `fk_comm_code_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 6) clients
ALTER TABLE `clients`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `clients` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `clients`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `clients`
  DROP FOREIGN KEY `fk_clients_industry_type`;
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
  ADD KEY `idx_industry_type` (`company_cd`, `industry_type`),
  ADD CONSTRAINT `fk_clients_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_clients_industry_type` FOREIGN KEY (`company_cd`, `industry_type`) REFERENCES `industry_fields` (`company_cd`, `field_code`);

-- 7) projects
ALTER TABLE `projects`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `projects` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `projects`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `projects`
  DROP FOREIGN KEY `projects_ibfk_1`,
  DROP FOREIGN KEY `projects_ibfk_2`,
  DROP FOREIGN KEY `projects_ibfk_field`,
  DROP FOREIGN KEY `projects_ibfk_service`,
  DROP FOREIGN KEY `projects_ibfk_org`;
ALTER TABLE `projects`
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
  ADD KEY `idx_projects_ordering` (`company_cd`, `ordering_party_id`),
  ADD CONSTRAINT `fk_projects_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `projects_ibfk_2` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `projects_ibfk_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`),
  ADD CONSTRAINT `projects_ibfk_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`),
  ADD CONSTRAINT `projects_ibfk_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`),
  ADD CONSTRAINT `projects_ibfk_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`);

-- 7-1) project_attributes
ALTER TABLE `project_attributes`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `project_attributes` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `project_attributes`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `project_attributes`
  DROP FOREIGN KEY `project_attributes_ibfk_1`;
ALTER TABLE `project_attributes`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `pipeline_id`, `attr_code`),
  ADD CONSTRAINT `fk_project_attributes_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `project_attributes_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE;

-- 8) project_contracts
ALTER TABLE `project_contracts`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `project_contracts` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `project_contracts`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `project_contracts`
  DROP FOREIGN KEY `project_contracts_ibfk_1`;
ALTER TABLE `project_contracts`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `pipeline_id`),
  ADD CONSTRAINT `fk_project_contracts_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `project_contracts_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE;

-- 10) project_history
ALTER TABLE `project_history`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `project_history` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `project_history`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `project_history`
  DROP FOREIGN KEY `project_history_ibfk_1`;
ALTER TABLE `project_history`
  DROP PRIMARY KEY,
  DROP INDEX `pipeline_id`,
  ADD PRIMARY KEY (`company_cd`, `history_id`),
  ADD UNIQUE KEY `uk_project_history_id` (`history_id`),
  ADD KEY `idx_project_history_pipeline` (`company_cd`, `pipeline_id`),
  ADD CONSTRAINT `fk_project_history_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `project_history_ibfk_1` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`) ON DELETE CASCADE;

-- 11) login_history
ALTER TABLE `login_history`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `login_history` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `login_history`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `login_history`
  DROP FOREIGN KEY `login_history_ibfk_1`;
ALTER TABLE `login_history`
  DROP PRIMARY KEY,
  DROP INDEX `login_id`,
  ADD PRIMARY KEY (`company_cd`, `history_id`),
  ADD UNIQUE KEY `uk_login_history_id` (`history_id`),
  ADD KEY `idx_login_history_login` (`company_cd`, `login_id`),
  ADD CONSTRAINT `fk_login_history_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`company_cd`, `login_id`) REFERENCES `users` (`company_cd`, `login_id`);

-- 12) auth_forms
ALTER TABLE `auth_forms`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `auth_forms` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `auth_forms`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `auth_forms`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `form_id`),
  ADD CONSTRAINT `fk_auth_forms_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 13) auth_permissions
ALTER TABLE `auth_permissions`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `auth_permissions` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `auth_permissions`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `auth_permissions`
  DROP FOREIGN KEY `fk_auth_form`;
ALTER TABLE `auth_permissions`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `role`, `form_id`),
  ADD KEY `idx_auth_permissions_form` (`company_cd`, `form_id`),
  ADD CONSTRAINT `fk_auth_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_auth_form` FOREIGN KEY (`company_cd`, `form_id`) REFERENCES `auth_forms` (`company_cd`, `form_id`);

-- 14) auth_role_permissions
ALTER TABLE `auth_role_permissions`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `auth_role_permissions` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `auth_role_permissions`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `auth_role_permissions`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `role`, `form_id`),
  ADD CONSTRAINT `fk_auth_role_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 15) auth_user_permissions
ALTER TABLE `auth_user_permissions`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `auth_user_permissions` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `auth_user_permissions`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `auth_user_permissions`
  DROP FOREIGN KEY `fk_user_auth`;
ALTER TABLE `auth_user_permissions`
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_cd`, `login_id`, `form_id`),
  ADD CONSTRAINT `fk_auth_user_permissions_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_user_auth` FOREIGN KEY (`company_cd`, `login_id`) REFERENCES `users` (`company_cd`, `login_id`);

-- 16) sales_plan
ALTER TABLE `sales_plan`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `sales_plan` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `sales_plan`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `sales_plan`
  DROP PRIMARY KEY,
  DROP INDEX `uk_plan_year_version`,
  ADD PRIMARY KEY (`company_cd`, `plan_id`),
  ADD UNIQUE KEY `uk_sales_plan_id` (`plan_id`),
  ADD UNIQUE KEY `uk_plan_year_version` (`company_cd`, `plan_year`, `plan_version`),
  ADD CONSTRAINT `fk_sales_plan_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`);

-- 17) sales_plan_line
ALTER TABLE `sales_plan_line`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `sales_plan_line` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `sales_plan_line`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `sales_plan_line`
  DROP FOREIGN KEY `fk_plan_line_plan`,
  DROP FOREIGN KEY `fk_plan_line_project`,
  DROP FOREIGN KEY `fk_plan_line_field`,
  DROP FOREIGN KEY `fk_plan_line_service`,
  DROP FOREIGN KEY `fk_plan_line_customer`,
  DROP FOREIGN KEY `fk_plan_line_ordering`,
  DROP FOREIGN KEY `fk_plan_line_org`,
  DROP FOREIGN KEY `fk_plan_line_manager`;
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
  ADD KEY `idx_plan_line_ordering` (`company_cd`, `ordering_party_id`),
  ADD CONSTRAINT `fk_sales_plan_line_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_plan_line_plan` FOREIGN KEY (`company_cd`, `plan_id`) REFERENCES `sales_plan` (`company_cd`, `plan_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_plan_line_project` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`),
  ADD CONSTRAINT `fk_plan_line_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`),
  ADD CONSTRAINT `fk_plan_line_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`),
  ADD CONSTRAINT `fk_plan_line_customer` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `fk_plan_line_ordering` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `fk_plan_line_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`),
  ADD CONSTRAINT `fk_plan_line_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`);

-- 18) sales_actual_line
ALTER TABLE `sales_actual_line`
  ADD COLUMN `company_cd` varchar(20) NULL FIRST;
UPDATE `sales_actual_line` SET `company_cd` = @company_cd WHERE `company_cd` IS NULL;
ALTER TABLE `sales_actual_line`
  MODIFY `company_cd` varchar(20) NOT NULL FIRST;
ALTER TABLE `sales_actual_line`
  DROP FOREIGN KEY `fk_actual_line_project`,
  DROP FOREIGN KEY `fk_actual_line_field`,
  DROP FOREIGN KEY `fk_actual_line_service`,
  DROP FOREIGN KEY `fk_actual_line_customer`,
  DROP FOREIGN KEY `fk_actual_line_ordering`,
  DROP FOREIGN KEY `fk_actual_line_org`,
  DROP FOREIGN KEY `fk_actual_line_manager`;
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
  ADD KEY `idx_actual_line_ordering` (`company_cd`, `ordering_party_id`),
  ADD CONSTRAINT `fk_sales_actual_line_company` FOREIGN KEY (`company_cd`) REFERENCES `companies` (`company_cd`),
  ADD CONSTRAINT `fk_actual_line_project` FOREIGN KEY (`company_cd`, `pipeline_id`) REFERENCES `projects` (`company_cd`, `pipeline_id`),
  ADD CONSTRAINT `fk_actual_line_field` FOREIGN KEY (`company_cd`, `field_code`) REFERENCES `industry_fields` (`company_cd`, `field_code`),
  ADD CONSTRAINT `fk_actual_line_service` FOREIGN KEY (`company_cd`, `service_code`) REFERENCES `service_codes` (`company_cd`, `service_code`),
  ADD CONSTRAINT `fk_actual_line_customer` FOREIGN KEY (`company_cd`, `customer_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `fk_actual_line_ordering` FOREIGN KEY (`company_cd`, `ordering_party_id`) REFERENCES `clients` (`company_cd`, `client_id`),
  ADD CONSTRAINT `fk_actual_line_org` FOREIGN KEY (`company_cd`, `org_id`) REFERENCES `org_units` (`company_cd`, `org_id`),
  ADD CONSTRAINT `fk_actual_line_manager` FOREIGN KEY (`company_cd`, `manager_id`) REFERENCES `users` (`company_cd`, `login_id`);

SET FOREIGN_KEY_CHECKS = 1;
