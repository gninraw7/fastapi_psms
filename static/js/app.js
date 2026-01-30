// ===================================
// static/js/app.js (수정 버전)
// 프로젝트 목록에서 수정 화면으로 분기 기능 추가
// 
// 버그 수정 (2026-01-30):
// 1. 진행단계 콤보 로드 - API 직접 호출로 변경
// 2. 검색필드 조건 적용 - search_field, search_text 파라미터 사용
// 3. 페이지 크기 기본값 25로 변경 (상단 필터의 pageSize 콤보 삭제됨)
// ===================================

// ===================================
// Global State
// ===================================
let projectTable = null;
let currentFilters = {
    search_field: '',   // ⭐ snake_case로 통일
    search_text: '',    // ⭐ snake_case로 통일
    manager_id: '',
    field_code: '',
    current_stage: '',
    page: 1,
    page_size: 25       // ⭐ 기본값 25로 변경
};
let selectedRow = null;  // 선택된 Row 추적

// ===================================
// Initialization
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 PSMS 초기화 시작...');
    
    try {
        await loadStageConfig();
        await initializeFilters();
        await initializeTable();
        initializeEventListeners();
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
        // 편집 모드로 직접 접근한 경우
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
// ⭐ 버그 수정: 진행단계 콤보 API 직접 호출
// ===================================
async function initializeFilters() {
    try {
        console.log('📡 필터 데이터 로딩...');
        
        // 담당자 로드
        const managers = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
        const managerSelect = document.getElementById('filterManager');
        if (managers && managers.items) {
            managers.items.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.manager_id || m.login_id;
                opt.textContent = m.manager_name || m.user_name;
                managerSelect.appendChild(opt);
            });
        }
        
        // 사업분야 로드
        const fields = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/FIELD`);
        const fieldSelect = document.getElementById('filterField');
        if (fields && fields.items) {
            fields.items.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.code;
                opt.textContent = f.code_name;
                fieldSelect.appendChild(opt);
            });
        }
        
        // ⭐ 버그 수정: 진행단계 - API에서 직접 로드
        const stageSelect = document.getElementById('filterStage');
        try {
            const stages = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/STAGE`);
            console.log('📥 진행단계 데이터:', stages);
            
            if (stages && stages.items && stages.items.length > 0) {
                stages.items.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.code;
                    opt.textContent = s.code_name;
                    stageSelect.appendChild(opt);
                });
                console.log('✅ 진행단계 콤보 로드 완료:', stages.items.length, '개');
            } else {
                // API 응답이 비어있으면 window.STAGE_CONFIG 사용
                console.warn('⚠️ STAGE API 응답 비어있음, STAGE_CONFIG 사용');
                loadStageFromConfig(stageSelect);
            }
        } catch (stageError) {
            console.warn('⚠️ STAGE API 실패, STAGE_CONFIG 사용:', stageError);
            loadStageFromConfig(stageSelect);
        }
        
        console.log('✅ 필터 로딩 완료');
    } catch (error) {
        console.error('❌ 필터 로딩 실패:', error);
    }
}

/**
 * STAGE_CONFIG에서 진행단계 콤보 로드 (폴백)
 */
function loadStageFromConfig(stageSelect) {
    if (window.STAGE_CONFIG && Object.keys(window.STAGE_CONFIG).length > 0) {
        Object.keys(window.STAGE_CONFIG).forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = window.STAGE_CONFIG[code].label;
            stageSelect.appendChild(opt);
        });
        console.log('✅ STAGE_CONFIG에서 로드 완료');
    } else {
        console.error('❌ STAGE_CONFIG도 비어있음');
    }
}

// ===================================
// Initialize Tabulator Table
// ⭐ 버그 수정: 페이지 크기 기본값 25
// ===================================
function initializeTable() {
    return new Promise((resolve, reject) => {
        console.log('📊 테이블 초기화...');
        
        projectTable = new Tabulator("#projectTable", {
            height: "600px",
            layout: "fitDataStretch",
            pagination: true,
            paginationMode: "remote",
            paginationSize: 25,                       // ⭐ 기본값 25로 변경
            paginationSizeSelector: [25, 50, 100, 200],
            placeholder: "데이터가 없습니다",
            
            // Row 선택 설정 (단일 선택)
            selectable: 1,
            selectableRangeMode: "click",
            
            ajaxURL: `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${API_CONFIG.ENDPOINTS.PROJECTS_LIST}`,
            
            // ⭐ 버그 수정: search_field, search_text 파라미터 전달
            ajaxURLGenerator: function(url, config, params) {
                const query = new URLSearchParams({
                    page: params.page || 1,
                    page_size: params.size || 25,     // ⭐ 기본값 25
                    ...(currentFilters.search_field && { search_field: currentFilters.search_field }),
                    ...(currentFilters.search_text && { search_text: currentFilters.search_text }),
                    ...(currentFilters.manager_id && { manager_id: currentFilters.manager_id }),
                    ...(currentFilters.field_code && { field_code: currentFilters.field_code }),
                    ...(currentFilters.current_stage && { current_stage: currentFilters.current_stage })
                });
                
                const finalUrl = `${url}?${query.toString()}`;
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
                // 체크박스 컬럼
                {
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    titleFormatterParams: {
                        rowRange: "active"
                    },
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
                        return `<span class="cell-pipeline-id" onclick="openProjectDetail('${val}')">${val}</span>`;
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
            
            // Row 선택 이벤트
            rowSelected: function(row) {
                selectedRow = row;
                updateEditButton();
                console.log('✅ Row 선택:', row.getData().pipeline_id);
            },
            
            rowDeselected: function(row) {
                selectedRow = null;
                updateEditButton();
                console.log('🔲 Row 선택 해제');
            },
            
            // 테이블 빌드 완료 이벤트
            tableBuilt: function() {
                console.log('✅ 테이블 빌드 완료');
                resolve();
            }
        });
        
        projectTable.on("dataLoaded", function(data) {
            console.log('✅ 데이터 로드 완료:', data.length, '건');
            selectedRow = null;
            updateEditButton();
        });
    });
}

// ===================================
// Update Edit Button State
// ===================================
function updateEditButton() {
    const btn = document.getElementById('btnAdd');
    if (!btn) return;
    
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span') || btn;
    
    if (selectedRow) {
        // 선택된 Row가 있으면 "편집" 모드
        if (icon) icon.className = 'fas fa-edit';
        if (text.tagName === 'SPAN') {
            text.textContent = ' 편집';
        } else {
            btn.innerHTML = '<i class="fas fa-edit"></i> 편집';
        }
        btn.title = '선택한 프로젝트 편집';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
    } else {
        // 선택된 Row가 없으면 "신규" 모드
        if (icon) icon.className = 'fas fa-plus-circle';
        if (text.tagName === 'SPAN') {
            text.textContent = ' 신규';
        } else {
            btn.innerHTML = '<i class="fas fa-plus-circle"></i> 신규';
        }
        btn.title = '새 프로젝트 추가';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
    }
}

// ===================================
// Initialize Event Listeners
// ⭐ 버그 수정: 검색필드 조건 적용, pageSize 이벤트 제거
// ===================================
function initializeEventListeners() {
    // 새로고침 버튼
    document.getElementById('btnRefresh').addEventListener('click', () => {
        projectTable.setData();
    });
    
    // 엑셀 내보내기 버튼
    document.getElementById('btnExport').addEventListener('click', exportToExcel);
    
    // ⭐ 신규/편집 버튼 - 수정됨
    document.getElementById('btnAdd').addEventListener('click', () => {
        if (selectedRow) {
            // 선택된 Row가 있으면 편집 모드로 이동
            const data = selectedRow.getData();
            console.log('✏️ 편집 모드로 이동:', data.pipeline_id);
            openProjectForm('edit', data.pipeline_id);
        } else {
            // 선택된 Row가 없으면 신규 모드로 이동
            console.log('➕ 신규 모드로 이동');
            openProjectForm('new');
        }
    });
    
    // ⭐ 버그 수정: 검색 필터 이벤트 - search_field 사용
    document.getElementById('searchField').addEventListener('change', (e) => {
        currentFilters.search_field = e.target.value;
        console.log('🔍 검색필드 변경:', currentFilters.search_field);
    });
    
    // ⭐ 버그 수정: 검색어 입력 - search_text 사용
    document.getElementById('searchText').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentFilters.search_text = e.target.value;
            console.log('🔍 검색 실행 (Enter):', currentFilters.search_field, currentFilters.search_text);
            projectTable.setData();
        }
    });
    
    // 검색 버튼 클릭
    document.getElementById('btnSearch').addEventListener('click', () => {
        currentFilters.search_text = document.getElementById('searchText').value;
        console.log('🔍 검색 실행 (버튼):', currentFilters.search_field, currentFilters.search_text);
        projectTable.setData();
    });
    
    // 담당자 필터
    document.getElementById('filterManager').addEventListener('change', (e) => {
        currentFilters.manager_id = e.target.value;
        projectTable.setData();
    });
    
    // 사업분야 필터
    document.getElementById('filterField').addEventListener('change', (e) => {
        currentFilters.field_code = e.target.value;
        projectTable.setData();
    });
    
    // 진행단계 필터
    document.getElementById('filterStage').addEventListener('change', (e) => {
        currentFilters.current_stage = e.target.value;
        console.log('🔍 진행단계 필터:', currentFilters.current_stage);
        projectTable.setData();
    });
    
    // ⭐ pageSize 이벤트 제거됨 (그리드 하단의 paginationSizeSelector 사용)
    
    // 모달 닫기 버튼
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // 모달 배경 클릭 시 닫기
    document.getElementById('projectModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
    
    console.log('✅ 이벤트 리스너 초기화 완료');
}

// ===================================
// Open Project Detail Modal
// ===================================
async function openProjectDetail(pipelineId) {
    console.log('📋 프로젝트 상세 조회:', pipelineId);
    
    try {
        Utils.showLoading(true);
        
        // 전체 상세 정보 API 호출 (속성, 이력 포함)
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECT_DETAIL}/${pipelineId}/full`);
        
        console.log('📥 상세 데이터:', response);
        
        Utils.showLoading(false);
        
        // 모달 렌더링
        renderProjectDetail(response, pipelineId);
        
        // 모달 열기
        document.getElementById('projectModal')?.classList.add('active');
        
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
    
    const html = `
        <div class="detail-header">
            <h2>${project.project_name || pipelineId}</h2>
            <div class="detail-actions">
                <button class="btn btn-primary" onclick="editProject('${pipelineId}')">
                    <i class="fas fa-edit"></i> 편집
                </button>
            </div>
        </div>
        
        <div class="detail-tabs">
            <button class="detail-tab active" onclick="switchDetailTab(this, 'basic')">기본정보</button>
            <button class="detail-tab" onclick="switchDetailTab(this, 'attributes')">속성정보</button>
            <button class="detail-tab" onclick="switchDetailTab(this, 'history')">변경이력</button>
        </div>
        
        <div id="detail-basic" class="detail-pane active">
            <div class="detail-grid">
                <div class="detail-item">
                    <label>파이프라인 ID</label>
                    <span>${project.pipeline_id || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>프로젝트명</label>
                    <span>${project.project_name || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>사업분야</label>
                    <span>${project.field_name || project.field_code || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>진행단계</label>
                    <span>${getStageBadge(project.current_stage)}</span>
                </div>
                <div class="detail-item">
                    <label>담당자</label>
                    <span>${project.manager_name || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>고객사</label>
                    <span>${project.customer_name || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>발주처</label>
                    <span>${project.ordering_party_name || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>견적금액</label>
                    <span>${project.quoted_amount ? Utils.formatNumber(project.quoted_amount) + ' 원' : '-'}</span>
                </div>
                <div class="detail-item">
                    <label>수주확률</label>
                    <span>${project.win_probability ? project.win_probability + '%' : '-'}</span>
                </div>
                <div class="detail-item full-width">
                    <label>비고</label>
                    <span>${project.notes || '-'}</span>
                </div>
            </div>
        </div>
        
        <div id="detail-attributes" class="detail-pane">
            ${attributes.length > 0 ? `
                <table class="detail-table">
                    <thead>
                        <tr>
                            <th>속성</th>
                            <th>값</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${attributes.map(a => `
                            <tr>
                                <td>${a.attribute_name || a.attribute_code}</td>
                                <td>${a.attribute_value || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="no-data">등록된 속성이 없습니다.</p>'}
        </div>
        
        <div id="detail-history" class="detail-pane">
            ${histories.length > 0 ? `
                <table class="detail-table">
                    <thead>
                        <tr>
                            <th>일자</th>
                            <th>진행단계</th>
                            <th>내용</th>
                            <th>작성자</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${histories.map(h => `
                            <tr>
                                <td>${Utils.formatDate(h.history_date)}</td>
                                <td>${getStageBadge(h.progress_stage)}</td>
                                <td>${h.strategy_content || '-'}</td>
                                <td>${h.creator_name || h.creator_id || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="no-data">등록된 이력이 없습니다.</p>'}
        </div>
    `;
    
    modalBody.innerHTML = html;
}

// ===================================
// Switch Detail Tab
// ===================================
function switchDetailTab(btn, tabId) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    // 모든 탭 컨텐츠 숨김
    document.querySelectorAll('.detail-pane').forEach(p => p.classList.remove('active'));
    
    // 선택한 탭 활성화
    btn.classList.add('active');
    document.getElementById(`detail-${tabId}`)?.classList.add('active');
}

// ===================================
// Edit Project - 수정 화면으로 이동
// ===================================
function editProject(pipelineId) {
    console.log('✏️ 편집 화면으로 이동:', pipelineId);
    
    // 모달 닫기
    closeModal();
    
    // 편집 화면으로 이동
    openProjectForm('edit', pipelineId);
}

// ===================================
// Close Modal
// ===================================
function closeModal() {
    document.getElementById('projectModal')?.classList.remove('active');
}

// ===================================
// Update Statistics
// ===================================
function updateStatistics(response) {
    document.getElementById('statTotal').textContent = response.total || response.total_records || 0;
    
    // 진행단계별 통계 (있는 경우)
    if (response.stats) {
        Object.keys(response.stats).forEach(stage => {
            const el = document.getElementById(`stat${stage}`);
            if (el) el.textContent = response.stats[stage] || 0;
        });
    }
}

// ===================================
// Export to Excel
// ===================================
function exportToExcel() {
    console.log('📊 엑셀 내보내기');
    projectTable.download("xlsx", "프로젝트_목록.xlsx", {
        sheetName: "프로젝트"
    });
}

// ===================================
// Export to window
// ===================================
window.openProjectDetail = openProjectDetail;
window.editProject = editProject;
window.switchDetailTab = switchDetailTab;
window.closeModal = closeModal;
window.projectTable = projectTable;
