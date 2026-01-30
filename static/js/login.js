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
    const loginIdInput = document.getElementById('loginId');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // 서버 주소는 login.html에서 이미 설정됨
    console.log('✅ 서버 주소:', AUTH.getServerUrl());

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

    /**
     * 로그인 폼 제출
     */
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

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
