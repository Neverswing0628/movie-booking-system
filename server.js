const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config(); // ← .env 파일 로드!

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // 정적 파일 서빙

// 환경 변수 디버깅 (개발 시에만)
console.log('\n🔍 ===== 환경 변수 확인 =====');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD 설정됨?:', process.env.DB_PASSWORD ? 'YES ✅' : 'NO ❌');
console.log('DB_PASSWORD 길이:', process.env.DB_PASSWORD?.length || 0);
console.log('=============================\n');

// PostgreSQL 연결 설정 (.env 파일 사용!)
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

// DB 연결 테스트
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ PostgreSQL 연결 실패:', err);
    } else {
        console.log('✅ PostgreSQL 연결 성공:', res.rows[0].now);
    }
});

// ========================================
// API 엔드포인트
// ========================================

// 헬스 체크
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
});

// 🔍 디버깅: 모든 테이블 목록
app.get('/api/debug/tables', async (req, res) => {
    try {
        const query = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('테이블 목록 조회 실패:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔍 디버깅: 특정 테이블 컬럼 정보
app.get('/api/debug/columns/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;
        const query = `
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position
        `;
        const result = await pool.query(query, [tableName]);
        res.json(result.rows);
    } catch (error) {
        console.error('컬럼 정보 조회 실패:', error);
        res.status(500).json({ error: error.message });
    }
});

// 🔍 디버깅: 특정 테이블 데이터 샘플
app.get('/api/debug/data/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;
        const limit = req.query.limit || 5;
        
        // SQL injection 방지를 위한 테이블명 검증
        const validTableQuery = await pool.query(
            `SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = $1`,
            [tableName]
        );
        
        if (validTableQuery.rows.length === 0) {
            return res.status(404).json({ error: '테이블을 찾을 수 없습니다' });
        }
        
        const query = `SELECT * FROM "${tableName}" LIMIT $1`;
        const result = await pool.query(query, [limit]);
        res.json(result.rows);
    } catch (error) {
        console.error('데이터 조회 실패:', error);
        res.status(500).json({ error: error.message });
    }
});

// 영화 목록 조회
app.get('/api/movies', async (req, res) => {
    try {
        const query = `
            SELECT 
                mv_id as id,
                mv_ttl as title,
                mv_ttl_en as "titleEn",
                mv_rtng as rating,
                mv_gnr as genre,
                mv_shw_tm as runtime,
                mv_rls_dt as "releaseDate",
                mv_drctr as director,
                mv_actr as actors,
                mv_stat as status
            FROM mv
            ORDER BY mv_id
            LIMIT 50
        `;
        
        const result = await pool.query(query);
        
        console.log(`✅ 영화 ${result.rows.length}개 조회 성공`);
        
        // 가격 추가 (실제로는 상영시간표나 극장 정보에서 가져와야 함)
        const movies = result.rows.map(movie => ({
            ...movie,
            price: 14000 // 기본 가격
        }));
        
        res.json(movies);
    } catch (error) {
        console.error('❌ 영화 목록 조회 실패:', error);
        res.status(500).json({ error: '영화 목록을 불러오는데 실패했습니다.', details: error.message });
    }
});

// 극장 목록 조회
app.get('/api/theaters', async (req, res) => {
    try {
        const query = `
            SELECT 
                tht_id as id,
                tht_nm as name,
                tht_rgn as region,
                tht_addr as address,
                tht_phn_no as phone,
                tht_stat as status
            FROM thtr
            WHERE tht_stat = '1'
            ORDER BY tht_rgn, tht_nm
        `;
        
        const result = await pool.query(query);
        console.log(`✅ 극장 ${result.rows.length}개 조회 성공`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ 극장 목록 조회 실패:', error);
        res.status(500).json({ error: '극장 목록을 불러오는데 실패했습니다.' });
    }
});

// 상영시간표 조회
app.get('/api/showtimes', async (req, res) => {
    try {
        const { movieId, theaterId } = req.query;
        
        let query = `
            SELECT 
                sht_id as id,
                tht_id as "theaterId",
                scr_id as "screenId",
                mv_id as "movieId",
                sht_shw_strt_dt as "startTime",
                sht_shw_end_dt as "endTime",
                sht_base_prc as price,
                sht_avlbl_seat_cnt as "availableSeats"
            FROM shtm
            WHERE 1=1
        `;
        
        const params = [];
        if (movieId) {
            params.push(movieId);
            query += ` AND mv_id = $${params.length}`;
        }
        if (theaterId) {
            params.push(theaterId);
            query += ` AND tht_id = $${params.length}`;
        }
        
        query += ` ORDER BY sht_shw_strt_dt`;
        
        const result = await pool.query(query, params);
        console.log(`✅ 상영시간표 ${result.rows.length}개 조회 성공`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ 상영시간표 조회 실패:', error);
        res.status(500).json({ error: '상영시간표를 불러오는데 실패했습니다.' });
    }
});

// 좌석 정보 조회
app.get('/api/seats/:showtimeId', async (req, res) => {
    try {
        const { showtimeId } = req.params;
        
        const query = `
            SELECT 
                s.seat_id,
                s.seat_row_nm as "rowName",
                s.seat_no as "seatNumber",
                s.seat_typ as type,
                CASE 
                    WHEN r.resv_id IS NOT NULL AND r.resv_stat = '2' THEN '2'
                    ELSE s.seat_stat
                END as available,
                r.resv_id as "reservationId"
            FROM seat s
            LEFT JOIN resv r ON s.seat_id = r.seat_id 
                AND r.sht_id = $1
                AND r.resv_stat = '2'
            WHERE s.scr_id = (
                SELECT scr_id FROM shtm WHERE sht_id = $1
            )
            ORDER BY s.seat_row_nm, s.seat_no
        `;
        
        const result = await pool.query(query, [showtimeId]);
        console.log(`✅ 좌석 ${result.rows.length}개 조회 (예약 상태 반영)`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ 좌석 정보 조회 실패:', error);
        res.status(500).json({ error: '좌석 정보를 불러오는데 실패했습니다.' });
    }
});

// ========================================
// 인증 API
// ========================================

// 로그인
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 회원 정보 조회
        const userQuery = `
            SELECT 
                mbr_id as id,
                mbr_email as email,
                mbr_nm as name,
                mbr_pnt as points,
                mbr_mbrshp_lvl as membership,
                mbr_pwd as password
            FROM cust
            WHERE mbr_email = $1 AND mbr_stat = 'ACTIVE'
        `;
        
        const userResult = await pool.query(userQuery, [email]);
        
        // 회원 없음
        if (userResult.rows.length === 0) {
            // 실패 로그 저장
            await pool.query(
                `INSERT INTO login_log (login_email, login_dtm, login_success, fail_reason, user_agent)
                 VALUES ($1, NOW(), '0', '존재하지 않는 이메일', $2)`,
                [email, req.headers['user-agent']]
            );
            
            return res.status(401).json({ 
                success: false,
                message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }
        
        const user = userResult.rows[0];
        
        // 비밀번호 검증 (실제로는 bcrypt 사용해야 함)
        if (user.password !== password) {
            // 실패 로그 저장
            await pool.query(
                `INSERT INTO login_log (mbr_id, login_email, login_dtm, login_success, fail_reason, user_agent)
                 VALUES ($1, $2, NOW(), '0', '비밀번호 불일치', $3)`,
                [user.id, email, req.headers['user-agent']]
            );
            
            return res.status(401).json({ 
                success: false,
                message: '이메일 또는 비밀번호가 올바르지 않습니다.' 
            });
        }
        
        // 성공 로그 저장
        await pool.query(
            `INSERT INTO login_log (mbr_id, login_email, login_dtm, login_success, user_agent)
             VALUES ($1, $2, NOW(), '1', $3)`,
            [user.id, email, req.headers['user-agent']]
        );
        
        // 마지막 로그인 시간 업데이트
        await pool.query(
            `UPDATE cust SET mbr_last_login = NOW() WHERE mbr_id = $1`,
            [user.id]
        );
        
        console.log(`✅ 로그인 성공: ${email}`);
        
        // 비밀번호 제외하고 반환
        delete user.password;
        
        res.json({
            success: true,
            message: '로그인되었습니다.',
            user: user
        });
        
    } catch (error) {
        console.error('❌ 로그인 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '로그인 처리 중 오류가 발생했습니다.' 
        });
    }
});

// 로그인 이력 조회
app.get('/api/auth/login-logs/:mbrId', async (req, res) => {
    try {
        const { mbrId } = req.params;
        
        const query = `
            SELECT 
                login_log_id as id,
                login_email as email,
                login_dtm as loginTime,
                login_success as success,
                fail_reason as failReason,
                user_agent as userAgent
            FROM login_log
            WHERE mbr_id = $1
            ORDER BY login_dtm DESC
            LIMIT 50
        `;
        
        const result = await pool.query(query, [mbrId]);
        console.log(`✅ 로그인 이력 ${result.rows.length}개 조회 성공`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ 로그인 이력 조회 실패:', error);
        res.status(500).json({ error: '로그인 이력을 불러오는데 실패했습니다.' });
    }
});

// ========================================
// 문의 API
// ========================================

// 문의 등록
app.post('/api/inquiries', async (req, res) => {
    try {
        const { mbrId, category, title, content } = req.body;
        
        // 문의 번호 생성
        const inquiryNo = 'INQ' + Date.now();
        
        const query = `
            INSERT INTO inqr (
                mbr_id,
                inqr_typ_cd,
                inqr_ttl,
                inqr_cn,
                inqr_stat_cd,
                inqr_reg_dtm
            ) VALUES ($1, $2, $3, $4, '1', NOW())
            RETURNING inqr_id as id
        `;
        
        const result = await pool.query(query, [
            mbrId,
            category || '기타',
            title,
            content
        ]);
        
        console.log(`✅ 문의 등록 성공: ${result.rows[0].id}`);
        
        res.json({
            success: true,
            message: '문의가 등록되었습니다.',
            inquiryId: result.rows[0].id,
            inquiryNo: inquiryNo
        });
        
    } catch (error) {
        console.error('❌ 문의 등록 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '문의 등록 중 오류가 발생했습니다.' 
        });
    }
});

// 문의 조회
app.get('/api/inquiries/:mbrId', async (req, res) => {
    try {
        const { mbrId } = req.params;
        
        const query = `
            SELECT 
                inqr_id as id,
                inqr_typ_cd as category,
                inqr_ttl as title,
                inqr_cn as content,
                inqr_answ_cn as answer,
                inqr_stat_cd as status,
                inqr_reg_dtm as createdAt,
                inqr_answ_dtm as answeredAt
            FROM inqr
            WHERE mbr_id = $1
            ORDER BY inqr_reg_dtm DESC
        `;
        
        const result = await pool.query(query, [mbrId]);
        console.log(`✅ 문의 ${result.rows.length}개 조회 성공`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ 문의 조회 실패:', error);
        res.status(500).json({ error: '문의 내역을 불러오는데 실패했습니다.' });
    }
});

// ========================================
// 포인트 API
// ========================================

// 회원 포인트 조회
app.get('/api/members/:id/points', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                mbr_id as id,
                mbr_pnt as points,
                mbr_mbrshp_lvl as membership
            FROM cust
            WHERE mbr_id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: '회원을 찾을 수 없습니다.' 
            });
        }
        
        console.log(`✅ 회원 ${id} 포인트 조회: ${result.rows[0].points}P`);
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('❌ 포인트 조회 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '포인트를 불러오는데 실패했습니다.' 
        });
    }
});

// 포인트 사용
app.post('/api/points/use', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { mbrId, amount, orderId } = req.body;
        
        await client.query('BEGIN');
        
        // 현재 포인트 조회 (FOR UPDATE로 잠금)
        const pointQuery = `
            SELECT mbr_pnt as points
            FROM cust
            WHERE mbr_id = $1
            FOR UPDATE
        `;
        
        const pointResult = await client.query(pointQuery, [mbrId]);
        
        if (pointResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false,
                message: '회원을 찾을 수 없습니다.' 
            });
        }
        
        const currentPoints = pointResult.rows[0].points;
        
        // 포인트 부족 확인
        if (currentPoints < amount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false,
                message: '포인트가 부족합니다.',
                currentPoints: currentPoints,
                requestedAmount: amount
            });
        }
        
        // 포인트 차감
        const updateQuery = `
            UPDATE cust
            SET mbr_pnt = mbr_pnt - $1
            WHERE mbr_id = $2
            RETURNING mbr_pnt as points
        `;
        
        const updateResult = await client.query(updateQuery, [amount, mbrId]);
        
        await client.query('COMMIT');
        
        console.log(`✅ 포인트 사용: 회원 ${mbrId}, ${amount}P 차감, 잔액 ${updateResult.rows[0].points}P`);
        
        res.json({
            success: true,
            message: '포인트가 사용되었습니다.',
            usedPoints: amount,
            remainingPoints: updateResult.rows[0].points
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 포인트 사용 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '포인트 사용 중 오류가 발생했습니다.' 
        });
    } finally {
        client.release();
    }
});

// 포인트 적립
app.post('/api/points/earn', async (req, res) => {
    try {
        const { mbrId, amount, reason } = req.body;
        
        const query = `
            UPDATE cust
            SET mbr_pnt = mbr_pnt + $1
            WHERE mbr_id = $2
            RETURNING mbr_pnt as points
        `;
        
        const result = await pool.query(query, [amount, mbrId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: '회원을 찾을 수 없습니다.' 
            });
        }
        
        console.log(`✅ 포인트 적립: 회원 ${mbrId}, ${amount}P 적립, 잔액 ${result.rows[0].points}P`);
        
        res.json({
            success: true,
            message: '포인트가 적립되었습니다.',
            earnedPoints: amount,
            totalPoints: result.rows[0].points
        });
        
    } catch (error) {
        console.error('❌ 포인트 적립 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '포인트 적립 중 오류가 발생했습니다.' 
        });
    }
});

// ========================================
// 쿠폰 API
// ========================================

// 회원 쿠폰 조회 (사용 가능한 쿠폰만)
app.get('/api/members/:id/coupons', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                mc.mbr_cpn_id as id,
                mc.cpn_id as "couponId",
                c.cpn_cd as code,
                c.cpn_nm as name,
                c.cpn_dc_amt as discount,
                c.cpn_min_amt as "minAmount",
                c.cpn_end_dt as "expiryDate",
                c.cpn_use_cond as condition,
                mc.mbr_cpn_iss_dtm as "issuedAt"
            FROM mbr_cpn mc
            JOIN cpn c ON mc.cpn_id = c.cpn_id
            WHERE mc.mbr_id = $1
              AND mc.mbr_cpn_use_yn = '0'
              AND c.cpn_stat = '1'
              AND c.cpn_end_dt >= CURRENT_DATE
            ORDER BY c.cpn_dc_amt DESC
        `;
        
        const result = await pool.query(query, [id]);
        
        console.log(`✅ 회원 ${id} 사용 가능한 쿠폰 ${result.rows.length}개 조회`);
        res.json(result.rows);
        
    } catch (error) {
        console.error('❌ 쿠폰 조회 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '쿠폰을 불러오는데 실패했습니다.' 
        });
    }
});

// 쿠폰 사용
app.post('/api/coupons/use', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { mbrCpnId, reservationId } = req.body;
        
        await client.query('BEGIN');
        
        // 쿠폰 정보 조회 (FOR UPDATE로 잠금)
        const couponQuery = `
            SELECT 
                mc.mbr_cpn_id,
                mc.mbr_id,
                mc.mbr_cpn_use_yn,
                c.cpn_dc_amt as discount,
                c.cpn_min_amt as "minAmount",
                c.cpn_nm as name
            FROM mbr_cpn mc
            JOIN cpn c ON mc.cpn_id = c.cpn_id
            WHERE mc.mbr_cpn_id = $1
            FOR UPDATE
        `;
        
        const couponResult = await client.query(couponQuery, [mbrCpnId]);
        
        if (couponResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false,
                message: '쿠폰을 찾을 수 없습니다.' 
            });
        }
        
        const coupon = couponResult.rows[0];
        
        // 이미 사용된 쿠폰 확인
        if (coupon.mbr_cpn_use_yn === '1') {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false,
                message: '이미 사용된 쿠폰입니다.' 
            });
        }
        
        // 쿠폰 사용 처리
        const updateQuery = `
            UPDATE mbr_cpn
            SET mbr_cpn_use_yn = '1',
                mbr_cpn_use_dtm = NOW(),
                rsv_id = $1
            WHERE mbr_cpn_id = $2
            RETURNING mbr_cpn_use_dtm as "usedAt"
        `;
        
        const updateResult = await client.query(updateQuery, [reservationId, mbrCpnId]);
        
        await client.query('COMMIT');
        
        console.log(`✅ 쿠폰 사용: 회원 ${coupon.mbr_id}, ${coupon.name} (${coupon.discount}원 할인)`);
        
        res.json({
            success: true,
            message: '쿠폰이 사용되었습니다.',
            discount: coupon.discount,
            usedAt: updateResult.rows[0].usedAt
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 쿠폰 사용 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '쿠폰 사용 중 오류가 발생했습니다.' 
        });
    } finally {
        client.release();
    }
});

// 쿠폰 발급 (관리자용)
app.post('/api/coupons/issue', async (req, res) => {
    try {
        const { mbrId, couponCode } = req.body;
        
        // 쿠폰 조회
        const cpnQuery = `
            SELECT cpn_id, cpn_nm, cpn_dc_amt
            FROM cpn
            WHERE cpn_cd = $1 AND cpn_stat = '1'
        `;
        
        const cpnResult = await pool.query(cpnQuery, [couponCode]);
        
        if (cpnResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: '유효하지 않은 쿠폰 코드입니다.' 
            });
        }
        
        const cpn = cpnResult.rows[0];
        
        // 중복 발급 확인
        const dupQuery = `
            SELECT mbr_cpn_id
            FROM mbr_cpn
            WHERE mbr_id = $1 AND cpn_id = $2 AND mbr_cpn_use_yn = '0'
        `;
        
        const dupResult = await pool.query(dupQuery, [mbrId, cpn.cpn_id]);
        
        if (dupResult.rows.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: '이미 보유한 쿠폰입니다.' 
            });
        }
        
        // 쿠폰 발급
        const issueQuery = `
            INSERT INTO mbr_cpn (mbr_id, cpn_id, mbr_cpn_use_yn)
            VALUES ($1, $2, '0')
            RETURNING mbr_cpn_id as id, mbr_cpn_iss_dtm as "issuedAt"
        `;
        
        const issueResult = await pool.query(issueQuery, [mbrId, cpn.cpn_id]);
        
        console.log(`✅ 쿠폰 발급: 회원 ${mbrId}, ${cpn.cpn_nm}`);
        
        res.json({
            success: true,
            message: '쿠폰이 발급되었습니다.',
            coupon: {
                id: issueResult.rows[0].id,
                name: cpn.cpn_nm,
                discount: cpn.cpn_dc_amt,
                issuedAt: issueResult.rows[0].issuedAt
            }
        });
        
    } catch (error) {
        console.error('❌ 쿠폰 발급 실패:', error);
        res.status(500).json({ 
            success: false,
            message: '쿠폰 발급 중 오류가 발생했습니다.' 
        });
    }
});

// 영화평 조회
app.get('/api/reviews/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        
        const query = `
            SELECT 
                r.rvw_id as id,
                r.mbr_id as "memberId",
                r.rvw_scr as score,
                r.rvw_cont as content,
                r.rvw_crt_dtm as "createdAt",
                r.rvw_like_cnt as "likeCount",
                c.mbr_nm as "memberName"
            FROM rvw r
            LEFT JOIN cust c ON r.mbr_id = c.mbr_id
            WHERE r.mv_id = $1 AND r.rvw_stat = '1'
            ORDER BY r.rvw_crt_dtm DESC
            LIMIT 50
        `;
        
        const result = await pool.query(query, [movieId]);
        console.log(`✅ 영화평 ${result.rows.length}개 조회 성공`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ 영화평 조회 실패:', error);
        res.status(500).json({ error: '영화평을 불러오는데 실패했습니다.' });
    }
});

// 예매 생성
app.post('/api/reservations', async (req, res) => {
    try {
        const { memberId, showtimeId, seats, totalAmount, usedPoints } = req.body;
        
        // 예매 번호 생성
        const reservationNo = 'R' + Date.now();
        
        const query = `
            INSERT INTO rsv (mbr_id, sht_id, rsv_no, rsv_tot_seat_cnt, rsv_tot_amt, rsv_usd_pnt, rsv_stat, rsv_dtm)
            VALUES ($1, $2, $3, $4, $5, $6, '1', NOW())
            RETURNING rsv_id as id, rsv_no as "reservationNo"
        `;
        
        const values = [memberId, showtimeId, reservationNo, seats.length, totalAmount, usedPoints || 0];
        const result = await pool.query(query, values);
        
        console.log(`✅ 예매 생성 성공: ${reservationNo}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ 예매 생성 실패:', error);
        res.status(500).json({ error: '예매에 실패했습니다.' });
    }
});

// 예매 내역 조회
app.get('/api/reservations/:memberId', async (req, res) => {
    try {
        const { memberId } = req.params;
        
        const query = `
            SELECT 
                r.rsv_id as id,
                r.rsv_no as "reservationNo",
                r.rsv_tot_seat_cnt as "seatCount",
                r.rsv_tot_amt as "totalAmount",
                r.rsv_stat as status,
                r.rsv_dtm as "createdAt",
                m.mv_ttl as "movieTitle",
                t.tht_nm as "theaterName",
                s.sht_shw_strt_dt as "showtime"
            FROM rsrv r
            LEFT JOIN shtm s ON r.sht_id = s.sht_id
            LEFT JOIN mv m ON s.mv_id = m.mv_id
            LEFT JOIN thtr t ON s.tht_id = t.tht_id
            WHERE r.mbr_id = $1
            ORDER BY r.rsv_dtm DESC
            LIMIT 50
        `;
        
        const result = await pool.query(query, [memberId]);
        console.log(`✅ 예매 내역 ${result.rows.length}개 조회 성공`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ 예매 내역 조회 실패:', error);
        res.status(500).json({ error: '예매 내역을 불러오는데 실패했습니다.' });
    }
});

// 문의 등록
app.post('/api/inquiry', async (req, res) => {
    try {
        const { memberId, category, title, content } = req.body;
        
        const query = `
            INSERT INTO inqr (mbr_id, inq_ctgry, inq_ttl, inq_cont, inq_dtm, inq_stat)
            VALUES ($1, $2, $3, $4, NOW(), '1')
            RETURNING inq_id as id
        `;
        
        const values = [memberId, category, title, content];
        const result = await pool.query(query, values);
        
        console.log(`✅ 문의 등록 성공`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ 문의 등록 실패:', error);
        res.status(500).json({ error: '문의 등록에 실패했습니다.' });
    }
});

// 로그인
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const query = `
            SELECT 
                mbr_id as id,
                mbr_email as email,
                mbr_nm as name,
                mbr_pnt as points,
                mbr_mbrshp_lvl as membership
            FROM cust
            WHERE mbr_email = $1 AND mbr_pwd = $2 AND mbr_stat = '1'
        `;
        
        const result = await pool.query(query, [email, password]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        // 마지막 로그인 시간 업데이트
        await pool.query('UPDATE cust SET mbr_last_login = NOW() WHERE mbr_id = $1', [result.rows[0].id]);
        
        console.log(`✅ 로그인 성공: ${email}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ 로그인 실패:', error);
        res.status(500).json({ error: '로그인에 실패했습니다.' });
    }
});

// 회원가입
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;
        
        // 이메일 중복 확인
        const checkQuery = 'SELECT mbr_id FROM cust WHERE mbr_email = $1';
        const checkResult = await pool.query(checkQuery, [email]);
        
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ error: '이미 가입된 이메일입니다.' });
        }
        
        const query = `
            INSERT INTO cust (mbr_email, mbr_pwd, mbr_nm, mbr_phn_no, mbr_pnt, mbr_mbrshp_lvl, mbr_join_dtm, mbr_stat)
            VALUES ($1, $2, $3, $4, 0, 'BASIC', NOW(), '1')
            RETURNING mbr_id as id, mbr_email as email, mbr_nm as name
        `;
        
        const values = [email, password, name, phone];
        const result = await pool.query(query, values);
        
        console.log(`✅ 회원가입 성공: ${email}`);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ 회원가입 실패:', error);
        res.status(500).json({ error: '회원가입에 실패했습니다.' });
    }
});

// 극장 목록 조회
app.get('/api/theaters', async (req, res) => {
    try {
        const query = `
            SELECT 
                극장_ID as id,
                극장_이름 as name,
                극장_지역 as region,
                극장_주소 as address
            FROM 극장
            ORDER BY 극장_지역, 극장_이름
        `;
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('극장 목록 조회 실패:', error);
        res.status(500).json({ error: '극장 목록을 불러오는데 실패했습니다.' });
    }
});

// 상영시간표 조회
app.get('/api/showtimes', async (req, res) => {
    try {
        const { movieId, theaterId, date } = req.query;
        
        let query = `
            SELECT 
                st.상영시간표_ID as id,
                st.영화_ID as movie_id,
                m.영화_제목 as movie_title,
                st.극장_ID as theater_id,
                t.극장_이름 as theater_name,
                st.상영관_ID as screen_id,
                sc.상영관_이름 as screen_name,
                st.상영_날짜 as show_date,
                st.상영_시작_시간 as start_time,
                st.상영_종료_시간 as end_time,
                st.상영_잔여좌석수 as available_seats
            FROM 상영시간표 st
            JOIN 영화 m ON st.영화_ID = m.영화_ID
            JOIN 극장 t ON st.극장_ID = t.극장_ID
            JOIN 상영관 sc ON st.상영관_ID = sc.상영관_ID
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (movieId) {
            query += ` AND st.영화_ID = $${paramIndex++}`;
            params.push(movieId);
        }
        
        if (theaterId) {
            query += ` AND st.극장_ID = $${paramIndex++}`;
            params.push(theaterId);
        }
        
        if (date) {
            query += ` AND st.상영_날짜 = $${paramIndex++}`;
            params.push(date);
        } else {
            // 날짜 지정 안하면 오늘 이후만
            query += ` AND st.상영_날짜 >= CURRENT_DATE`;
        }
        
        query += ` ORDER BY st.상영_날짜, st.상영_시작_시간`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('상영시간표 조회 실패:', error);
        res.status(500).json({ error: '상영시간표를 불러오는데 실패했습니다.' });
    }
});

// 좌석 정보 조회
app.get('/api/seats/:showtimeId', async (req, res) => {
    try {
        const { showtimeId } = req.params;
        
        const query = `
            SELECT 
                s.좌석_ID as id,
                s.좌석_행 as row,
                s.좌석_열 as col,
                s.좌석_등급명 as grade,
                CASE 
                    WHEN r.예매_ID IS NOT NULL THEN false
                    ELSE true
                END as available
            FROM 좌석 s
            JOIN 상영시간표 st ON s.상영관_ID = st.상영관_ID
            LEFT JOIN 예매 r ON s.좌석_ID = r.좌석_ID 
                AND r.상영시간표_ID = st.상영시간표_ID
                AND r.예매_상태 IN ('예약완료', '결제완료')
            WHERE st.상영시간표_ID = $1
            ORDER BY s.좌석_행, s.좌석_열
        `;
        
        const result = await pool.query(query, [showtimeId]);
        res.json(result.rows);
    } catch (error) {
        console.error('좌석 정보 조회 실패:', error);
        res.status(500).json({ error: '좌석 정보를 불러오는데 실패했습니다.' });
    }
});

// 예매 생성 (동시성 제어 포함)
app.post('/api/reservations', async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { movieId, showtimeId, seats, totalAmount, paymentInfo } = req.body;
        
        // 트랜잭션 시작
        await client.query('BEGIN');
        
        // 좌석 잠금 및 예약 가능 여부 확인 (FOR UPDATE - 비관적 락)
        const seatCheckQuery = `
            SELECT s.좌석_ID, s.좌석_행, s.좌석_열
            FROM 좌석 s
            WHERE s.좌석_ID = ANY($1::int[])
            AND NOT EXISTS (
                SELECT 1 FROM 예매 r 
                WHERE r.좌석_ID = s.좌석_ID 
                AND r.상영시간표_ID = $2
                AND r.예매_상태 IN ('예약완료', '결제완료')
            )
            FOR UPDATE
        `;
        
        const seatIds = seats.map(s => s.id);
        const seatCheck = await client.query(seatCheckQuery, [seatIds, showtimeId]);
        
        if (seatCheck.rows.length !== seats.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: '이미 예약된 좌석이 포함되어 있습니다.',
                available: seatCheck.rows.length,
                requested: seats.length
            });
        }
        
        // 예매 생성
        const bookingNumber = 'BOOK-' + Date.now();
        const insertReservationQuery = `
            INSERT INTO 예매 (
                예매_번호,
                회원_ID,
                영화_ID,
                상영시간표_ID,
                예매_날짜,
                예매_상태,
                예매_총금액
            ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, '결제완료', $5)
            RETURNING 예매_ID
        `;
        
        const reservationResult = await client.query(insertReservationQuery, [
            bookingNumber,
            1, // 임시 회원 ID (실제로는 로그인한 사용자)
            movieId,
            showtimeId,
            totalAmount
        ]);
        
        const reservationId = reservationResult.rows[0].예매_id;
        
        // 좌석 예매 상세 생성
        for (const seat of seats) {
            await client.query(
                `INSERT INTO 예매상세 (예매_ID, 좌석_ID) VALUES ($1, $2)`,
                [reservationId, seat.id]
            );
        }
        
        // 결제 정보 저장
        await client.query(
            `INSERT INTO 결제 (
                예매_ID, 
                결제_금액, 
                결제_수단, 
                결제_상태,
                결제_일시
            ) VALUES ($1, $2, '신용카드', '결제완료', CURRENT_TIMESTAMP)`,
            [reservationId, totalAmount]
        );
        
        // 상영시간표 잔여 좌석 수 업데이트
        await client.query(
            `UPDATE 상영시간표 
             SET 상영_잔여좌석수 = 상영_잔여좌석수 - $1
             WHERE 상영시간표_ID = $2`,
            [seats.length, showtimeId]
        );
        
        // 트랜잭션 커밋
        await client.query('COMMIT');
        
        res.json({
            success: true,
            bookingNumber: bookingNumber,
            reservationId: reservationId,
            message: '예매가 완료되었습니다.'
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('예매 생성 실패:', error);
        res.status(500).json({ error: '예매 처리 중 오류가 발생했습니다.' });
    } finally {
        client.release();
    }
});

// 예매 조회
app.get('/api/reservations/:bookingNumber', async (req, res) => {
    try {
        const { bookingNumber } = req.params;
        
        const query = `
            SELECT 
                r.예매_ID as id,
                r.예매_번호 as booking_number,
                r.예매_날짜 as booking_date,
                r.예매_상태 as status,
                r.예매_총금액 as total_amount,
                m.영화_제목 as movie_title,
                st.상영_날짜 as show_date,
                st.상영_시작_시간 as start_time,
                t.극장_이름 as theater_name,
                sc.상영관_이름 as screen_name
            FROM 예매 r
            JOIN 영화 m ON r.영화_ID = m.영화_ID
            JOIN 상영시간표 st ON r.상영시간표_ID = st.상영시간표_ID
            JOIN 극장 t ON st.극장_ID = t.극장_ID
            JOIN 상영관 sc ON st.상영관_ID = sc.상영관_ID
            WHERE r.예매_번호 = $1
        `;
        
        const result = await pool.query(query, [bookingNumber]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: '예매 정보를 찾을 수 없습니다.' });
        }
        
        // 좌석 정보 조회
        const seatsQuery = `
            SELECT s.좌석_행 as row, s.좌석_열 as col
            FROM 예매상세 rd
            JOIN 좌석 s ON rd.좌석_ID = s.좌석_ID
            WHERE rd.예매_ID = $1
        `;
        
        const seatsResult = await pool.query(seatsQuery, [result.rows[0].id]);
        
        res.json({
            ...result.rows[0],
            seats: seatsResult.rows
        });
        
    } catch (error) {
        console.error('예매 조회 실패:', error);
        res.status(500).json({ error: '예매 정보를 불러오는데 실패했습니다.' });
    }
});

// ========================================
// 서버 시작
// ========================================
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║   영화 예매 시스템 API 서버 시작됨      ║
║   포트: ${PORT}                            ║
║   URL: http://localhost:${PORT}           ║
╚═══════════════════════════════════════════╝

📌 API 엔드포인트:
   GET  /api/health                    - 헬스 체크
   
   🔐 인증
   POST /api/auth/login                - 로그인
   GET  /api/auth/login-logs/:mbrId    - 로그인 이력 조회
   
   🎬 영화
   GET  /api/movies                    - 영화 목록
   GET  /api/theaters                  - 극장 목록
   GET  /api/showtimes                 - 상영시간표
   GET  /api/seats/:showtimeId         - 좌석 정보
   
   📝 예매
   POST /api/reservations              - 예매 생성
   GET  /api/reservations/:id          - 예매 조회
   
   💬 문의
   POST /api/inquiries                 - 문의 등록
   GET  /api/inquiries/:mbrId          - 문의 조회
    `);
});

// 에러 핸들링
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
