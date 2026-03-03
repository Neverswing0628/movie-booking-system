-- ========================================
-- 쿠폰 시스템 테이블 생성
-- ========================================

-- 1. 쿠폰 마스터 테이블
CREATE TABLE cpn (
    cpn_id SERIAL PRIMARY KEY,
    cpn_cd VARCHAR(20) UNIQUE NOT NULL,          -- 쿠폰코드 (WELCOME2024)
    cpn_nm VARCHAR(100) NOT NULL,                -- 쿠폰명
    cpn_dc_amt INTEGER NOT NULL,                 -- 할인금액
    cpn_min_amt INTEGER DEFAULT 0,               -- 최소결제금액
    cpn_strt_dt DATE NOT NULL,                   -- 시작일
    cpn_end_dt DATE NOT NULL,                    -- 종료일
    cpn_use_cond VARCHAR(200),                   -- 사용조건 (평일만, 특정영화 등)
    cpn_stat CHAR(1) DEFAULT '1',                -- 상태 (1:사용가능, 0:중단)
    cpn_reg_dtm TIMESTAMP DEFAULT NOW()          -- 등록일시
);

COMMENT ON TABLE cpn IS '쿠폰 마스터';
COMMENT ON COLUMN cpn.cpn_cd IS '쿠폰코드';
COMMENT ON COLUMN cpn.cpn_nm IS '쿠폰명';
COMMENT ON COLUMN cpn.cpn_dc_amt IS '할인금액';
COMMENT ON COLUMN cpn.cpn_min_amt IS '최소결제금액';
COMMENT ON COLUMN cpn.cpn_strt_dt IS '시작일';
COMMENT ON COLUMN cpn.cpn_end_dt IS '종료일';
COMMENT ON COLUMN cpn.cpn_use_cond IS '사용조건';
COMMENT ON COLUMN cpn.cpn_stat IS '상태 (1:사용가능, 0:중단)';

-- 2. 회원별 쿠폰 테이블
CREATE TABLE mbr_cpn (
    mbr_cpn_id SERIAL PRIMARY KEY,
    mbr_id INTEGER NOT NULL,                     -- 회원ID
    cpn_id INTEGER NOT NULL,                     -- 쿠폰ID
    mbr_cpn_iss_dtm TIMESTAMP DEFAULT NOW(),     -- 발급일시
    mbr_cpn_use_dtm TIMESTAMP,                   -- 사용일시
    mbr_cpn_use_yn CHAR(1) DEFAULT '0',          -- 사용여부 (0:미사용, 1:사용완료)
    rsv_id INTEGER,                              -- 예매ID (사용처) - rsrv 테이블 참조
    CONSTRAINT fk_mbr_cpn_mbr FOREIGN KEY (mbr_id) REFERENCES cust(mbr_id),
    CONSTRAINT fk_mbr_cpn_cpn FOREIGN KEY (cpn_id) REFERENCES cpn(cpn_id)
    -- rsrv 테이블 외래키는 나중에 추가: FOREIGN KEY (rsv_id) REFERENCES rsrv(rsv_id)
);

COMMENT ON TABLE mbr_cpn IS '회원별 쿠폰';
COMMENT ON COLUMN mbr_cpn.mbr_cpn_iss_dtm IS '발급일시';
COMMENT ON COLUMN mbr_cpn.mbr_cpn_use_dtm IS '사용일시';
COMMENT ON COLUMN mbr_cpn.mbr_cpn_use_yn IS '사용여부 (0:미사용, 1:사용완료)';

-- 3. 인덱스 생성
CREATE INDEX idx_cpn_cd ON cpn(cpn_cd);
CREATE INDEX idx_cpn_date ON cpn(cpn_strt_dt, cpn_end_dt);
CREATE INDEX idx_mbr_cpn_mbr ON mbr_cpn(mbr_id);
CREATE INDEX idx_mbr_cpn_use ON mbr_cpn(mbr_cpn_use_yn);
CREATE INDEX idx_mbr_cpn_mbr_use ON mbr_cpn(mbr_id, mbr_cpn_use_yn);  -- 복합 인덱스

-- ========================================
-- 샘플 쿠폰 데이터
-- ========================================

-- 쿠폰 마스터 데이터
INSERT INTO cpn (cpn_cd, cpn_nm, cpn_dc_amt, cpn_min_amt, cpn_strt_dt, cpn_end_dt, cpn_use_cond, cpn_stat) VALUES
('WELCOME2024', '신규회원 환영 쿠폰', 5000, 10000, '2024-01-01', '2024-12-31', '신규 가입 회원 전용', '1'),
('BIRTH2024', '생일 축하 쿠폰', 10000, 20000, '2024-01-01', '2024-12-31', '생일 당월 사용 가능', '1'),
('EVENT2024', '이벤트 쿠폰', 3000, 15000, '2024-02-01', '2024-03-31', '특정 이벤트 참여자 전용', '1'),
('VIP2024', 'VIP 회원 쿠폰', 15000, 30000, '2024-01-01', '2024-12-31', 'VIP 등급 회원 전용', '1'),
('WEEKEND2024', '주말 할인 쿠폰', 4000, 12000, '2024-01-01', '2024-12-31', '토/일요일만 사용 가능', '1');

-- 회원별 쿠폰 발급 (기존 회원들에게 환영 쿠폰 지급)
INSERT INTO mbr_cpn (mbr_id, cpn_id, mbr_cpn_use_yn)
SELECT 
    mbr_id,
    (SELECT cpn_id FROM cpn WHERE cpn_cd = 'WELCOME2024'),
    '0'
FROM cust
WHERE mbr_stat = 'ACTIVE'
LIMIT 10;

-- VIP 회원에게 추가 쿠폰 지급
INSERT INTO mbr_cpn (mbr_id, cpn_id, mbr_cpn_use_yn)
SELECT 
    mbr_id,
    (SELECT cpn_id FROM cpn WHERE cpn_cd = 'VIP2024'),
    '0'
FROM cust
WHERE mbr_mbrshp_lvl = 'VIP' AND mbr_stat = 'ACTIVE'
LIMIT 5;

-- ========================================
-- 확인 쿼리
-- ========================================

-- 쿠폰 마스터 확인
SELECT * FROM cpn ORDER BY cpn_id;

-- 회원별 쿠폰 현황
SELECT 
    c.mbr_nm as "회원명",
    cp.cpn_nm as "쿠폰명",
    cp.cpn_dc_amt as "할인금액",
    mc.mbr_cpn_use_yn as "사용여부",
    mc.mbr_cpn_iss_dtm as "발급일시"
FROM mbr_cpn mc
JOIN cust c ON mc.mbr_id = c.mbr_id
JOIN cpn cp ON mc.cpn_id = cp.cpn_id
ORDER BY mc.mbr_cpn_id DESC
LIMIT 20;

-- 회원별 사용 가능한 쿠폰 수
SELECT 
    c.mbr_id,
    c.mbr_nm,
    COUNT(*) as "보유쿠폰수"
FROM cust c
LEFT JOIN mbr_cpn mc ON c.mbr_id = mc.mbr_id AND mc.mbr_cpn_use_yn = '0'
GROUP BY c.mbr_id, c.mbr_nm
ORDER BY "보유쿠폰수" DESC;

-- ========================================
-- 유용한 뷰 생성
-- ========================================

-- 사용 가능한 쿠폰 조회 뷰
CREATE OR REPLACE VIEW v_available_coupons AS
SELECT 
    mc.mbr_cpn_id,
    mc.mbr_id,
    c.cpn_id,
    c.cpn_cd,
    c.cpn_nm,
    c.cpn_dc_amt,
    c.cpn_min_amt,
    c.cpn_end_dt,
    c.cpn_use_cond,
    mc.mbr_cpn_iss_dtm,
    CASE 
        WHEN c.cpn_end_dt < CURRENT_DATE THEN '기간만료'
        WHEN mc.mbr_cpn_use_yn = '1' THEN '사용완료'
        ELSE '사용가능'
    END as status
FROM mbr_cpn mc
JOIN cpn c ON mc.cpn_id = c.cpn_id
WHERE mc.mbr_cpn_use_yn = '0'
  AND c.cpn_stat = '1'
  AND c.cpn_end_dt >= CURRENT_DATE;

COMMENT ON VIEW v_available_coupons IS '사용 가능한 쿠폰 목록';

-- 확인
SELECT * FROM v_available_coupons LIMIT 10;

-- ========================================
-- 완료!
-- ========================================

SELECT '✅ 쿠폰 테이블 생성 완료!' as message;
SELECT '📊 쿠폰 마스터: ' || COUNT(*) || '개' as info FROM cpn;
SELECT '🎫 발급된 쿠폰: ' || COUNT(*) || '개' as info FROM mbr_cpn;
