-- DDL_20260203_Code_Seed.sql
-- Source: 영업계획및실적현황_v0.1.xlsx [코드] 시트
-- 생성일: 2026-02-03

START TRANSACTION;

-- 분야 코드 (industry_fields)
INSERT INTO industry_fields (field_code, field_name, org_desc, facility_desc, sort_order, is_use) VALUES
  ('의료','의료','병원·의원·복지시설','종합병원, 지방 의료원, 보건소, 요양병원',1,'Y'),
  ('공공','공공','중앙·지방 행정기관','관공서, 주민센터, 복지관, 체육 시설, 행정센터',2,'Y'),
  ('교육','교육','초중등·고등·기타교육','도서관, 학교, 학원, 직업훈련기관',3,'Y'),
  ('금융','금융','은행·보험·증권','지점·콜센터·모바일',4,'Y'),
  ('교통','교통','육상·철도·항공·해운','버스, 지하철, 공항, 물류센터, 주유소',5,'Y'),
  ('문화','문화','공연·전시·스포츠, 오락,서비스','극장, 박물관, 테마파크',6,'Y'),
  ('숙박','숙박','호텔·리조트.숙박','호텔, 리조트, 콘도',7,'Y'),
  ('제조','제조','제조','전기, 전자, 기계',8,'Y'),
  ('방송','방송','방송업','지상파·케이블·OTT',9,'Y'),
  ('법률','법률','법무관련 서비스','변호사사무소, 법무법인',10,'Y'),
  ('AICC','AICC','콜센터 연계','금융, 공공, 교통, 일반 Enterp. 등',11,'Y')
ON DUPLICATE KEY UPDATE field_name=VALUES(field_name), org_desc=VALUES(org_desc), facility_desc=VALUES(facility_desc), sort_order=VALUES(sort_order), is_use=VALUES(is_use);

-- 공통코드(FIELD) 동기화
INSERT INTO comm_code (group_code, code, code_name, sort_order, is_use) VALUES
  ('FIELD','의료','의료',1,'Y'),
  ('FIELD','공공','공공',2,'Y'),
  ('FIELD','교육','교육',3,'Y'),
  ('FIELD','금융','금융',4,'Y'),
  ('FIELD','교통','교통',5,'Y'),
  ('FIELD','문화','문화',6,'Y'),
  ('FIELD','숙박','숙박',7,'Y'),
  ('FIELD','제조','제조',8,'Y'),
  ('FIELD','방송','방송',9,'Y'),
  ('FIELD','법률','법률',10,'Y'),
  ('FIELD','AICC','AICC',11,'Y')
ON DUPLICATE KEY UPDATE code_name=VALUES(code_name), sort_order=VALUES(sort_order), is_use=VALUES(is_use);

-- 서비스 코드 (service_codes) - 상위
INSERT INTO service_codes (service_code, parent_code, service_name, display_name, sort_order, is_use) VALUES
  ('AI서비스',NULL,'AI서비스','AI서비스',1,'Y'),
  ('AI수어',NULL,'AI수어','AI수어',2,'Y'),
  ('기타',NULL,'기타','기타',3,'Y')
ON DUPLICATE KEY UPDATE service_name=VALUES(service_name), display_name=VALUES(display_name), sort_order=VALUES(sort_order), is_use=VALUES(is_use);

-- 서비스 코드 (service_codes) - 하위
INSERT INTO service_codes (service_code, parent_code, service_name, display_name, sort_order, is_use) VALUES
  ('AI서비스-SI부문','AI서비스','SI부문','AI서비스-SI부문',1,'Y'),
  ('AI서비스-IPCC','AI서비스','IPCC','AI서비스-IPCC',2,'Y'),
  ('AI서비스-시스템','AI서비스','시스템','AI서비스-시스템',3,'Y'),
  ('AI서비스-패키지','AI서비스','패키지','AI서비스-패키지',4,'Y'),
  ('AI수어-구축형','AI수어','구축형','AI수어-구축형',5,'Y'),
  ('AI수어-구독형','AI수어','구독형','AI수어-구독형',6,'Y'),
  ('AI수어-과제형','AI수어','과제형','AI수어-과제형',7,'Y'),
  ('AI수어-대외매출','AI수어','대외매출','AI수어-대외매출',8,'Y'),
  ('기타-유지보수(SM)','기타','유지보수(SM)','기타-유지보수(SM)',9,'Y'),
  ('기타-유지보수(MA)','기타','유지보수(MA)','기타-유지보수(MA)',10,'Y')
ON DUPLICATE KEY UPDATE parent_code=VALUES(parent_code), service_name=VALUES(service_name), display_name=VALUES(display_name), sort_order=VALUES(sort_order), is_use=VALUES(is_use);

-- 공통코드(SERVICE) 동기화
INSERT INTO comm_code (group_code, code, code_name, sort_order, is_use) VALUES
  ('SERVICE','AI서비스-SI부문','AI서비스-SI부문',1,'Y'),
  ('SERVICE','AI서비스-IPCC','AI서비스-IPCC',2,'Y'),
  ('SERVICE','AI서비스-시스템','AI서비스-시스템',3,'Y'),
  ('SERVICE','AI서비스-패키지','AI서비스-패키지',4,'Y'),
  ('SERVICE','AI수어-구축형','AI수어-구축형',5,'Y'),
  ('SERVICE','AI수어-구독형','AI수어-구독형',6,'Y'),
  ('SERVICE','AI수어-과제형','AI수어-과제형',7,'Y'),
  ('SERVICE','AI수어-대외매출','AI수어-대외매출',8,'Y'),
  ('SERVICE','기타-유지보수(SM)','기타-유지보수(SM)',9,'Y'),
  ('SERVICE','기타-유지보수(MA)','기타-유지보수(MA)',10,'Y')
ON DUPLICATE KEY UPDATE code_name=VALUES(code_name), sort_order=VALUES(sort_order), is_use=VALUES(is_use);

-- 조직/부서 (org_units)
INSERT INTO org_units (org_name, org_type, is_use)
SELECT 'AX기술영업팀', 'TEAM', 'Y' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE org_name = 'AX기술영업팀');
INSERT INTO org_units (org_name, org_type, is_use)
SELECT 'AX프로젝트팀', 'TEAM', 'Y' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE org_name = 'AX프로젝트팀');
INSERT INTO org_units (org_name, org_type, is_use)
SELECT 'AX기술수행팀', 'TEAM', 'Y' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM org_units WHERE org_name = 'AX기술수행팀');

-- 담당자 목록(참고): users 테이블은 필수 컬럼이 있어 자동 삽입하지 않음
-- 양승구
-- 임철현
-- 오민규

COMMIT;
