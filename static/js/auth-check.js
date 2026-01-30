/**
 * ===================================
 * 인증 확인 스크립트 (auth-check.js)
 * index.html의 body 시작 부분에서 로드되어야 함
 * ===================================
 */

(async function() {
    'use strict';
    
    console.log('🔐 인증 확인 시작');
    
    // 로그인 페이지인 경우 건너뛰기
    if (window.location.pathname.includes('login.html')) {
        console.log('📄 로그인 페이지 - 인증 확인 건너뛰기');
        return;
    }
    
    // AUTH 객체가 로드될 때까지 대기
    if (typeof AUTH === 'undefined') {
        console.error('❌ AUTH 모듈이 로드되지 않음');
        window.location.href = '/';
        return;
    }
    
    // 로그인 여부 확인
    if (!AUTH.isAuthenticated()) {
        console.log('❌ 인증되지 않음 - 로그인 페이지로 이동');
        window.location.href = '/';
        return;
    }
    
    // 자동 로그인 시도
    try {
        const success = await AUTH.tryAutoLogin();
        
        if (success) {
            console.log('✅ 인증 확인 성공');
            
            // 사용자 정보 표시
            const userInfo = AUTH.getUserInfo();
            console.log('📋 저장된 사용자 정보:', userInfo);
            
            if (userInfo) {
                // 사용자 이름 표시
                const currentUserElement = document.getElementById('currentUser');
                console.log('🎯 currentUser 요소:', currentUserElement);
                
                if (currentUserElement) {
                    // 다양한 필드명 지원 (API 응답 형식 변경에 대응)
                    const displayName = userInfo.user_name || 
                                       userInfo.userName || 
                                       userInfo.login_id || 
                                       userInfo.loginId || 
                                       '사용자';
                    
                    console.log('👤 표시할 사용자 이름:', displayName);
                    console.log('📝 현재 표시된 텍스트:', currentUserElement.textContent);
                    
                    currentUserElement.textContent = displayName;
                    
                    console.log('✅ 사용자 정보 업데이트 완료:', currentUserElement.textContent);
                } else {
                    console.warn('⚠️ currentUser 요소를 찾을 수 없습니다');
                    console.log('💡 HTML에 <span id="currentUser"></span> 요소가 있는지 확인하세요');
                }
            } else {
                console.warn('⚠️ 사용자 정보가 없습니다');
            }
        } else {
            console.log('❌ 자동 로그인 실패 - 로그인 페이지로 이동');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('❌ 인증 확인 중 오류:', error);
        window.location.href = '/';
    }
})();
