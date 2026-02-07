/**
 * ===================================
 * 로그인 페이지 스크립트 (login.js)
 * 웹 버전 - 서버 주소 자동 감지
 * ===================================
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 로그인 페이지 초기화');

    // DOM 요소
    const loginForm = document.getElementById('loginForm');
    const companySelect = document.getElementById('companyCd');
    const loginIdInput = document.getElementById('loginId');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // 서버 주소는 login.html에서 이미 설정됨
    console.log('✅ 서버 주소:', AUTH.getServerUrl());
    initializeCompanySelect();

    /**
     * 비밀번호 표시/숨기기
     */
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        
        const icon = togglePasswordBtn.querySelector('i');
        if (type === 'password') {
            icon.className = 'fas fa-eye';
        } else {
            icon.className = 'fas fa-eye-slash';
        }
    });

    if (companySelect) {
        companySelect.addEventListener('change', () => {
            const selected = companySelect.value.trim();
            if (selected) {
                AUTH.setCompanyCd(selected);
            }
        });
    }

    /**
     * 로그인 폼 제출
     */
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedCompany = (companySelect && companySelect.value) ? companySelect.value.trim() : '';
        if (selectedCompany) {
            AUTH.setCompanyCd(selectedCompany);
        }

        const loginId = loginIdInput.value.trim();
        const password = passwordInput.value.trim();

        if (!loginId || !password) {
            showError('아이디와 비밀번호를 입력하세요.');
            return;
        }

        showLoading(true);
        hideError();
        loginBtn.disabled = true;

        const result = await AUTH.login(loginId, password);

        showLoading(false);

        if (result.success) {
            console.log('✅ 로그인 성공:', result.user);
            
            // 성공 메시지 없이 즉시 메인 페이지로 이동
            window.location.href = '/app';
        } else {
            console.log('❌ 로그인 실패:', result.message);
            showError(result.message || '로그인에 실패했습니다.');
            loginBtn.disabled = false;
            
            // 비밀번호 필드 초기화 및 포커스
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    async function initializeCompanySelect() {
        if (!companySelect) return;

        const fallbackCompany = (window.COMPANY_CONFIG && window.COMPANY_CONFIG.DEFAULT_COMPANY_CD) || 'TESTCOMP';
        const storedCompany = AUTH.getCompanyCd ? (AUTH.getCompanyCd() || fallbackCompany) : fallbackCompany;

        try {
            const serverUrl = AUTH.getServerUrl();
            const response = await fetch(`${serverUrl}/api/v1/auth/companies`, { method: 'GET' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const items = data.items || [];

            if (items.length === 0) {
                renderCompanyOptions([{ company_cd: fallbackCompany, company_name: fallbackCompany }], storedCompany);
                return;
            }

            renderCompanyOptions(items, storedCompany);
        } catch (error) {
            console.warn('⚠️ 회사 목록 조회 실패, 기본값 사용:', error);
            renderCompanyOptions([{ company_cd: fallbackCompany, company_name: fallbackCompany }], storedCompany);
        }
    }

    function renderCompanyOptions(items, selectedCd) {
        companySelect.innerHTML = '';
        items.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.company_cd;
            const name = item.company_name || item.company_cd;
            option.textContent = `${name} (${item.company_cd})`;
            companySelect.appendChild(option);
        });

        const exists = items.some(item => item.company_cd === selectedCd);
        companySelect.value = exists ? selectedCd : (items[0]?.company_cd || selectedCd || '');
        if (AUTH.setCompanyCd) {
            AUTH.setCompanyCd(companySelect.value);
        }
    }

    /**
     * 에러 메시지 표시
     */
    function showError(message) {
        errorMessage.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorMessage.style.display = 'block';
    }

    /**
     * 에러 메시지 숨기기
     */
    function hideError() {
        errorMessage.style.display = 'none';
    }

    /**
     * 로딩 스피너 표시/숨기기
     */
    function showLoading(show) {
        loadingSpinner.style.display = show ? 'flex' : 'none';
    }
});
