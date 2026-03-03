-- ========================================
-- 쿠폰 테이블 외래키 추가
-- ========================================

-- rsrv 테이블 구조 확인 완료!
-- 테이블명: rsrv
-- 기본키: rsv_id
-- 컬럼: rsv_id, mbr_id, sht_id, rsv_no, rsv_tot_seat_cnt, rsv_tot_amt, rsv_usd_pnt, rsv_stat, rsv_dtm

-- ========================================
-- 외래키 추가
-- ========================================

ALTER TABLE mbr_cpn
ADD CONSTRAINT fk_mbr_cpn_rsrv
FOREIGN KEY (rsv_id) REFERENCES rsrv(rsv_id);

-- ========================================
-- 확인
-- ========================================

-- 외래키 제약조건 확인
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'mbr_cpn';

-- 결과: fk_mbr_cpn_rsrv가 표시되어야 함
-- mbr_cpn.rsv_id -> rsrv.rsv_id
