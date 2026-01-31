// ===================================
// static/js/app.js
// 프로젝트 목록 화면 JavaScript
// 
// 버그 수정 (2026-01-30):
// - initializeTable의 Promise가 resolve되지 않아 이벤트 리스너가 등록되지 않는 문제 수정
// - 이벤트 리스너를 테이블 초기화와 독립적으로 바로 등록
// ===================================

// ===================================
// Global State
// ===================================
let projectTable = null;
let currentFilters = {
    search_field: '',
    search_text: '',
    manager_id: '',
    field_code: '',
    current_stage: '',
    page: 1,
    page_size: 25
};
let selectedRow = null;

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 PSMS 초기화 시작...');
    
    // 프로젝트 목록 페이지인지 확인
    const projectTableEl = document.getElementById('projectTable');
    
    if (!projectTableEl) {
        console.log('⚠️ projectTable 요소 없음, 초기화 스킵');
        return;
    }
    
    try {
        // 1. STAGE 설정 로드
        await loadStageConfig();
        
        // 2. 필터 초기화
        await initializeFilters();
        
        // 3. 테이블 초기화 (Promise 기다리지 않음)
        initializeTable();
        
        // 4. ⭐ 이벤트 리스너 즉시 등록 (테이블 빌드 기다리지 않음)
        initializeEventListeners();
        
        // 5. URL 파라미터 체크
        checkURLParameters();
        
        console.log('✅ 초기화 완료');
    } catch (error) {
        console.error('❌ 초기화 실패:', error);
    }
});

// ===================================
// URL Parameters Check
// ===================================
function checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const pipelineId = urlParams.get('pipeline_id');
    const page = urlParams.get('page');
    const mode = urlParams.get('mode');
    
    if (pipelineId && page === 'projects-new' && mode === 'edit') {
        console.log('📋 URL 파라미터 - 편집 모드:', pipelineId);
    } else if (pipelineId) {
        console.log('📋 URL 파라미터 발견:', pipelineId);
        setTimeout(() => {
            openProjectDetail(pipelineId);
        }, 1000);
    }
}

// ===================================
// Initialize Filter Options
// ===================================
async function initializeFilters() {
    try {
        console.log('📡 필터 데이터 로딩...');
        
        // 담당자 로드
        const managerSelect = document.getElementById('filterManager');
        if (managerSelect) {
            try {
                const managers = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
                if (managers && managers.items) {
                    managers.items.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.manager_id || m.login_id;
                        opt.textContent = m.manager_name || m.user_name;
                        managerSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.warn('⚠️ 담당자 로드 실패:', e);
            }
        }
        
        // 사업분야 로드
        const fieldSelect = document.getElementById('filterField');
        if (fieldSelect) {
            try {
                const fields = await API.get(API_CONFIG.ENDPOINTS.COMBO_DATA + '/FIELD');
                if (fields && fields.items) {
                    fields.items.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f.code;
                        opt.textContent = f.code_name;
                        fieldSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.warn('⚠️ 사업분야 로드 실패:', e);
            }
        }
        
        // 진행단계 로드
        const stageSelect = document.getElementById('filterStage');
        if (stageSelect) {
            try {
                const stages = await API.get(API_CONFIG.ENDPOINTS.COMBO_DATA + '/STAGE');
                console.log('📥 진행단계 데이터:', stages);
                
                if (stages && stages.items && stages.items.length > 0) {
                    stages.items.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.code;
                        opt.textContent = s.code_name;
                        stageSelect.appendChild(opt);
                    });
                    console.log('✅ 진행단계 콤보 로드 완료:', stages.items.length, '개');
                } else if (window.STAGE_CONFIG && Object.keys(window.STAGE_CONFIG).length > 0) {
                    console.warn('⚠️ STAGE API 응답 비어있음, STAGE_CONFIG 사용');
                    Object.keys(window.STAGE_CONFIG).forEach(code => {
                        const opt = document.createElement('option');
                        opt.value = code;
                        opt.textContent = window.STAGE_CONFIG[code].label;
                        stageSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.warn('⚠️ 진행단계 로드 실패:', e);
                if (window.STAGE_CONFIG) {
                    Object.keys(window.STAGE_CONFIG).forEach(code => {
                        const opt = document.createElement('option');
                        opt.value = code;
                        opt.textContent = window.STAGE_CONFIG[code].label;
                        stageSelect.appendChild(opt);
                    });
                }
            }
        }
        
        console.log('✅ 필터 로딩 완료');
    } catch (error) {
        console.error('❌ 필터 로딩 실패:', error);
    }
}

// ===================================
// Initialize Tabulator Table
// ⭐ Promise 제거 - 동기적으로 테이블 생성
// ===================================
function initializeTable() {
    console.log('📊 테이블 초기화...');
    
    const tableEl = document.getElementById('projectTable');
    if (!tableEl) {
        console.error('❌ projectTable 요소를 찾을 수 없음');
        return;
    }
    
    projectTable = new Tabulator("#projectTable", {
        height: "600px",
        layout: "fitDataStretch",
        pagination: true,
        paginationMode: "remote",
        paginationSize: 25,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: "데이터가 없습니다",
        
        selectable: 1,
        selectableRangeMode: "click",
        
        ajaxURL: API_CONFIG.BASE_URL + API_CONFIG.API_VERSION + API_CONFIG.ENDPOINTS.PROJECTS_LIST,
        
        ajaxURLGenerator: function(url, config, params) {
            const queryParams = {
                page: params.page || 1,
                page_size: params.size || 25
            };
            
            if (currentFilters.search_field) {
                queryParams.search_field = currentFilters.search_field;
            }
            if (currentFilters.search_text) {
                queryParams.search_text = currentFilters.search_text;
            }
            if (currentFilters.manager_id) {
                queryParams.manager_id = currentFilters.manager_id;
            }
            if (currentFilters.field_code) {
                queryParams.field_code = currentFilters.field_code;
            }
            if (currentFilters.current_stage) {
                queryParams.current_stage = currentFilters.current_stage;
            }
            
            const query = new URLSearchParams(queryParams);
            const finalUrl = url + '?' + query.toString();
            console.log('📡 API 호출:', finalUrl);
            return finalUrl;
        },
        
        ajaxResponse: function(url, params, response) {
            updateStatistics(response);
            return {
                last_page: response.total_pages || 1,
                data: response.items || []
            };
        },
        
        ajaxError: function(error) {
            console.error('❌ AJAX 에러:', error);
            return { last_page: 1, data: [] };
        },
        
        columns: [
            {
                formatter: "rowSelection",
                titleFormatter: "rowSelection",
                titleFormatterParams: { rowRange: "active" },
                hozAlign: "center",
                headerSort: false,
                width: 50,
                frozen: true
            },
            {
                title: "파이프라인ID",
                field: "pipeline_id",
                width: 120,
                frozen: true,
                headerSort: false,
                formatter: function(cell) {
                    const val = cell.getValue();
                    return '<span class="cell-pipeline-id" onclick="openProjectDetail(\'' + val + '\')">' + val + '</span>';
                }
            },
            {
                title: "분야",
                field: "field_name",
                width: 100,
                headerSort: false,
                hozAlign: "center"
            },
            {
                title: "프로젝트명",
                field: "project_name",
                minWidth: 300,
                headerSort: false,
                formatter: function(cell) {
                    return Utils.truncate(cell.getValue(), 50);
                }
            },
            {
                title: "고객사",
                field: "customer_name",
                width: 150,
                headerSort: false
            },
            {
                title: "발주처",
                field: "ordering_party_name",
                width: 150,
                headerSort: false
            },
            {
                title: "진행단계",
                field: "current_stage",
                width: 120,
                hozAlign: "center",
                headerSort: false,
                formatter: function(cell) {
                    return getStageBadge(cell.getValue());
                }
            },
            {
                title: "담당자",
                field: "manager_name",
                width: 100,
                hozAlign: "center",
                headerSort: false
            },
            {
                title: "견적금액",
                field: "quoted_amount",
                width: 130,
                hozAlign: "right",
                headerSort: false,
                formatter: function(cell) {
                    const val = cell.getValue();
                    return val ? Utils.formatNumber(val) + ' 원' : '-';
                }
            },
            {
                title: "등록일",
                field: "created_at",
                width: 110,
                hozAlign: "center",
                headerSort: false,
                formatter: function(cell) {
                    return Utils.formatDate(cell.getValue());
                }
            }
        ],
        
    });
    
    // ⭐ 이벤트는 .on() 메서드로 등록해야 함 (Tabulator 5.x)
    projectTable.on("rowSelected", function(row) {
        selectedRow = row;
        console.log('✅ Row 선택:', row.getData().pipeline_id);
        updateEditButton();
    });
    
    projectTable.on("rowDeselected", function(row) {
        selectedRow = null;
        console.log('🔲 Row 선택 해제');
        updateEditButton();
    });
    
    // ⭐ 행 클릭 시 선택 (체크박스 외 영역 클릭해도 선택되도록)
    projectTable.on("rowClick", function(e, row) {
        console.log('🖱️ 행 클릭');
        // 이미 선택된 행이면 선택 해제, 아니면 선택
        if (row.isSelected()) {
            row.deselect();
        } else {
            // 다른 행 선택 해제 후 현재 행 선택
            projectTable.deselectRow();
            row.select();
        }
    });
    
    // ⭐ 더블클릭 시 수정 화면 열기
    projectTable.on("rowDblClick", function(e, row) {
        var data = row.getData();
        console.log('🖱️ 더블클릭:', data.pipeline_id);
        if (typeof openProjectForm === 'function') {
            openProjectForm('edit', data.pipeline_id);
        } else {
            console.error('❌ openProjectForm 함수 없음');
        }
    });
    
    // 데이터 로드 완료 이벤트
    projectTable.on("dataLoaded", function(data) {
        console.log('✅ 데이터 로드 완료:', data.length, '건');
        selectedRow = null;
        updateEditButton();
    });
    
    console.log('✅ 테이블 생성 완료');
}

// ===================================
// Update Edit Button State
// ⭐ 수정: 선택 시 '열기'로 변경
// ===================================
function updateEditButton() {
    const btn = document.getElementById('btnAdd');
    if (!btn) {
        console.warn('⚠️ btnAdd 요소 없음');
        return;
    }
    
    console.log('🔄 버튼 상태 업데이트, selectedRow:', selectedRow ? 'exists' : 'null');
    
    if (selectedRow) {
        btn.innerHTML = '<i class="fas fa-folder-open"></i> 열기';
        btn.title = '선택한 프로젝트 열기';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
        console.log('  → 버튼: 열기');
    } else {
        btn.innerHTML = '<i class="fas fa-plus-circle"></i> 신규';
        btn.title = '새 프로젝트 추가';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
        console.log('  → 버튼: 신규');
    }
}

// ===================================
// Initialize Event Listeners
// ⭐ 핵심 수정: 모든 요소에 null 체크 추가
// ===================================
function initializeEventListeners() {
    console.log('🔧 이벤트 리스너 초기화 시작...');
    
    // 새로고침 버튼
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
            console.log('🔄 새로고침 클릭');
            if (projectTable) projectTable.setData();
        });
        console.log('  ✓ btnRefresh 이벤트 등록');
    } else {
        console.warn('  ✗ btnRefresh 요소 없음');
    }
    
    // 엑셀 내보내기 버튼
    const btnExport = document.getElementById('btnExport');
    if (btnExport) {
        btnExport.addEventListener('click', function() {
            console.log('📊 엑셀 내보내기 클릭');
            exportToExcel();
        });
        console.log('  ✓ btnExport 이벤트 등록');
    } else {
        console.warn('  ✗ btnExport 요소 없음');
    }
    
    // 신규/열기 버튼
    const btnAdd = document.getElementById('btnAdd');
    if (btnAdd) {
        btnAdd.addEventListener('click', function() {
            if (selectedRow) {
                const data = selectedRow.getData();
                console.log('📂 열기 클릭 - 편집 모드로 이동:', data.pipeline_id);
                if (typeof openProjectForm === 'function') {
                    openProjectForm('edit', data.pipeline_id);
                } else {
                    console.error('❌ openProjectForm 함수 없음');
                }
            } else {
                console.log('➕ 신규 클릭 - 신규 모드로 이동');
                if (typeof openProjectForm === 'function') {
                    openProjectForm('new');
                } else {
                    console.error('❌ openProjectForm 함수 없음');
                }
            }
        });
        console.log('  ✓ btnAdd 이벤트 등록');
    } else {
        console.warn('  ✗ btnAdd 요소 없음');
    }
    
    // 검색 필드 콤보박스
    const searchField = document.getElementById('searchField');
    if (searchField) {
        searchField.addEventListener('change', function(e) {
            currentFilters.search_field = e.target.value;
            console.log('🔍 검색필드 변경:', currentFilters.search_field);
        });
        console.log('  ✓ searchField 이벤트 등록');
    } else {
        console.warn('  ✗ searchField 요소 없음');
    }
    
    // 검색어 입력
    const searchText = document.getElementById('searchText');
    if (searchText) {
        searchText.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                currentFilters.search_text = e.target.value;
                console.log('🔍 검색 실행 (Enter):', currentFilters.search_text);
                if (projectTable) projectTable.setData();
            }
        });
        searchText.addEventListener('blur', function(e) {
            currentFilters.search_text = e.target.value;
        });
        console.log('  ✓ searchText 이벤트 등록');
    } else {
        console.warn('  ✗ searchText 요소 없음');
    }
    
    // 검색 버튼 (있는 경우에만)
    const btnSearch = document.getElementById('btnSearch');
    if (btnSearch) {
        btnSearch.addEventListener('click', function() {
            var searchTextEl = document.getElementById('searchText');
            currentFilters.search_text = searchTextEl ? searchTextEl.value : '';
            console.log('🔍 검색 실행 (버튼):', currentFilters.search_text);
            if (projectTable) projectTable.setData();
        });
        console.log('  ✓ btnSearch 이벤트 등록');
    }
    
    // 담당자 필터
    const filterManager = document.getElementById('filterManager');
    if (filterManager) {
        filterManager.addEventListener('change', function(e) {
            currentFilters.manager_id = e.target.value;
            console.log('🔍 담당자 필터:', currentFilters.manager_id);
            if (projectTable) projectTable.setData();
        });
        console.log('  ✓ filterManager 이벤트 등록');
    } else {
        console.warn('  ✗ filterManager 요소 없음');
    }
    
    // 사업분야 필터
    const filterField = document.getElementById('filterField');
    if (filterField) {
        filterField.addEventListener('change', function(e) {
            currentFilters.field_code = e.target.value;
            console.log('🔍 사업분야 필터:', currentFilters.field_code);
            if (projectTable) projectTable.setData();
        });
        console.log('  ✓ filterField 이벤트 등록');
    } else {
        console.warn('  ✗ filterField 요소 없음');
    }
    
    // 진행단계 필터
    const filterStage = document.getElementById('filterStage');
    if (filterStage) {
        filterStage.addEventListener('change', function(e) {
            currentFilters.current_stage = e.target.value;
            console.log('🔍 진행단계 필터:', currentFilters.current_stage);
            if (projectTable) projectTable.setData();
        });
        console.log('  ✓ filterStage 이벤트 등록');
    } else {
        console.warn('  ✗ filterStage 요소 없음');
    }
    
    // 페이지 크기 (있는 경우)
    const pageSize = document.getElementById('pageSize');
    if (pageSize) {
        pageSize.addEventListener('change', function(e) {
            const size = parseInt(e.target.value, 10);
            console.log('📄 페이지 크기 변경:', size);
            if (projectTable) projectTable.setPageSize(size);
        });
        console.log('  ✓ pageSize 이벤트 등록');
    }
    
    // 모달 닫기 버튼
    document.querySelectorAll('.modal-close').forEach(function(btn) {
        btn.addEventListener('click', closeModal);
    });
    
    // 모달 배경 클릭 시 닫기
    const projectModal = document.getElementById('projectModal');
    if (projectModal) {
        projectModal.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal')) {
                closeModal();
            }
        });
    }
    
    console.log('✅ 이벤트 리스너 초기화 완료');
}

// ===================================
// Open Project Detail Modal
// ===================================
async function openProjectDetail(pipelineId) {
    console.log('📋 프로젝트 상세 조회:', pipelineId);
    
    try {
        Utils.showLoading(true);
        
        const response = await API.get(API_CONFIG.ENDPOINTS.PROJECT_DETAIL + '/' + pipelineId + '/full');
        console.log('📥 상세 데이터:', response);
        
        Utils.showLoading(false);
        
        renderProjectDetail(response, pipelineId);
        
        const modal = document.getElementById('projectModal');
        if (modal) modal.classList.add('active');
        
    } catch (error) {
        console.error('❌ 상세 조회 실패:', error);
        Utils.showLoading(false);
        alert('프로젝트 정보를 불러오는데 실패했습니다.');
    }
}

// ===================================
// Render Project Detail
// ===================================
function renderProjectDetail(response, pipelineId) {
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;
    
    const project = response.project || response;
    const attributes = response.attributes || [];
    const histories = response.histories || [];
    
    var attrRows = '';
    if (attributes.length > 0) {
        attributes.forEach(function(a) {
            attrRows += '<tr><td>' + (a.attribute_name || a.attr_name || a.attr_code) + '</td><td>' + (a.attribute_value || a.attr_value || '-') + '</td></tr>';
        });
    }
    
    var histRows = '';
    if (histories.length > 0) {
        histories.forEach(function(h) {
            histRows += '<tr><td>' + Utils.formatDate(h.history_date || h.base_date) + '</td><td>' + getStageBadge(h.progress_stage) + '</td><td>' + (h.strategy_content || '-') + '</td><td>' + (h.creator_name || h.creator_id || '-') + '</td></tr>';
        });
    }
    
    var html = '<div class="detail-header">' +
        '<h2>' + (project.project_name || pipelineId) + '</h2>' +
        '<div class="detail-actions">' +
            '<button class="btn btn-primary" onclick="editProject(\'' + pipelineId + '\')">' +
                '<i class="fas fa-edit"></i> 편집' +
            '</button>' +
        '</div>' +
    '</div>' +
    
    '<div class="detail-tabs">' +
        '<button class="detail-tab active" onclick="switchDetailTab(this, \'basic\')">기본정보</button>' +
        '<button class="detail-tab" onclick="switchDetailTab(this, \'attributes\')">속성정보</button>' +
        '<button class="detail-tab" onclick="switchDetailTab(this, \'history\')">변경이력</button>' +
    '</div>' +
    
    '<div id="detail-basic" class="detail-pane active">' +
        '<div class="detail-grid">' +
            '<div class="detail-item"><label>파이프라인 ID</label><span>' + (project.pipeline_id || '-') + '</span></div>' +
            '<div class="detail-item"><label>프로젝트명</label><span>' + (project.project_name || '-') + '</span></div>' +
            '<div class="detail-item"><label>사업분야</label><span>' + (project.field_name || project.field_code || '-') + '</span></div>' +
            '<div class="detail-item"><label>진행단계</label><span>' + getStageBadge(project.current_stage) + '</span></div>' +
            '<div class="detail-item"><label>담당자</label><span>' + (project.manager_name || '-') + '</span></div>' +
            '<div class="detail-item"><label>고객사</label><span>' + (project.customer_name || '-') + '</span></div>' +
            '<div class="detail-item"><label>발주처</label><span>' + (project.ordering_party_name || '-') + '</span></div>' +
            '<div class="detail-item"><label>견적금액</label><span>' + (project.quoted_amount ? Utils.formatNumber(project.quoted_amount) + ' 원' : '-') + '</span></div>' +
            '<div class="detail-item"><label>수주확률</label><span>' + (project.win_probability ? project.win_probability + '%' : '-') + '</span></div>' +
            '<div class="detail-item full-width"><label>비고</label><span>' + (project.notes || '-') + '</span></div>' +
        '</div>' +
    '</div>' +
    
    '<div id="detail-attributes" class="detail-pane">' +
        (attributes.length > 0 ? 
            '<table class="detail-table"><thead><tr><th>속성</th><th>값</th></tr></thead><tbody>' + attrRows + '</tbody></table>' 
            : '<p class="no-data">등록된 속성이 없습니다.</p>') +
    '</div>' +
    
    '<div id="detail-history" class="detail-pane">' +
        (histories.length > 0 ? 
            '<table class="detail-table"><thead><tr><th>일자</th><th>진행단계</th><th>내용</th><th>작성자</th></tr></thead><tbody>' + histRows + '</tbody></table>'
            : '<p class="no-data">등록된 이력이 없습니다.</p>') +
    '</div>';
    
    modalBody.innerHTML = html;
}

// ===================================
// Switch Detail Tab
// ===================================
function switchDetailTab(btn, tabId) {
    document.querySelectorAll('.detail-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.detail-pane').forEach(function(p) { p.classList.remove('active'); });
    
    btn.classList.add('active');
    var pane = document.getElementById('detail-' + tabId);
    if (pane) pane.classList.add('active');
}

// ===================================
// Edit Project
// ===================================
function editProject(pipelineId) {
    console.log('✏️ 편집 화면으로 이동:', pipelineId);
    closeModal();
    if (typeof openProjectForm === 'function') {
        openProjectForm('edit', pipelineId);
    }
}

// ===================================
// Close Modal
// ===================================
function closeModal() {
    var modal = document.getElementById('projectModal');
    if (modal) modal.classList.remove('active');
}

// ===================================
// Update Statistics
// ===================================
function updateStatistics(response) {
    var statTotal = document.getElementById('statTotal');
    if (statTotal) {
        statTotal.textContent = response.total || response.total_records || 0;
    }
    
    if (response.stats) {
        Object.keys(response.stats).forEach(function(stage) {
            var el = document.getElementById('stat' + stage);
            if (el) el.textContent = response.stats[stage] || 0;
        });
    }
}

// ===================================
// Export to Excel
// ===================================
function exportToExcel() {
    console.log('📊 엑셀 내보내기');
    if (projectTable) {
        projectTable.download("xlsx", "프로젝트_목록.xlsx", {
            sheetName: "프로젝트"
        });
    } else {
        console.error('❌ projectTable이 없음');
        alert('테이블이 초기화되지 않았습니다.');
    }
}

// ===================================
// Export to window
// ===================================
window.openProjectDetail = openProjectDetail;
window.editProject = editProject;
window.switchDetailTab = switchDetailTab;
window.closeModal = closeModal;
window.exportToExcel = exportToExcel;

console.log('📦 app.js 모듈 로드 완료');