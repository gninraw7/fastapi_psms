// mobile.js
// ===================================
// Mobile Pages JavaScript - v3.0
// 참조 관계 반영: clients, users, comm_code
// ===================================

let mobileProjects = [];
let currentMobilePipelineId = null;
let mobileStageConfig = {};
let mobileFieldConfig = {};
let mobileUsers = [];
let mobileClients = [];
let mobileServiceCodes = [];
let mobileOrgUnits = [];
let mobileManagerOptions = [];
let currentClientSearchType = null; // 'customer' or 'ordering'

/**
 * 모바일 프로젝트 목록 초기화
 */
async function initializeMobileProjects() {
    console.log('📱 ========================================');
    console.log('📱 모바일 프로젝트 목록 초기화 시작');
    console.log('📱 ========================================');
    
    try {
        // 1. 공통코드 로드 (STAGE, FIELD)
        console.log('📱 Step 1: 공통코드 로드');
        await loadMobileCommonCodes();
        
        // 2. 콤보박스 설정
        console.log('📱 Step 2: 콤보박스 설정');
        await loadMobileComboBoxes();
        
        // 3. 연도 필터 설정
        console.log('📱 Step 3: 연도 필터 설정');
        loadMobileYearFilter();
        
        // 4. 검색 이벤트 설정
        console.log('📱 Step 4: 검색 이벤트 설정');
        setupMobileSearchEvents();
        
        // 5. 프로젝트 목록 로드
        console.log('📱 Step 5: 프로젝트 목록 로드');
        await loadMobileProjects();
        
        console.log('✅ 모바일 초기화 완료');
        
    } catch (error) {
        console.error('❌ 모바일 초기화 실패:', error);
        showMobileError('초기화 중 오류가 발생했습니다: ' + error.message);
    }
}

/**
 * 공통코드 로드 (STAGE, FIELD)
 */
async function loadMobileCommonCodes() {
    try {
        // STAGE 로드
        console.log('📡 STAGE 공통코드 로드...');
        const stageResponse = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/STAGE`);
        
        if (stageResponse && stageResponse.items && Array.isArray(stageResponse.items)) {
            mobileStageConfig = {};
            stageResponse.items.forEach((stage, index) => {
                mobileStageConfig[stage.code] = {
                    label: stage.code_name,
                    class: `badge-stage-${(index % 9) + 1}`
                };
            });
            console.log('✅ STAGE 로드 완료:', Object.keys(mobileStageConfig).length, '개');
        } else {
            setDefaultStageConfig();
        }
        
        // FIELD 로드
        console.log('📡 FIELD 공통코드 로드...');
        const fieldResponse = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/FIELD`);
        
        if (fieldResponse && fieldResponse.items && Array.isArray(fieldResponse.items)) {
            mobileFieldConfig = {};
            fieldResponse.items.forEach(field => {
                mobileFieldConfig[field.code] = field.code_name;
            });
            console.log('✅ FIELD 로드 완료:', Object.keys(mobileFieldConfig).length, '개');
        } else {
            console.warn('⚠️ FIELD 로드 실패, 기본값 사용');
            mobileFieldConfig = {
                'F01': 'SI',
                'F02': 'SM',
                'F03': 'Cloud'
            };
        }
        
    } catch (error) {
        console.error('❌ 공통코드 로드 실패:', error);
        setDefaultStageConfig();
        mobileFieldConfig = {
            'F01': 'SI',
            'F02': 'SM',
            'F03': 'Cloud'
        };
    }
}

/**
 * 기본 STAGE 설정
 */
function setDefaultStageConfig() {
    mobileStageConfig = {
        'S01': { label: '1 영업중', class: 'badge-stage-1' },
        'S02': { label: '2 견적제출', class: 'badge-stage-2' },
        'S03': { label: '3 제안중', class: 'badge-stage-3' },
        'S04': { label: '4 입찰중', class: 'badge-stage-4' },
        'S05': { label: '5 DROP', class: 'badge-stage-5' },
        'S06': { label: '6 실주', class: 'badge-stage-6' },
        'S07': { label: '7 수주완료', class: 'badge-stage-7' },
        'S08': { label: '8 계약완료', class: 'badge-stage-8' },
        'S09': { label: '9 유지보수', class: 'badge-stage-9' }
    };
}

/**
 * 콤보박스 설정
 */
async function loadMobileComboBoxes() {
    try {
        // 1. STAGE 콤보박스
        const stageFilterSelect = document.getElementById('mobileStageFilter');
        const stageFormSelect = document.getElementById('mobileCurrentStage');
        const stageHistorySelect = document.getElementById('mobileHistoryStage');
        
        if (stageFilterSelect) {
            stageFilterSelect.innerHTML = '<option value="">전체 진행단계</option>';
            Object.keys(mobileStageConfig).forEach(code => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = mobileStageConfig[code].label;
                stageFilterSelect.appendChild(option);
            });
        }
        
        if (stageFormSelect) {
            stageFormSelect.innerHTML = '<option value="">선택하세요</option>';
            Object.keys(mobileStageConfig).forEach(code => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = mobileStageConfig[code].label;
                stageFormSelect.appendChild(option);
            });
        }
        
        if (stageHistorySelect) {
            stageHistorySelect.innerHTML = '<option value="">선택하세요</option>';
            Object.keys(mobileStageConfig).forEach(code => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = mobileStageConfig[code].label;
                stageHistorySelect.appendChild(option);
            });
        }
        
        // 2. FIELD 콤보박스
        const fieldFormSelect = document.getElementById('mobileFieldCode');
        if (fieldFormSelect) {
            fieldFormSelect.innerHTML = '<option value="">선택하세요</option>';
            Object.keys(mobileFieldConfig).forEach(code => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = mobileFieldConfig[code];
                fieldFormSelect.appendChild(option);
            });
        }

        // 3. 서비스코드 콤보박스
        const serviceSelect = document.getElementById('mobileServiceCode');
        if (serviceSelect) {
            serviceSelect.innerHTML = '<option value="">선택하세요</option>';
            try {
                const response = await API.get(`${API_CONFIG.ENDPOINTS.SERVICE_CODES}/list?is_use=Y`);
                mobileServiceCodes = response?.items || [];
                mobileServiceCodes.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.service_code;
                    option.textContent = item.display_name || item.service_name || item.service_code;
                    serviceSelect.appendChild(option);
                });
            } catch (e) {
                console.warn('⚠️ 서비스코드 로드 실패:', e);
            }
        }

        // 4. 담당조직 콤보박스
        const orgSelect = document.getElementById('mobileOrgId');
        if (orgSelect) {
            orgSelect.innerHTML = '<option value="">선택하세요</option>';
            try {
                const response = await API.get(`${API_CONFIG.ENDPOINTS.ORG_UNITS}?is_use=Y`);
                mobileOrgUnits = response?.items || [];
                mobileOrgUnits.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.org_id;
                    option.textContent = item.org_name || item.org_id;
                    orgSelect.appendChild(option);
                });
            } catch (e) {
                console.warn('⚠️ 조직 로드 실패:', e);
            }
        }
        
        // 5. 담당자 콤보박스 로드
        await loadMobileManagers();
        
        console.log('✅ 콤보박스 설정 완료');
        
    } catch (error) {
        console.error('❌ 콤보박스 설정 실패:', error);
    }
}

/**
 * 담당자 목록 로드
 */
async function loadMobileManagers() {
    try {
        console.log('📡 담당자 목록 로드...');
        const response = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
        
        if (response && response.managers && Array.isArray(response.managers)) {
            mobileUsers = response.managers;
            mobileManagerOptions = response.managers;
            
            const managerSelect = document.getElementById('mobileManagerId');
            if (managerSelect) {
                managerSelect.innerHTML = '<option value="">선택하세요</option>';
                response.managers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.login_id;
                    option.textContent = user.user_name || user.login_id;
                    if (user.org_id !== undefined && user.org_id !== null) {
                        option.setAttribute('data-org-id', String(user.org_id));
                    }
                    managerSelect.appendChild(option);
                });
            }

            if (managerSelect && managerSelect.dataset.bound !== '1') {
                managerSelect.addEventListener('change', () => {
                    const val = managerSelect.value;
                    if (val) syncMobileOrgWithManager(val, null, false);
                });
                managerSelect.dataset.bound = '1';
            }
            
            console.log('✅ 담당자 로드 완료:', mobileUsers.length, '명');
        }
    } catch (error) {
        console.error('❌ 담당자 로드 실패:', error);
    }
}

/**
 * 연도 필터 설정
 */
function loadMobileYearFilter() {
    try {
        const yearSelect = document.getElementById('mobileYearFilter');
        if (!yearSelect) return;
        
        yearSelect.innerHTML = '<option value="">전체 연도</option>';
        const currentYear = new Date().getFullYear();
        
        for (let year = currentYear + 1; year >= 2020; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `${year}년`;
            yearSelect.appendChild(option);
        }
        
        console.log('✅ 연도 필터 설정 완료');
    } catch (error) {
        console.error('❌ 연도 필터 설정 실패:', error);
    }
}

// ===================================
// Current User Helpers (Mobile)
// ===================================
function getCurrentUserInfoMobile() {
    if (window.AUTH && typeof AUTH.getUserInfo === 'function') {
        return AUTH.getUserInfo();
    }
    if (window.currentUser) return window.currentUser;
    return null;
}

function syncMobileOrgWithManager(managerId, fallbackOrgId = null, overwrite = true) {
    const orgSelect = document.getElementById('mobileOrgId');
    if (!orgSelect) return;

    if (!overwrite && orgSelect.value) return;

    let orgId = null;
    const manager = mobileManagerOptions.find(m => (m.manager_id || m.login_id) === managerId);
    if (manager && manager.org_id) {
        orgId = manager.org_id;
    } else if (fallbackOrgId) {
        orgId = fallbackOrgId;
    }

    if (orgId !== null && orgId !== undefined && orgId !== '') {
        orgSelect.value = String(orgId);
    }
}

function setDefaultMobileManagerForNew() {
    const user = getCurrentUserInfoMobile();
    const managerSelect = document.getElementById('mobileManagerId');
    if (!user || !managerSelect) return;

    const loginId = user.login_id || user.loginId;
    if (!loginId) return;

    let option = Array.from(managerSelect.options).find(o => o.value === loginId);
    if (!option) {
        option = document.createElement('option');
        option.value = loginId;
        option.textContent = user.user_name || user.userName || loginId;
        if (user.org_id) option.setAttribute('data-org-id', String(user.org_id));
        managerSelect.appendChild(option);
    }

    managerSelect.value = loginId;
    syncMobileOrgWithManager(loginId, user.org_id, true);
}

/**
 * 프로젝트 목록 로드
 */
async function loadMobileProjects() {
    console.log('📡 프로젝트 목록 로드 시작');
    
    const listContainer = document.getElementById('mobileProjectList');
    if (!listContainer) {
        console.error('❌ 목록 컨테이너를 찾을 수 없음');
        return;
    }
    
    listContainer.innerHTML = '<div class="mobile-loading"><i class="fas fa-spinner fa-spin"></i><p>로딩중...</p></div>';
    
    try {
        const response = await API.get(API_CONFIG.ENDPOINTS.PROJECTS_LIST);
        console.log('📥 API 응답:', response);
        
        let projects = null;
        if (response.items && Array.isArray(response.items)) {
            projects = response.items;
        } else if (response.projects && Array.isArray(response.projects)) {
            projects = response.projects;
        } else if (Array.isArray(response)) {
            projects = response;
        }
        
        if (!projects || projects.length === 0) {
            showMobileEmpty();
            updateMobileStats([]);
            return;
        }
        
        console.log('✅ 프로젝트 로드 성공:', projects.length, '개');
        
        mobileProjects = projects;
        renderMobileProjects(projects);
        updateMobileStats(projects);
        
    } catch (error) {
        console.error('❌ 프로젝트 로드 실패:', error);
        listContainer.innerHTML = `
            <div class="mobile-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <p>데이터를 불러올 수 없습니다.</p>
            </div>
        `;
    }
}

/**
 * 프로젝트 목록 렌더링
 */
function renderMobileProjects(projects) {
    console.log('🎨 프로젝트 렌더링:', projects ? projects.length : 0, '개');
    
    const listContainer = document.getElementById('mobileProjectList');
    if (!listContainer) {
        console.error('❌ 목록 컨테이너를 찾을 수 없음');
        return;
    }
    
    if (!projects || projects.length === 0) {
        showMobileEmpty();
        return;
    }
    
    const html = projects.map(project => {
        const pipelineId = project.pipeline_id || '-';
        const projectName = project.project_name || '(이름없음)';
        
        // ⭐ 여러 필드명 지원 (안전한 처리)
        const clientName = project.client_name || 
                          project.customer_name || 
                          (project.customer && project.customer.client_name) || 
                          '-';
        
        const managerName = project.manager_name || 
                           (project.manager && project.manager.user_name) || 
                           '-';
        
        const year = project.year || '-';
        const quarter = project.quarter ? `${project.quarter}분기` : '';
        
        // ⭐ 진행단계도 여러 필드명 지원
        const stageCode = project.current_stage || 
                         project.stage_code || 
                         'S01';
        
        const amount = project.confirmed_amount || 
                      project.expected_amount || 
                      0;
        
        return `
            <div class="mobile-project-card" onclick="viewMobileProject('${pipelineId}')">
                <div class="mobile-card-header">
                    <div class="mobile-card-title">
                        <div class="mobile-card-id">${pipelineId}</div>
                        <div class="mobile-card-project">${projectName}</div>
                    </div>
                    ${getMobileStageBadge(stageCode)}
                </div>
                
                <div class="mobile-card-info">
                    <div class="mobile-card-row">
                        <i class="fas fa-building"></i>
                        ${clientName}
                    </div>
                    <div class="mobile-card-row">
                        <i class="fas fa-user"></i>
                        ${managerName}
                    </div>
                    <div class="mobile-card-row">
                        <i class="fas fa-calendar"></i>
                        ${year}년 ${quarter}
                    </div>
                </div>
                
                <div class="mobile-card-footer">
                    <div class="mobile-card-amount">
                        ${formatMobileAmount(amount)}
                    </div>
                    <div class="mobile-card-actions">
                        <button class="btn-mobile-action edit" onclick="editMobileProject(event, '${pipelineId}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-mobile-action delete" onclick="deleteMobileProject(event, '${pipelineId}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    listContainer.innerHTML = html;
}

/**
 * STAGE 배지 생성
 */
function getMobileStageBadge(stageCode) {
    if (!stageCode) {
        return '<span class="mobile-card-badge badge-stage-1">-</span>';
    }
    
    const config = mobileStageConfig[stageCode];
    if (!config) {
        return `<span class="mobile-card-badge badge-stage-1">${stageCode}</span>`;
    }
    
    return `<span class="mobile-card-badge ${config.class}">${config.label}</span>`;
}

/**
 * 빈 상태 표시
 */
function showMobileEmpty() {
    const listContainer = document.getElementById('mobileProjectList');
    if (!listContainer) return;
    
    listContainer.innerHTML = `
        <div class="mobile-empty">
            <i class="fas fa-folder-open"></i>
            <p>등록된 프로젝트가 없습니다.</p>
        </div>
    `;
}

/**
 * 통계 업데이트
 */
function updateMobileStats(projects) {
    const total = projects.length;
    const active = projects.filter(p => 
        !['S05', 'S06', 'S08'].includes(p.current_stage || p.stage_code)
    ).length;
    const complete = projects.filter(p => 
        (p.current_stage || p.stage_code) === 'S08'
    ).length;
    
    const totalEl = document.getElementById('mobileTotalCount');
    const activeEl = document.getElementById('mobileActiveCount');
    const completeEl = document.getElementById('mobileCompleteCount');
    
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (completeEl) completeEl.textContent = complete;
}

/**
 * 검색 이벤트 설정
 */
function setupMobileSearchEvents() {
    const searchInput = document.getElementById('mobileSearchInput');
    const stageFilter = document.getElementById('mobileStageFilter');
    const yearFilter = document.getElementById('mobileYearFilter');
    
    if (!searchInput || !stageFilter || !yearFilter) return;
    
    const filterProjects = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const stageCode = stageFilter.value;
        const year = yearFilter.value;
        
        let filtered = [...mobileProjects];
        
        if (searchTerm) {
            filtered = filtered.filter(p => 
                (p.project_name && p.project_name.toLowerCase().includes(searchTerm)) ||
                (p.client_name && p.client_name.toLowerCase().includes(searchTerm)) ||
                (p.customer_name && p.customer_name.toLowerCase().includes(searchTerm))
            );
        }
        
        if (stageCode) {
            filtered = filtered.filter(p => 
                (p.current_stage || p.stage_code) === stageCode
            );
        }
        
        if (year) {
            filtered = filtered.filter(p => String(p.year) === String(year));
        }
        
        renderMobileProjects(filtered);
        updateMobileStats(filtered);
    };
    
    searchInput.addEventListener('input', Utils.debounce(filterProjects, 300));
    stageFilter.addEventListener('change', filterProjects);
    yearFilter.addEventListener('change', filterProjects);
}

// ===================================
// 거래처 검색 기능
// ===================================

/**
 * 거래처 검색 모달 열기
 */
function openMobileClientSearch(type) {
    console.log('🔍 ====================================');
    console.log('🔍 거래처 검색 모달 열기:', type);
    console.log('🔍 ====================================');
    
    currentClientSearchType = type;
    
    const modal = document.getElementById('mobileClientSearchModal');
    const title = document.getElementById('mobileClientSearchTitle');
    const searchInput = document.getElementById('mobileClientSearchInput');
    
    if (!modal || !title || !searchInput) {
        console.error('❌ 모달 요소를 찾을 수 없음');
        return;
    }
    
    if (type === 'customer') {
        title.textContent = '고객사 검색';
    } else if (type === 'ordering') {
        title.textContent = '발주처 검색';
    }
    
    modal.classList.add('active');
    searchInput.value = '';
    
    console.log('✅ 모달 열림, 거래처 로드 시작');
    
    // 전체 거래처 로드
    loadMobileClients('');
    
    // 검색 이벤트 재설정
    searchInput.oninput = function() {
        const term = this.value.trim();
        console.log('🔍 검색 입력:', term);
        searchMobileClients(term);
    };
    
    // 포커스
    setTimeout(() => {
        searchInput.focus();
    }, 300);
}
/**
 * 거래처 검색 모달 닫기
 */
function closeMobileClientSearch() {
    const modal = document.getElementById('mobileClientSearchModal');
    modal.classList.remove('active');
    currentClientSearchType = null;
}

/**
 * 거래처 목록 로드
 */
async function loadMobileClients(searchTerm = '') {
    console.log('🔍 ====================================');
    console.log('🔍 거래처 로드 시작');
    console.log('🔍 검색어:', searchTerm || '(전체)');
    console.log('🔍 ====================================');
    
    const resultsContainer = document.getElementById('mobileClientSearchResults');
    
    if (!resultsContainer) {
        console.error('❌ 거래처 결과 컨테이너를 찾을 수 없음');
        return;
    }
    
    resultsContainer.innerHTML = '<div class="mobile-client-loading"><i class="fas fa-spinner fa-spin"></i></div>';
    
    try {
        // API URL 구성
        let apiUrl;
        if (searchTerm && searchTerm.trim()) {
            apiUrl = `${API_CONFIG.ENDPOINTS.CLIENTS_SEARCH}?search=${encodeURIComponent(searchTerm)}&limit=50`;
        } else {
            apiUrl = `${API_CONFIG.ENDPOINTS.CLIENTS_LIST}?limit=50`;
        }
        
        console.log('📡 API 요청 URL:', apiUrl);
        
        const response = await API.get(apiUrl);
        console.log('📥 API 원본 응답:', response);
        
        // 응답 구조 파싱
        let clients = null;
        if (response.clients && Array.isArray(response.clients)) {
            clients = response.clients;
            console.log('✅ response.clients 사용');
        } else if (response.items && Array.isArray(response.items)) {
            clients = response.items;
            console.log('✅ response.items 사용');
        } else if (response.data && Array.isArray(response.data)) {
            clients = response.data;
            console.log('✅ response.data 사용');
        } else if (Array.isArray(response)) {
            clients = response;
            console.log('✅ response 배열 직접 사용');
        }
        
        console.log('🏢 파싱된 거래처 데이터:', clients);
        
        if (!clients || clients.length === 0) {
            console.log('⚠️ 검색 결과 없음');
            resultsContainer.innerHTML = `
                <div class="mobile-client-empty">
                    <i class="fas fa-search"></i>
                    <p>검색 결과가 없습니다.</p>
                </div>
            `;
            return;
        }
        
        console.log('✅ 거래처 로드 성공:', clients.length, '개');
        console.log('🎨 렌더링 시작...');
        
        mobileClients = clients;
        renderMobileClients(clients);
        
    } catch (error) {
        console.error('❌ 거래처 로드 실패:', error);
        resultsContainer.innerHTML = `
            <div class="mobile-client-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <p>거래처를 불러올 수 없습니다.</p>
                <p style="font-size: 11px; color: #999; margin-top: 8px;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * 거래처 검색
 */
function searchMobileClients(searchTerm) {
    console.log('🔍 거래처 검색 함수 호출:', searchTerm);
    
    // 항상 API 호출 (서버 사이드 검색)
    loadMobileClients(searchTerm);
}

/**
 * 거래처 목록 렌더링
 */
function renderMobileClients(clients) {
    console.log('🎨 거래처 렌더링 시작:', clients ? clients.length : 0, '개');
    
    const resultsContainer = document.getElementById('mobileClientSearchResults');
    
    if (!resultsContainer) {
        console.error('❌ 거래처 결과 컨테이너를 찾을 수 없음');
        return;
    }
    
    if (!clients || clients.length === 0) {
        resultsContainer.innerHTML = `
            <div class="mobile-client-empty">
                <i class="fas fa-search"></i>
                <p>검색 결과가 없습니다.</p>
            </div>
        `;
        return;
    }
    
    const html = clients.map(client => {
        console.log('🏢 거래처 항목:', client);
        
        const clientId = client.client_id || '';
        const clientName = client.client_name || '(이름없음)';
        const businessNumber = client.business_number || '';
        const ceoName = client.ceo_name || '';
        const phone = client.phone || '';
        
        return `
            <div class="mobile-client-item" onclick="selectMobileClient(${clientId}, '${escapeHtml(clientName)}')">
                <div class="mobile-client-name">${clientName}</div>
                <div class="mobile-client-info">
                    ${businessNumber ? `<div>사업자번호: ${businessNumber}</div>` : ''}
                    ${ceoName ? `<div>대표자: ${ceoName}</div>` : ''}
                    ${phone ? `<div>전화: ${phone}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    console.log('✅ 거래처 렌더링 완료');
    resultsContainer.innerHTML = html;
}

/**
 * 거래처 선택
 */
function selectMobileClient(clientId, clientName) {
    console.log('✅ 거래처 선택:', clientId, clientName);
    
    if (!currentClientSearchType) {
        console.error('❌ currentClientSearchType이 설정되지 않음');
        return;
    }
    
    if (currentClientSearchType === 'customer') {
        const idField = document.getElementById('mobileCustomerId');
        const nameField = document.getElementById('mobileCustomerSearch');
        
        if (idField && nameField) {
            idField.value = clientId;
            nameField.value = clientName;
            console.log('✅ 고객사 설정:', clientId, clientName);
        }
    } else if (currentClientSearchType === 'ordering') {
        const idField = document.getElementById('mobileOrderingPartyId');
        const nameField = document.getElementById('mobileOrderingPartySearch');
        
        if (idField && nameField) {
            idField.value = clientId;
            nameField.value = clientName;
            console.log('✅ 발주처 설정:', clientId, clientName);
            
            // Clear 버튼 표시
            const clearBtn = document.querySelector('.mobile-search-field .btn-clear');
            if (clearBtn) clearBtn.style.display = 'flex';
        }
    }
    
    closeMobileClientSearch();
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 거래처 선택 해제
 */
function clearMobileClient(type) {
    if (type === 'ordering') {
        document.getElementById('mobileOrderingPartyId').value = '';
        document.getElementById('mobileOrderingPartySearch').value = '';
        
        const clearBtn = event.currentTarget;
        clearBtn.style.display = 'none';
    }
}

// ===================================
// 프로젝트 폼
// ===================================

/**
 * 프로젝트 폼 초기화
 */
async function initializeMobileProjectForm() {
    console.log('📱 ========================================');
    console.log('📱 프로젝트 폼 초기화 시작');
    console.log('📱 ========================================');
    
    try {
        // 공통코드 확인 및 로드
        if (Object.keys(mobileStageConfig).length === 0 || Object.keys(mobileFieldConfig).length === 0) {
            console.log('📡 공통코드 로드 필요');
            await loadMobileCommonCodes();
            await loadMobileComboBoxes();
        }
        
        const form = document.getElementById('mobileProjectForm');
        if (!form) {
            console.error('❌ 폼을 찾을 수 없음');
            return;
        }
        
        console.log('✅ 폼 요소 확인 완료');
        
        // 폼 초기화
        form.reset();
        
        document.getElementById('mobileFormTitle').textContent = '프로젝트 등록';
        document.getElementById('mobilePipelineId').value = '';
        currentMobilePipelineId = null;

        // 신규 모드 기본값: 로그인 사용자 담당자, 조직 자동 설정
        setDefaultMobileManagerForNew();
        
        // 발주처 clear 버튼 숨김
        const clearBtn = document.querySelector('.mobile-search-field .btn-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        
        // ⭐ 폼 제출 이벤트 (중요!)
        form.onsubmit = async (e) => {
            console.log('📝 폼 제출 이벤트 발생');
            e.preventDefault();
            e.stopPropagation();
            await saveMobileProject();
            return false;
        };
        
        console.log('✅ 폼 이벤트 연결 완료');
        console.log('✅ 폼 초기화 완료');
    } catch (error) {
        console.error('❌ 폼 초기화 실패:', error);
    }
}
/**
 * 프로젝트 편집 데이터 로드
 */
async function loadMobileProjectForEdit(pipelineId) {
    console.log('📝 프로젝트 편집 로드:', pipelineId);
    
    try {
        const project = mobileProjects.find(p => p.pipeline_id === pipelineId);
        if (!project) {
            alert('프로젝트를 찾을 수 없습니다.');
            return;
        }
        
        console.log('📄 프로젝트 데이터:', project);
        
        document.getElementById('mobileFormTitle').textContent = '프로젝트 수정';
        document.getElementById('mobilePipelineId').value = pipelineId;
        
        // 기본 정보
        document.getElementById('mobileFieldCode').value = project.field_code || '';
        const serviceSelect = document.getElementById('mobileServiceCode');
        if (serviceSelect) serviceSelect.value = project.service_code || '';
        document.getElementById('mobileProjectName').value = project.project_name || '';
        document.getElementById('mobileCurrentStage').value = project.current_stage || '';
        document.getElementById('mobileManagerId').value = project.manager_id || '';
        const orgSelect = document.getElementById('mobileOrgId');
        if (orgSelect) orgSelect.value = project.org_id || '';
        if (orgSelect && !orgSelect.value && project.manager_id) {
            syncMobileOrgWithManager(project.manager_id, null, false);
        }
        
        // 금액 정보 (quoted_amount를 expected_amount로 매핑)
        document.getElementById('mobileExpectedAmount').value = project.quoted_amount || 0;
        
        // 고객사 정보
        document.getElementById('mobileCustomerId').value = project.customer_id || '';
        document.getElementById('mobileCustomerSearch').value = project.customer_name || project.client_name || '';
        
        // 발주처 정보
        if (project.ordering_party_id) {
            document.getElementById('mobileOrderingPartyId').value = project.ordering_party_id;
            document.getElementById('mobileOrderingPartySearch').value = project.ordering_party_name || '';
            
            const clearBtn = document.querySelector('.mobile-search-field .btn-clear');
            if (clearBtn) clearBtn.style.display = 'flex';
        }
        
        console.log('✅ 폼 데이터 로드 완료');
    } catch (error) {
        console.error('❌ 프로젝트 로드 실패:', error);
        alert('프로젝트 정보를 불러올 수 없습니다.');
    }
}

/**
 * 프로젝트 저장
 */
async function saveMobileProject() {
    console.log('💾 ========================================');
    console.log('💾 프로젝트 저장 시작');
    console.log('💾 ========================================');
    
    try {
        const pipelineId = document.getElementById('mobilePipelineId').value;
        console.log('📍 Pipeline ID:', pipelineId || '(신규)');
        
        // 1. 폼 요소 확인
        const fieldCodeEl = document.getElementById('mobileFieldCode');
        const customerIdEl = document.getElementById('mobileCustomerId');
        const projectNameEl = document.getElementById('mobileProjectName');
        const currentStageEl = document.getElementById('mobileCurrentStage');
        const managerIdEl = document.getElementById('mobileManagerId');
        const serviceCodeEl = document.getElementById('mobileServiceCode');
        const orgIdEl = document.getElementById('mobileOrgId');
        const orderingPartyIdEl = document.getElementById('mobileOrderingPartyId');
        const expectedAmountEl = document.getElementById('mobileExpectedAmount');
        
        if (!fieldCodeEl || !customerIdEl || !projectNameEl || !currentStageEl) {
            console.error('❌ 필수 폼 요소를 찾을 수 없음');
            alert('폼 요소를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
            return;
        }
        
        // 2. 데이터 수집
        const fieldCode = fieldCodeEl.value;
        const customerIdStr = customerIdEl.value;
        const projectName = projectNameEl.value.trim();
        const currentStage = currentStageEl.value;
        const managerId = managerIdEl ? managerIdEl.value : null;
        const orderingPartyIdStr = orderingPartyIdEl ? orderingPartyIdEl.value : null;
        const serviceCode = serviceCodeEl ? serviceCodeEl.value : '';
        const orgIdStr = orgIdEl ? orgIdEl.value : '';
        const expectedAmount = expectedAmountEl ? expectedAmountEl.value : '0';
        
        console.log('📋 수집된 데이터:');
        console.log('  - field_code:', fieldCode);
        console.log('  - customer_id:', customerIdStr);
        console.log('  - project_name:', projectName);
        console.log('  - current_stage:', currentStage);
        console.log('  - manager_id:', managerId);
        console.log('  - ordering_party_id:', orderingPartyIdStr);
        console.log('  - service_code:', serviceCode);
        console.log('  - org_id:', orgIdStr);
        console.log('  - quoted_amount:', expectedAmount);
        
        // 3. 필수 항목 검증
        if (!fieldCode) {
            alert('분야를 선택해주세요.');
            fieldCodeEl.focus();
            return;
        }
        
        if (!customerIdStr) {
            alert('고객사를 선택해주세요.');
            document.getElementById('mobileCustomerSearch').focus();
            return;
        }
        
        if (!projectName) {
            alert('프로젝트명을 입력해주세요.');
            projectNameEl.focus();
            return;
        }
        
        if (!currentStage) {
            alert('진행단계를 선택해주세요.');
            currentStageEl.focus();
            return;
        }
        
        // 4. 데이터 타입 변환
        const customerId = parseInt(customerIdStr);
        const orderingPartyId = orderingPartyIdStr ? parseInt(orderingPartyIdStr) : null;
        const quotedAmount = parseFloat(expectedAmount) || 0;
        const orgId = orgIdStr ? parseInt(orgIdStr) : null;
        
        if (isNaN(customerId)) {
            alert('고객사 정보가 올바르지 않습니다.');
            return;
        }
        
        const data = {
            project_name: projectName,
            field_code: fieldCode,
            service_code: serviceCode || null,
            customer_id: customerId,
            current_stage: currentStage,
            manager_id: managerId || null,
            org_id: orgId,
            ordering_party_id: orderingPartyId,
            quoted_amount: quotedAmount,
            created_by: 'mobile_user'  // TODO: 실제 로그인 사용자
        };
        
        console.log('✅ 최종 전송 데이터:', data);
        
        // 5. API 호출
        let response;
        if (pipelineId) {
            console.log('📡 PUT 요청:', `${API_CONFIG.ENDPOINTS.PROJECTS}/${pipelineId}`);
            data.updated_by = 'mobile_user';
            delete data.created_by;
            response = await API.put(`${API_CONFIG.ENDPOINTS.PROJECTS}/${pipelineId}`, data);
        } else {
            console.log('📡 POST 요청:', API_CONFIG.ENDPOINTS.PROJECTS);
            response = await API.post(API_CONFIG.ENDPOINTS.PROJECTS, data);
        }
        
        console.log('✅ API 응답:', response);
        
        // 6. 성공 처리
        const successMsg = pipelineId 
            ? `프로젝트가 수정되었습니다.\n\nPipeline ID: ${pipelineId}` 
            : `프로젝트가 등록되었습니다.\n\nPipeline ID: ${response.pipeline_id || response.data?.pipeline_id}`;
        
        alert(successMsg);
        
        // 목록으로 이동
        navigateTo('mobile-projects');
        
        // 목록 새로고침
        setTimeout(() => {
            loadMobileProjects();
        }, 200);
        
    } catch (error) {
        console.error('❌ ========================================');
        console.error('❌ 저장 실패');
        console.error('❌ ========================================');
        console.error('에러 객체:', error);
        console.error('에러 메시지:', error.message);
        console.error('에러 스택:', error.stack);
        
        let errorMsg = '저장 중 오류가 발생했습니다.';
        
        if (error.response) {
            console.error('서버 응답:', error.response);
            errorMsg += '\n\n' + (error.response.detail || error.response.message || JSON.stringify(error.response));
        } else if (error.message) {
            errorMsg += '\n\n' + error.message;
        }
        
        alert(errorMsg);
    }
}

/**
 * 프로젝트 편집
 */
function editMobileProject(event, pipelineId) {
    event.stopPropagation();
    currentMobilePipelineId = pipelineId;
    navigateTo('mobile-project-new');
    setTimeout(() => loadMobileProjectForEdit(pipelineId), 100);
}

/**
 * 프로젝트 삭제
 */
async function deleteMobileProject(event, pipelineId) {
    event.stopPropagation();
    
    if (!confirm('정말 삭제하시겠습니까?\n\n삭제된 데이터는 복구할 수 없습니다.')) {
        return;
    }
    
    try {
        console.log('🗑️ 프로젝트 삭제:', pipelineId);
        
        // API 호출
        await API.delete(`${API_CONFIG.ENDPOINTS.PROJECTS}/${pipelineId}`);
        
        console.log('✅ 삭제 성공');
        
        // 목록에서 제거
        mobileProjects = mobileProjects.filter(p => p.pipeline_id !== pipelineId);
        renderMobileProjects(mobileProjects);
        updateMobileStats(mobileProjects);
        
        alert('삭제되었습니다.');
    } catch (error) {
        console.error('❌ 삭제 실패:', error);
        alert('삭제 중 오류가 발생했습니다:\n' + (error.message || '알 수 없는 오류'));
    }
}
/**
 * 프로젝트 상세보기
 */
function viewMobileProject(pipelineId) {
    const project = mobileProjects.find(p => p.pipeline_id === pipelineId);
    if (!project) {
        alert('프로젝트를 찾을 수 없습니다.');
        return;
    }
    
    const fieldName = mobileFieldConfig[project.field_code] || project.field_code || '-';
    const stageName = getMobileStageLabel(project.current_stage || project.stage_code);
    
    const info = `
프로젝트 상세 정보

Pipeline ID: ${project.pipeline_id || '-'}
분야: ${fieldName}
서비스: ${project.service_name || project.service_code || '-'}
프로젝트명: ${project.project_name || '-'}
고객사: ${project.customer_name || project.client_name || '-'}
발주처: ${project.ordering_party_name || '-'}
진행단계: ${stageName}
담당자: ${project.manager_name || '-'}
담당조직: ${project.org_name || project.org_id || '-'}
연도/분기: ${project.year || '-'}년 ${project.quarter ? project.quarter + '분기' : ''}
예상금액: ${formatMobileAmount(project.expected_amount)}
확정금액: ${formatMobileAmount(project.confirmed_amount)}
비고: ${project.remarks || '-'}
    `.trim();
    
    alert(info);
}

// ===================================
// 이력 등록
// ===================================

/**
 * 이력 등록 초기화
 */
async function initializeMobileHistory() {
    console.log('📱 ========================================');
    console.log('📱 이력 등록 초기화 시작');
    console.log('📱 ========================================');
    
    try {
        // 1. 공통코드 확인
        if (Object.keys(mobileStageConfig).length === 0) {
            console.log('📡 공통코드 로드');
            await loadMobileCommonCodes();
            await loadMobileComboBoxes();
        }
        
        // 2. 프로젝트 목록 로드
        console.log('📡 프로젝트 목록 로드');
        await loadMobileProjectsForHistory();
        
        // 3. 기본값 설정
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('mobileHistoryDate');
        if (dateInput) {
            dateInput.value = today;
        }
        
        const projectInfo = document.getElementById('mobileProjectInfo');
        if (projectInfo) {
            projectInfo.style.display = 'none';
        }
        
        // 4. 폼 제출 이벤트
        const form = document.getElementById('mobileHistoryForm');
        if (form) {
            form.onsubmit = async (e) => {
                console.log('📝 이력 폼 제출 이벤트');
                e.preventDefault();
                e.stopPropagation();
                await saveMobileHistory();
                return false;
            };
        }
        
        console.log('✅ 이력 폼 초기화 완료');
    } catch (error) {
        console.error('❌ 이력 폼 초기화 실패:', error);
        alert('이력 등록 화면 초기화에 실패했습니다.');
    }
}

/**
 * 이력용 프로젝트 목록 로드
 */
async function loadMobileProjectsForHistory() {
    console.log('📡 이력용 프로젝트 목록 로드');
    
    try {
        const response = await API.get(API_CONFIG.ENDPOINTS.PROJECTS_LIST);
        console.log('📥 API 응답:', response);
        
        let projects = null;
        if (response.items && Array.isArray(response.items)) {
            projects = response.items;
        } else if (response.projects && Array.isArray(response.projects)) {
            projects = response.projects;
        } else if (Array.isArray(response)) {
            projects = response;
        }
        
        if (!projects) {
            console.error('❌ 프로젝트 데이터를 찾을 수 없음');
            return;
        }
        
        const select = document.getElementById('mobileHistoryProject');
        if (!select) {
            console.error('❌ 프로젝트 select를 찾을 수 없음');
            return;
        }
        
        select.innerHTML = '<option value="">프로젝트를 선택하세요</option>';
        
        // 진행중인 프로젝트만 필터링 (DROP, 실주, 계약완료 제외)
        const activeProjects = projects.filter(p => 
            !['S05', 'S06', 'S08'].includes(p.current_stage || p.stage_code)
        );
        
        console.log('📊 진행중 프로젝트:', activeProjects.length, '개');
        
        activeProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.pipeline_id;
            
            const clientName = project.client_name || project.customer_name || '';
            option.textContent = `${project.project_name} (${clientName})`;
            
            // 데이터 속성 저장
            option.dataset.client = clientName;
            option.dataset.stage = project.current_stage || project.stage_code || '';
            option.dataset.customerId = project.customer_id || '';
            
            select.appendChild(option);
        });
        
        console.log('✅ 이력용 프로젝트 로드 완료:', activeProjects.length, '개');
    } catch (error) {
        console.error('❌ 프로젝트 목록 로드 실패:', error);
    }
}

/**
 * 선택된 프로젝트 정보 표시
 */
function loadMobileProjectInfo() {
    console.log('📊 프로젝트 정보 표시');
    
    const select = document.getElementById('mobileHistoryProject');
    const projectInfo = document.getElementById('mobileProjectInfo');
    const clientSpan = document.getElementById('mobileInfoClient');
    const stageSpan = document.getElementById('mobileInfoStage');
    const historyStageSelect = document.getElementById('mobileHistoryStage');
    
    if (!select || !projectInfo) {
        console.error('❌ 필요한 요소를 찾을 수 없음');
        return;
    }
    
    if (select.value) {
        const option = select.options[select.selectedIndex];
        
        // 프로젝트 정보 표시
        projectInfo.style.display = 'block';
        
        if (clientSpan) {
            clientSpan.textContent = option.dataset.client || '-';
        }
        
        if (stageSpan) {
            stageSpan.innerHTML = getMobileStageBadge(option.dataset.stage);
        }
        
        // 진행단계 자동 선택
        if (historyStageSelect && option.dataset.stage) {
            historyStageSelect.value = option.dataset.stage;
        }
        
        console.log('✅ 프로젝트 정보 표시:', option.dataset);
    } else {
        projectInfo.style.display = 'none';
    }
}

/**
 * 이력 저장
 */
async function saveMobileHistory() {
    console.log('💾 ========================================');
    console.log('💾 이력 저장 시작');
    console.log('💾 ========================================');
    
    try {
        const pipelineId = document.getElementById('mobileHistoryProject').value;
        const historyDate = document.getElementById('mobileHistoryDate').value;
        const stageCode = document.getElementById('mobileHistoryStage').value;
        const content = document.getElementById('mobileHistoryContent').value.trim();
        
        console.log('📋 수집된 데이터:');
        console.log('  - pipeline_id:', pipelineId);
        console.log('  - base_date:', historyDate);
        console.log('  - progress_stage:', stageCode);
        console.log('  - content:', content);
        
        // 필수 항목 검증
        if (!pipelineId) {
            alert('프로젝트를 선택해주세요.');
            document.getElementById('mobileHistoryProject').focus();
            return;
        }
        
        if (!historyDate) {
            alert('이력 일자를 선택해주세요.');
            document.getElementById('mobileHistoryDate').focus();
            return;
        }
        
        if (!stageCode) {
            alert('진행단계를 선택해주세요.');
            document.getElementById('mobileHistoryStage').focus();
            return;
        }
        
        if (!content) {
            alert('이력 내용을 입력해주세요.');
            document.getElementById('mobileHistoryContent').focus();
            return;
        }
        
        const data = {
            pipeline_id: pipelineId,
            base_date: historyDate,
            progress_stage: stageCode,
            strategy_content: content,
            creator_id: 'mobile_user'  // TODO: 실제 로그인 사용자
        };
        
        console.log('✅ 최종 전송 데이터:', data);
        
        // ⭐ 실제 API 호출
        console.log('📡 POST 요청:', API_CONFIG.ENDPOINTS.PROJECT_HISTORY);
        const response = await API.post(API_CONFIG.ENDPOINTS.PROJECT_HISTORY, data);
        
        console.log('✅ 저장 성공:', response);
        
        alert(`이력이 등록되었습니다.\n\nHistory ID: ${response.history_id || ''}`);
        resetMobileHistoryForm();
        
    } catch (error) {
        console.error('❌ ========================================');
        console.error('❌ 이력 저장 실패');
        console.error('❌ ========================================');
        console.error('에러:', error);
        
        let errorMsg = '이력 저장 중 오류가 발생했습니다.';
        if (error.message) {
            errorMsg += '\n\n' + error.message;
        }
        
        alert(errorMsg);
    }
}

/**
 * 이력 폼 초기화
 */
function resetMobileHistoryForm() {
    console.log('🔄 이력 폼 초기화');
    
    const form = document.getElementById('mobileHistoryForm');
    if (form) {
        form.reset();
    }
    
    const projectInfo = document.getElementById('mobileProjectInfo');
    if (projectInfo) {
        projectInfo.style.display = 'none';
    }
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('mobileHistoryDate');
    if (dateInput) {
        dateInput.value = today;
    }
    
    console.log('✅ 폼 초기화 완료');
}

// ===================================
// 유틸리티
// ===================================

function formatMobileAmount(amount) {
    if (!amount || amount === 0) return '0원';
    const thousands = Math.floor(amount / 1000);
    return `${thousands.toLocaleString()}천원`;
}

function getMobileStageLabel(stageCode) {
    if (!stageCode) return '-';
    const config = mobileStageConfig[stageCode];
    return config ? config.label : stageCode;
}

function showMobileError(message) {
    alert('오류: ' + message);
}

// ===================================
// Export
// ===================================
window.initializeMobileProjects = initializeMobileProjects;
window.initializeMobileProjectForm = initializeMobileProjectForm;
window.initializeMobileHistory = initializeMobileHistory;
window.loadMobileProjectInfo = loadMobileProjectInfo;
window.saveMobileProject = saveMobileProject;
window.saveMobileHistory = saveMobileHistory;
window.resetMobileHistoryForm = resetMobileHistoryForm;
window.viewMobileProject = viewMobileProject;
window.editMobileProject = editMobileProject;
window.deleteMobileProject = deleteMobileProject;
window.openMobileClientSearch = openMobileClientSearch;
window.closeMobileClientSearch = closeMobileClientSearch;
window.selectMobileClient = selectMobileClient;
window.clearMobileClient = clearMobileClient;

console.log('📦 Mobile 모듈 v3.0 로드 완료 (참조 관계 반영)');
