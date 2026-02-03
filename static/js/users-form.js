// ===================================
// 사용자 등록/수정 폼 관리
// ===================================

let currentUserNo = null;
let currentUserMode = 'new';
let allowLoginIdChange = false;

function getUserFormElement(id) {
    const page = document.getElementById('page-users-form');
    if (page) {
        return page.querySelector(`#${id}`);
    }
    return document.getElementById(id);
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const modeParam = urlParams.get('mode');
    const userNoParam = urlParams.get('user_no');

    if (pageParam === 'users-form') {
        initializeUserFormPage(modeParam, userNoParam);
    }
});

async function initializeUserFormPage(mode, userNo) {
    if (!mode || !userNo) {
        const urlParams = new URLSearchParams(window.location.search);
        mode = mode || urlParams.get('mode');
        userNo = userNo || urlParams.get('user_no');
    }

    currentUserMode = mode || 'new';
    currentUserNo = userNo ? parseInt(userNo, 10) : null;
    allowLoginIdChange = false;

    const titleEl = getUserFormElement('userFormTitleText') || document.getElementById('userFormTitleText');
    if (titleEl) {
        titleEl.textContent = currentUserMode === 'edit' ? '사용자 수정' : '신규 사용자 등록';
    }
    const breadcrumbTitle = document.querySelector('.breadcrumb-title');
    if (breadcrumbTitle && breadcrumbTitle.textContent.includes('사용자')) {
        breadcrumbTitle.textContent = currentUserMode === 'edit' ? '사용자 수정' : '사용자 등록';
    }

    const deleteBtn = getUserFormElement('btnDeleteUser');
    const deleteBtnBottom = getUserFormElement('btnDeleteUserBottom');
    const loginIdInput = getUserFormElement('loginId');
    const enableLoginBtn = getUserFormElement('btnEnableLoginIdEdit');

    await loadRoleOptions();

    if (currentUserMode === 'edit' && currentUserNo) {
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (deleteBtnBottom) deleteBtnBottom.style.display = 'inline-block';
        if (loginIdInput) loginIdInput.disabled = true;
        if (enableLoginBtn) enableLoginBtn.style.display = 'inline-block';
        loadUserData(currentUserNo);
    } else {
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (deleteBtnBottom) deleteBtnBottom.style.display = 'none';
        if (loginIdInput) loginIdInput.disabled = false;
        if (enableLoginBtn) enableLoginBtn.style.display = 'none';
        initializeNewUserForm();
    }
}

function initializeNewUserForm() {
    const today = new Date().toISOString().slice(0, 10);
    setFieldValue('userNo', '');
    setFieldValue('userNoView', '');
    setFieldValue('loginId', '');
    setFieldValue('userName', '');
    setFieldValue('email', '');
    setFieldValue('phone', '');
    setFieldValue('headquarters', '');
    setFieldValue('department', '');
    setFieldValue('team', '');
    setFieldValue('startDate', today);
    setFieldValue('endDate', '9999-12-31');
    setFieldValue('status', 'ACTIVE');
    setFieldValue('createdAt', '');
    setFieldValue('updatedAt', '');
    setFieldValue('createdBy', '');
    setFieldValue('updatedBy', '');

    const salesCheckbox = getUserFormElement('isSalesRep');
    if (salesCheckbox) salesCheckbox.checked = false;
}

async function loadRoleOptions() {
    const roleSelect = getUserFormElement('role');
    if (!roleSelect) return;

    roleSelect.innerHTML = '<option value="">선택하세요</option>';

    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/ROLE`);
        const items = response.items || [];
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.code;
            opt.textContent = item.code_name;
            roleSelect.appendChild(opt);
        });
    } catch (error) {
        console.error('❌ ROLE 로드 실패:', error);
    }
}

async function loadUserData(userNo) {
    try {
        const baseEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS)
            ? API_CONFIG.ENDPOINTS.USERS
            : "/users";
        const user = await API.get(`${baseEndpoint}/${userNo}`);
        if (!user) throw new Error('사용자 데이터가 없습니다.');

        setFieldValue('userNo', user.user_no);
        setFieldValue('userNoView', user.user_no);
        setFieldValue('loginId', user.login_id);
        setFieldValue('userName', user.user_name);
        setFieldValue('role', user.role);
        setFieldValue('email', user.email);
        setFieldValue('phone', user.phone);
        setFieldValue('headquarters', user.headquarters);
        setFieldValue('department', user.department);
        setFieldValue('team', user.team);
        setFieldValue('startDate', user.start_date);
        setFieldValue('endDate', user.end_date);
        setFieldValue('status', user.status);
        setFieldValue('createdAt', formatDateTime(user.created_at));
        setFieldValue('updatedAt', formatDateTime(user.updated_at));
        setFieldValue('createdBy', user.created_by);
        setFieldValue('updatedBy', user.updated_by);

        const salesCheckbox = getUserFormElement('isSalesRep');
        if (salesCheckbox) salesCheckbox.checked = !!user.is_sales_rep;
    } catch (error) {
        console.error('❌ 사용자 데이터 로드 실패:', error);
        alert('사용자 정보를 불러오는데 실패했습니다: ' + error.message);
    }
}

function setFieldValue(id, value) {
    const el = getUserFormElement(id);
    if (el) {
        el.value = value !== null && value !== undefined ? value : '';
    }
}

function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ko-KR');
}

function getCurrentLoginId() {
    if (window.AUTH && typeof AUTH.getUserInfo === 'function') {
        const info = AUTH.getUserInfo();
        return info?.login_id || info?.loginId || null;
    }
    return null;
}

async function saveUserForm() {
    const loginId = getUserFormElement('loginId')?.value.trim();
    const userName = getUserFormElement('userName')?.value.trim();
    const role = getUserFormElement('role')?.value;

    if (!loginId || !userName || !role) {
        alert('필수 항목을 입력하세요.');
        return;
    }

    const payload = {
        login_id: loginId,
        user_name: userName,
        role: role,
        is_sales_rep: getUserFormElement('isSalesRep')?.checked || false,
        email: getUserFormElement('email')?.value.trim() || null,
        phone: getUserFormElement('phone')?.value.trim() || null,
        headquarters: getUserFormElement('headquarters')?.value.trim() || null,
        department: getUserFormElement('department')?.value.trim() || null,
        team: getUserFormElement('team')?.value.trim() || null,
        start_date: getUserFormElement('startDate')?.value || null,
        end_date: getUserFormElement('endDate')?.value || null,
        status: getUserFormElement('status')?.value || null
    };

    const actor = getCurrentLoginId();

    try {
        if (currentUserMode === 'edit' && currentUserNo) {
            payload.updated_by = actor;
            payload.allow_login_id_change = allowLoginIdChange;
            const baseEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS)
                ? API_CONFIG.ENDPOINTS.USERS
                : "/users";
            await API.put(`${baseEndpoint}/${currentUserNo}`, payload);
            alert('사용자 정보가 저장되었습니다.');
            // 수정 후에는 화면 유지 (요건)
            await loadUserData(currentUserNo);
            return;
        } else {
            payload.created_by = actor;
            const baseEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS)
                ? API_CONFIG.ENDPOINTS.USERS
                : "/users";
            const result = await API.post(`${baseEndpoint}`, payload);
            alert('사용자가 등록되었습니다.');
            // 등록 후에도 화면 유지
            if (result && result.user_no) {
                currentUserMode = 'edit';
                currentUserNo = result.user_no;
                const url = `${window.location.pathname}?page=users-form&mode=edit&user_no=${result.user_no}`;
                if (history.pushState) {
                    history.pushState({page: 'users-form', mode: 'edit', userNo: result.user_no}, '', url);
                }
                await loadUserData(result.user_no);
            }
            return;
        }
    } catch (error) {
        console.error('❌ 사용자 저장 실패:', error);
        alert('사용자 저장에 실패했습니다: ' + error.message);
    }
}

async function deleteUser() {
    if (!currentUserNo) return;
    if (!confirm('해당 사용자를 삭제하시겠습니까?')) return;

    try {
        const baseEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS)
            ? API_CONFIG.ENDPOINTS.USERS
            : "/users";
        await API.delete(`${baseEndpoint}/${currentUserNo}`);
        alert('사용자가 삭제되었습니다.');
        navigateToUserList();
    } catch (error) {
        console.error('❌ 사용자 삭제 실패:', error);
        alert('사용자 삭제에 실패했습니다: ' + error.message);
    }
}

async function enableLoginIdEdit() {
    if (!currentUserNo) return;

    try {
        const canChangeEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS_CAN_CHANGE_LOGIN_ID)
            ? API_CONFIG.ENDPOINTS.USERS_CAN_CHANGE_LOGIN_ID
            : "/users/can-change-login-id";
        const result = await API.get(`${canChangeEndpoint}?user_no=${currentUserNo}`);
        if (result.can_change) {
            const loginIdInput = getUserFormElement('loginId');
            if (loginIdInput) {
                loginIdInput.disabled = false;
                allowLoginIdChange = true;
                alert('login_id 수정이 허용되었습니다. 저장 시 반영됩니다.');
            }
        } else {
            alert('login_id가 다른 데이터에 사용 중이라 수정할 수 없습니다.');
        }
    } catch (error) {
        console.error('❌ login_id 수정 허용 실패:', error);
        alert('login_id 수정 가능 여부 확인에 실패했습니다: ' + error.message);
    }
}

function navigateToUserList() {
    const url = `${window.location.pathname}?page=users`;
    if (history.pushState) {
        history.pushState({page: 'users'}, '', url);
    }
    navigateTo('users');
    // 목록 자동 갱신
    setTimeout(() => {
        if (typeof refreshUsersList === 'function') {
            refreshUsersList();
        }
    }, 200);
}

window.initializeUserFormPage = initializeUserFormPage;
window.saveUserForm = saveUserForm;
window.deleteUser = deleteUser;
window.enableLoginIdEdit = enableLoginIdEdit;
window.navigateToUserList = navigateToUserList;

console.log('✅ users-form.js 로드 완료');
