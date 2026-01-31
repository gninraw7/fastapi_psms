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
 * 버그 수정 (2026-01-30):
 * - 아이콘 중복 표시 문제 해결 (formTitle 텍스트만 변경)
 * - 속성/이력 저장 로직 수정
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
            
            // 고객사/발주처 (ID와 이름 모두 설정)
            if (project.customer_id) {
                selectedCustomerId = project.customer_id;
                const customerIdEl = document.getElementById('customer_id');
                if (customerIdEl) customerIdEl.value = project.customer_id;
            }
            document.getElementById('customer_name').value = project.customer_name || '';
            
            if (project.ordering_party_id) {
                selectedOrderingPartyId = project.ordering_party_id;
                const orderingPartyIdEl = document.getElementById('ordering_party_id');
                if (orderingPartyIdEl) orderingPartyIdEl.value = project.ordering_party_id;
            }
            document.getElementById('ordering_party_name').value = project.ordering_party_name || '';
            
            document.getElementById('quoted_amount').value = project.quoted_amount || '';
            
            // 1.3 수주확률, 비고 (신규 필드)
            const winProbEl = document.getElementById('win_probability');
            if (winProbEl) winProbEl.value = project.win_probability || '';
            
            const notesEl = document.getElementById('notes');
            if (notesEl) notesEl.value = project.notes || '';
            
            // 속성 로드 - 기존 데이터는 row_stat을 빈값으로 (수정 시 'U'로 변경)
            attributes = (response.attributes || []).map(attr => ({
                ...attr,
                row_stat: ''  // 기존 데이터: 빈값 (변경 시 'U')
            }));
            renderAttributes();
            
            // 이력 로드 - 기존 데이터는 row_stat을 빈값으로
            histories = (response.histories || []).map(hist => ({
                ...hist,
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
// Client Search (고객사/발주처)
// ===================================
function initializeClientSearch() {
    // 고객사 검색 버튼
    const customerSearchBtn = document.getElementById('customer_search_btn');
    const customerNameInput = document.getElementById('customer_name');
    
    if (customerSearchBtn) {
        customerSearchBtn.addEventListener('click', () => openClientSearchModal('customer'));
    }
    if (customerNameInput) {
        customerNameInput.addEventListener('click', () => openClientSearchModal('customer'));
    }
    
    // 발주처 검색 버튼
    const orderingPartySearchBtn = document.getElementById('ordering_party_search_btn');
    const orderingPartyNameInput = document.getElementById('ordering_party_name');
    
    if (orderingPartySearchBtn) {
        orderingPartySearchBtn.addEventListener('click', () => openClientSearchModal('ordering_party'));
    }
    if (orderingPartyNameInput) {
        orderingPartyNameInput.addEventListener('click', () => openClientSearchModal('ordering_party'));
    }
}

// 고객사 검색 모달 열기
async function openClientSearchModal(target) {
    clientSearchTarget = target;
    clientSearchPage = 1;
    
    const modal = document.getElementById('clientSearchModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('clientSearchInput').value = '';
        await searchClients();
    }
}

// 고객사 검색
async function searchClients(page = 1) {
    const searchInput = document.getElementById('clientSearchInput');
    const keyword = searchInput?.value?.trim() || '';
    
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.CLIENTS}?keyword=${encodeURIComponent(keyword)}&page=${page}&page_size=10`);
        console.log('📥 고객사 검색 결과:', response);
        
        renderClientSearchResults(response.items || response.clients || []);
        renderClientPagination(response.total || 0, page);
    } catch (error) {
        console.error('❌ 고객사 검색 실패:', error);
    }
}

// 검색 결과 렌더링
function renderClientSearchResults(clients) {
    const container = document.getElementById('clientSearchResults');
    if (!container) return;
    
    if (clients.length === 0) {
        container.innerHTML = '<p class="no-data">검색 결과가 없습니다.</p>';
        return;
    }
    
    container.innerHTML = clients.map(client => `
        <div class="client-item" onclick="selectClient(${client.client_id}, '${client.client_name}')">
            <span class="client-name">${client.client_name}</span>
            <span class="client-type">${client.client_type || ''}</span>
        </div>
    `).join('');
}

// 페이지네이션 렌더링
function renderClientPagination(total, currentPage) {
    const container = document.getElementById('clientPagination');
    if (!container) return;
    
    const totalPages = Math.ceil(total / 10);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '';
    for (let i = 1; i <= totalPages && i <= 5; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="searchClients(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

// 고객사 선택
function selectClient(clientId, clientName) {
    if (clientSearchTarget === 'customer') {
        selectedCustomerId = clientId;
        const customerIdEl = document.getElementById('customer_id');
        if (customerIdEl) customerIdEl.value = clientId;
        document.getElementById('customer_name').value = clientName;
    } else {
        selectedOrderingPartyId = clientId;
        const orderingPartyIdEl = document.getElementById('ordering_party_id');
        if (orderingPartyIdEl) orderingPartyIdEl.value = clientId;
        document.getElementById('ordering_party_name').value = clientName;
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
    
    // 새 속성 추가
    const attrName = attributeOptions.find(o => o.code === attrCode)?.code_name || attrCode;
    const newAttr = {
        attr_code: attrCode,
        attr_name: attrName,
        attr_value: attrValue,
        row_stat: 'N'  // 신규
    };
    attributes.push(newAttr);
    
    console.log('➕ 속성 추가:', newAttr);
    
    // 입력 필드 초기화
    attrCodeSelect.value = '';
    if (attrValueInput) attrValueInput.value = '';
    
    renderAttributes();
}

function removeAttribute(index) {
    const attr = attributes[index];
    
    if (attr.row_stat === 'N') {
        // 신규 항목은 바로 삭제
        attributes.splice(index, 1);
        console.log('🗑️ 신규 속성 삭제');
    } else {
        // 기존 항목은 삭제 표시
        attributes[index].row_stat = 'D';
        console.log('🗑️ 기존 속성 삭제 표시:', attr.attr_code);
    }
    renderAttributes();
}

function updateAttribute(index, field, value) {
    const attr = attributes[index];
    const oldValue = attr[field];
    
    // 값이 변경된 경우에만 처리
    if (oldValue !== value) {
        attributes[index][field] = value;
        
        // 기존 데이터인 경우 (row_stat이 빈값) → 수정 표시
        if (attr.row_stat === '' || attr.row_stat === undefined) {
            attributes[index].row_stat = 'U';
            console.log('✏️ 속성 수정:', attr.attr_code, field, ':', oldValue, '→', value);
        }
    }
}

function renderAttributes() {
    const container = document.getElementById('attributesList');
    if (!container) return;
    
    // 2.1 속성 추가 영역 + 테이블
    let html = `
        <div class="attribute-add-row">
            <select id="new_attr_code" class="form-select">
                <option value="">속성명 선택</option>
                ${attributeOptions.map(opt => 
                    `<option value="${opt.code}">${opt.code_name}</option>`
                ).join('')}
            </select>
            <input type="text" id="new_attr_value" class="form-input" placeholder="속성값 입력">
            <button type="button" class="btn btn-sm btn-primary" onclick="addAttribute()">
                <i class="fas fa-plus"></i> 추가
            </button>
        </div>
    `;
    
    // 삭제되지 않은 속성만 필터링
    const visibleAttrs = attributes.filter(attr => attr.row_stat !== 'D');
    
    if (visibleAttrs.length > 0) {
        html += `
            <table class="attributes-table">
                <thead>
                    <tr>
                        <th style="width: 30%;">속성명</th>
                        <th style="width: 50%;">속성값</th>
                        <th style="width: 20%;">관리</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        attributes.forEach((attr, index) => {
            if (attr.row_stat === 'D') return;  // 삭제된 항목 숨김
            
            const attrName = attr.attr_name || attributeOptions.find(o => o.code === attr.attr_code)?.code_name || attr.attr_code;
            const rowClass = attr.row_stat === 'N' ? 'new-row' : (attr.row_stat === 'U' ? 'modified-row' : '');
            
            html += `
                <tr class="${rowClass}">
                    <td>${attrName}</td>
                    <td>
                        <input type="text" class="form-input" style="width: 95%;"
                            value="${attr.attr_value || ''}" 
                            onchange="window.updateAttribute(${index}, 'attr_value', this.value)">
                    </td>
                    <td style="text-align: center;">
                        <button type="button" class="btn btn-sm btn-danger" 
                            onclick="window.removeAttribute(${index})" title="삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
    } else {
        html += '<p class="no-data">등록된 속성이 없습니다. 위에서 속성을 추가하세요.</p>';
    }
    
    container.innerHTML = html;
}

// ===================================
// 3.1 Histories Management (수정됨)
// ===================================
function addHistory() {
    const today = new Date().toISOString().split('T')[0];
    const newHist = {
        history_id: null,  // 신규는 null
        base_date: today,
        progress_stage: 'S01',  // 3.1 기본값 S01
        strategy_content: '',
        row_stat: 'N'  // 신규
    };
    histories.push(newHist);
    console.log('➕ 이력 추가');
    renderHistories();
}

function removeHistory(index) {
    const hist = histories[index];
    
    if (hist.row_stat === 'N') {
        // 신규 항목은 바로 삭제
        histories.splice(index, 1);
        console.log('🗑️ 신규 이력 삭제');
    } else {
        // 기존 항목은 삭제 표시
        histories[index].row_stat = 'D';
        console.log('🗑️ 기존 이력 삭제 표시:', hist.history_id);
    }
    renderHistories();
}

function updateHistory(index, field, value) {
    const hist = histories[index];
    const oldValue = hist[field];
    
    // 값이 변경된 경우에만 처리
    if (oldValue !== value) {
        histories[index][field] = value;
        
        // 기존 데이터인 경우 (row_stat이 빈값) → 수정 표시
        if (hist.row_stat === '' || hist.row_stat === undefined) {
            histories[index].row_stat = 'U';
            console.log('✏️ 이력 수정:', hist.history_id, field, ':', oldValue, '→', value);
        }
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
    `;
    
    // 삭제되지 않은 이력만 필터링
    const visibleHists = histories.filter(hist => hist.row_stat !== 'D');
    
    if (visibleHists.length > 0) {
        html += `
            <table class="histories-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="width: 150px; padding: 8px 16px 8px 8px;">기준일</th>
                        <th style="width: 140px; padding: 8px 16px;">진행단계</th>
                        <th style="padding: 8px;">전략/내용</th>
                        <th style="width: 80px; padding: 8px;">관리</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        histories.forEach((hist, index) => {
            if (hist.row_stat === 'D') return;  // 삭제된 항목 숨김
            
            // 3.1 진행단계 콤보박스 옵션 생성
            const stageOptionsHtml = stageOptions.map(s => 
                `<option value="${s.code}" ${hist.progress_stage === s.code ? 'selected' : ''}>${s.code_name}</option>`
            ).join('');
            
            const rowClass = hist.row_stat === 'N' ? 'new-row' : (hist.row_stat === 'U' ? 'modified-row' : '');
            
            html += `
                <tr class="${rowClass}">
                    <td style="padding: 8px 16px 8px 8px; vertical-align: top;">
                        <input type="date" class="form-input" 
                            style="width: 130px;"
                            value="${hist.base_date || ''}" 
                            onchange="window.updateHistory(${index}, 'base_date', this.value)">
                    </td>
                    <td style="padding: 8px 16px; vertical-align: top;">
                        <select class="form-select" 
                            style="width: 110px;"
                            onchange="window.updateHistory(${index}, 'progress_stage', this.value)">
                            <option value="">선택</option>
                            ${stageOptionsHtml}
                        </select>
                    </td>
                    <td style="padding: 8px; vertical-align: top;">
                        <textarea class="form-textarea" rows="2" 
                            style="width: 98%; box-sizing: border-box; resize: vertical;"
                            onchange="window.updateHistory(${index}, 'strategy_content', this.value)">${hist.strategy_content || ''}</textarea>
                    </td>
                    <td style="text-align: center; padding: 8px; vertical-align: top;">
                        <button type="button" class="btn btn-sm btn-danger" 
                            onclick="window.removeHistory(${index})" title="삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
    } else {
        html += '<p class="no-data">등록된 이력이 없습니다. 위 버튼으로 이력을 추가하세요.</p>';
    }
    
    container.innerHTML = html;
}

// ===================================
// Save Project (✅ 수정됨 - 속성/이력 별도 저장)
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
        
        // 데이터 수집
        const projectData = {
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

window.addEventListener('projectFormOpen', (e) => {
    const { mode, pipelineId } = e.detail;
    console.log('📨 projectFormOpen 이벤트 수신:', mode, pipelineId);
    initializeProjectForm(mode, pipelineId);
});

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
window.closeProjectForm = closeProjectForm;
window.openClientSearchModal = openClientSearchModal;
window.closeClientSearchModal = closeClientSearchModal;
window.searchClients = searchClients;
window.selectClient = selectClient;

console.log('📦 Project Form 모듈 로드 완료');