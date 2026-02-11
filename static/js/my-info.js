// ===================================
// 내정보 화면 관리
// ===================================

let myInfoInitialized = false;
let myRoleMap = {};

function initializeMyInfoPage() {
    console.log('👤 내정보 페이지 초기화');

    if (!myInfoInitialized) {
        bindMyInfoEvents();
        myInfoInitialized = true;
    }

    loadMyInfo();
    if (window.__focusPasswordChange) {
        setTimeout(() => {
            focusPasswordChangeSection();
            window.__focusPasswordChange = false;
        }, 200);
    }
}

function bindMyInfoEvents() {
    const newPasswordInput = document.getElementById('myNewPassword');
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', () => {
            updatePasswordRuleStatus();
        });
    }
}

async function loadMyInfo() {
    try {
        const [userInfo, roleCodes] = await Promise.all([
            AUTH.getMe(),
            fetchRoleCodes()
        ]);

        myRoleMap = roleCodes;
        applyMyInfo(userInfo);
    } catch (error) {
        console.error('❌ 내정보 로드 실패:', error);
        alert('내정보를 불러오지 못했습니다: ' + (error.message || error));
    }
}

async function fetchRoleCodes() {
    try {
        const response = await AUTH.apiRequest('/api/v1/common/codes/ROLE', {
            method: 'GET'
        });
        const items = response.items || [];
        const map = {};
        items.forEach((item) => {
            map[item.code] = item.code_name;
        });
        return map;
    } catch (error) {
        console.warn('⚠️ 권한 코드 조회 실패:', error);
        return {};
    }
}

function applyMyInfo(userInfo) {
    if (!userInfo) return;

    setValue('myLoginId', userInfo.login_id);
    setValue('myUserName', userInfo.user_name);

    const roleLabel = myRoleMap[userInfo.role] ? `${userInfo.role} (${myRoleMap[userInfo.role]})` : userInfo.role;
    setValue('myRole', roleLabel);
    setValue('myStatus', userInfo.status);

    const salesRepCheckbox = document.getElementById('mySalesRep');
    if (salesRepCheckbox) {
        salesRepCheckbox.checked = !!userInfo.is_sales_rep;
    }

    setValue('myEmail', userInfo.email || '');
    setValue('myPhone', userInfo.phone || '');
    setValue('myOrgName', userInfo.org_name || '');
    setValue('myStartDate', userInfo.start_date || '');
    setValue('myEndDate', userInfo.end_date || '');
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.value = value != null ? value : '';
    }
}

function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

async function saveMyInfo() {
    const payload = {
        user_name: getValue('myUserName'),
        email: getValue('myEmail') || null,
        phone: getValue('myPhone') || null,
        is_sales_rep: !!(document.getElementById('mySalesRep') && document.getElementById('mySalesRep').checked)
    };

    if (!payload.user_name) {
        alert('사용자명을 입력하세요.');
        return;
    }

    try {
        const response = await AUTH.apiRequest('/api/v1/auth/me', {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        const updatedUser = response.user || response;
        AUTH.setUserInfo(updatedUser);
        updateNavbarUserName(updatedUser);

        alert(response.message || '내정보가 저장되었습니다.');
        applyMyInfo(updatedUser);
    } catch (error) {
        console.error('❌ 내정보 저장 실패:', error);
        alert(error.message || '내정보 저장에 실패했습니다.');
    }
}

function updateNavbarUserName(userInfo) {
    const name = userInfo.user_name || userInfo.login_id;
    const currentUserEl = document.getElementById('currentUser');
    if (currentUserEl && name) {
        currentUserEl.textContent = name;
    }
}

function updatePasswordRuleStatus() {
    const statusEl = document.getElementById('myPasswordRuleStatus');
    const newPassword = getValue('myNewPassword');
    if (!statusEl) return;

    if (!newPassword) {
        statusEl.textContent = '비밀번호 규칙을 확인해주세요.';
        statusEl.classList.remove('is-valid', 'is-invalid');
        return;
    }

    const isValid = isStrongPassword(newPassword);
    statusEl.textContent = isValid
        ? '사용 가능한 비밀번호입니다.'
        : '영문, 숫자, 특수문자를 모두 포함한 8자 이상으로 입력하세요.';
    statusEl.classList.toggle('is-valid', isValid);
    statusEl.classList.toggle('is-invalid', !isValid);
}

function isStrongPassword(password) {
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return password.length >= 8 && hasLetter && hasNumber && hasSpecial;
}

async function changeMyPassword() {
    const oldPassword = getValue('myOldPassword');
    const newPassword = getValue('myNewPassword');
    const confirmPassword = getValue('myNewPasswordConfirm');

    if (!oldPassword || !newPassword || !confirmPassword) {
        alert('비밀번호 입력을 모두 채워주세요.');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('새 비밀번호 확인이 일치하지 않습니다.');
        return;
    }

    if (!isStrongPassword(newPassword)) {
        alert('비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
        return;
    }

    try {
        const response = await AUTH.apiRequest('/api/v1/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword
            })
        });

        alert(response.message || '비밀번호가 변경되었습니다.');
        clearPasswordForm();
        try {
            const refreshedUser = await AUTH.getMe();
            AUTH.setUserInfo(refreshedUser);
            updateNavbarUserName(refreshedUser);
            window.__forcePasswordChange = !!refreshedUser.must_change_password;
        } catch (e) {
            console.warn('⚠️ 사용자 정보 갱신 실패:', e);
            AUTH.setMustChangePassword(false);
            window.__forcePasswordChange = false;
        }
        if (typeof window.__hideInitialPasswordModal === 'function') {
            window.__hideInitialPasswordModal();
        }
    } catch (error) {
        console.error('❌ 비밀번호 변경 실패:', error);
        alert(error.message || '비밀번호 변경에 실패했습니다.');
    }
}

function clearPasswordForm() {
    setValue('myOldPassword', '');
    setValue('myNewPassword', '');
    setValue('myNewPasswordConfirm', '');
    updatePasswordRuleStatus();
}

function closeMyInfo() {
    if (window.__forcePasswordChange) {
        const modal = document.getElementById('initialPasswordModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
        return;
    }
    const fallbackPage = 'projects-list';
    const targetPage = window.myInfoReturnPage || fallbackPage;
    if (typeof pageExists === 'function' && !pageExists(targetPage)) {
        navigateTo(fallbackPage);
        return;
    }
    navigateTo(targetPage);
}

function focusPasswordChangeSection() {
    const section = document.getElementById('myPasswordSection');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

window.initializeMyInfoPage = initializeMyInfoPage;
window.saveMyInfo = saveMyInfo;
window.changeMyPassword = changeMyPassword;
window.closeMyInfo = closeMyInfo;
window.focusPasswordChangeSection = focusPasswordChangeSection;
