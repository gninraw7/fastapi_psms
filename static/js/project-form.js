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

// ===================================
// Initialize Project Form
// ===================================
async function initializeProjectForm(mode = 'new', pipelineId = null) {
    formMode = mode;
    currentPipelineId = pipelineId;
    
    console.log('📝 폼 초기화:', mode, pipelineId);
    
    // 제목 변경
    const titleElement = document.getElementById('formTitle');
    if (mode === 'new') {
        titleElement.innerHTML = '<i class="fas fa-plus-circle"></i> 신규 프로젝트';
        document.getElementById('pipeline_id').value = '자동생성';
    } else {
        titleElement.innerHTML = '<i class="fas fa-edit"></i> 프로젝트 수정';
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
    }
}

// ===================================
// Load ComboBoxes (수정됨)
// ===================================
async function loadFormComboBoxes() {
    try {
        console.log('🔄 콤보박스 로딩 시작...');
        
        // 1.1 진행단계 (STAGE) - API에서 로드
        const stageSelect = document.getElementById('current_stage');
        stageSelect.innerHTML = '<option value="">선택하세요</option>';
        
        try {
            // 새로운 API 엔드포인트 사용
            const stages = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/STAGE`);
            console.log('📥 진행단계 데이터:', stages);
            
            if (stages && stages.items) {
                stageOptions = stages.items;
                stages.items.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.code;
                    opt.textContent = s.code_name;
                    stageSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.warn('⚠️ STAGE API 실패, 기본값 사용:', e);
            // 기본 STAGE_CONFIG 사용
            if (window.STAGE_CONFIG) {
                Object.keys(window.STAGE_CONFIG).forEach(code => {
                    const opt = document.createElement('option');
                    opt.value = code;
                    opt.textContent = window.STAGE_CONFIG[code].label;
                    stageSelect.appendChild(opt);
                });
            }
        }
        
        // 사업분야 (FIELD)
        const fields = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/FIELD`);
        const fieldSelect = document.getElementById('field_code');
        fieldSelect.innerHTML = '<option value="">선택하세요</option>';
        if (fields && fields.items) {
            fields.items.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.code;
                opt.textContent = f.code_name;
                fieldSelect.appendChild(opt);
            });
        }
        
        // 1.1 담당자 - 응답 형식 수정 반영
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
            console.warn('⚠️ PROJECT_ATTRIBUTE API 실패:', e);
        }
        
        console.log('✅ 콤보박스 로딩 완료');
    } catch (error) {
        console.error('❌ 콤보박스 로딩 실패:', error);
    }
}

// ===================================
// 1.2 고객사/발주처 선택 기능
// ===================================
function initializeClientSearch() {
    // 고객사 검색 버튼 이벤트
    const customerSearchBtn = document.getElementById('customer_search_btn');
    if (customerSearchBtn) {
        customerSearchBtn.addEventListener('click', () => openClientSearchModal('customer'));
    }
    
    // 발주처 검색 버튼 이벤트
    const orderingPartySearchBtn = document.getElementById('ordering_party_search_btn');
    if (orderingPartySearchBtn) {
        orderingPartySearchBtn.addEventListener('click', () => openClientSearchModal('ordering_party'));
    }
    
    // 고객사 입력 필드 클릭시 모달 열기
    const customerInput = document.getElementById('customer_name');
    if (customerInput) {
        customerInput.addEventListener('click', () => openClientSearchModal('customer'));
        customerInput.setAttribute('readonly', true);
        customerInput.style.cursor = 'pointer';
    }
    
    // 발주처 입력 필드 클릭시 모달 열기
    const orderingPartyInput = document.getElementById('ordering_party_name');
    if (orderingPartyInput) {
        orderingPartyInput.addEventListener('click', () => openClientSearchModal('ordering_party'));
        orderingPartyInput.setAttribute('readonly', true);
        orderingPartyInput.style.cursor = 'pointer';
    }
}

// 고객사 검색 모달 열기
function openClientSearchModal(target) {
    clientSearchTarget = target;
    clientSearchPage = 1;
    
    const modal = document.getElementById('clientSearchModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('clientSearchInput').value = '';
        document.getElementById('clientSearchInput').focus();
        loadClientSearchResults('');
    }
}

// 고객사 검색 모달 닫기
function closeClientSearchModal() {
    const modal = document.getElementById('clientSearchModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 고객사 검색 실행
async function searchClients() {
    const searchText = document.getElementById('clientSearchInput').value.trim();
    clientSearchPage = 1;
    await loadClientSearchResults(searchText);
}

// 고객사 검색 결과 로드 (페이징 포함)
async function loadClientSearchResults(searchText, page = 1) {
    const resultsContainer = document.getElementById('clientSearchResults');
    resultsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">검색 중...</p>';
    
    try {
        // 1.2 새로운 API 사용 (페이징 포함)
        const response = await API.get(`/api/v1/projects/clients/search`, {
            search_text: searchText,
            page: page,
            page_size: 10
        });
        
        console.log('📥 고객사 검색 결과:', response);
        
        const clients = response.items || [];
        
        if (clients.length === 0) {
            resultsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">검색 결과가 없습니다.</p>';
            updateClientPagination(response);
            return;
        }
        
        // 결과 테이블 생성
        let html = `
            <table class="client-search-table">
                <thead>
                    <tr>
                        <th>고객사명</th>
                        <th>사업자번호</th>
                        <th>대표자</th>
                        <th>선택</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        clients.forEach(client => {
            html += `
                <tr>
                    <td>${client.client_name || ''}</td>
                    <td>${client.business_number || ''}</td>
                    <td>${client.ceo_name || ''}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-primary" 
                            onclick="selectClient(${client.client_id}, '${escapeHtml(client.client_name)}')">
                            선택
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        resultsContainer.innerHTML = html;
        
        // 페이징 업데이트
        updateClientPagination(response);
        
    } catch (error) {
        console.error('❌ 고객사 검색 실패:', error);
        resultsContainer.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">검색 중 오류가 발생했습니다.</p>';
    }
}

// 페이징 UI 업데이트
function updateClientPagination(response) {
    const paginationContainer = document.getElementById('clientSearchPagination');
    if (!paginationContainer) return;
    
    const { page, total_pages, has_prev, has_next } = response;
    
    let html = '<div class="pagination-controls">';
    
    if (has_prev) {
        html += `<button type="button" class="btn btn-sm" onclick="goToClientPage(${page - 1})">이전</button>`;
    }
    
    html += `<span class="page-info">${page} / ${total_pages || 1}</span>`;
    
    if (has_next) {
        html += `<button type="button" class="btn btn-sm" onclick="goToClientPage(${page + 1})">다음</button>`;
    }
    
    html += '</div>';
    paginationContainer.innerHTML = html;
}

// 페이지 이동
function goToClientPage(page) {
    const searchText = document.getElementById('clientSearchInput').value.trim();
    clientSearchPage = page;
    loadClientSearchResults(searchText, page);
}

// 고객사 선택
function selectClient(clientId, clientName) {
    if (clientSearchTarget === 'customer') {
        selectedCustomerId = clientId;
        document.getElementById('customer_id').value = clientId;
        document.getElementById('customer_name').value = clientName;
    } else if (clientSearchTarget === 'ordering_party') {
        selectedOrderingPartyId = clientId;
        document.getElementById('ordering_party_id').value = clientId;
        document.getElementById('ordering_party_name').value = clientName;
    }
    
    closeClientSearchModal();
}

// HTML 이스케이프
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// Load Project Data (Edit Mode) - 수정됨
// ===================================
async function loadProjectData(pipelineId) {
    try {
        Utils.showLoading(true);
        console.log('📡 프로젝트 데이터 로딩:', pipelineId);
        
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
            
            // 고객사/발주처 (ID와 이름 모두 설정)
            if (project.customer_id) {
                selectedCustomerId = project.customer_id;
                document.getElementById('customer_id').value = project.customer_id;
            }
            document.getElementById('customer_name').value = project.customer_name || '';
            
            if (project.ordering_party_id) {
                selectedOrderingPartyId = project.ordering_party_id;
                document.getElementById('ordering_party_id').value = project.ordering_party_id;
            }
            document.getElementById('ordering_party_name').value = project.ordering_party_name || '';
            
            document.getElementById('quoted_amount').value = project.quoted_amount || '';
            
            // 1.3 수주확률, 비고 (신규 필드)
            document.getElementById('win_probability').value = project.win_probability || '';
            document.getElementById('notes').value = project.notes || '';
            
            // 속성 로드
            attributes = response.attributes || [];
            renderAttributes();
            
            // 이력 로드
            histories = response.histories || [];
            renderHistories();
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
    document.getElementById('customer_id').value = '';
    document.getElementById('customer_name').value = '';
    document.getElementById('ordering_party_id').value = '';
    document.getElementById('ordering_party_name').value = '';
    selectedCustomerId = null;
    selectedOrderingPartyId = null;
    
    document.getElementById('quoted_amount').value = '';
    document.getElementById('win_probability').value = '';
    document.getElementById('notes').value = '';
    
    attributes = [];
    histories = [];
    renderAttributes();
    renderHistories();
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
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });
}

// ===================================
// 2.1 Attributes Management (수정됨)
// ===================================
function addAttribute() {
    // 2.1 기존 속성과 중복 체크
    const attrCodeSelect = document.getElementById('new_attr_code');
    const attrValueInput = document.getElementById('new_attr_value');
    
    if (!attrCodeSelect || !attrValueInput) {
        // 입력 필드가 없으면 기본 방식
        const newAttr = {
            attr_code: '',
            attr_value: '',
            row_stat: 'N'
        };
        attributes.push(newAttr);
    } else {
        const attrCode = attrCodeSelect.value;
        const attrValue = attrValueInput.value.trim();
        
        if (!attrCode) {
            alert('속성명을 선택하세요.');
            return;
        }
        
        // 2.1 중복 체크
        const isDuplicate = attributes.some(attr => attr.attr_code === attrCode && attr.row_stat !== 'D');
        if (isDuplicate) {
            alert('이미 등록된 속성입니다.');
            return;
        }
        
        const newAttr = {
            attr_code: attrCode,
            attr_name: attributeOptions.find(o => o.code === attrCode)?.code_name || attrCode,
            attr_value: attrValue,
            row_stat: 'N'
        };
        attributes.push(newAttr);
        
        // 입력 필드 초기화
        attrCodeSelect.value = '';
        attrValueInput.value = '';
    }
    
    renderAttributes();
}

function removeAttribute(index) {
    if (attributes[index].row_stat === 'N') {
        // 신규 항목은 바로 삭제
        attributes.splice(index, 1);
    } else {
        // 기존 항목은 삭제 표시
        attributes[index].row_stat = 'D';
    }
    renderAttributes();
}

function updateAttribute(index, field, value) {
    attributes[index][field] = value;
    if (attributes[index].row_stat !== 'N') {
        attributes[index].row_stat = 'U';
    }
}

function renderAttributes() {
    const container = document.getElementById('attributesList');
    if (!container) return;
    
    // 2.1 속성 추가 영역
    let html = `
        <div class="attribute-add-row">
            <select id="new_attr_code" class="form-select">
                <option value="">속성명 선택</option>
                ${attributeOptions.map(opt => 
                    `<option value="${opt.code}">${opt.code_name}</option>`
                ).join('')}
            </select>
            <input type="text" id="new_attr_value" class="form-input" placeholder="속성값">
            <button type="button" class="btn btn-sm btn-primary" onclick="addAttribute()">
                <i class="fas fa-plus"></i> 추가
            </button>
        </div>
        <table class="attributes-table">
            <thead>
                <tr>
                    <th>속성명</th>
                    <th>속성값</th>
                    <th>삭제</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    attributes.forEach((attr, index) => {
        if (attr.row_stat === 'D') return;  // 삭제된 항목 숨김
        
        const attrName = attr.attr_name || attributeOptions.find(o => o.code === attr.attr_code)?.code_name || attr.attr_code;
        
        html += `
            <tr>
                <td>${attrName}</td>
                <td>
                    <input type="text" class="form-input" 
                        value="${attr.attr_value || ''}" 
                        onchange="updateAttribute(${index}, 'attr_value', this.value)">
                </td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeAttribute(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ===================================
// 3.1 Histories Management (수정됨)
// ===================================
function addHistory() {
    const today = new Date().toISOString().split('T')[0];
    const newHist = {
        base_date: today,
        progress_stage: 'S01',  // 3.1 기본값 S01
        strategy_content: '',
        row_stat: 'N'
    };
    histories.push(newHist);
    renderHistories();
}

function removeHistory(index) {
    if (histories[index].row_stat === 'N') {
        histories.splice(index, 1);
    } else {
        histories[index].row_stat = 'D';
    }
    renderHistories();
}

function updateHistory(index, field, value) {
    histories[index][field] = value;
    if (histories[index].row_stat !== 'N') {
        histories[index].row_stat = 'U';
    }
}

function renderHistories() {
    const container = document.getElementById('historiesList');
    if (!container) return;
    
    // 3.1 이력 추가 버튼
    let html = `
        <div class="history-add-row">
            <button type="button" class="btn btn-primary" onclick="addHistory()">
                <i class="fas fa-plus"></i> 이력 추가
            </button>
        </div>
        <table class="histories-table">
            <thead>
                <tr>
                    <th>기준일</th>
                    <th>진행단계</th>
                    <th>전략/내용</th>
                    <th>삭제</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    histories.forEach((hist, index) => {
        if (hist.row_stat === 'D') return;
        
        // 3.1 진행단계 콤보박스 옵션 생성
        const stageOptionsHtml = stageOptions.map(s => 
            `<option value="${s.code}" ${hist.progress_stage === s.code ? 'selected' : ''}>${s.code_name}</option>`
        ).join('');
        
        html += `
            <tr>
                <td>
                    <input type="date" class="form-input" 
                        value="${hist.base_date || ''}" 
                        onchange="updateHistory(${index}, 'base_date', this.value)">
                </td>
                <td>
                    <select class="form-select" onchange="updateHistory(${index}, 'progress_stage', this.value)">
                        <option value="">선택</option>
                        ${stageOptionsHtml}
                    </select>
                </td>
                <td>
                    <input type="text" class="form-input" 
                        value="${hist.strategy_content || ''}" 
                        onchange="updateHistory(${index}, 'strategy_content', this.value)">
                </td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeHistory(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// ===================================
// Save Project (수정됨 - win_probability, notes 포함)
// ===================================
async function saveProject() {
    try {
        // 필수 입력 검증
        const projectName = document.getElementById('project_name').value.trim();
        const fieldCode = document.getElementById('field_code').value;
        const currentStage = document.getElementById('current_stage').value;
        const managerId = document.getElementById('manager_id').value;
        
        if (!projectName) {
            alert('프로젝트명을 입력하세요.');
            return;
        }
        
        if (!fieldCode) {
            alert('사업분야를 선택하세요.');
            return;
        }
        
        if (!currentStage) {
            alert('진행단계를 선택하세요.');
            return;
        }
        
        if (!managerId) {
            alert('담당자를 선택하세요.');
            return;
        }
        
        Utils.showLoading(true);
        
        // 데이터 수집 (1.2, 1.3 수정 반영)
        const projectData = {
            project_name: projectName,
            field_code: fieldCode,
            current_stage: currentStage,
            manager_id: managerId,
            customer_id: selectedCustomerId || parseInt(document.getElementById('customer_id')?.value) || null,
            ordering_party_id: selectedOrderingPartyId || parseInt(document.getElementById('ordering_party_id')?.value) || null,
            quoted_amount: parseInt(document.getElementById('quoted_amount').value) || 0,
            win_probability: parseInt(document.getElementById('win_probability').value) || 0,  // 1.3 추가
            notes: document.getElementById('notes').value.trim(),  // 1.3 추가
            attributes: attributes.filter(a => a.row_stat !== 'D'),
            histories: histories.filter(h => h.row_stat !== 'D'),
            user_id: window.currentUser?.login_id || 'system'  // 현재 로그인 사용자
        };
        
        console.log('💾 저장 데이터:', projectData);
        
        // API 호출
        let response;
        if (formMode === 'new') {
            response = await API.post(API_CONFIG.ENDPOINTS.PROJECTS, projectData);
        } else {
            response = await API.put(`${API_CONFIG.ENDPOINTS.PROJECTS}/${currentPipelineId}`, projectData);
        }
        
        console.log('✅ 저장 응답:', response);
        
        Utils.showLoading(false);
        
        alert(formMode === 'new' 
            ? `프로젝트가 등록되었습니다.\nPipeline ID: ${response.pipeline_id}` 
            : '프로젝트가 수정되었습니다.'
        );
        
        // 목록으로 이동
        navigateTo('projects-list');
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
// Cancel Form
// ===================================
function cancelProjectForm() {
    if (confirm('작성 중인 내용이 저장되지 않습니다. 취소하시겠습니까?')) {
        navigateTo('projects-list');
    }
}

// Export to window
window.initializeProjectForm = initializeProjectForm;
window.addAttribute = addAttribute;
window.removeAttribute = removeAttribute;
window.updateAttribute = updateAttribute;
window.addHistory = addHistory;
window.removeHistory = removeHistory;
window.updateHistory = updateHistory;
window.saveProject = saveProject;
window.cancelProjectForm = cancelProjectForm;
window.openClientSearchModal = openClientSearchModal;
window.closeClientSearchModal = closeClientSearchModal;
window.searchClients = searchClients;
window.selectClient = selectClient;
window.goToClientPage = goToClientPage;
