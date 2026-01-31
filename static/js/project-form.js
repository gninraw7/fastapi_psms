/**
 * static/js/project-form.js
 * 영업 > 신규프로젝트 화면 수정
 * 
 * 수정 내용:
 * 1.1 진행단계, 담당자 콤보박스 데이터 로드 수정
 * 1.2 고객사/발주처 선택 모달 (검색 + 페이징)
 * 1.3 수주확률(win_probability), 비고(notes) 필드 추가
 * 2.1 속성정보 탭 - PROJECT_ATTRIBUTE 콤보박스
 * 3.1 변경이력 탭 - progress_stage 콤보박스, 기본값 S01
 * 
 * 버그 수정 (2026-01-31):
 * - 고객사/발주처 정보 조회 오류 수정
 * - 고객사 검색 API 엔드포인트 수정 (CLIENTS_SEARCH → CLIENTS_SEARCH_SIMPLE)
 * - 속성정보 DB 저장 오류 수정 (row_stat 관리)
 * - 변경이력 DB 저장 오류 수정 (row_stat 관리)
 * - 속성정보 추가 버튼 렌더링 추가
 * - 변경이력 추가 버튼 렌더링 추가
 * - pipeline_id 전송 추가로 수정 모드 저장 오류 해결
 * - 변경이력 전략 내용 입력란을 textarea로 변경 (자동 높이 조절)
 * - 변경이력 수정 모달 추가 (prompt 대신 모달 사용)
 * - ⭐ 변경이력 진행단계 스마트 관리 기능 추가:
 *   1) 수정 모드 시 기본정보 탭의 진행단계를 이력 입력 기본값으로 설정
 *   2) 이력 추가 시 진행단계가 기본정보보다 나중이면 자동 업데이트 제안
 *   3) sort_order 기반 진행단계 비교
 */

// ===================================
// Project Form State
// ===================================
let formMode = 'new';  // 'new' or 'edit'
let currentPipelineId = null;
let attributes = [];
let histories = [];

// 콤보박스 데이터 캐시
let stageOptions = [];
let attributeOptions = [];

// 고객사 선택 모달 상태
let clientSearchPage = 1;
let clientSearchTarget = '';  // 'customer' or 'ordering_party'
let selectedCustomerId = null;
let selectedOrderingPartyId = null;

// ⭐ 변경이력 수정 모달 상태
let editingHistoryIndex = null;

// ===================================
// Initialize Project Form
// ===================================
async function initializeProjectForm(mode = 'new', pipelineId = null) {
    formMode = mode;
    currentPipelineId = pipelineId;
    
    console.log('📝 폼 초기화:', mode, pipelineId);
    
    // ✅ 버그 수정: 제목 텍스트만 변경 (아이콘은 HTML에 이미 있음)
    const titleElement = document.getElementById('formTitle');
    const titleIcon = titleElement.parentElement.querySelector('i');  // 부모의 아이콘
    
    if (mode === 'new') {
        titleElement.textContent = '신규 프로젝트';  // 텍스트만 변경
        if (titleIcon) titleIcon.className = 'fas fa-plus-circle';
        document.getElementById('pipeline_id').value = '자동생성';
    } else {
        titleElement.textContent = '프로젝트 수정';  // 텍스트만 변경
        if (titleIcon) titleIcon.className = 'fas fa-edit';
    }
    
    // 콤보박스 초기화 (수정됨)
    await loadFormComboBoxes();
    
    // 탭 이벤트 바인딩
    initializeFormTabs();
    
    // 고객사 선택 이벤트 바인딩
    initializeClientSearch();
    
    // 수정 모드면 데이터 로드
    if (mode === 'edit' && pipelineId) {
        await loadProjectData(pipelineId);
    } else {
        // 신규 모드면 폼 초기화
        resetForm();
        
        // 3.1 신규 등록시 진행단계 기본값 'S01'
        document.getElementById('current_stage').value = 'S01';
        
        // 속성/이력 렌더링 (빈 상태로)
        renderAttributes();
        renderHistories();

        // ⭐ 마크다운 포맷팅 초기화 (새로 추가)
        initMarkdownFormatting();
    }
}

// ===================================
// Load ComboBoxes
// ===================================
async function loadFormComboBoxes() {
    try {
        console.log('📦 콤보박스 데이터 로딩 시작...');
        
        // 1.1 진행단계 콤보박스 (STAGE)
        const stages = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/STAGE`);
        const stageSelect = document.getElementById('current_stage');
        stageSelect.innerHTML = '<option value="">선택하세요</option>';
        console.log('📥 진행단계 데이터:', stages);
        
        if (stages && stages.items) {
            // ⭐ sort_order 정보 포함하여 저장
            stageOptions = stages.items;
            stages.items.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.code;
                opt.textContent = s.code_name;
                stageSelect.appendChild(opt);
            });
            
            console.log('📊 진행단계 옵션 로드 완료:', stageOptions.length, '개');
        }
        
        // 1.1 사업분야 콤보박스 (FIELD)
        const fields = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/FIELD`);
        const fieldSelect = document.getElementById('field_code');
        fieldSelect.innerHTML = '<option value="">선택하세요</option>';
        console.log('📥 사업분야 데이터:', fields);
        
        if (fields && fields.items) {
            fields.items.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.code;
                opt.textContent = f.code_name;
                fieldSelect.appendChild(opt);
            });
        }
        
        // 1.1 담당자 콤보박스
        const managers = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
        const managerSelect = document.getElementById('manager_id');
        managerSelect.innerHTML = '<option value="">선택하세요</option>';
        console.log('📥 담당자 데이터:', managers);
        
        // items 배열에서 데이터 로드
        const managerList = managers?.items || managers?.managers || [];
        managerList.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.manager_id || m.login_id;
            opt.textContent = m.manager_name || m.user_name;
            managerSelect.appendChild(opt);
        });
        
        // 2.1 프로젝트 속성 콤보박스 데이터 로드
        try {
            const attrs = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/PROJECT_ATTRIBUTE`);
            console.log('📥 프로젝트 속성 데이터:', attrs);
            if (attrs && attrs.items) {
                attributeOptions = attrs.items;
            }
        } catch (e) {
            console.warn('⚠️ PROJECT_ATTRIBUTE 로드 실패:', e);
            attributeOptions = [];
        }
        
        console.log('✅ 콤보박스 로딩 완료');
        
    } catch (error) {
        console.error('❌ 콤보박스 로딩 실패:', error);
    }
}

// ===================================
// Load Project Data (수정 모드)
// ===================================
async function loadProjectData(pipelineId) {
    try {
        Utils.showLoading(true);
        
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECT_DETAIL}/${pipelineId}/full`);
        console.log('📥 프로젝트 데이터:', response);
        
        if (response) {
            const project = response.project || response;
            
            // 기본정보 채우기
            document.getElementById('pipeline_id').value = project.pipeline_id || '';
            document.getElementById('project_name').value = project.project_name || '';
            document.getElementById('field_code').value = project.field_code || '';
            document.getElementById('current_stage').value = project.current_stage || project.progress_stage || '';
            document.getElementById('manager_id').value = project.manager_id || '';
            
            // ✅ 고객사/발주처 수정 (디버깅 강화)
            console.log('🏢 고객사/발주처 정보:', {
                customer_id: project.customer_id,
                customer_name: project.customer_name,
                ordering_party_id: project.ordering_party_id,
                ordering_party_name: project.ordering_party_name
            });
            
            // 고객사 설정
            if (project.customer_id) {
                selectedCustomerId = project.customer_id;
                
                const customerIdEl = document.getElementById('customer_id');
                const customerNameEl = document.getElementById('customer_name');
                
                if (customerIdEl && customerNameEl) {
                    customerIdEl.value = project.customer_id;
                    customerNameEl.value = project.customer_name || '';
                    
                    // ✅ 값이 제대로 설정되었는지 즉시 확인
                    console.log('✅ 고객사 설정 완료:', {
                        id_value: customerIdEl.value,
                        name_value: customerNameEl.value
                    });
                } else {
                    console.error('❌ 고객사 input 요소를 찾을 수 없음:', {
                        customerIdEl: !!customerIdEl,
                        customerNameEl: !!customerNameEl
                    });
                }
            } else {
                console.warn('⚠️ 고객사 ID가 없습니다.');
            }
            
            // 발주처 설정
            if (project.ordering_party_id) {
                selectedOrderingPartyId = project.ordering_party_id;
                
                const orderingPartyIdEl = document.getElementById('ordering_party_id');
                const orderingPartyNameEl = document.getElementById('ordering_party_name');
                
                if (orderingPartyIdEl && orderingPartyNameEl) {
                    orderingPartyIdEl.value = project.ordering_party_id;
                    orderingPartyNameEl.value = project.ordering_party_name || '';
                    
                    // ✅ 값이 제대로 설정되었는지 즉시 확인
                    console.log('✅ 발주처 설정 완료:', {
                        id_value: orderingPartyIdEl.value,
                        name_value: orderingPartyNameEl.value
                    });
                } else {
                    console.error('❌ 발주처 input 요소를 찾을 수 없음:', {
                        orderingPartyIdEl: !!orderingPartyIdEl,
                        orderingPartyNameEl: !!orderingPartyNameEl
                    });
                }
            } else {
                console.log('ℹ️ 발주처가 설정되지 않았습니다.');
            }
            
            document.getElementById('quoted_amount').value = project.quoted_amount || '';
            
            // 1.3 수주확률, 비고 (신규 필드)
            const winProbEl = document.getElementById('win_probability');
            if (winProbEl) winProbEl.value = project.win_probability || '';
            
            const notesEl = document.getElementById('notes');
            if (notesEl) notesEl.value = project.notes || '';
            
            // ✅ 속성 로드 - 기존 데이터는 row_stat을 빈값으로 (수정 시 'U'로 변경)
            attributes = (response.attributes || []).map(attr => ({
                attr_code: attr.attr_code,
                attr_value: attr.attr_value || '',
                attr_name: attr.attr_name || '',
                row_stat: ''  // 기존 데이터: 빈값 (변경 시 'U')
            }));
            renderAttributes();
            
            // ✅ 이력 로드 - 기존 데이터는 row_stat을 빈값으로
            histories = (response.histories || []).map(hist => ({
                history_id: hist.history_id,
                base_date: hist.base_date,
                progress_stage: hist.progress_stage,
                strategy_content: hist.strategy_content || '',
                stage_name: hist.stage_name || '',
                row_stat: ''  // 기존 데이터: 빈값 (변경 시 'U')
            }));
            renderHistories();
            
            console.log('✅ 프로젝트 데이터 로드 완료');
            console.log('   - 속성:', attributes.length, '개');
            console.log('   - 이력:', histories.length, '개');
        }
        
        Utils.showLoading(false);
    } catch (error) {
        console.error('❌ 프로젝트 데이터 로딩 실패:', error);
        Utils.showLoading(false);
        alert('프로젝트 데이터를 불러오는데 실패했습니다.');
    }
}

// ===================================
// Reset Form
// ===================================
function resetForm() {
    document.getElementById('pipeline_id').value = '자동생성';
    document.getElementById('project_name').value = '';
    document.getElementById('field_code').value = '';
    document.getElementById('current_stage').value = 'S01';  // 3.1 기본값 S01
    document.getElementById('manager_id').value = '';
    
    // 고객사/발주처 초기화
    const customerIdEl = document.getElementById('customer_id');
    if (customerIdEl) customerIdEl.value = '';
    document.getElementById('customer_name').value = '';
    
    const orderingPartyIdEl = document.getElementById('ordering_party_id');
    if (orderingPartyIdEl) orderingPartyIdEl.value = '';
    document.getElementById('ordering_party_name').value = '';
    
    selectedCustomerId = null;
    selectedOrderingPartyId = null;
    
    document.getElementById('quoted_amount').value = '';
    
    const winProbEl = document.getElementById('win_probability');
    if (winProbEl) winProbEl.value = '';
    
    const notesEl = document.getElementById('notes');
    if (notesEl) notesEl.value = '';
    
    attributes = [];
    histories = [];
}

// ===================================
// Tab Navigation
// ===================================
function initializeFormTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // 모든 탭 비활성화
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // 선택한 탭 활성화
            btn.classList.add('active');
            const targetPane = document.getElementById('tab-' + targetTab);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}

// ===================================
// Client Search Modal
// ===================================
function initializeClientSearch() {
    // 고객사 검색 버튼
    const customerBtn = document.getElementById('customer_search_btn');
    const customerInput = document.getElementById('customer_name');
    
    if (customerBtn) {
        customerBtn.addEventListener('click', () => openClientSearchModal('customer'));
    }
    if (customerInput) {
        customerInput.addEventListener('click', () => openClientSearchModal('customer'));
    }
    
    // 발주처 검색 버튼
    const orderingBtn = document.getElementById('ordering_party_search_btn');
    const orderingInput = document.getElementById('ordering_party_name');
    
    if (orderingBtn) {
        orderingBtn.addEventListener('click', () => openClientSearchModal('ordering_party'));
    }
    if (orderingInput) {
        orderingInput.addEventListener('click', () => openClientSearchModal('ordering_party'));
    }
}

async function openClientSearchModal(target) {
    clientSearchTarget = target;
    clientSearchPage = 1;
    
    const modal = document.getElementById('clientSearchModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('clientSearchInput').value = '';
        document.getElementById('clientSearchResults').innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">검색어를 입력하세요</p>';
    }
}

async function searchClients(page = 1) {
    try {
        clientSearchPage = page;
        
        const searchInput = document.getElementById('clientSearchInput');
        const searchText = searchInput ? searchInput.value.trim() : '';
        
        console.log('🔍 고객사 검색:', { searchText, page });
        
        Utils.showLoading(true);
        
        // ✅ 수정: CLIENTS_SEARCH_SIMPLE 엔드포인트 사용
        const url = `${API_CONFIG.ENDPOINTS.CLIENTS_SEARCH_SIMPLE}?search_text=${encodeURIComponent(searchText)}`;
        console.log('📡 API 호출:', url);
        
        const response = await API.get(url);
        console.log('📥 검색 결과:', response);
        
        Utils.showLoading(false);
        
        renderClientSearchResults(response);
        
    } catch (error) {
        console.error('❌ 거래처 검색 실패:', error);
        Utils.showLoading(false);
        alert('거래처 검색 중 오류가 발생했습니다.');
    }
}

function renderClientSearchResults(response) {
    const container = document.getElementById('clientSearchResults');
    if (!container) return;
    
    // ✅ response가 배열인 경우와 객체인 경우 모두 처리
    const items = Array.isArray(response) ? response : (response.items || response.clients || []);
    
    console.log('📊 검색 결과 렌더링:', items.length, '건');
    
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">검색 결과가 없습니다.</p>';
        return;
    }
    
    let html = '<div class="client-results-list">';
    items.forEach(client => {
        html += `
            <div class="client-result-item" onclick="selectClient(${client.client_id}, '${(client.client_name || '').replace(/'/g, "\\'")}')">
                <div class="client-result-name">${client.client_name || ''}</div>
                <div class="client-result-info">
                    ${client.business_number ? `<span>사업자: ${client.business_number}</span>` : ''}
                    ${client.ceo_name ? `<span>대표: ${client.ceo_name}</span>` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
    
    // ✅ 페이징은 response에 total_pages가 있을 때만 렌더링
    if (response.total_pages) {
        renderClientPagination(response);
    } else {
        // 페이징 정보가 없으면 페이징 컨테이너 숨김
        const paginationContainer = document.getElementById('clientSearchPagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
    }
}

function renderClientPagination(response) {
    const container = document.getElementById('clientSearchPagination');
    if (!container) return;
    
    const totalPages = response.total_pages || 1;
    const currentPage = response.current_page || 1;
    
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="searchClients(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

// 고객사 선택
function selectClient(clientId, clientName) {
    console.log('✅ 거래처 선택:', { clientSearchTarget, clientId, clientName });
    
    if (clientSearchTarget === 'customer') {
        selectedCustomerId = clientId;
        const customerIdEl = document.getElementById('customer_id');
        if (customerIdEl) customerIdEl.value = clientId;
        document.getElementById('customer_name').value = clientName;
        
        console.log('✅ 고객사 선택:', { clientId, clientName });
    } else {
        selectedOrderingPartyId = clientId;
        const orderingPartyIdEl = document.getElementById('ordering_party_id');
        if (orderingPartyIdEl) orderingPartyIdEl.value = clientId;
        document.getElementById('ordering_party_name').value = clientName;
        
        console.log('✅ 발주처 선택:', { clientId, clientName });
    }
    
    closeClientSearchModal();
}

// 모달 닫기
function closeClientSearchModal() {
    const modal = document.getElementById('clientSearchModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===================================
// 2.1 Attributes Management (수정됨)
// ===================================
function addAttribute() {
    // 2.1 속성 추가
    const attrCodeSelect = document.getElementById('new_attr_code');
    const attrValueInput = document.getElementById('new_attr_value');
    
    if (!attrCodeSelect) {
        console.warn('⚠️ 속성 코드 select 요소를 찾을 수 없음');
        return;
    }
    
    const attrCode = attrCodeSelect.value;
    const attrValue = attrValueInput ? attrValueInput.value.trim() : '';
    
    if (!attrCode) {
        alert('속성명을 선택하세요.');
        return;
    }
    
    // 2.1 중복 체크 (삭제 표시된 것 제외)
    const isDuplicate = attributes.some(attr => attr.attr_code === attrCode && attr.row_stat !== 'D');
    if (isDuplicate) {
        alert('이미 등록된 속성입니다. 동일한 속성은 중복 등록할 수 없습니다.');
        return;
    }
    
    // 속성명 찾기
    const selectedOption = attributeOptions.find(opt => opt.code === attrCode);
    const attrName = selectedOption ? selectedOption.code_name : attrCode;
    
    // ✅ 신규 속성 추가 (row_stat: 'N' 설정 필수)
    attributes.push({
        attr_code: attrCode,
        attr_value: attrValue,
        attr_name: attrName,
        row_stat: 'N'  // ✅ 신규 표시
    });
    
    console.log('✅ 속성 추가:', { attrCode, attrValue, attrName, row_stat: 'N' });
    
    // 입력 필드 초기화
    attrCodeSelect.value = '';
    if (attrValueInput) attrValueInput.value = '';
    
    // 렌더링
    renderAttributes();
}

// ✅ 속성 수정 함수
function editAttribute(index) {
    const attr = attributes[index];
    
    const newValue = prompt('속성 값을 입력하세요:', attr.attr_value || '');
    
    if (newValue !== null && newValue !== attr.attr_value) {
        attributes[index].attr_value = newValue.trim();
        
        // ✅ 신규(N)가 아니고 삭제(D)가 아니면 수정(U)으로 표시
        if (attr.row_stat !== 'N' && attr.row_stat !== 'D') {
            attributes[index].row_stat = 'U';
            console.log('✅ 속성 수정:', { index, attr_code: attr.attr_code, row_stat: 'U' });
        }
        
        renderAttributes();
    }
}

// ✅ 속성 삭제 함수
function deleteAttribute(index) {
    const attr = attributes[index];
    
    if (!confirm(`"${attr.attr_name || attr.attr_code}" 속성을 삭제하시겠습니까?`)) {
        return;
    }
    
    // ✅ 신규(N)로 추가된 것은 배열에서 제거, 기존 데이터는 'D'로 표시
    if (attr.row_stat === 'N') {
        // 신규 추가된 것은 완전히 제거
        attributes.splice(index, 1);
        console.log('✅ 신규 속성 제거:', { index });
    } else {
        // 기존 데이터는 삭제 표시
        attributes[index].row_stat = 'D';
        console.log('✅ 기존 속성 삭제 표시:', { index, attr_code: attr.attr_code, row_stat: 'D' });
    }
    
    renderAttributes();
}

// ✅ 속성 렌더링 함수 (입력 폼 포함)
function renderAttributes() {
    const container = document.getElementById('attributesList');
    if (!container) {
        console.error('❌ attributesList 컨테이너를 찾을 수 없음');
        return;
    }
    
    let html = '';
    
    // ✅ 속성 추가 입력 폼 (항상 표시)
    html += `
        <div class="attribute-add-row" style="display: flex; gap: 0.75rem; margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; align-items: center;">
            <select id="new_attr_code" class="form-select" style="flex: 1;">
                <option value="">속성 선택</option>
    `;
    
    // 속성 옵션 추가
    attributeOptions.forEach(opt => {
        html += `<option value="${opt.code}">${opt.code_name}</option>`;
    });
    
    html += `
            </select>
            <input type="text" id="new_attr_value" class="form-input" placeholder="속성 값 입력" style="flex: 1;">
            <button type="button" class="btn btn-primary btn-sm" onclick="addAttribute()">
                <i class="fas fa-plus"></i> 추가
            </button>
        </div>
    `;
    
    // 삭제 표시된 것 제외하고 표시
    const visibleAttrs = attributes.filter(a => a.row_stat !== 'D');
    
    if (visibleAttrs.length === 0) {
        html += `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p>등록된 속성이 없습니다.</p>
            </div>
        `;
    } else {
        html += '<div class="attributes-list">';
        
        visibleAttrs.forEach((attr) => {
            // 실제 배열에서의 인덱스 찾기
            const realIndex = attributes.indexOf(attr);
            
            const statusBadge = attr.row_stat === 'N' ? 
                '<span class="badge badge-new" style="background: #4caf50; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">신규</span>' : 
                (attr.row_stat === 'U' ? '<span class="badge badge-modified" style="background: #ff9800; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">수정됨</span>' : '');
            
            html += `
                <div class="attribute-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 0.5rem;">
                    <div class="attribute-info" style="flex: 1;">
                        <strong>${attr.attr_name || attr.attr_code}</strong>
                        <span class="attribute-value" style="margin-left: 1rem; color: #666;">${attr.attr_value || '-'}</span>
                        ${statusBadge}
                    </div>
                    <div class="attribute-actions" style="display: flex; gap: 0.5rem;">
                        <button type="button" class="btn-icon" onclick="editAttribute(${realIndex})" title="수정" style="background: #2196f3; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-icon btn-danger" onclick="deleteAttribute(${realIndex})" title="삭제" style="background: #f44336; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    container.innerHTML = html;
    
    console.log('📊 속성 렌더링:', {
        total: attributes.length,
        visible: visibleAttrs.length,
        new: attributes.filter(a => a.row_stat === 'N').length,
        updated: attributes.filter(a => a.row_stat === 'U').length,
        deleted: attributes.filter(a => a.row_stat === 'D').length
    });
}

// 레거시 함수 호환성 유지
function removeAttribute(index) {
    deleteAttribute(index);
}

function updateAttribute(index) {
    editAttribute(index);
}

// ===================================
// ⭐ Textarea 자동 높이 조절 함수
// ===================================
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    
    // 높이 초기화
    textarea.style.height = 'auto';
    
    // 내용에 맞춰 높이 조절 (최소 3줄, 최대 10줄)
    const lineHeight = 24; // 대략적인 한 줄 높이 (px)
    const minHeight = lineHeight * 3;
    const maxHeight = lineHeight * 10;
    
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    
    textarea.style.height = newHeight + 'px';
}

// ===================================
// ⭐ 진행단계 비교 유틸리티 함수
// ===================================
function compareStage(stageCode1, stageCode2) {
    /**
     * 두 진행단계 코드를 비교
     * @returns {number} -1: stage1이 더 앞, 0: 같음, 1: stage1이 더 뒤
     */
    const stage1 = stageOptions.find(s => s.code === stageCode1);
    const stage2 = stageOptions.find(s => s.code === stageCode2);
    
    if (!stage1 || !stage2) return 0;
    
    const order1 = stage1.sort_order || 0;
    const order2 = stage2.sort_order || 0;
    
    if (order1 < order2) return -1;
    if (order1 > order2) return 1;
    return 0;
}

function getStageName(stageCode) {
    /**
     * 진행단계 코드로 이름 조회
     */
    const stage = stageOptions.find(s => s.code === stageCode);
    return stage ? stage.code_name : stageCode;
}

// ===================================
// ⭐ 기본정보 탭 진행단계 업데이트 함수
// ===================================
async function updateBasicInfoStage(newStageCode, source = 'history') {
    /**
     * 기본정보 탭의 진행단계를 업데이트
     * @param {string} newStageCode - 새로운 진행단계 코드
     * @param {string} source - 업데이트 소스 ('history' 또는 'edit')
     */
    const currentStageEl = document.getElementById('current_stage');
    if (!currentStageEl) {
        console.error('❌ current_stage 요소를 찾을 수 없음');
        return false;
    }
    
    const currentStageCode = currentStageEl.value;
    const currentStageName = getStageName(currentStageCode);
    const newStageName = getStageName(newStageCode);
    
    const message = source === 'history' 
        ? `변경이력의 진행단계(${newStageName})가 현재 진행단계(${currentStageName})보다 나중입니다.\n\n기본정보 탭의 진행단계를 '${newStageName}'로 업데이트하시겠습니까?`
        : `이력 수정으로 진행단계가 '${newStageName}'로 변경되었습니다.\n\n기본정보 탭의 진행단계도 '${newStageName}'로 업데이트하시겠습니까?`;
    
    if (confirm(message)) {
        currentStageEl.value = newStageCode;
        console.log('✅ 기본정보 탭 진행단계 업데이트:', {
            from: currentStageCode,
            to: newStageCode,
            source: source
        });
        return true;
    }
    
    return false;
}

// ===================================
// 3.1 Histories Management (수정됨)
// ===================================
function addHistory() {
    const baseDateInput = document.getElementById('new_history_date');
    const stageSelect = document.getElementById('new_history_stage');
    const contentTextarea = document.getElementById('new_history_content');
    
    if (!baseDateInput || !stageSelect) {
        console.warn('⚠️ 이력 입력 요소를 찾을 수 없음');
        return;
    }
    
    const baseDate = baseDateInput.value;
    const progressStage = stageSelect.value;
    const strategyContent = contentTextarea ? contentTextarea.value.trim() : '';
    
    if (!baseDate) {
        alert('기준일을 입력하세요.');
        return;
    }
    
    if (!progressStage) {
        alert('진행단계를 선택하세요.');
        return;
    }
    
    // 진행단계명 찾기
    const selectedOption = stageOptions.find(opt => opt.code === progressStage);
    const stageName = selectedOption ? selectedOption.code_name : progressStage;
    
    // ⭐ 기본정보 탭 진행단계와 비교
    const currentStageEl = document.getElementById('current_stage');
    const currentStageCode = currentStageEl ? currentStageEl.value : '';
    
    if (currentStageCode && compareStage(progressStage, currentStageCode) > 0) {
        // 새 이력의 진행단계가 더 나중인 경우
        console.log('📊 진행단계 비교:', {
            current: currentStageCode,
            new: progressStage,
            result: '신규 이력이 더 나중'
        });
        
        // 비동기로 업데이트 (사용자 확인 후)
        updateBasicInfoStage(progressStage, 'history');
    }
    
    // ✅ 신규 이력 추가 (row_stat: 'N' 설정 필수)
    histories.push({
        history_id: null,  // 신규는 ID 없음
        base_date: baseDate,
        progress_stage: progressStage,
        strategy_content: strategyContent,
        stage_name: stageName,
        row_stat: 'N'  // ✅ 신규 표시
    });
    
    console.log('✅ 이력 추가:', { baseDate, progressStage, stageName, row_stat: 'N' });
    
    // 입력 필드 초기화
    baseDateInput.value = '';
    stageSelect.value = formMode === 'edit' && currentStageCode ? currentStageCode : 'S01';  // ⭐ 기본값 유지
    if (contentTextarea) {
        contentTextarea.value = '';
        contentTextarea.style.height = 'auto';
    }
    
    // 렌더링
    renderHistories();
}

// ===================================
// ⭐ 변경이력 수정 모달 상태 변수
// ===================================
// (이미 상단에 선언되어 있음)

// ===================================
// ⭐ 변경이력 수정 - 모달 사용 (기존 prompt 방식에서 개선)
// ===================================
function editHistory(index) {
    const hist = histories[index];
    
    // 수정 중인 인덱스 저장
    editingHistoryIndex = index;
    
    // 모달 열기
    const modal = document.getElementById('historyEditModal');
    if (!modal) {
        console.error('❌ historyEditModal을 찾을 수 없음');
        // 모달이 없으면 기존 prompt 방식으로 폴백
        const newContent = prompt('전략 내용을 입력하세요:', hist.strategy_content || '');
        if (newContent !== null && newContent !== hist.strategy_content) {
            histories[index].strategy_content = newContent.trim();
            if (hist.row_stat !== 'N' && hist.row_stat !== 'D') {
                histories[index].row_stat = 'U';
            }
            renderHistories();
        }
        return;
    }
    
    // 진행단계 select 옵션 채우기
    const stageSelect = document.getElementById('edit_history_stage');
    if (stageSelect) {
        stageSelect.innerHTML = '<option value="">진행단계 선택</option>';
        stageOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.code;
            option.textContent = opt.code_name;
            if (opt.code === hist.progress_stage) {
                option.selected = true;
            }
            stageSelect.appendChild(option);
        });
    }
    
    // 기존 데이터 채우기
    const dateInput = document.getElementById('edit_history_date');
    if (dateInput) dateInput.value = hist.base_date || '';
    
    const contentTextarea = document.getElementById('edit_history_content');
    if (contentTextarea) {
        contentTextarea.value = hist.strategy_content || '';
        // 높이 자동 조절
        autoResizeTextarea(contentTextarea);

        // ⭐ 마크다운 포맷팅 바인딩 추가
        bindMarkdownFormatting(contentTextarea);
    }
    
    // 모달 표시
    modal.classList.add('active');
    modal.style.display = 'flex';
    
    console.log('✏️ 이력 수정 모달 열림:', { index, hist });
}

// ===================================
// ⭐ 변경이력 수정 저장 (새로 추가된 함수)
// ===================================
function saveHistoryEdit() {
    if (editingHistoryIndex === null) {
        console.error('❌ 수정 중인 이력 인덱스가 없음');
        return;
    }
    
    const dateInput = document.getElementById('edit_history_date');
    const stageSelect = document.getElementById('edit_history_stage');
    const contentTextarea = document.getElementById('edit_history_content');
    
    if (!dateInput || !stageSelect || !contentTextarea) {
        console.error('❌ 수정 폼 요소를 찾을 수 없음');
        return;
    }
    
    const newDate = dateInput.value;
    const newStage = stageSelect.value;
    const newContent = contentTextarea.value.trim();
    
    // 필수 입력 확인
    if (!newDate) {
        alert('기준일을 입력하세요.');
        dateInput.focus();
        return;
    }
    
    if (!newStage) {
        alert('진행단계를 선택하세요.');
        stageSelect.focus();
        return;
    }
    
    const hist = histories[editingHistoryIndex];
    
    // 변경사항 확인
    const hasChanges = 
        newDate !== hist.base_date || 
        newStage !== hist.progress_stage || 
        newContent !== (hist.strategy_content || '');
    
    if (!hasChanges) {
        // 변경사항 없음
        closeHistoryEditModal();
        return;
    }
    
    // 진행단계명 찾기
    const selectedOption = stageOptions.find(opt => opt.code === newStage);
    const stageName = selectedOption ? selectedOption.code_name : newStage;
    
    // ⭐ 진행단계가 변경된 경우 기본정보 탭과 비교
    if (newStage !== hist.progress_stage) {
        const currentStageEl = document.getElementById('current_stage');
        const currentStageCode = currentStageEl ? currentStageEl.value : '';
        
        if (currentStageCode && compareStage(newStage, currentStageCode) > 0) {
            console.log('📊 진행단계 비교 (수정):', {
                current: currentStageCode,
                new: newStage,
                result: '수정된 이력이 더 나중'
            });
            
            // 비동기로 업데이트
            updateBasicInfoStage(newStage, 'edit');
        }
    }
    
    // 데이터 업데이트
    histories[editingHistoryIndex].base_date = newDate;
    histories[editingHistoryIndex].progress_stage = newStage;
    histories[editingHistoryIndex].strategy_content = newContent;
    histories[editingHistoryIndex].stage_name = stageName;
    
    // ✅ 신규(N)가 아니고 삭제(D)가 아니면 수정(U)으로 표시
    if (hist.row_stat !== 'N' && hist.row_stat !== 'D') {
        histories[editingHistoryIndex].row_stat = 'U';
        console.log('✅ 이력 수정:', { 
            index: editingHistoryIndex, 
            history_id: hist.history_id, 
            row_stat: 'U',
            changes: { newDate, newStage, newContent }
        });
    } else if (hist.row_stat === 'N') {
        console.log('✅ 신규 이력 수정:', { 
            index: editingHistoryIndex,
            changes: { newDate, newStage, newContent }
        });
    }
    
    // 모달 닫기
    closeHistoryEditModal();
    
    // 렌더링
    renderHistories();
}

// ===================================
// ⭐ 변경이력 수정 모달 닫기 (새로 추가된 함수)
// ===================================
function closeHistoryEditModal() {
    const modal = document.getElementById('historyEditModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    
    // 입력 필드 초기화
    const dateInput = document.getElementById('edit_history_date');
    if (dateInput) dateInput.value = '';
    
    const stageSelect = document.getElementById('edit_history_stage');
    if (stageSelect) stageSelect.value = '';
    
    const contentTextarea = document.getElementById('edit_history_content');
    if (contentTextarea) {
        contentTextarea.value = '';
        contentTextarea.style.height = 'auto';
    }
    
    editingHistoryIndex = null;
}

// ✅ 이력 삭제 함수
function deleteHistory(index) {
    const hist = histories[index];
    
    if (!confirm(`${hist.base_date} 이력을 삭제하시겠습니까?`)) {
        return;
    }
    
    // ✅ 신규(N)로 추가된 것은 배열에서 제거, 기존 데이터는 'D'로 표시
    if (hist.row_stat === 'N') {
        // 신규 추가된 것은 완전히 제거
        histories.splice(index, 1);
        console.log('✅ 신규 이력 제거:', { index });
    } else {
        // 기존 데이터는 삭제 표시
        histories[index].row_stat = 'D';
        console.log('✅ 기존 이력 삭제 표시:', { index, history_id: hist.history_id, row_stat: 'D' });
    }
    
    renderHistories();
}

// ✅ 이력 렌더링 함수 (입력 폼 포함 + textarea로 개선)
function renderHistories() {
    const container = document.getElementById('historiesList');
    if (!container) {
        console.error('❌ historiesList 컨테이너를 찾을 수 없음');
        return;
    }
    
    // ⭐ 현재 진행단계 가져오기 (수정 모드일 때 기본값으로 사용)
    const currentStageEl = document.getElementById('current_stage');
    const currentStageCode = currentStageEl ? currentStageEl.value : '';
    const defaultStage = (formMode === 'edit' && currentStageCode) ? currentStageCode : 'S01';
    
    let html = '';
    
    // ✅ 이력 추가 입력 폼 (textarea로 변경, 자동 높이 조절)
    html += `
        <div class="history-add-row" style="display: grid; grid-template-columns: auto auto 1fr auto; gap: 0.75rem; margin-bottom: 1rem; padding: 1rem; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; align-items: start; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <label style="font-size: 0.75rem; font-weight: 600; color: #555;">기준일</label>
                <input type="date" id="new_history_date" class="form-input" style="min-width: 150px;">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <label style="font-size: 0.75rem; font-weight: 600; color: #555;">진행단계</label>
                <select id="new_history_stage" class="form-select" style="min-width: 150px;">
                    <option value="">진행단계 선택</option>
    `;
    
    // ⭐ 진행단계 옵션 추가 (기본값 설정)
    stageOptions.forEach(opt => {
        const isSelected = opt.code === defaultStage;
        html += `<option value="${opt.code}" ${isSelected ? 'selected' : ''}>${opt.code_name}</option>`;
    });
    
    html += `
                </select>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <label style="font-size: 0.75rem; font-weight: 600; color: #555;">전략 내용 (여러 줄 입력 가능)</label>
                <textarea 
                    id="new_history_content" 
                    class="form-textarea" 
                    placeholder="전략 내용을 입력하세요.
여러 줄로 상세하게 작성할 수 있습니다."
                    style="
                        width: 100%; 
                        min-height: 90px;
                        max-height: 240px;
                        padding: 0.75rem; 
                        border: 1px solid #ddd; 
                        border-radius: 6px; 
                        font-family: inherit; 
                        font-size: 0.875rem; 
                        line-height: 1.5;
                        resize: vertical;
                        transition: border-color 0.2s, box-shadow 0.2s;
                    "
                    oninput="autoResizeTextarea(this)"
                    onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)';"
                    onblur="this.style.borderColor='#ddd'; this.style.boxShadow='none';"
                ></textarea>
            </div>
            
            <button type="button" class="btn btn-primary" onclick="addHistory()" style="align-self: end; white-space: nowrap; padding: 0.75rem 1.5rem; height: fit-content;">
                <i class="fas fa-plus"></i> 추가
            </button>
        </div>
    `;
    
    // 삭제 표시된 것 제외하고 표시
    const visibleHists = histories.filter(h => h.row_stat !== 'D');
    
    if (visibleHists.length === 0) {
        html += `
            <div style="text-align: center; padding: 3rem; color: #999; background: #fafafa; border-radius: 8px; border: 2px dashed #e0e0e0;">
                <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 1rem; color: #ccc;"></i>
                <p style="font-size: 1rem; font-weight: 500;">등록된 이력이 없습니다.</p>
                <p style="font-size: 0.875rem; color: #999; margin-top: 0.5rem;">위 입력 폼에서 새로운 이력을 추가해보세요.</p>
            </div>
        `;
    } else {
        html += '<div class="histories-list">';
        
        visibleHists.forEach((hist) => {
            // 실제 배열에서의 인덱스 찾기
            const realIndex = histories.indexOf(hist);
            
            const statusBadge = hist.row_stat === 'N' ? 
                '<span class="badge badge-new" style="background: #4caf50; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">신규</span>' : 
                (hist.row_stat === 'U' ? '<span class="badge badge-modified" style="background: #ff9800; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">수정됨</span>' : '');
            
            // 여러 줄 텍스트 표시를 위해 줄바꿈을 <br>로 변환
            const formattedContent = (hist.strategy_content || '-').replace(/\n/g, '<br>');
            
            html += `
                <div class="history-item" style="display: flex; gap: 1rem; padding: 1rem; background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow 0.2s;" onmouseenter="this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'" onmouseleave="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'">
                    <div class="history-info" style="flex: 1; display: grid; grid-template-columns: 100px 120px 1fr; gap: 1rem; align-items: start;">
                        <div class="history-date" style="font-weight: 600; color: #333;">
                            <i class="far fa-calendar-alt" style="color: #667eea; margin-right: 0.25rem;"></i>
                            ${Utils.formatDate(hist.base_date)}
                        </div>
                        <div class="history-stage" style="font-weight: 500; color: #555;">
                            <i class="fas fa-flag" style="color: #667eea; margin-right: 0.25rem;"></i>
                            ${hist.stage_name || hist.progress_stage}${statusBadge}
                        </div>
                        <div class="history-content" style="color: #666; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">
                            ${formattedContent}
                        </div>
                    </div>
                    <div class="history-actions" style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                        <button type="button" class="btn-icon" onclick="editHistory(${realIndex})" title="수정" style="background: #2196f3; color: white; border: none; padding: 0.5rem 0.75rem; border-radius: 4px; cursor: pointer; transition: background 0.2s;" onmouseenter="this.style.background='#1976d2'" onmouseleave="this.style.background='#2196f3'">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-icon btn-danger" onclick="deleteHistory(${realIndex})" title="삭제" style="background: #f44336; color: white; border: none; padding: 0.5rem 0.75rem; border-radius: 4px; cursor: pointer; transition: background 0.2s;" onmouseenter="this.style.background='#d32f2f'" onmouseleave="this.style.background='#f44336'">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    container.innerHTML = html;
    
    // ⭐ textarea 이벤트 리스너 재설정
    setTimeout(() => {
        const textarea = document.getElementById('new_history_content');
        if (textarea) {
            autoResizeTextarea(textarea);

            // ⭐ 마크다운 포맷팅 바인딩 추가
            bindMarkdownFormatting(textarea);
        }
    }, 0);
    
    console.log('📊 이력 렌더링:', {
        mode: formMode,
        defaultStage: defaultStage,
        total: histories.length,
        visible: visibleHists.length,
        new: histories.filter(h => h.row_stat === 'N').length,
        updated: histories.filter(h => h.row_stat === 'U').length,
        deleted: histories.filter(h => h.row_stat === 'D').length
    });
}

// 레거시 함수 호환성 유지
function removeHistory(index) {
    deleteHistory(index);
}

function updateHistory(index) {
    editHistory(index);
}

// ===================================
// Save Project
// ===================================
async function saveProject() {
    try {
        console.log('💾 ========================================');
        console.log('💾 프로젝트 저장 시작');
        console.log('💾 formMode:', formMode);
        console.log('💾 currentPipelineId:', currentPipelineId);
        console.log('💾 ========================================');
        
        // 필수 입력 확인
        const projectName = document.getElementById('project_name').value.trim();
        const fieldCode = document.getElementById('field_code').value;
        const currentStage = document.getElementById('current_stage').value;
        const managerId = document.getElementById('manager_id').value;
        
        if (!projectName) {
            alert('프로젝트명을 입력하세요.');
            document.getElementById('project_name').focus();
            return;
        }
        
        if (!fieldCode) {
            alert('사업분야를 선택하세요.');
            document.getElementById('field_code').focus();
            return;
        }
        
        if (!currentStage) {
            alert('진행단계를 선택하세요.');
            document.getElementById('current_stage').focus();
            return;
        }
        
        if (!managerId) {
            alert('담당자를 선택하세요.');
            document.getElementById('manager_id').focus();
            return;
        }
        
        Utils.showLoading(true);
        
        // ✅ 속성 데이터 준비 (row_stat이 있는 것만 전송)
        const attributesToSave = attributes
            .filter(a => a.row_stat)  // row_stat이 있는 것만 (N, U, D)
            .map(a => ({
                attr_code: a.attr_code,
                attr_value: a.attr_value || '',
                row_stat: a.row_stat
            }));
        
        // ✅ 이력 데이터 준비 (row_stat이 있는 것만 전송)
        const historiesToSave = histories
            .filter(h => h.row_stat)  // row_stat이 있는 것만 (N, U, D)
            .map(h => ({
                history_id: h.history_id || null,
                base_date: h.base_date,
                progress_stage: h.progress_stage,
                strategy_content: h.strategy_content || '',
                row_stat: h.row_stat
            }));
        
        // ⭐ 데이터 수집 (pipeline_id 포함)
        const projectData = {
            pipeline_id: formMode === 'edit' ? currentPipelineId : null,  // ⭐ 핵심: 수정 모드일 때 pipeline_id 전송
            project_name: projectName,
            field_code: fieldCode,
            current_stage: currentStage,
            manager_id: managerId,
            customer_id: selectedCustomerId || parseInt(document.getElementById('customer_id')?.value) || null,
            ordering_party_id: selectedOrderingPartyId || parseInt(document.getElementById('ordering_party_id')?.value) || null,
            quoted_amount: parseInt(document.getElementById('quoted_amount').value) || 0,
            win_probability: parseInt(document.getElementById('win_probability')?.value) || 0,
            notes: document.getElementById('notes')?.value?.trim() || '',
            user_id: window.currentUser?.login_id || 'system'
        };
        
        // ⭐ 핵심 수정: 변경사항이 있을 때만 키를 추가
        console.log('💾 저장 데이터 준비:');
        console.log('   - pipeline_id:', projectData.pipeline_id);
        console.log('   - 속성 배열:', attributes.length, '개 (row_stat 있음:', attributesToSave.length, '개)');
        console.log('   - 이력 배열:', histories.length, '개 (row_stat 있음:', historiesToSave.length, '개)');
        
        if (attributesToSave.length > 0) {
            projectData.attributes = attributesToSave;
            console.log('   ✅ 속성 변경 전송:', attributesToSave);
        } else {
            console.log('   ⚠️ 속성 변경 없음 → attributes 키 생략');
        }
        
        if (historiesToSave.length > 0) {
            projectData.histories = historiesToSave;
            console.log('   ✅ 이력 변경 전송:', historiesToSave);
        } else {
            console.log('   ⚠️ 이력 변경 없음 → histories 키 생략');
        }
        
        console.log('📤 최종 전송 데이터:', projectData);
        
        // ⭐ API 호출 - 신규/수정 모두 POST /project-detail/save 사용
        const response = await API.post(API_CONFIG.ENDPOINTS.PROJECT_SAVE, projectData);
        
        console.log('✅ 저장 응답:', response);
        
        // ✅ 신규 등록인 경우 → 수정 모드로 전환
        if (formMode === 'new' && response.pipeline_id) {
            // 모드 변경
            formMode = 'edit';
            currentPipelineId = response.pipeline_id;
            
            // pipeline_id 표시
            document.getElementById('pipeline_id').value = response.pipeline_id;
            
            // 제목 변경
            const titleElement = document.getElementById('formTitle');
            const titleIcon = titleElement.parentElement.querySelector('i');
            titleElement.textContent = '프로젝트 수정';
            if (titleIcon) titleIcon.className = 'fas fa-edit';
            
            Utils.showLoading(false);
            
            // 데이터 새로고침 (row_stat 초기화를 위해)
            await loadProjectData(response.pipeline_id);
            
            alert(`프로젝트가 등록되었습니다.\nPipeline ID: ${response.pipeline_id}`);
        } else {
            Utils.showLoading(false);
            
            // 수정 모드: 데이터 새로고침 (row_stat 초기화)
            await loadProjectData(currentPipelineId);
            
            alert('프로젝트가 수정되었습니다.');
        }
        
        // ✅ 목록으로 이동하지 않고 현재 화면 유지
        // 백그라운드에서 목록 데이터 갱신 (나중에 목록으로 돌아갈 때를 위해)
        if (typeof projectTable !== 'undefined' && projectTable) {
            projectTable.setData();
        }
        
    } catch (error) {
        console.error('❌ 저장 실패:', error);
        Utils.showLoading(false);
        alert('저장 중 오류가 발생했습니다.\n' + (error.message || ''));
    }
}

// ===================================
// Close Form (목록으로 돌아가기)
// ===================================
function closeProjectForm() {
    // 목록으로 이동
    navigateTo('projects-list');
    
    // 목록 데이터 새로고침
    if (typeof projectTable !== 'undefined' && projectTable) {
        projectTable.setData();
    }
}

// ===================================
// Cancel Form (변경 사항 확인 후 닫기)
// ===================================
function cancelProjectForm() {
    if (confirm('작성 중인 내용이 저장되지 않습니다. 목록으로 돌아가시겠습니까?')) {
        closeProjectForm();
    }
}

// Event listener for custom event
window.addEventListener('projectFormOpen', (e) => {
    const { mode, pipelineId } = e.detail;
    console.log('📨 projectFormOpen 이벤트 수신:', mode, pipelineId);
    initializeProjectForm(mode, pipelineId);
});

// ⭐ 모달 외부 클릭 시 닫기 (새로 추가)
window.addEventListener('click', function(event) {
    const modal = document.getElementById('historyEditModal');
    if (modal && event.target === modal) {
        closeHistoryEditModal();
    }
});

// ⭐ ESC 키로 모달 닫기 (새로 추가)
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('historyEditModal');
        if (modal && modal.classList.contains('active')) {
            closeHistoryEditModal();
        }
    }
});

// Export to window
window.initializeProjectForm = initializeProjectForm;
window.addAttribute = addAttribute;
window.removeAttribute = removeAttribute;
window.updateAttribute = updateAttribute;
window.editAttribute = editAttribute;
window.deleteAttribute = deleteAttribute;
window.addHistory = addHistory;
window.removeHistory = removeHistory;
window.updateHistory = updateHistory;
window.editHistory = editHistory;
window.deleteHistory = deleteHistory;
window.saveProject = saveProject;
window.cancelProjectForm = cancelProjectForm;
window.closeProjectForm = closeProjectForm;
window.openClientSearchModal = openClientSearchModal;
window.closeClientSearchModal = closeClientSearchModal;
window.searchClients = searchClients;
window.selectClient = selectClient;
window.autoResizeTextarea = autoResizeTextarea;
window.saveHistoryEdit = saveHistoryEdit;  // ⭐ 추가
window.closeHistoryEditModal = closeHistoryEditModal;  // ⭐ 추가

console.log('📦 Project Form 모듈 로드 완료');