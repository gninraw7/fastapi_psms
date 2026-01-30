// ===================================
// Project Form State
// ===================================
let formMode = 'new';  // 'new' or 'edit'
let currentPipelineId = null;
let attributes = [];
let histories = [];

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
    
    // 콤보박스 초기화
    await loadFormComboBoxes();
    
    // 탭 이벤트 바인딩
    initializeFormTabs();
    
    // 수정 모드면 데이터 로드
    if (mode === 'edit' && pipelineId) {
        await loadProjectData(pipelineId);
    } else {
        // 신규 모드면 폼 초기화
        resetForm();
    }
}

// ===================================
// Load ComboBoxes
// ===================================
async function loadFormComboBoxes() {
    try {
        // 진행단계
        const stageSelect = document.getElementById('current_stage');
        stageSelect.innerHTML = '<option value="">선택하세요</option>';
        Object.keys(window.STAGE_CONFIG).forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = window.STAGE_CONFIG[code].label;
            stageSelect.appendChild(opt);
        });
        
        // 사업분야
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
        
        // 담당자
        const managers = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
        const managerSelect = document.getElementById('manager_id');
        managerSelect.innerHTML = '<option value="">선택하세요</option>';
        if (managers && managers.items) {
            managers.items.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.manager_id;
                opt.textContent = m.manager_name;
                managerSelect.appendChild(opt);
            });
        }
        
        console.log('✅ 콤보박스 로딩 완료');
    } catch (error) {
        console.error('❌ 콤보박스 로딩 실패:', error);
    }
}

// ===================================
// Load Project Data (Edit Mode)
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
            document.getElementById('customer_name').value = project.customer_name || '';
            document.getElementById('ordering_party_name').value = project.ordering_party_name || '';
            document.getElementById('quoted_amount').value = project.quoted_amount || '';
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
    document.getElementById('current_stage').value = '';
    document.getElementById('manager_id').value = '';
    document.getElementById('customer_name').value = '';
    document.getElementById('ordering_party_name').value = '';
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
// Attributes Management
// ===================================
function addAttribute() {
    const newAttr = {
        id: Date.now(),  // 임시 ID
        attribute_name: '',
        attribute_value: '',
        isNew: true
    };
    
    attributes.push(newAttr);
    renderAttributes();
}

function removeAttribute(id) {
    attributes = attributes.filter(attr => attr.id !== id);
    renderAttributes();
}

function renderAttributes() {
    const container = document.getElementById('attributesList');
    
    if (attributes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>등록된 속성이 없습니다</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = attributes.map(attr => `
        <div class="attribute-item" data-id="${attr.id}">
            <input 
                type="text" 
                class="attr-name" 
                placeholder="속성명" 
                value="${attr.attribute_name || ''}"
                onchange="updateAttribute(${attr.id}, 'name', this.value)"
            >
            <input 
                type="text" 
                class="attr-value" 
                placeholder="속성값" 
                value="${attr.attribute_value || ''}"
                onchange="updateAttribute(${attr.id}, 'value', this.value)"
            >
            <button class="btn-delete" onclick="removeAttribute(${attr.id})">
                <i class="fas fa-trash"></i> 삭제
            </button>
        </div>
    `).join('');
}

function updateAttribute(id, field, value) {
    const attr = attributes.find(a => a.id === id);
    if (attr) {
        if (field === 'name') {
            attr.attribute_name = value;
        } else {
            attr.attribute_value = value;
        }
    }
}

// ===================================
// History Management
// ===================================
function addHistory() {
    const newHistory = {
        id: Date.now(),
        base_date: new Date().toISOString().split('T')[0],
        stage_code: '',
        description: '',
        isNew: true
    };
    
    histories.unshift(newHistory);  // 최신순 정렬
    renderHistories();
}

function removeHistory(id) {
    histories = histories.filter(h => h.id !== id);
    renderHistories();
}

function renderHistories() {
    const container = document.getElementById('historiesList');
    
    if (histories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>등록된 이력이 없습니다</p>
            </div>
        `;
        return;
    }
    
    // 진행단계 옵션 생성
    const stageOptions = Object.keys(window.STAGE_CONFIG).map(code => 
        `<option value="${code}">${window.STAGE_CONFIG[code].label}</option>`
    ).join('');
    
    container.innerHTML = histories.map(history => `
        <div class="history-item" data-id="${history.id}">
            <input 
                type="date" 
                value="${history.base_date || history.created_date || ''}"
                onchange="updateHistory(${history.id}, 'date', this.value)"
            >
            <select onchange="updateHistory(${history.id}, 'stage', this.value)">
                <option value="">선택</option>
                ${stageOptions}
            </select>
            <textarea 
                placeholder="변경 내용을 입력하세요"
                onchange="updateHistory(${history.id}, 'description', this.value)"
            >${history.description || history.strategy_content || ''}</textarea>
            <div class="history-actions">
                <button class="btn-delete" onclick="removeHistory(${history.id})" title="삭제">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // 선택된 값 설정
    histories.forEach(history => {
        const item = container.querySelector(`[data-id="${history.id}"]`);
        if (item) {
            const select = item.querySelector('select');
            if (select) {
                select.value = history.stage_code || history.progress_stage || '';
            }
        }
    });
}

function updateHistory(id, field, value) {
    const history = histories.find(h => h.id === id);
    if (history) {
        if (field === 'date') {
            history.base_date = value;
        } else if (field === 'stage') {
            history.stage_code = value;
        } else {
            history.description = value;
        }
    }
}

// ===================================
// Save Project
// ===================================
async function saveProject() {
    try {
        // 유효성 검사
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
        
        // 데이터 수집
        const projectData = {
            project_name: projectName,
            field_code: fieldCode,
            current_stage: currentStage,
            manager_id: managerId,
            customer_name: document.getElementById('customer_name').value.trim(),
            ordering_party_name: document.getElementById('ordering_party_name').value.trim(),
            quoted_amount: parseInt(document.getElementById('quoted_amount').value) || 0,
            win_probability: parseInt(document.getElementById('win_probability').value) || 0,
            notes: document.getElementById('notes').value.trim(),
            attributes: attributes,
            histories: histories
        };
        
        console.log('💾 저장 데이터:', projectData);
        
        // API 호출 (TODO: 실제 API 구현 필요)
        if (formMode === 'new') {
            // const response = await API.post('/projects', projectData);
            alert('신규 프로젝트가 저장되었습니다.\n(API 구현 필요)');
        } else {
            // const response = await API.put(`/projects/${currentPipelineId}`, projectData);
            alert('프로젝트가 수정되었습니다.\n(API 구현 필요)');
        }
        
        Utils.showLoading(false);
        
        // 목록으로 이동
        navigateTo('projects-list');
        if (projectTable) {
            projectTable.setData();
        }
        
    } catch (error) {
        console.error('❌ 저장 실패:', error);
        Utils.showLoading(false);
        alert('저장 중 오류가 발생했습니다.');
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
