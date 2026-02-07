/**
 * ===================================
 * 인증 확인 스크립트 (auth-check.js)
 * index.html의 body 시작 부분에서 로드되어야 함
 * ===================================
 */

(function() {
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
    
    async function applyUserUiState() {
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

                    // 관리자 메뉴 표시 여부 설정
                    const adminMenu = document.getElementById('adminMenu');
                    if (adminMenu) {
                        const role = (userInfo.role || '').toString().toLowerCase();
                        const isAdmin = role === 'admin';
                        adminMenu.style.display = isAdmin ? '' : 'none';
                    }

                    // 회사 전환 UI 초기화 (관리자만)
                    initializeCompanySwitcher(userInfo);
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyUserUiState);
    } else {
        applyUserUiState();
    }

    async function initializeCompanySwitcher(userInfo) {
        const container = document.getElementById('companySwitch');
        const select = document.getElementById('currentCompanySelect');
        const switchBtn = document.getElementById('btnSwitchCompany');

        if (!container || !select || !switchBtn) return;

        const role = (userInfo?.role || '').toString().toLowerCase();
        if (role !== 'admin') {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        const currentCompany = userInfo.company_cd || AUTH.getCompanyCd() || (window.COMPANY_CONFIG?.DEFAULT_COMPANY_CD) || '';
        try {
            const serverUrl = AUTH.getServerUrl();
            const response = await fetch(`${serverUrl}/api/v1/auth/companies`, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const items = data.items || [];

            if (items.length === 0) {
                renderCompanyOptions([{ company_cd: currentCompany, company_name: currentCompany }], currentCompany);
            } else {
                renderCompanyOptions(items, currentCompany);
            }
        } catch (error) {
            console.warn('⚠️ 회사 목록 조회 실패:', error);
            renderCompanyOptions([{ company_cd: currentCompany, company_name: currentCompany }], currentCompany);
        }

        switchBtn.addEventListener('click', async () => {
            const target = (select.value || '').trim();
            if (!target || target === currentCompany) {
                return;
            }

            if (!confirm(`회사 전환: ${currentCompany} → ${target}\n전환 후 화면이 새로고침됩니다.`)) {
                select.value = currentCompany;
                return;
            }

            try {
                await AUTH.switchCompany(target);
                window.location.reload();
            } catch (error) {
                console.error('❌ 회사 전환 실패:', error);
                alert(error?.message || '회사 전환 실패');
                select.value = currentCompany;
            }
        });
    }

    function renderCompanyOptions(items, selectedCd) {
        const select = document.getElementById('currentCompanySelect');
        if (!select) return;
        select.innerHTML = '';
        items.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.company_cd;
            const name = item.company_name || item.company_cd;
            option.textContent = `${name} (${item.company_cd})`;
            select.appendChild(option);
        });

        const exists = items.some(item => item.company_cd === selectedCd);
        select.value = exists ? selectedCd : (items[0]?.company_cd || selectedCd || '');
    }
})();
