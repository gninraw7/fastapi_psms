// ===================================
// Global State
// ===================================
let projectTable = null;
let currentFilters = {
    searchField: '',
    searchText: '',
    manager_id: '',
    field_code: '',
    current_stage: '',
    page: 1,
    page_size: 100
};
let selectedRow = null;  // ⭐ 선택된 Row 추적

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
    
    if (pipelineId) {
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
        
        const managers = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
        const managerSelect = document.getElementById('filterManager');
        if (managers && managers.items) {
            managers.items.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.manager_id;
                opt.textContent = m.manager_name;
                managerSelect.appendChild(opt);
            });
        }
        
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
        
        const stageSelect = document.getElementById('filterStage');
        Object.keys(window.STAGE_CONFIG).forEach(code => {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = window.STAGE_CONFIG[code].label;
            stageSelect.appendChild(opt);
        });
        
        console.log('✅ 필터 로딩 완료');
    } catch (error) {
        console.error('❌ 필터 로딩 실패:', error);
    }
}

// ===================================
// Initialize Tabulator Table
// ===================================
function initializeTable() {
    return new Promise((resolve, reject) => {
        console.log('📊 테이블 초기화...');
        
        projectTable = new Tabulator("#projectTable", {
            height: "600px",
            layout: "fitDataStretch",
            pagination: true,
            paginationMode: "remote",
            paginationSize: 100,
            paginationSizeSelector: [25, 50, 100, 200],
            placeholder: "데이터가 없습니다",
            
            // ⭐ Row 선택 설정 (단일 선택)
            selectable: 1,
            selectableRangeMode: "click",
            
            ajaxURL: `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${API_CONFIG.ENDPOINTS.PROJECTS_LIST}`,
            
            ajaxURLGenerator: function(url, config, params) {
                const query = new URLSearchParams({
                    page: params.page || 1,
                    page_size: params.size || 100,
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
                // ⭐ 체크박스 컬럼 추가
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
                    title: "담당자",
                    field: "manager_name",
                    width: 100,
                    headerSort: false,
                    hozAlign: "center"
                },
                {
                    title: "진행단계",
                    field: "current_stage",
                    width: 120,
                    headerSort: false,
                    hozAlign: "center",
                    formatter: function(cell) {
                        return getStageBadge(cell.getValue());
                    }
                },
                {
                    title: "견적금액",
                    field: "quoted_amount",
                    width: 150,
                    headerSort: false,
                    hozAlign: "right",
                    formatter: function(cell) {
                        return `<span class="cell-amount">${Utils.formatCurrency(cell.getValue())}</span>`;
                    }
                }
            ]
        });
        
        // ⭐ Row 선택 이벤트
        projectTable.on("rowSelected", function(row) {
            selectedRow = row;
            console.log('✅ Row 선택:', row.getData().pipeline_id);
            updateEditButton();
        });
        
        projectTable.on("rowDeselected", function(row) {
            selectedRow = null;
            console.log('❌ Row 선택 해제');
            updateEditButton();
        });
        
        projectTable.on("tableBuilt", function() {
            console.log('✅ 테이블 빌드 완료');
            resolve();
        });
		
		projectTable.on("rowDblClick", function(e, row) {
			const data = row.getData();
			openProjectDetail(data.pipeline_id);
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
    const icon = btn.querySelector('i');
    const text = btn.querySelector('span') || btn;
    
    if (selectedRow) {
        // 선택된 Row가 있으면 "열기/편집" 모드
        icon.className = 'fas fa-folder-open';
        if (text.tagName === 'SPAN') {
            text.textContent = ' 열기';
        } else {
            btn.innerHTML = '<i class="fas fa-folder-open"></i> 열기';
        }
        btn.title = '선택한 프로젝트 열기';
    } else {
        // 선택된 Row가 없으면 "신규" 모드
        icon.className = 'fas fa-plus-circle';
        if (text.tagName === 'SPAN') {
            text.textContent = ' 신규';
        } else {
            btn.innerHTML = '<i class="fas fa-plus-circle"></i> 신규';
        }
        btn.title = '새 프로젝트 추가';
    }
}

// ===================================
// Initialize Event Listeners
// ===================================
function initializeEventListeners() {
    document.getElementById('btnRefresh').addEventListener('click', () => {
        projectTable.setData();
    });
    
    document.getElementById('btnExport').addEventListener('click', exportToExcel);
    
    // ⭐ 신규/열기 버튼
    document.getElementById('btnAdd').addEventListener('click', () => {
        if (selectedRow) {
            // 선택된 Row가 있으면 상세 화면 열기
            const data = selectedRow.getData();
            openProjectDetail(data.pipeline_id);
        } else {
            // 선택된 Row가 없으면 신규 모드
            alert('신규 프로젝트 추가 기능 준비 중입니다.');
            // TODO: 신규 프로젝트 입력 폼 열기
        }
    });
    
    const searchInput = document.getElementById('searchText');
    searchInput.addEventListener('input', Utils.debounce(() => {
        currentFilters.search_text = searchInput.value;
        projectTable.setData();
    }, 500));
    
    document.getElementById('searchField').addEventListener('change', (e) => {
        currentFilters.search_field = e.target.value;
        projectTable.setData();
    });
    
    document.getElementById('filterManager').addEventListener('change', (e) => {
        currentFilters.manager_id = e.target.value;
        projectTable.setData();
    });
    
    document.getElementById('filterField').addEventListener('change', (e) => {
        currentFilters.field_code = e.target.value;
        projectTable.setData();
    });
    
    document.getElementById('filterStage').addEventListener('change', (e) => {
        currentFilters.current_stage = e.target.value;
        projectTable.setData();
    });
    
    document.getElementById('pageSize').addEventListener('change', (e) => {
        const size = parseInt(e.target.value);
        currentFilters.page_size = size;
        projectTable.setPageSize(size);
    });
}

// ===================================
// Update Statistics
// ===================================
function updateStatistics(response) {
    document.getElementById('statTotal').textContent = Utils.formatNumber(response.total_records || 0);
    document.getElementById('statProgress').textContent = Utils.formatNumber(response.in_progress_count || 0);
    document.getElementById('statCompleted').textContent = Utils.formatNumber(response.completed_count || 0);
    document.getElementById('statAmount').textContent = Utils.formatCurrency(response.total_amount || 0);
}

// ===================================
// Export to Excel
// ===================================
function exportToExcel() {
    const data = projectTable.getData();
    if (!data || data.length === 0) {
        alert('데이터가 없습니다');
        return;
    }
    
    const excelData = data.map(row => ({
        '파이프라인ID': row.pipeline_id,
        '분야': row.field_name,
        '프로젝트명': row.project_name,
        '고객사': row.customer_name,
        '발주처': row.ordering_party_name,
        '담당자': row.manager_name,
        '진행단계': getStageLabel(row.current_stage),
        '견적금액': row.quoted_amount
    }));
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "프로젝트목록");
    
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `프로젝트목록_${today}.xlsx`);
    
    console.log('✅ 엑셀 다운로드 완료');
}

// ===================================
// Open Project Detail Modal
// ===================================
async function openProjectDetail(pipelineId) {
    const modal = document.getElementById('projectModal');
    const modalBody = document.getElementById('modalBody');
    
    modal.classList.add('active');
    modalBody.innerHTML = '<p style="text-align: center; padding: 2rem;">로딩 중...</p>';
    
    try {
        console.log('📡 상세 정보 로딩:', pipelineId);
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECT_DETAIL}/${pipelineId}/full`);
        console.log('📥 상세 정보 응답:', response);
        
        if (response) {
            renderProjectDetail(response);
        }
    } catch (error) {
        console.error('❌ 상세 정보 로딩 실패:', error);
        modalBody.innerHTML = `
            <p style="text-align: center; color: red; padding: 2rem;">
                데이터 로드 실패<br>
                <span style="font-size: 0.875rem;">${error.message}</span>
            </p>
        `;
    }
}

// ===================================
// Render Project Detail
// ===================================
function renderProjectDetail(data) {
    const modalBody = document.getElementById('modalBody');
    console.log('🎨 렌더링 데이터:', data);
    
    const project = data.project || data;
    const attributes = data.attributes || [];
    const histories = data.histories || [];
    
    const html = `
        <div class="detail-section">
            <h3><i class="fas fa-info-circle"></i> 기본 정보</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>파이프라인 ID</label>
                    <div>${project.pipeline_id || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>프로젝트명</label>
                    <div>${project.project_name || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>사업분야</label>
                    <div>${project.field_name || project.field_code || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>진행단계</label>
                    <div>${getStageBadge(project.current_stage || project.progress_stage)}</div>
                </div>
                <div class="detail-item">
                    <label>고객사</label>
                    <div>${project.customer_name || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>발주처</label>
                    <div>${project.ordering_party_name || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>담당자</label>
                    <div>${project.manager_name || project.manager_id || '-'}</div>
                </div>
                <div class="detail-item">
                    <label>견적금액</label>
                    <div class="text-primary font-bold">${Utils.formatCurrency(project.quoted_amount || 0)}</div>
                </div>
            </div>
        </div>
        
        ${attributes && attributes.length > 0 ? `
        <div class="detail-section mt-3">
            <h3><i class="fas fa-tags"></i> 속성 정보</h3>
            <div class="detail-grid">
                ${attributes.map(attr => `
                    <div class="detail-item">
                        <label>${attr.attribute_name || '-'}</label>
                        <div>${attr.attribute_value || '-'}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- ⭐ 이력 섹션은 detail-grid 밖에 위치 (full-width) -->
        <div class="detail-section mt-3" style="width: 100%;">
            <h3><i class="fas fa-history"></i> 변경 이력</h3>
            <div class="history-list" style="width: 100%;">
                ${renderProjectHistory(histories)}
            </div>
        </div>
    `;
    
    modalBody.innerHTML = html;
}

// ===================================
// Close Modal
// ===================================
function closeModal() {
    document.getElementById('projectModal').classList.remove('active');
}

// ===================================
// Export to window
// ===================================
window.openProjectDetail = openProjectDetail;
window.closeModal = closeModal;

document.addEventListener('click', (e) => {
    const modal = document.getElementById('projectModal');
    if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});


function renderProjectHistory(history) {
    if (!history || history.length === 0) {
        return `
            <div class="history-empty">
                <i class="fas fa-inbox"></i>
                <p>등록된 이력이 없습니다.</p>
            </div>
        `;
    }
    
    return history.map(item => `
        <div class="history-item" style="width: 100%; max-width: none; display: block; box-sizing: border-box; background: #f8f9fa; border: 1px solid #e0e0e0; border-left: 4px solid #3498db; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <div class="history-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap;">
                <span class="history-date" style="font-size: 14px; font-weight: 600; color: #2c3e50;">
                    <i class="fas fa-calendar-alt"></i>
                    ${item.base_date || item.record_date || '-'}
                </span>
                <span class="history-stage ${getStageBadgeClass(item.progress_stage)}">
                    ${getStageText(item.progress_stage)}
                </span>
            </div>
            <div style="width: 100%; max-width: none; display: block; box-sizing: border-box; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e9ecef; color: #495057; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; word-break: keep-all; overflow-wrap: break-word;">
                ${escapeHtml(item.strategy_content || '-')}
            </div>
            <div class="history-meta" style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #6c757d;">
                <span>
                    <i class="fas fa-user"></i>
                    ${item.creator_id || '-'}
                </span>
                <span>
                    <i class="fas fa-clock"></i>
                    ${formatDateTime(item.created_at)}
                </span>
            </div>
        </div>
    `).join('');
}

// ===================================
// Helper Functions for History
// ===================================

/**
 * 단계 코드에 따른 배지 클래스 반환
 */
function getStageBadgeClass(stageCode) {
    const stageMap = {
        'S01': 'badge-stage-1',  // 1 영업중
        'S02': 'badge-stage-2',  // 2 제안
        'S03': 'badge-stage-3',  // 3 협상
        'S04': 'badge-stage-4',  // 4 임찰중
        'S05': 'badge-stage-5',  // 5 DROP
        'S06': 'badge-stage-6',  // 6 실주
        'S07': 'badge-stage-7',  // 7 계약진행
        'S08': 'badge-stage-8',  // 8 계약완료
        'S09': 'badge-stage-9'   // 9 기타
    };
    
    return stageMap[stageCode] || 'badge-stage-1';
}

/**
 * 단계 코드에 따른 텍스트 반환
 */
function getStageText(stageCode) {
    const stageMap = {
        'S01': '1 영업중',
        'S02': '2 제안',
        'S03': '3 협상',
        'S04': '4 임찰중',
        'S05': '5 DROP',
        'S06': '6 실주',
        'S07': '7 계약진행',
        'S08': '8 계약완료',
        'S09': '9 기타'
    };
    
    return stageMap[stageCode] || stageCode || '-';
}

/**
 * 단계 배지 HTML 생성
 */
function getStageBadge(stageCode) {
    return `<span class="badge ${getStageBadgeClass(stageCode)}">${getStageText(stageCode)}</span>`;
}

/**
 * 날짜/시간 포맷
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    try {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (e) {
        return dateStr;
    }
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
