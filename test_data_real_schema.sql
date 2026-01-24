-- =====================================================
-- PSMS 테스트 데이터 (실제 스키마 기준)
-- =====================================================

-- =====================================================
-- 1. 공통 코드 데이터
-- =====================================================

-- 사업분야 코드 (FIELD)
INSERT INTO comm_code (group_code, code, code_name, sort_order, is_use, created_by) VALUES
('FIELD', 'SI', '시스템통합(SI)', 1, 'Y', 'admin'),
('FIELD', 'SM', '시스템유지보수(SM)', 2, 'Y', 'admin'),
('FIELD', 'CONSULTING', 'IT컨설팅', 3, 'Y', 'admin'),
('FIELD', 'SOLUTION', '솔루션', 4, 'Y', 'admin'),
('FIELD', 'OUTSOURCING', '아웃소싱', 5, 'Y', 'admin');

-- 진행단계 코드 (STAGE)
INSERT INTO comm_code (group_code, code, code_name, sort_order, is_use, created_by) VALUES
('STAGE', 'PROSPECT', '잠재고객', 1, 'Y', 'admin'),
('STAGE', 'QUALIFY', '자격검증', 2, 'Y', 'admin'),
('STAGE', 'PROPOSAL', '제안', 3, 'Y', 'admin'),
('STAGE', 'NEGOTIATION', '협상', 4, 'Y', 'admin'),
('STAGE', 'CONTRACT', '계약체결', 5, 'Y', 'admin'),
('STAGE', 'EXECUTING', '수행중', 6, 'Y', 'admin'),
('STAGE', 'CLOSED_WON', '수주완료', 7, 'Y', 'admin'),
('STAGE', 'CLOSED_LOST', '미수주', 8, 'Y', 'admin');

-- =====================================================
-- 2. 사용자 데이터
-- =====================================================

INSERT INTO users (
    login_id, password, user_name, role, is_sales_rep, email, 
    headquarters, department, team, start_date, status, created_by
) VALUES
('admin', SHA2('admin123', 256), '시스템관리자', 'ADMIN', 0, 'admin@kbds.co.kr', 
 'IT본부', '시스템관리팀', NULL, '2020-01-01', 'ACTIVE', 'system'),
 
('hong01', SHA2('hong123', 256), '홍길동', 'USER', 1, 'hong@kbds.co.kr',
 '영업본부', '1영업팀', 'KB영업팀', '2021-03-01', 'ACTIVE', 'admin'),
 
('kim02', SHA2('kim123', 256), '김영희', 'USER', 1, 'kim@kbds.co.kr',
 '영업본부', '2영업팀', '공공영업팀', '2021-06-01', 'ACTIVE', 'admin'),
 
('lee03', SHA2('lee123', 256), '이철수', 'USER', 1, 'lee@kbds.co.kr',
 '영업본부', '3영업팀', '대기업영업팀', '2022-01-01', 'ACTIVE', 'admin'),
 
('park04', SHA2('park123', 256), '박민수', 'USER', 0, 'park@kbds.co.kr',
 'IT본부', '개발팀', 'SI개발팀', '2021-09-01', 'ACTIVE', 'admin');

-- =====================================================
-- 3. 고객사 데이터
-- =====================================================

INSERT INTO clients (client_name, business_type, created_by) VALUES
('KB국민은행', '금융', 'admin'),
('KB증권', '금융', 'admin'),
('KB손해보험', '금융', 'admin'),
('KB생명보험', '금융', 'admin'),
('KB캐피탈', '금융', 'admin'),
('KB저축은행', '금융', 'admin'),
('KB카드', '금융', 'admin'),
('현대자동차', '제조', 'admin'),
('삼성전자', '제조', 'admin'),
('LG전자', '제조', 'admin'),
('SK텔레콤', '통신', 'admin'),
('KT', '통신', 'admin'),
('행정안전부', '공공', 'admin'),
('국토교통부', '공공', 'admin'),
('서울시청', '공공', 'admin');

-- =====================================================
-- 4. 프로젝트 기본 정보
-- =====================================================

INSERT INTO projects (
    pipeline_id, project_name, field_code, manager_id, 
    customer_id, ordering_party_id, current_stage, quoted_amount, created_by
) VALUES
-- KB그룹 프로젝트
('2024_001', 'KB국민은행 차세대 시스템 구축', 'SI', 'hong01', 
 1, 1, 'NEGOTIATION', 5000000000.00, 'hong01'),
 
('2024_002', 'KB증권 트레이딩 시스템 고도화', 'SI', 'hong01',
 2, 2, 'PROPOSAL', 1500000000.00, 'hong01'),
 
('2024_003', 'KB손해보험 모바일 앱 개발', 'SI', 'hong01',
 3, 3, 'QUALIFY', 800000000.00, 'hong01'),
 
('2024_004', 'KB생명 CRM 시스템 구축', 'SOLUTION', 'hong01',
 4, 4, 'PROPOSAL', 1200000000.00, 'hong01'),
 
('2024_005', 'KB캐피탈 여신시스템 개선', 'SI', 'hong01',
 5, 5, 'CONTRACT', 900000000.00, 'hong01'),
 
('2024_006', 'KB저축은행 업무시스템 유지보수', 'SM', 'hong01',
 6, 6, 'EXECUTING', 300000000.00, 'hong01'),
 
('2024_007', 'KB카드 빅데이터 분석 플랫폼', 'SI', 'kim02',
 7, 7, 'PROPOSAL', 2000000000.00, 'kim02'),

-- 공공기관 프로젝트
('2024_008', '행정안전부 통합업무시스템 구축', 'SI', 'kim02',
 13, 13, 'QUALIFY', 3000000000.00, 'kim02'),
 
('2024_009', '국토교통부 부동산 정보시스템', 'SI', 'kim02',
 14, 14, 'PROPOSAL', 1800000000.00, 'kim02'),
 
('2024_010', '서울시청 스마트시티 플랫폼', 'SI', 'kim02',
 15, 15, 'NEGOTIATION', 2500000000.00, 'kim02'),

-- 대기업 프로젝트  
('2024_011', '현대자동차 ERP 시스템 컨설팅', 'CONSULTING', 'lee03',
 8, 8, 'PROPOSAL', 1800000000.00, 'lee03'),
 
('2024_012', '삼성전자 MES 시스템 구축', 'SI', 'lee03',
 9, 9, 'QUALIFY', 3500000000.00, 'lee03'),
 
('2024_013', 'LG전자 SCM 시스템 고도화', 'SI', 'lee03',
 10, 10, 'PROPOSAL', 2200000000.00, 'lee03'),
 
('2024_014', 'SK텔레콤 고객관리 시스템', 'SOLUTION', 'lee03',
 11, 11, 'NEGOTIATION', 1600000000.00, 'lee03'),
 
('2024_015', 'KT 통신망 관리시스템', 'SI', 'lee03',
 12, 12, 'CONTRACT', 2800000000.00, 'lee03');

-- =====================================================
-- 5. 계약 상세 정보 (계약체결/수행중인 프로젝트만)
-- =====================================================

INSERT INTO project_contracts (
    pipeline_id, contract_date, start_date, end_date,
    order_amount, contract_amount, created_by
) VALUES
-- KB캐피탈 프로젝트
('2024_005', '2024-06-15', '2024-07-01', '2024-12-31',
 900000000.00, 850000000.00, 'hong01'),

-- KB저축은행 프로젝트  
('2024_006', '2024-01-10', '2024-02-01', '2025-01-31',
 300000000.00, 300000000.00, 'hong01'),

-- KT 프로젝트
('2024_015', '2024-08-20', '2024-09-01', '2025-08-31',
 2800000000.00, 2700000000.00, 'lee03');

-- =====================================================
-- 6. 매출 실적 (수행중인 프로젝트)
-- =====================================================

-- KB저축은행 프로젝트 월별 매출
INSERT INTO sales_performance (pipeline_id, sales_date, sales_amount, created_by) VALUES
('2024_006', '2024-02-28', 25000000.00, 'system'),
('2024_006', '2024-03-31', 25000000.00, 'system'),
('2024_006', '2024-04-30', 25000000.00, 'system'),
('2024_006', '2024-05-31', 25000000.00, 'system'),
('2024_006', '2024-06-30', 25000000.00, 'system'),
('2024_006', '2024-07-31', 25000000.00, 'system'),
('2024_006', '2024-08-31', 25000000.00, 'system'),
('2024_006', '2024-09-30', 25000000.00, 'system'),
('2024_006', '2024-10-31', 25000000.00, 'system'),
('2024_006', '2024-11-30', 25000000.00, 'system'),
('2024_006', '2024-12-31', 25000000.00, 'system'),
('2025-01-31', '2024-006', 25000000.00, 'system');

-- KT 프로젝트 월별 매출
INSERT INTO sales_performance (pipeline_id, sales_date, sales_amount, created_by) VALUES
('2024_015', '2024-09-30', 225000000.00, 'system'),
('2024_015', '2024-10-31', 225000000.00, 'system'),
('2024_015', '2024-11-30', 225000000.00, 'system'),
('2024_015', '2024-12-31', 225000000.00, 'system');

-- =====================================================
-- 7. 프로젝트 변경 이력
-- =====================================================

INSERT INTO project_history (
    pipeline_id, base_date, progress_stage, strategy_content, creator_id, created_by
) VALUES
('2024_001', '2024-06-01', 'PROPOSAL', 
 '차세대 시스템 구축 제안서 제출 완료. 경쟁사 2개 업체와 경쟁 예상.', 'hong01', 'hong01'),
 
('2024_001', '2024-07-15', 'NEGOTIATION',
 '1차 PT 완료. 고객사 긍정적 반응. 가격 협상 진행중.', 'hong01', 'hong01'),
 
('2024_002', '2024-08-10', 'PROPOSAL',
 '트레이딩 시스템 고도화 제안. 실시간 처리 성능 개선 중점.', 'hong01', 'hong01'),
 
('2024_005', '2024-06-01', 'NEGOTIATION',
 '최종 가격 협상 완료. 계약 임박.', 'hong01', 'hong01'),
 
('2024_005', '2024-06-15', 'CONTRACT',
 '계약 체결 완료. 7월 1일 킥오프 미팅 예정.', 'hong01', 'hong01');

-- =====================================================
-- 8. 확인 쿼리
-- =====================================================

-- 데이터 개수 확인
SELECT 
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM comm_code) as comm_code_count,
    (SELECT COUNT(*) FROM clients) as clients_count,
    (SELECT COUNT(*) FROM projects) as projects_count,
    (SELECT COUNT(*) FROM project_contracts) as contracts_count,
    (SELECT COUNT(*) FROM sales_performance) as sales_count,
    (SELECT COUNT(*) FROM project_history) as history_count;

-- 프로젝트 단계별 통계
SELECT 
    cc.code_name as stage_name,
    COUNT(*) as count,
    SUM(p.quoted_amount) as total_quoted_amount
FROM projects p
LEFT JOIN comm_code cc ON p.current_stage = cc.code AND cc.group_code = 'STAGE'
GROUP BY p.current_stage, cc.code_name
ORDER BY cc.sort_order;

-- 담당자별 프로젝트 현황
SELECT 
    u.user_name,
    COUNT(*) as project_count,
    SUM(p.quoted_amount) as total_quoted_amount
FROM projects p
LEFT JOIN users u ON p.manager_id = u.login_id
GROUP BY u.user_name
ORDER BY total_quoted_amount DESC;
