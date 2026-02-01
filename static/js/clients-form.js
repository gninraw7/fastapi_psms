// ===================================
// 거래처 등록/수정 폼 관리
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
        
        // DOM 요소 확인
        const formTitleElement = document.getElementById('clientFormTitleText');
        const deleteBtn = document.getElementById('btnDeleteClient');
        const deleteBtnBottom = document.getElementById('btnDeleteClientBottom');
        
        if (!formTitleElement) {
            console.warn('⚠️ 거래처 폼 페이지가 아직 로드되지 않음');
            return;
        }
        
        if (currentMode === 'edit' && currentClientId) {
            // 수정 모드
            formTitleElement.textContent = '거래처 수정';
            if (deleteBtn) deleteBtn.style.display = 'inline-block';
            if (deleteBtnBottom) deleteBtnBottom.style.display = 'inline-block';
            
            // 거래처 데이터 로드
            loadClientData(currentClientId);
        } else {
            // 신규 등록 모드
            formTitleElement.textContent = '신규 거래처 등록';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (deleteBtnBottom) deleteBtnBottom.style.display = 'none';
            
            // 폼 초기화
            initializeNewClientForm();
        }
        
        // 자동 포맷팅 이벤트 바인딩
        setupAutoFormatting();
        
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
    
    // 폼 리셋
    const form = document.getElementById('clientForm');
    if (form) {
        form.reset();
    }
    
    // 히든 필드 설정
    const clientIdInput = document.getElementById('clientId');
    const clientModeInput = document.getElementById('clientMode');
    
    if (clientIdInput) clientIdInput.value = '';
    if (clientModeInput) clientModeInput.value = 'new';
    
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
        const client = data.client;
        
        // 폼 필드 채우기
        document.getElementById('clientId').value = client.client_id || '';
        document.getElementById('clientMode').value = 'edit';
        document.getElementById('clientName').value = client.client_name || '';
        document.getElementById('businessNumber').value = client.business_number || '';
        document.getElementById('ceoName').value = client.ceo_name || '';
        document.getElementById('industryType').value = client.industry_type || '';
        document.getElementById('establishedDate').value = client.established_date || '';
        document.getElementById('employeeCount').value = client.employee_count || '';
        document.getElementById('address').value = client.address || '';
        document.getElementById('phone').value = client.phone || '';
        document.getElementById('fax').value = client.fax || '';
        document.getElementById('email').value = client.email || '';
        document.getElementById('homepage').value = client.homepage || '';
        document.getElementById('isActive').checked = client.is_active !== false;
        document.getElementById('remarks').value = client.remarks || '';
        
        hideLoading();
        
        console.log('✅ 거래처 데이터 로드 완료');
        
    } catch (error) {
        console.error('❌ 거래처 데이터 로드 실패:', error);
        hideLoading();
        alert('거래처 정보를 불러오는데 실패했습니다.');
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
        if (value.length > 9) value = value.slice(0, 10);
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
    const clientName = document.getElementById('clientName').value.trim();
    const businessNumber = document.getElementById('businessNumber').value.trim();
    const email = document.getElementById('email').value.trim();
    
    // 필수 항목 검사
    if (!clientName) {
        alert('거래처명을 입력하세요.');
        document.getElementById('clientName').focus();
        return false;
    }
    
    // 사업자번호 검사 (입력된 경우만)
    if (businessNumber && businessNumber.replace(/[^0-9]/g, '').length !== 10) {
        alert('사업자번호는 10자리 숫자로 입력하세요.');
        document.getElementById('businessNumber').focus();
        return false;
    }
    
    // 이메일 검사 (입력된 경우만)
    if (email && !isValidEmail(email)) {
        alert('올바른 이메일 형식이 아닙니다.');
        document.getElementById('email').focus();
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
        
        // 폼 데이터 수집
        const formData = {
            client_name: document.getElementById('clientName').value.trim(),
            business_number: document.getElementById('businessNumber').value.trim() || null,
            ceo_name: document.getElementById('ceoName').value.trim() || null,
            industry_type: document.getElementById('industryType').value || null,
            established_date: document.getElementById('establishedDate').value || null,
            employee_count: document.getElementById('employeeCount').value ? parseInt(document.getElementById('employeeCount').value) : null,
            address: document.getElementById('address').value.trim() || null,
            phone: document.getElementById('phone').value.trim() || null,
            fax: document.getElementById('fax').value.trim() || null,
            email: document.getElementById('email').value.trim() || null,
            homepage: document.getElementById('homepage').value.trim() || null,
            is_active: document.getElementById('isActive').checked,
            remarks: document.getElementById('remarks').value.trim() || null
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
        
        // 목록으로 이동
        navigateToClientList();
        
    } catch (error) {
        console.error('❌ 거래처 저장 실패:', error);
        hideLoading();
        alert(error.message || '저장에 실패했습니다.');
    }
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
    if (typeof openClientsList === 'function') {
        openClientsList();
    } else {
        // Fallback
        window.location.href = '/app?page=clients-list';
    }
}

/**
 * 거래처 폼으로 이동
 */
function navigateToClientForm(mode, clientId) {
    if (typeof openClientForm === 'function') {
        openClientForm(mode, clientId);
    } else {
        // Fallback
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
