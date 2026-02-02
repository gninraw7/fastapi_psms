// ===================================
// 거래처 등록/수정 폼 관리
// 
// 수정 내역 (2026-02-01):
// - API 응답 형태 호환성 개선 (data.client || data)
// - navigateToClientList 함수 개선 (openClientsList 우선)
// - 삭제 버튼 ID 업데이트 (deleteClientBtn, deleteClientBtnBottom)
// - 에러 처리 강화
// ===================================

// 전역 변수
let currentClientId = null;
let currentMode = 'new'; // 'new' or 'edit'

/**
 * 페이지 로드 시 초기화
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏢 거래처 폼 스크립트 로드');
    
    // URL 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const modeParam = urlParams.get('mode');
    const clientIdParam = urlParams.get('client_id');
    
    // 거래처 폼 페이지인 경우에만 초기화
    if (pageParam === 'clients-form') {
        initializeClientFormPage(modeParam, clientIdParam);
    }
});

/**
 * 거래처 폼 페이지 초기화
 */
function initializeClientFormPage(mode, clientId) {
    console.log('🔧 거래처 폼 초기화:', mode, clientId);
    
    try {
        currentMode = mode || 'new';
        currentClientId = clientId ? parseInt(clientId) : null;

        const titleEl = document.getElementById('clientFormTitleText');
        if (titleEl) {
            titleEl.textContent = currentMode === 'edit' ? '거래처 수정' : '신규 거래처 등록';
        }

        const isActiveCheckbox = document.getElementById('isActive');
        if (isActiveCheckbox) {
            isActiveCheckbox.disabled = false;
            isActiveCheckbox.removeAttribute('disabled');
        }
        
        // DOM 요소 확인
        const deleteBtn = document.getElementById('btnDeleteClient');
        const deleteBtnBottom = document.getElementById('btnDeleteClientBottom');
        
        if (currentMode === 'edit' && currentClientId) {
            // 수정 모드
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
            if (deleteBtnBottom) deleteBtnBottom.style.display = 'inline-block';
            
            // 거래처 데이터 로드
            loadClientData(currentClientId);
        } else {
            // 신규 등록 모드
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (deleteBtnBottom) deleteBtnBottom.style.display = 'none';
            
            // 폼 초기화
            initializeNewClientForm();
        }
        
        // 자동 포맷팅 이벤트 바인딩
        setupAutoFormatting();

        // 목록/닫기 버튼 연결
        bindClientFormNavigationButtons();
        
        console.log('✅ 거래처 폼 초기화 완료');
        
    } catch (error) {
        console.error('❌ 거래처 폼 초기화 실패:', error);
    }
}

/**
 * 신규 거래처 폼 초기화
 */
function initializeNewClientForm() {
    console.log('📝 신규 거래처 폼 초기화');
    
    // 활성 상태 기본값
    const isActiveCheckbox = document.getElementById('isActive');
    if (isActiveCheckbox) {
        isActiveCheckbox.checked = true;
    }
}

/**
 * 거래처 데이터 로드 (수정 모드)
 */
async function loadClientData(clientId) {
    console.log('📥 거래처 데이터 로드:', clientId);
    
    try {
        showLoading();
        
        const response = await fetch(`/api/v1/clients/${clientId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`거래처 조회 실패: ${response.status}`);
        }
        
        const data = await response.json();
        
        // ⭐ 수정: API 응답 형태 호환성 개선
        // {client: {...}} 형태 또는 {...} 직접 반환 모두 지원
        const client = data.client || data;
        
        if (!client || !client.client_id) {
            throw new Error('거래처 데이터가 없습니다');
        }
        
        console.log('📦 거래처 데이터:', client);
        
        // 폼 필드 채우기
        const setFieldValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value || '';
            }
        };
        
        setFieldValue('clientName', client.client_name);
        setFieldValue('businessNumber', client.business_number);
        setFieldValue('ceoName', client.ceo_name);
        setFieldValue('industryType', client.industry_type);
        setFieldValue('establishedDate', client.established_date);
        setFieldValue('employeeCount', client.employee_count);
        setFieldValue('address', client.address);
        setFieldValue('phone', client.phone);
        setFieldValue('fax', client.fax);
        setFieldValue('email', client.email);
        setFieldValue('homepage', client.homepage);
        setFieldValue('remarks', client.remarks);
        
        // 체크박스
        const isActiveCheckbox = document.getElementById('isActive');
        if (isActiveCheckbox) {
            isActiveCheckbox.checked = client.is_active !== false;
        }
        
        hideLoading();
        
        console.log('✅ 거래처 데이터 로드 완료');
        
    } catch (error) {
        console.error('❌ 거래처 데이터 로드 실패:', error);
        hideLoading();
        alert('거래처 정보를 불러오는데 실패했습니다: ' + error.message);
    }
}

/**
 * 자동 포맷팅 설정
 */
function setupAutoFormatting() {
    // 사업자번호 자동 포맷팅 (000-00-00000)
    const businessNumberInput = document.getElementById('businessNumber');
    if (businessNumberInput) {
        businessNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length > 10) value = value.slice(0, 10);
            
            if (value.length > 5) {
                value = value.slice(0, 3) + '-' + value.slice(3, 5) + '-' + value.slice(5);
            } else if (value.length > 3) {
                value = value.slice(0, 3) + '-' + value.slice(3);
            }
            
            e.target.value = value;
        });
    }
    
    // 전화번호 자동 포맷팅
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneNumber);
    }
    
    const faxInput = document.getElementById('fax');
    if (faxInput) {
        faxInput.addEventListener('input', formatPhoneNumber);
    }
}

/**
 * 전화번호 포맷팅
 */
function formatPhoneNumber(e) {
    let value = e.target.value.replace(/[^0-9]/g, '');
    
    if (value.startsWith('02')) {
        // 서울 지역번호
        if (value.length > 10) value = value.slice(0, 10);
        if (value.length > 6) {
            value = value.slice(0, 2) + '-' + value.slice(2, 6) + '-' + value.slice(6);
        } else if (value.length > 2) {
            value = value.slice(0, 2) + '-' + value.slice(2);
        }
    } else if (value.startsWith('010') || value.startsWith('011') || value.startsWith('016') || value.startsWith('017') || value.startsWith('018') || value.startsWith('019')) {
        // 휴대폰
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 7) {
            value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7);
        } else if (value.length > 3) {
            value = value.slice(0, 3) + '-' + value.slice(3);
        }
    } else {
        // 기타 지역번호
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 7) {
            value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7);
        } else if (value.length > 3) {
            value = value.slice(0, 3) + '-' + value.slice(3);
        }
    }
    
    e.target.value = value;
}

/**
 * 폼 유효성 검사
 */
function validateClientForm() {
    const clientName = document.getElementById('clientName');
    const businessNumber = document.getElementById('businessNumber');
    const email = document.getElementById('email');
    
    if (!clientName) {
        alert('폼 요소를 찾을 수 없습니다.');
        return false;
    }
    
    const clientNameValue = clientName.value.trim();
    const businessNumberValue = businessNumber ? businessNumber.value.trim() : '';
    const emailValue = email ? email.value.trim() : '';
    
    // 필수 항목 검사
    if (!clientNameValue) {
        alert('거래처명을 입력하세요.');
        clientName.focus();
        return false;
    }
    
    // 사업자번호 검사 (입력된 경우만)
    if (businessNumberValue && businessNumberValue.replace(/[^0-9]/g, '').length !== 10) {
        alert('사업자번호는 10자리 숫자로 입력하세요.');
        if (businessNumber) businessNumber.focus();
        return false;
    }
    
    // 이메일 검사 (입력된 경우만)
    if (emailValue && !isValidEmail(emailValue)) {
        alert('올바른 이메일 형식이 아닙니다.');
        if (email) email.focus();
        return false;
    }
    
    return true;
}

/**
 * 이메일 유효성 검사
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * 거래처 저장
 */
async function saveClientForm() {
    console.log('💾 거래처 저장 시작');
    
    // 유효성 검사
    if (!validateClientForm()) {
        return;
    }
    
    try {
        showLoading();
        
        // 폼 데이터 수집 (안전하게)
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };
        
        const getNumberValue = (id) => {
            const element = document.getElementById(id);
            const value = element ? element.value.trim() : '';
            return value ? parseInt(value) : null;
        };
        
        const formData = {
            client_name: getValue('clientName'),
            business_number: getValue('businessNumber') || null,
            ceo_name: getValue('ceoName') || null,
            industry_type: getValue('industryType') || null,
            established_date: getValue('establishedDate') || null,
            employee_count: getNumberValue('employeeCount'),
            address: getValue('address') || null,
            phone: getValue('phone') || null,
            fax: getValue('fax') || null,
            email: getValue('email') || null,
            homepage: getValue('homepage') || null,
            is_active: document.getElementById('isActive') ? document.getElementById('isActive').checked : true,
            remarks: getValue('remarks') || null
        };
        
        let url, method;
        
        if (currentMode === 'edit' && currentClientId) {
            // 수정
            url = `/api/v1/clients/${currentClientId}`;
            method = 'PUT';
        } else {
            // 신규 등록
            url = '/api/v1/clients';
            method = 'POST';
        }
        
        console.log('📤 API 호출:', method, url);
        console.log('📦 데이터:', formData);
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '저장 실패');
        }
        
        const result = await response.json();
        
        hideLoading();
        
        alert(result.message || '저장되었습니다.');

        await refreshClientFormAfterSave(result);
        
    } catch (error) {
        console.error('❌ 거래처 저장 실패:', error);
        hideLoading();
        alert(error.message || '저장에 실패했습니다.');
    }
}

/**
 * 저장 직후 서버 데이터로 폼 갱신
 */
async function refreshClientFormAfterSave(result) {
    let targetClientId = null;

    if (currentMode === 'edit' && currentClientId) {
        targetClientId = currentClientId;
    } else {
        targetClientId = extractClientIdFromSaveResult(result);
    }

    if (!targetClientId) {
        console.warn('⚠️ 저장 결과에서 거래처 ID를 찾지 못해 폼 갱신을 건너뜁니다.');
        return;
    }

    if (currentMode !== 'edit') {
        currentMode = 'edit';
        currentClientId = targetClientId;

        const titleEl = document.getElementById('clientFormTitleText');
        if (titleEl) {
            titleEl.textContent = '거래처 수정';
        }

        const deleteBtn = document.getElementById('btnDeleteClient');
        const deleteBtnBottom = document.getElementById('btnDeleteClientBottom');
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (deleteBtnBottom) deleteBtnBottom.style.display = 'inline-block';

        const clientIdField = document.getElementById('clientId');
        if (clientIdField) clientIdField.value = String(targetClientId);
        const clientModeField = document.getElementById('clientMode');
        if (clientModeField) clientModeField.value = 'edit';

        // 새로고침 시에도 수정 모드 유지
        if (window.history && window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.set('page', 'clients-form');
            url.searchParams.set('mode', 'edit');
            url.searchParams.set('client_id', String(targetClientId));
            window.history.replaceState({}, '', url.toString());
        }
    }

    await loadClientData(targetClientId);
}

/**
 * 저장 결과에서 거래처 ID 추출
 */
function extractClientIdFromSaveResult(result) {
    if (!result || typeof result !== 'object') {
        return null;
    }

    const directId = result.client_id;
    if (Number.isInteger(directId)) {
        return directId;
    }
    if (typeof directId === 'string' && directId.trim() !== '') {
        const parsed = parseInt(directId, 10);
        if (Number.isInteger(parsed)) {
            return parsed;
        }
    }

    const data = result.data || result.client;
    if (data && typeof data === 'object') {
        const dataId = data.client_id || (data.client && data.client.client_id);
        if (Number.isInteger(dataId)) {
            return dataId;
        }
        if (typeof dataId === 'string' && dataId.trim() !== '') {
            const parsed = parseInt(dataId, 10);
            if (Number.isInteger(parsed)) {
                return parsed;
            }
        }
    }

    return null;
}

/**
 * 목록/닫기 버튼 이벤트 바인딩
 */
function bindClientFormNavigationButtons() {
    const listButtons = document.querySelectorAll('[data-client-nav="list"]');
    listButtons.forEach((button) => {
        if (button.dataset.navBound === 'true') {
            return;
        }
        button.addEventListener('click', (event) => {
            event.preventDefault();
            navigateToClientList();
        });
        button.dataset.navBound = 'true';
    });

    const closeButtons = document.querySelectorAll('[data-client-nav="close"]');
    closeButtons.forEach((button) => {
        if (button.dataset.navBound === 'true') {
            return;
        }
        button.addEventListener('click', (event) => {
            event.preventDefault();
            navigateToClientList();
        });
        button.dataset.navBound = 'true';
    });
}

/**
 * 거래처 삭제
 */
async function deleteClient() {
    if (!currentClientId) {
        alert('삭제할 거래처가 없습니다.');
        return;
    }
    
    if (!confirm('정말 삭제하시겠습니까?\n\n프로젝트에서 사용 중인 경우 비활성화 처리됩니다.')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch(`/api/v1/clients/${currentClientId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '삭제 실패');
        }
        
        const result = await response.json();
        
        hideLoading();
        
        alert(result.message || '삭제되었습니다.');
        
        // 목록으로 이동
        navigateToClientList();
        
    } catch (error) {
        console.error('❌ 거래처 삭제 실패:', error);
        hideLoading();
        alert(error.message || '삭제에 실패했습니다.');
    }
}

/**
 * 거래처 목록으로 이동
 */
function navigateToClientList() {
    console.log('📍 거래처 목록으로 이동');
    
    // ⭐ 우선순위 적용
    if (typeof openClientsList === 'function') {
        console.log('  → openClientsList 사용');
        openClientsList();
    } else if (typeof loadPage === 'function') {
        console.log('  → loadPage 사용');
        loadPage('clients-list');
    } else {
        console.log('  → URL 이동 (폴백)');
        window.location.href = '/app?page=clients-list';
    }
}

/**
 * 거래처 폼으로 이동
 */
function navigateToClientForm(mode, clientId) {
    console.log('📍 거래처 폼으로 이동:', mode, clientId);
    
    // ⭐ 우선순위 적용
    if (typeof openClientForm === 'function') {
        console.log('  → openClientForm 사용');
        openClientForm(mode, clientId);
    } else if (typeof loadPage === 'function') {
        console.log('  → loadPage 사용');
        let url = `/app?page=clients-form&mode=${mode}`;
        if (clientId) {
            url += `&client_id=${clientId}`;
        }
        loadPage('clients-form', { mode: mode, client_id: clientId });
    } else {
        console.log('  → URL 이동 (폴백)');
        let url = `/app?page=clients-form&mode=${mode}`;
        if (clientId) {
            url += `&client_id=${clientId}`;
        }
        window.location.href = url;
    }
}

/**
 * 로딩 표시
 */
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/**
 * 로딩 숨김
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// 전역 함수로 등록
window.saveClientForm = saveClientForm;
window.deleteClient = deleteClient;
window.navigateToClientList = navigateToClientList;
window.navigateToClientForm = navigateToClientForm;

console.log('📦 거래처 폼 모듈 로드 완료');
