// ========================================
// 쿠폰 기능 추가 코드
// ========================================
// 이 코드를 movie_booking_platform.html의 <script> 태그 안에 추가하세요

// 1. 전역 변수 추가 (let currentUser = null; 아래에 추가)
let availableCoupons = [];  // 사용 가능한 쿠폰 목록
let selectedCoupon = null;   // 선택된 쿠폰

// 2. 쿠폰 목록 로드 함수 추가
async function loadAvailableCoupons() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/members/${currentUser.id}/coupons`);
        if (response.ok) {
            availableCoupons = await response.json();
            console.log(`✅ 쿠폰 ${availableCoupons.length}개 로드`);
            
            // 결제 화면 쿠폰 select 업데이트
            updateCouponSelect();
        }
    } catch (error) {
        console.error('❌ 쿠폰 로드 실패:', error);
        availableCoupons = [];
    }
}

// 3. 쿠폰 select 옵션 업데이트
function updateCouponSelect() {
    const couponSelect = document.getElementById('couponSelect');
    if (!couponSelect) return;
    
    // 기존 옵션 제거
    couponSelect.innerHTML = '<option value="">쿠폰을 선택하세요</option>';
    
    // DB에서 가져온 쿠폰 옵션 추가
    availableCoupons.forEach(coupon => {
        const option = document.createElement('option');
        option.value = JSON.stringify(coupon);  // 쿠폰 정보 전체를 value에 저장
        option.textContent = `${coupon.name} (${coupon.discount.toLocaleString()}원 할인)`;
        
        // 최소 금액 조건 표시
        if (coupon.minAmount > 0) {
            option.textContent += ` - ${coupon.minAmount.toLocaleString()}원 이상`;
        }
        
        couponSelect.appendChild(option);
    });
    
    if (availableCoupons.length === 0) {
        couponSelect.innerHTML = '<option value="">사용 가능한 쿠폰이 없습니다</option>';
        couponSelect.disabled = true;
    } else {
        couponSelect.disabled = false;
    }
}

// 4. applyCoupon() 함수 수정 (기존 함수 전체 교체)
function applyCoupon() {
    const couponSelect = document.getElementById('couponSelect');
    const couponValue = couponSelect.value;

    if (!couponValue) {
        paymentData.couponDiscount = 0;
        selectedCoupon = null;
    } else {
        // JSON 파싱하여 쿠폰 정보 가져오기
        selectedCoupon = JSON.parse(couponValue);
        
        // 최소 금액 체크
        const baseAmount = paymentData.originalAmount - paymentData.pointDiscount;
        if (baseAmount < selectedCoupon.minAmount) {
            alert(`이 쿠폰은 ${selectedCoupon.minAmount.toLocaleString()}원 이상 결제 시 사용 가능합니다.`);
            couponSelect.value = '';
            selectedCoupon = null;
            paymentData.couponDiscount = 0;
        } else {
            paymentData.couponDiscount = selectedCoupon.discount;
        }
    }

    updatePaymentAmount();
}

// 5. showSection 수정 - 결제 화면 진입 시 쿠폰 로드
// showSection 함수 안에서 'payment' 섹션일 때 쿠폰 로드하도록 추가
/*
기존 showSection 함수에서 다음 부분을 추가:

function showSection(sectionId) {
    // ... 기존 코드 ...
    
    // 결제 화면 진입 시 쿠폰 로드
    if (sectionId === 'payment') {
        loadAvailableCoupons();
    }
    
    // ... 나머지 코드 ...
}
*/

// 6. processPayment 함수 수정 - 쿠폰 사용 API 호출 추가
// processPayment 함수의 포인트 적립 부분 다음에 추가:
/*
// 💰 쿠폰 사용 (DB API 호출)
if (selectedCoupon && paymentData.couponDiscount > 0) {
    try {
        const useCouponResponse = await fetch(`${API_BASE_URL}/coupons/use`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mbrCpnId: selectedCoupon.id,
                reservationId: apiReservationNo
            })
        });
        
        if (useCouponResponse.ok) {
            const useCouponResult = await useCouponResponse.json();
            console.log(`✅ 쿠폰 사용: ${selectedCoupon.name}, ${useCouponResult.discount}원 할인`);
            
            // 사용한 쿠폰은 목록에서 제거
            availableCoupons = availableCoupons.filter(c => c.id !== selectedCoupon.id);
        }
    } catch (error) {
        console.error('❌ 쿠폰 사용 API 실패:', error);
    }
}
*/

// 7. showMypageTab 함수에 쿠폰함 추가
/*
function showMypageTab(tabName) {
    // ... 기존 코드 ...
    
    if (tabName === 'coupons') {
        loadMypageCoupons();
    }
}
*/

// 8. 마이페이지 쿠폰함 로드 함수
async function loadMypageCoupons() {
    const couponsContent = document.getElementById('mypageCoupons');
    if (!couponsContent || !currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/members/${currentUser.id}/coupons`);
        
        if (response.ok) {
            const coupons = await response.json();
            
            if (coupons.length === 0) {
                couponsContent.innerHTML = `
                    <div style="padding: 60px 20px; text-align: center; color: #999;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🎫</div>
                        <div style="font-size: 16px;">보유하신 쿠폰이 없습니다</div>
                    </div>
                `;
                return;
            }
            
            let html = '<div style="display: grid; gap: 15px; padding: 20px 0;">';
            
            coupons.forEach(coupon => {
                const expiryDate = new Date(coupon.expiryDate);
                const today = new Date();
                const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                let statusColor = '#28a745';
                let statusText = '사용 가능';
                
                if (daysLeft <= 7) {
                    statusColor = '#ffc107';
                    statusText = `${daysLeft}일 남음`;
                }
                
                html += `
                    <div style="border: 2px dashed ${statusColor}; padding: 20px; border-radius: 8px; background: #f8f9fa;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div style="font-size: 20px; font-weight: bold; color: ${statusColor};">
                                ${coupon.discount.toLocaleString()}원 할인
                            </div>
                            <div style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                                ${statusText}
                            </div>
                        </div>
                        <div style="font-size: 16px; margin-bottom: 8px; font-weight: 500;">
                            ${coupon.name}
                        </div>
                        <div style="color: #666; font-size: 14px; margin-bottom: 4px;">
                            ${coupon.minAmount > 0 ? `${coupon.minAmount.toLocaleString()}원 이상 결제 시 사용` : '제한 없음'}
                        </div>
                        <div style="color: #999; font-size: 13px;">
                            ${expiryDate.toLocaleDateString()} 까지
                        </div>
                        ${coupon.condition ? `
                            <div style="margin-top: 8px; padding: 8px; background: white; border-radius: 4px; font-size: 12px; color: #666;">
                                💡 ${coupon.condition}
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
            couponsContent.innerHTML = html;
            
        } else {
            couponsContent.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">쿠폰 조회 실패</div>';
        }
    } catch (error) {
        console.error('❌ 쿠폰 조회 실패:', error);
        couponsContent.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">쿠폰 조회 중 오류가 발생했습니다</div>';
    }
}

// 9. 로그인 성공 시 쿠폰 로드 (login 함수에 추가)
/*
async function login() {
    // ... 기존 로그인 코드 ...
    
    if (data.success) {
        currentUser = data.user;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // 쿠폰 로드 추가
        await loadAvailableCoupons();
        
        updateLoginUI();
        closeModal('loginModal');
        alert('로그인되었습니다.');
    }
}
*/

// 10. 페이지 로드 시 세션 복원하면서 쿠폰도 로드 (checkLoginStatus 함수에 추가)
/*
function checkLoginStatus() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateLoginUI();
        
        // 쿠폰 로드 추가
        loadAvailableCoupons();
    }
}
*/

console.log('✅ 쿠폰 기능 코드 로드 완료!');
