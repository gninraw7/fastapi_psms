-- =====================================================
-- PSMS 데이터베이스 테스트 데이터
-- =====================================================

-- 데이터베이스 생성 (필요시)
-- CREATE DATABASE IF NOT EXISTS psms_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE psms_db;

-- =====================================================
-- 1. 테이블 생성
-- =====================================================

-- 프로젝트 테이블
CREATE TABLE IF NOT EXISTS projects (
    pipeline_id VARCHAR(50) PRIMARY KEY,
    project_name VARCHAR(200),
    customer_name VARCHAR(200),
    field VARCHAR(50),
    stage VARCHAR(50),
    manager_id VARCHAR(50),
    amount DECIMAL(15,2),
    probability INT,
    expected_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_field (field),
    INDEX idx_stage (stage),
    INDEX idx_manager (manager_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 공통코드 테이블
CREATE TABLE IF NOT EXISTS comm_code (
    group_code VARCHAR(50),
    code VARCHAR(50),
    code_name VARCHAR(200),
    sort_order INT DEFAULT 0,
    is_use CHAR(1) DEFAULT 'Y',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_code, code),
    INDEX idx_group_code (group_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    login_id VARCHAR(50) PRIMARY KEY,
    user_name VARCHAR(100),
    email VARCHAR(200),
    is_sales_rep TINYINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 2. 테스트 데이터 삽입
-- =====================================================

-- 사용자 데이터
INSERT INTO users (login_id, user_name, email, is_sales_rep, status) VALUES
('user01', '홍길동', 'hong@kbds.co.kr', 1, 'ACTIVE'),
('user02', '김영희', 'kim@kbds.co.kr', 1, 'ACTIVE'),
('user03', '이철수', 'lee@kbds.co.kr', 1, 'ACTIVE'),
('user04', '박민수', 'park@kbds.co.kr', 0, 'ACTIVE');

-- 공통코드 - FIELD (분야)
INSERT INTO comm_code (group_code, code, code_name, sort_order, is_use) VALUES
('FIELD', 'IT', 'IT/시스템', 1, 'Y'),
('FIELD', 'CONSULTING', '컨설팅', 2, 'Y'),
('FIELD', 'SOLUTION', '솔루션', 3, 'Y'),
('FIELD', 'MAINTENANCE', '유지보수', 4, 'Y');

-- 공통코드 - STAGE (단계)
INSERT INTO comm_code (group_code, code, code_name, sort_order, is_use) VALUES
('STAGE', 'PROSPECT', '잠재고객', 1, 'Y'),
('STAGE', 'QUALIFY', '자격검증', 2, 'Y'),
('STAGE', 'PROPOSAL', '제안', 3, 'Y'),
('STAGE', 'NEGOTIATION', '협상', 4, 'Y'),
('STAGE', 'CONTRACT', '계약', 5, 'Y'),
('STAGE', 'CLOSED_WON', '수주', 6, 'Y'),
('STAGE', 'CLOSED_LOST', '실주', 7, 'Y');

-- 프로젝트 데이터 (100건)
INSERT INTO projects (pipeline_id, project_name, customer_name, field, stage, manager_id, amount, probability, expected_date) VALUES
('P2024001', 'KB증권 트레이딩시스템 고도화', 'KB증권', 'IT', 'PROPOSAL', 'user01', 150000000, 70, '2024-12-31'),
('P2024002', 'KB국민은행 차세대 시스템', 'KB국민은행', 'IT', 'NEGOTIATION', 'user01', 500000000, 80, '2024-11-30'),
('P2024003', 'KB손해보험 디지털 전환 컨설팅', 'KB손해보험', 'CONSULTING', 'QUALIFY', 'user02', 80000000, 50, '2025-01-15'),
('P2024004', 'KB생명 CRM 시스템 구축', 'KB생명', 'SOLUTION', 'PROPOSAL', 'user02', 120000000, 65, '2024-10-31'),
('P2024005', 'KB캐피탈 여신시스템 개선', 'KB캐피탈', 'IT', 'CONTRACT', 'user03', 90000000, 90, '2024-09-30'),
('P2024006', 'KB저축은행 모바일뱅킹 개발', 'KB저축은행', 'IT', 'PROPOSAL', 'user01', 70000000, 60, '2024-12-15'),
('P2024007', 'KB카드 빅데이터 분석 플랫폼', 'KB카드', 'IT', 'QUALIFY', 'user02', 200000000, 55, '2025-02-28'),
('P2024008', 'KB부동산신탁 시스템 유지보수', 'KB부동산신탁', 'MAINTENANCE', 'CLOSED_WON', 'user03', 30000000, 100, '2024-08-31'),
('P2024009', '현대자동차 ERP 컨설팅', '현대자동차', 'CONSULTING', 'PROSPECT', 'user01', 180000000, 30, '2025-03-31'),
('P2024010', '삼성전자 MES 시스템', '삼성전자', 'SOLUTION', 'PROPOSAL', 'user02', 350000000, 70, '2024-11-15');

-- 추가 프로젝트 데이터 (90건 더)
INSERT INTO projects (pipeline_id, project_name, customer_name, field, stage, manager_id, amount, probability, expected_date)
SELECT 
    CONCAT('P2024', LPAD(n + 10, 3, '0')),
    CONCAT('프로젝트-', n + 10),
    CASE (n % 5)
        WHEN 0 THEN 'A회사'
        WHEN 1 THEN 'B회사'
        WHEN 2 THEN 'C회사'
        WHEN 3 THEN 'D회사'
        ELSE 'E회사'
    END,
    CASE (n % 4)
        WHEN 0 THEN 'IT'
        WHEN 1 THEN 'CONSULTING'
        WHEN 2 THEN 'SOLUTION'
        ELSE 'MAINTENANCE'
    END,
    CASE (n % 7)
        WHEN 0 THEN 'PROSPECT'
        WHEN 1 THEN 'QUALIFY'
        WHEN 2 THEN 'PROPOSAL'
        WHEN 3 THEN 'NEGOTIATION'
        WHEN 4 THEN 'CONTRACT'
        WHEN 5 THEN 'CLOSED_WON'
        ELSE 'CLOSED_LOST'
    END,
    CASE (n % 3)
        WHEN 0 THEN 'user01'
        WHEN 1 THEN 'user02'
        ELSE 'user03'
    END,
    FLOOR(50000000 + RAND() * 150000000),
    FLOOR(30 + RAND() * 70),
    DATE_ADD(CURDATE(), INTERVAL FLOOR(RAND() * 180) DAY)
FROM (
    SELECT a.N + b.N * 10 + 1 n
    FROM 
    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
    (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8) b
    LIMIT 90
) numbers;

-- =====================================================
-- 3. 확인 쿼리
-- =====================================================

-- 데이터 개수 확인
SELECT 
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM comm_code) as comm_code_count,
    (SELECT COUNT(*) FROM projects) as projects_count;

-- 프로젝트 통계
SELECT 
    stage,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    AVG(probability) as avg_probability
FROM projects
GROUP BY stage
ORDER BY 
    CASE stage
        WHEN 'PROSPECT' THEN 1
        WHEN 'QUALIFY' THEN 2
        WHEN 'PROPOSAL' THEN 3
        WHEN 'NEGOTIATION' THEN 4
        WHEN 'CONTRACT' THEN 5
        WHEN 'CLOSED_WON' THEN 6
        WHEN 'CLOSED_LOST' THEN 7
    END;
