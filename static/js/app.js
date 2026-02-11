// ===================================
// static/js/app.js
// 프로젝트 목록 화면 JavaScript
// 
// 버그 수정 (2026-01-30):
// - initializeTable의 Promise가 resolve되지 않아 이벤트 리스너가 등록되지 않는 문제 수정
// - 이벤트 리스너를 테이블 초기화와 독립적으로 바로 등록
//
// 기능 추가 (2026-02-01):
// - ⭐ 진행단계 아이콘 표시 (StageIcons 모듈 사용)
// - 프로젝트 목록 그리드: 배지 스타일 (아이콘 + 배경색 + 테두리)
// - 프로젝트 상세 정보: 배지 스타일
// - 변경이력 목록: 인라인 스타일 (아이콘 + 텍스트)
// - 폴백 지원: StageIcons 미로드 시 기존 getStageBadge 사용
// - [신규] 버튼 클릭 시 openProjectForm('new') 호출
// - 더블클릭 시 openProjectForm('edit', pipelineId) 호출
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
    service_code: '',
    current_stage: '',
    status: 'ACTIVE',
    sales_plan_id: '',
    page: 1,
    page_size: 25
};
let selectedRow = null;
let latestHistoryEnabled = false;
let latestHistoryTooltip = null;
let latestHistoryToggleBtn = null;
let projectsListInitialized = false;
let projectsListEventsBound = false;

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
        await initializeProjectsListPage();
        
        console.log('✅ 초기화 완료');
    } catch (error) {
        console.error('❌ 초기화 실패:', error);
    }
});

async function initializeProjectsListPage() {
    const projectTableEl = document.getElementById('projectTable');
    if (!projectTableEl) {
        console.log('⚠️ projectTable 요소 없음, 프로젝트 목록 초기화 스킵');
        return;
    }

    if (!projectsListInitialized) {
        // 1. STAGE 설정 로드
        await loadStageConfig();

        // 2. 필터 초기화
        await initializeFilters();

        // 3. 테이블 초기화 (Promise 기다리지 않음)
        initializeTable();

        // 4. ⭐ 이벤트 리스너 즉시 등록 (테이블 빌드 기다리지 않음)
        initializeEventListeners();

        // 4-1. 최종 이력 보기 토글 초기화
        initializeLatestHistoryControls();

        // 5. URL 파라미터 체크
        checkURLParameters();

        projectsListInitialized = true;
        return;
    }

    refreshProjectsList();
}

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
                const fields = await API.get(`${API_CONFIG.ENDPOINTS.INDUSTRY_FIELDS}/list?is_use=Y`);
                if (fields && fields.items) {
                    fields.items.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f.field_code;
                        opt.textContent = f.field_name || f.field_code;
                        fieldSelect.appendChild(opt);
                    });
                }
            } catch (e) {
                console.warn('⚠️ 사업분야 로드 실패:', e);
            }
        }

        // 서비스 로드 (하위 서비스만: parent_code IS NOT NULL)
        const serviceSelect = document.getElementById('filterService');
        if (serviceSelect) {
            try {
                const services = await API.get(`${API_CONFIG.ENDPOINTS.SERVICE_CODES}/list?is_use=Y`);
                if (services && services.items) {
                    services.items
                        .filter(s => s.parent_code)
                        .forEach(s => {
                            const opt = document.createElement('option');
                            opt.value = s.service_code;
                            opt.textContent = s.display_name || '';
                            serviceSelect.appendChild(opt);
                        });
                }
            } catch (e) {
                console.warn('⚠️ 서비스 로드 실패:', e);
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

        // 영업계획 로드
        const salesPlanSelect = document.getElementById('filterSalesPlan');
        if (salesPlanSelect) {
            try {
                const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/list?page=1&page_size=500`);
                (response?.items || []).forEach(plan => {
                    const opt = document.createElement('option');
                    opt.value = plan.plan_id;
                    const year = plan.plan_year || '-';
                    const version = plan.plan_version || '-';
                    const status = plan.status_code || '-';
                    opt.textContent = `${year} ${version} (${status})`;
                    salesPlanSelect.appendChild(opt);
                });
            } catch (e) {
                console.warn('⚠️ 영업계획 콤보 로드 실패:', e);
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

    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};
    
    projectTable = new Tabulator("#projectTable", {
        ...commonOptions,
        sortMode: "remote",
        ajaxSorting: true,
        height: "600px",
        layout: "fitDataStretch",
        pagination: true,
        paginationMode: "remote",
        paginationSize: 25,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: "데이터가 없습니다",
        columnDefaults: {
            ...(commonOptions.columnDefaults || {}),
            headerHozAlign: "center"
        },
        rowFormatter: function(row) {
            bindLatestHistoryHover(row);
        },
        selectable: 1,
        selectableRangeMode: "click",
        
        ajaxURL: API_CONFIG.BASE_URL + API_CONFIG.API_VERSION + API_CONFIG.ENDPOINTS.PROJECTS_LIST,
        
        ajaxURLGenerator: function(url, config, params) {
            const safeParams = params || {};
            const sorters = safeParams.sorters || safeParams.sort || safeParams.sorter || [];
            const finalUrl = buildProjectsListUrl({
                page: safeParams.page || 1,
                size: safeParams.size || 25,
                sorters
            });
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
                formatter: function(cell) {
                    const val = cell.getValue();
                    return '<span class="cell-pipeline-id" onclick="openProjectDetail(\'' + val + '\')">' + val + '</span>';
                }
            },
            {
                title: "분야",
                field: "field_name",
                width: 100,
                hozAlign: "center"
            },
            {
                title: "서비스",
                field: "service_name",
                width: 140,
                hozAlign: "center",
                formatter: function(cell) {
                    const val = cell.getValue();
                    if (val) return val;
                    const row = cell.getRow().getData();
                    return row.service_code || '-';
                }
            },
            {
                title: "프로젝트명",
                field: "project_name",
                minWidth: 300,
                formatter: function(cell) {
                    return Utils.truncate(cell.getValue(), 50);
                }
            },
            {
                title: "고객사",
                field: "customer_name",
                width: 150,
                headerSort: true
            },
            {
                title: "발주처",
                field: "ordering_party_name",
                width: 150,
                headerSort: true
            },
            {
                title: "진행단계",
                field: "current_stage",
                width: 160,  // ⭐ 너비 증가 (아이콘 + 배지 공간)
                hozAlign: "center",
                formatter: function(cell) {
                    const stageCode = cell.getValue();
                    
                    // 값이 없으면 기본 표시
                    if (!stageCode) return '-';
                    
                    // ⭐ StageIcons가 로드되었는지 확인
                    if (typeof StageIcons === 'undefined') {
                        // StageIcons가 없으면 기존 방식 사용
                        if (typeof getStageBadge !== 'undefined') {
                            return getStageBadge(stageCode);
                        }
                        return stageCode;
                    }
                    
                    // ⭐ StageIcons를 사용하여 배지 스타일로 렌더링
                    const config = StageIcons.getConfig(stageCode);
                    const stageName = config.label ? `${stageCode.replace('S0', '')} ${config.label}` : stageCode;
                    
                    return StageIcons.render(stageCode, stageName, { 
                        size: 'sm', 
                        style: 'badge'  // 배지 스타일 (배경색 + 테두리)
                    });
                }
            },
            {
                title: "담당자",
                field: "manager_name",
                width: 100,
                hozAlign: "center",
                headerSort: true
            },
            {
                title: "담당조직",
                field: "org_name",
                width: 140,
                hozAlign: "center",
                headerSort: true,
                formatter: function(cell) {
                    const val = cell.getValue();
                    if (val) return val;
                    const row = cell.getRow().getData();
                    return row.org_id || '-';
                }
            },
            {
                title: "견적금액",
                field: "quoted_amount",
                width: 130,
                hozAlign: "right",
                formatter: function(cell) {
                    const val = cell.getValue();
                    return val ? Utils.formatNumber(val) + ' 원' : '-';
                }
            },
            {
                title: "최종기준일",
                field: "latest_base_date",
                width: 110,
                hozAlign: "center",
                headerSort: true,
                formatter: function(cell) {
                    return Utils.formatDate(cell.getValue());
                }
            },
            {
                title: "이력건수",
                field: "history_count",
                width: 90,
                hozAlign: "right",
                headerSort: true,
                formatter: function(cell) {
                    const val = cell.getValue();
                    return (val === null || val === undefined) ? '-' : Utils.formatNumber(val);
                }
            },
            {
                title: "등록일",
                field: "created_at",
                width: 110,
                hozAlign: "center",
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
    
    // ⭐ 더블클릭 시 수정 화면 열기 (개선됨)
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
// ⭐ 개선: [신규] 버튼 클릭 시 openProjectForm('new') 호출
// ===================================
function initializeEventListeners() {
    if (projectsListEventsBound) return;
    projectsListEventsBound = true;
    console.log('🔧 이벤트 리스너 초기화 시작...');
    
    // 새로고침 버튼
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
            console.log('🔄 새로고침 클릭');
            refreshProjectsList();
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
    
    // ⭐ 신규/열기 버튼 (개선: openProjectForm 호출)
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
        console.log('  ✓ btnAdd 이벤트 등록 (openProjectForm 호출)');
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
                reloadProjectsList(1);
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
            reloadProjectsList(1);
        });
        console.log('  ✓ btnSearch 이벤트 등록');
    }
    
    // 담당자 필터
    const filterManager = document.getElementById('filterManager');
    if (filterManager) {
        filterManager.addEventListener('change', function(e) {
            currentFilters.manager_id = e.target.value;
            console.log('🔍 담당자 필터:', currentFilters.manager_id);
            reloadProjectsList(1);
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
            reloadProjectsList(1);
        });
        console.log('  ✓ filterField 이벤트 등록');
    } else {
        console.warn('  ✗ filterField 요소 없음');
    }

    // 서비스 필터
    const filterService = document.getElementById('filterService');
    if (filterService) {
        filterService.addEventListener('change', function(e) {
            currentFilters.service_code = e.target.value;
            console.log('🔍 서비스 필터:', currentFilters.service_code);
            reloadProjectsList(1);
        });
        console.log('  ✓ filterService 이벤트 등록');
    } else {
        console.warn('  ✗ filterService 요소 없음');
    }
    
    // 진행단계 필터
    const filterStage = document.getElementById('filterStage');
    if (filterStage) {
        filterStage.addEventListener('change', function(e) {
            currentFilters.current_stage = e.target.value;
            console.log('🔍 진행단계 필터:', currentFilters.current_stage);
            reloadProjectsList(1);
        });
        console.log('  ✓ filterStage 이벤트 등록');
    } else {
        console.warn('  ✗ filterStage 요소 없음');
    }

    // 상태 필터
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.addEventListener('change', function(e) {
            currentFilters.status = e.target.value;
            console.log('🔍 상태 필터:', currentFilters.status);
            reloadProjectsList(1);
        });
        console.log('  ✓ filterStatus 이벤트 등록');
    } else {
        console.warn('  ✗ filterStatus 요소 없음');
    }

    // 영업계획 필터
    const filterSalesPlan = document.getElementById('filterSalesPlan');
    if (filterSalesPlan) {
        filterSalesPlan.addEventListener('change', function(e) {
            currentFilters.sales_plan_id = e.target.value;
            console.log('🔍 영업계획 필터:', currentFilters.sales_plan_id);
            reloadProjectsList(1);
        });
        console.log('  ✓ filterSalesPlan 이벤트 등록');
    } else {
        console.warn('  ✗ filterSalesPlan 요소 없음');
    }
    
    // 페이지 크기 (있는 경우)
    const pageSize = document.getElementById('pageSize');
    if (pageSize) {
        pageSize.addEventListener('change', function(e) {
            const size = parseInt(e.target.value, 10);
            console.log('📄 페이지 크기 변경:', size);
            currentFilters.page_size = size;
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
// Latest History Tooltip Controls
// ===================================
function initializeLatestHistoryControls() {
    latestHistoryToggleBtn = document.getElementById('toggleLatestHistory');
    latestHistoryTooltip = document.getElementById('latestHistoryTooltip');

    if (!latestHistoryToggleBtn || !latestHistoryTooltip) {
        console.warn('⚠️ 최종 이력 보기 UI 요소 없음');
        return;
    }

    setLatestHistoryToggleState(false);

    latestHistoryToggleBtn.addEventListener('click', function() {
        latestHistoryEnabled = !latestHistoryEnabled;
        setLatestHistoryToggleState(latestHistoryEnabled);
        if (!latestHistoryEnabled) {
            hideLatestHistoryTooltip();
        }
    });
}

function setLatestHistoryToggleState(enabled) {
    if (!latestHistoryToggleBtn) return;
    latestHistoryToggleBtn.classList.toggle('active', enabled);
    latestHistoryToggleBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    const stateEl = latestHistoryToggleBtn.querySelector('.toggle-state');
    if (stateEl) {
        stateEl.textContent = enabled ? 'ON' : 'OFF';
    }
}

function bindLatestHistoryHover(row) {
    const rowEl = row.getElement();
    if (!rowEl || rowEl.dataset.latestHistoryBound === '1') return;
    rowEl.dataset.latestHistoryBound = '1';

    rowEl.addEventListener('mouseenter', function(e) {
        if (!latestHistoryEnabled) return;
        showLatestHistoryTooltip(e, row.getData());
    });

    rowEl.addEventListener('mousemove', function(e) {
        if (!latestHistoryEnabled) return;
        positionLatestHistoryTooltip(e.clientX, e.clientY);
    });

    rowEl.addEventListener('mouseleave', function() {
        hideLatestHistoryTooltip();
    });
}

function showLatestHistoryTooltip(e, rowData) {
    if (!latestHistoryTooltip) return;

    const dateText = rowData && rowData.latest_base_date ? Utils.formatDate(rowData.latest_base_date) : '-';
    const historyLineRaw = rowData && rowData.latest_history_line ? rowData.latest_history_line : '';
    const historyLine = historyLineRaw && historyLineRaw.trim().length > 0 ? historyLineRaw.trim() : '이력 없음';

    latestHistoryTooltip.innerHTML = `
        <div class="history-tooltip-title">최종 이력</div>
        <div class="history-tooltip-date">${Utils.escapeHtml(dateText)}</div>
        <div class="history-tooltip-content">${Utils.escapeHtml(historyLine)}</div>
    `;

    latestHistoryTooltip.classList.add('active');
    latestHistoryTooltip.setAttribute('aria-hidden', 'false');
    positionLatestHistoryTooltip(e.clientX, e.clientY);
}

function hideLatestHistoryTooltip() {
    if (!latestHistoryTooltip) return;
    latestHistoryTooltip.classList.remove('active');
    latestHistoryTooltip.setAttribute('aria-hidden', 'true');
}

function positionLatestHistoryTooltip(clientX, clientY) {
    if (!latestHistoryTooltip) return;

    const offsetX = 14;
    const offsetY = 18;
    const padding = 12;

    let left = clientX + offsetX;
    let top = clientY + offsetY;

    const rect = latestHistoryTooltip.getBoundingClientRect();
    if (left + rect.width + padding > window.innerWidth) {
        left = clientX - rect.width - offsetX;
    }
    if (top + rect.height + padding > window.innerHeight) {
        top = clientY - rect.height - offsetY;
    }

    latestHistoryTooltip.style.left = Math.max(padding, left) + 'px';
    latestHistoryTooltip.style.top = Math.max(padding, top) + 'px';
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
// ⭐ 진행단계 렌더링 헬퍼 함수
// ===================================
function renderStageForDetail(stageCode) {
    if (!stageCode) return '-';
    
    // StageIcons 사용 가능 시
    if (typeof StageIcons !== 'undefined') {
        var config = StageIcons.getConfig(stageCode);
        var stageName = config.label ? stageCode.replace('S0', '') + ' ' + config.label : stageCode;
        return StageIcons.render(stageCode, stageName, { size: 'sm', style: 'badge' });
    }
    
    // 폴백: getStageBadge 사용
    if (typeof getStageBadge !== 'undefined') {
        return getStageBadge(stageCode);
    }
    
    // 최종 폴백: 코드만 표시
    return stageCode;
}

// ===================================
// Render Activity Type (History)
// ===================================
const DETAIL_ACTIVITY_TYPE_COLOR_MAP = window.PSMS_ACTIVITY_TYPE_COLOR_MAP || {
    MEETING: '#2563eb',
    PROPOSAL: '#7c3aed',
    CONTRACT: '#16a34a',
    FOLLOWUP: '#f59e0b',
    SUPPORT: '#0ea5e9',
    ETC: '#94a3b8',
    UNKNOWN: '#cbd5f5'
};

const DETAIL_ACTIVITY_TYPE_ICON_MAP = {
    MEETING: 'fas fa-comments',
    PROPOSAL: 'fas fa-file-signature',
    CONTRACT: 'fas fa-handshake',
    FOLLOWUP: 'fas fa-repeat',
    SUPPORT: 'fas fa-life-ring',
    ETC: 'fas fa-ellipsis-h',
    UNKNOWN: 'fas fa-question'
};

function getDetailActivityTypeColor(typeCode) {
    if (!typeCode) return DETAIL_ACTIVITY_TYPE_COLOR_MAP.UNKNOWN;
    return DETAIL_ACTIVITY_TYPE_COLOR_MAP[typeCode] || DETAIL_ACTIVITY_TYPE_COLOR_MAP.UNKNOWN;
}

function getDetailActivityTypeIcon(typeCode) {
    if (!typeCode) return DETAIL_ACTIVITY_TYPE_ICON_MAP.UNKNOWN;
    return DETAIL_ACTIVITY_TYPE_ICON_MAP[typeCode] || DETAIL_ACTIVITY_TYPE_ICON_MAP.UNKNOWN;
}

function renderDetailActivityType(typeCode, typeName) {
    if (!typeCode && !typeName) return '-';
    const label = Utils.escapeHtml(typeName || typeCode || '-');
    const color = getDetailActivityTypeColor(typeCode);
    const iconClass = getDetailActivityTypeIcon(typeCode);
    return `
        <span class="history-activity">
            <span class="history-activity-icon" style="background:${color}">
                <i class="${iconClass}"></i>
            </span>
            <span class="history-activity-label">${label}</span>
        </span>
    `;
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
            // ⭐ 진행단계 렌더링 (StageIcons 사용)
            var stageHtml = h.progress_stage || '-';
            if (h.progress_stage && typeof StageIcons !== 'undefined') {
                var config = StageIcons.getConfig(h.progress_stage);
                var stageName = config.label ? h.progress_stage.replace('S0', '') + ' ' + config.label : h.progress_stage;
                stageHtml = StageIcons.render(h.progress_stage, stageName, { size: 'sm', style: 'inline' });
            } else if (h.progress_stage && typeof getStageBadge !== 'undefined') {
                stageHtml = getStageBadge(h.progress_stage);
            }
            
            var activityHtml = renderDetailActivityType(h.activity_type, h.activity_type_name);
            histRows += '<tr><td>' + Utils.formatDate(h.history_date || h.base_date) + '</td><td>' + stageHtml + '</td><td>' + activityHtml + '</td><td>' + (h.strategy_content || '-') + '</td><td>' + (h.creator_name || h.creator_id || '-') + '</td></tr>';
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
        '<div class="detail-item"><label>서비스</label><span>' + (project.service_name || project.service_code || '-') + '</span></div>' +
        '<div class="detail-item"><label>진행단계</label><span>' + renderStageForDetail(project.current_stage) + '</span></div>' +
        '<div class="detail-item"><label>담당자</label><span>' + (project.manager_name || '-') + '</span></div>' +
        '<div class="detail-item"><label>담당조직</label><span>' + (project.org_name || project.org_id || '-') + '</span></div>' +
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
            '<table class="detail-table detail-history-table"><thead><tr><th>일자</th><th>진행단계</th><th>활동유형</th><th>내용</th><th>작성자</th></tr></thead><tbody>' + histRows + '</tbody></table>'
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

// 프로그램용 탭 활성화 헬퍼
function activateDetailTab(tabId) {
    var btn = document.querySelector(`.detail-tab[onclick*=\"'${tabId}'\"]`);
    if (btn) {
        switchDetailTab(btn, tabId);
        return;
    }
    document.querySelectorAll('.detail-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.detail-pane').forEach(function(p) { p.classList.remove('active'); });
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
    if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('modal-front');
    }
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
    openExcelExportModal();
}

function getCurrentProjectSort() {
    if (!projectTable || typeof projectTable.getSorters !== 'function') {
        return { sort_field: '', sort_dir: '' };
    }
    const sorters = projectTable.getSorters() || [];
    if (!sorters.length) return { sort_field: '', sort_dir: '' };
    return {
        sort_field: sorters[0].field || '',
        sort_dir: sorters[0].dir || ''
    };
}

function buildProjectListQueryParams(page = 1, pageSize = 25) {
    const params = {
        page,
        page_size: pageSize
    };

    if (currentFilters.search_field) params.search_field = currentFilters.search_field;
    if (currentFilters.search_text) params.search_text = currentFilters.search_text;
    if (currentFilters.manager_id) params.manager_id = currentFilters.manager_id;
    if (currentFilters.field_code) params.field_code = currentFilters.field_code;
    if (currentFilters.service_code) params.service_code = currentFilters.service_code;
    if (currentFilters.current_stage) params.current_stage = currentFilters.current_stage;
    if (currentFilters.status) params.status = currentFilters.status;
    if (currentFilters.sales_plan_id) params.sales_plan_id = currentFilters.sales_plan_id;

    const sort = getCurrentProjectSort();
    if (sort.sort_field) {
        params.sort_field = sort.sort_field;
        params.sort_dir = sort.sort_dir || 'asc';
    }

    return params;
}

function buildProjectsListUrl({ page = 1, size = 25, sorters = [] } = {}) {
    const params = buildProjectListQueryParams(page, size);
    if (sorters.length > 0) {
        params.sort_field = sorters[0].field;
        params.sort_dir = sorters[0].dir || 'asc';
    }
    const query = new URLSearchParams(params);
    return `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${API_CONFIG.ENDPOINTS.PROJECTS_LIST}?${query.toString()}`;
}

function reloadProjectsList(page = 1) {
    if (!projectTable) return;
    const pageSize = typeof projectTable.getPageSize === 'function' ? projectTable.getPageSize() : 25;
    const sorters = typeof projectTable.getSorters === 'function' ? projectTable.getSorters() : [];
    const finalUrl = buildProjectsListUrl({ page, size: pageSize, sorters });
    projectTable.setData(finalUrl);
}

function refreshProjectsList() {
    const currentPage = projectTable && typeof projectTable.getPage === 'function' ? projectTable.getPage() : 1;
    reloadProjectsList(currentPage || 1);
}

function getDateIsoString(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatExportDateValue(value) {
    if (!value) return '-';
    if (value instanceof Date) return getDateIsoString(value);
    const s = String(value);
    if (s.includes('T')) return s.split('T')[0];
    if (s.includes(' ')) return s.split(' ')[0];
    return s;
}

function openExcelExportModal() {
    const modal = document.getElementById('excelExportModal');
    if (!modal) {
        console.warn('⚠️ excelExportModal 요소 없음, 기본 다운로드로 대체');
        if (projectTable) {
            projectTable.download("xlsx", "프로젝트_목록.xlsx", { sheetName: "프로젝트" });
        }
        return;
    }

    const exportType = document.getElementById('excelExportType');
    const exportLayout = document.getElementById('excelExportLayout');
    const fromDate = document.getElementById('excelExportFromDate');
    const toDate = document.getElementById('excelExportToDate');
    const summary = document.getElementById('excelExportFilterSummary');
    const progress = document.getElementById('excelExportProgress');

    if (exportType) exportType.value = 'filtered';
    if (exportLayout) exportLayout.value = 'single_sheet';

    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 6);
    if (fromDate) fromDate.value = getDateIsoString(lastWeek);
    if (toDate) toDate.value = getDateIsoString(today);
    if (summary) summary.textContent = getFilterSummaryText();
    if (progress) progress.textContent = '';

    onExcelExportTypeChange();
    modal.classList.add('active');
}

function closeExcelExportModal() {
    const modal = document.getElementById('excelExportModal');
    if (modal) modal.classList.remove('active');
}

function onExcelExportTypeChange() {
    const exportType = document.getElementById('excelExportType')?.value || 'filtered';
    const periodRow = document.getElementById('excelExportPeriodRow');
    if (periodRow) {
        periodRow.style.display = exportType === 'activity' ? 'grid' : 'none';
    }
}

function getFilterSummaryText() {
    const parts = [];
    if (currentFilters.search_field || currentFilters.search_text) {
        parts.push(`검색(${currentFilters.search_field || '전체'}): ${currentFilters.search_text || '-'}`);
    }
    if (currentFilters.manager_id) parts.push(`담당자: ${currentFilters.manager_id}`);
    if (currentFilters.field_code) parts.push(`사업분야: ${currentFilters.field_code}`);
    if (currentFilters.service_code) parts.push(`서비스: ${currentFilters.service_code}`);
    if (currentFilters.current_stage) parts.push(`진행단계: ${currentFilters.current_stage}`);
    if (currentFilters.sales_plan_id) parts.push(`영업계획: ${currentFilters.sales_plan_id}`);
    return parts.length ? parts.join(' | ') : '필터 없음(전체)';
}

function normalizeHistoryDate(history) {
    const raw = history?.base_date || history?.history_date || history?.record_date || '';
    if (!raw) return null;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return null;
}

function isHistoryInRange(history, fromDate, toDate) {
    const d = normalizeHistoryDate(history);
    if (!d) return false;
    return d >= fromDate && d <= toDate;
}

function sanitizeSheetName(raw) {
    const base = String(raw || 'Sheet')
        .replace(/[\\/*?:[\]]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
    return (base || 'Sheet').slice(0, 31);
}

function getProjectBaseRow(project) {
    return [
        project.pipeline_id || '-',
        project.project_name || '-',
        project.field_name || project.field_code || '-',
        project.service_name || project.service_code || '-',
        project.stage_name || project.current_stage || '-',
        project.manager_name || project.manager_id || '-',
        project.org_name || project.org_id || '-',
        project.customer_name || '-',
        project.ordering_party_name || '-',
        Number(project.quoted_amount || 0),
        `${Number(project.win_probability || 0)}%`,
        project.notes || ''
    ];
}

function buildProjectSheetRows(entry, opts, index) {
    const project = entry.project || {};
    const attributes = entry.attributes || [];
    const histories = entry.histories || [];
    const rows = [];

    rows.push([`[${index + 1}] ${project.pipeline_id || '-'} - ${project.project_name || '-'}`]);
    rows.push(['']);
    rows.push(['파이프라인ID', '프로젝트명', '사업분야', '서비스', '진행단계', '담당자', '조직', '고객사', '발주처', '견적금액', '수주확률', '비고']);
    rows.push(getProjectBaseRow(project));
    rows.push(['']);

    rows.push(['속성정보']);
    rows.push(['속성코드', '속성명', '값']);
    if (attributes.length === 0) {
        rows.push(['-', '(없음)', '-']);
    } else {
        attributes.forEach(attr => {
            rows.push([
                attr.attr_code || '-',
                attr.attr_name || attr.attribute_name || attr.attr_code || '-',
                attr.attr_value || attr.attribute_value || '-'
            ]);
        });
    }
    rows.push(['']);

    rows.push(['변경이력']);
    rows.push(['기준일', '진행단계', '내용', '작성자']);
    if (histories.length === 0) {
        rows.push(['-', '-', '(없음)', '-']);
    } else {
        histories.forEach(hist => {
            rows.push([
                formatExportDateValue(hist.base_date || hist.history_date || hist.record_date),
                hist.stage_name || hist.progress_stage || '-',
                hist.strategy_content || '-',
                hist.creator_name || hist.creator_id || '-'
            ]);
        });
    }

    if (opts.exportType === 'activity') {
        rows.push(['']);
        rows.push([`활동 기간`, `${opts.fromDateRaw} ~ ${opts.toDateRaw}`]);
    }

    return rows;
}

function buildSummaryRows(entries, opts) {
    const totalHistories = entries.reduce((acc, entry) => acc + ((entry.histories || []).length), 0);
    const typeLabel = opts.exportType === 'activity' ? '주간/월간 활동내역' : '필터링 프로젝트 전체';
    const layoutLabel = opts.layout === 'per_project' ? '프로젝트별 시트' : '단일 시트';
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const rows = [
        ['PSMS 프로젝트 엑셀 리포트 요약'],
        [''],
        ['출력 유형', typeLabel],
        ['시트 구성', layoutLabel],
        ['출력 일시', ts],
        ['프로젝트 수', entries.length],
        ['이력 행 수', totalHistories],
        ['필터 조건', getFilterSummaryText()]
    ];

    if (opts.exportType === 'activity') {
        rows.push(['활동 기간', `${opts.fromDateRaw} ~ ${opts.toDateRaw}`]);
    }
    return rows;
}

function buildWorkbook(entries, opts) {
    const wb = XLSX.utils.book_new();

    const summaryRows = buildSummaryRows(entries, opts);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 22 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, '요약');

    if (opts.layout === 'single_sheet') {
        const rows = [];
        entries.forEach((entry, idx) => {
            const block = buildProjectSheetRows(entry, opts, idx);
            block.forEach(row => rows.push(row));
            rows.push(['']);
            rows.push(['']);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 16 },
            { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
            { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 50 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, '전체리포트');
    } else {
        const usedNames = new Set(['요약']);
        entries.forEach((entry, idx) => {
            const project = entry.project || {};
            const candidate = sanitizeSheetName(`${project.pipeline_id || idx + 1}_${project.project_name || '프로젝트'}`);
            let name = candidate || `프로젝트_${idx + 1}`;
            let suffix = 1;
            while (usedNames.has(name)) {
                const trimmed = candidate.slice(0, Math.max(1, 28));
                name = `${trimmed}_${suffix}`;
                suffix += 1;
            }
            usedNames.add(name);

            const rows = buildProjectSheetRows(entry, opts, idx);
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [
                { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 16 },
                { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
                { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 50 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, name);
        });
    }

    return wb;
}

async function fetchAllProjectsForExport() {
    const allItems = [];
    let page = 1;
    const pageSize = 500;

    while (true) {
        const params = buildProjectListQueryParams(page, pageSize);
        const query = new URLSearchParams(params).toString();
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECTS_LIST}?${query}`);
        const items = response?.items || [];
        allItems.push(...items);

        const totalPages = response?.total_pages || 1;
        if (page >= totalPages) break;
        page += 1;
    }

    return allItems;
}

async function fetchProjectDetailsForExport(projects, onProgress) {
    if (!projects.length) return [];
    const results = new Array(projects.length);
    const concurrency = Math.min(6, projects.length);
    let cursor = 0;
    let completed = 0;

    async function worker() {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= projects.length) break;

            const row = projects[index];
            const pipelineId = row.pipeline_id;
            try {
                const detail = await API.get(`${API_CONFIG.ENDPOINTS.PROJECT_DETAIL}/${pipelineId}/full`);
                const project = detail?.project || {};
                const mergedProject = { ...row, ...project };
                results[index] = {
                    project: mergedProject,
                    attributes: detail?.attributes || [],
                    histories: detail?.histories || []
                };
            } catch (error) {
                console.warn(`⚠️ 상세 조회 실패: ${pipelineId}`, error);
                results[index] = {
                    project: row,
                    attributes: [],
                    histories: []
                };
            } finally {
                completed += 1;
                if (typeof onProgress === 'function') onProgress(completed, projects.length);
            }
        }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i += 1) {
        workers.push(worker());
    }
    await Promise.all(workers);
    return results.filter(Boolean);
}

function setExcelExportProgress(message) {
    const el = document.getElementById('excelExportProgress');
    if (el) el.textContent = message;
}

function setExcelExportRunningState(isRunning) {
    const btn = document.getElementById('btnExcelExportRun');
    if (!btn) return;
    btn.disabled = isRunning;
    btn.innerHTML = isRunning
        ? '<i class="fas fa-spinner fa-spin"></i> 생성 중...'
        : '<i class="fas fa-file-excel"></i> 엑셀 생성';
}

async function runExcelExport() {
    const exportType = document.getElementById('excelExportType')?.value || 'filtered';
    const layout = document.getElementById('excelExportLayout')?.value || 'single_sheet';
    const fromDateRaw = document.getElementById('excelExportFromDate')?.value || '';
    const toDateRaw = document.getElementById('excelExportToDate')?.value || '';

    let fromDate = null;
    let toDate = null;

    if (exportType === 'activity') {
        if (!fromDateRaw || !toDateRaw) {
            alert('활동내역 출력은 기간(From/To) 입력이 필요합니다.');
            return;
        }
        fromDate = new Date(fromDateRaw);
        toDate = new Date(toDateRaw);
        if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            alert('기간 형식이 올바르지 않습니다.');
            return;
        }
        fromDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        toDate = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
        if (fromDate > toDate) {
            alert('From 날짜는 To 날짜보다 같거나 이전이어야 합니다.');
            return;
        }
    }

    try {
        setExcelExportRunningState(true);
        setExcelExportProgress('대상 프로젝트 조회 중...');
        Utils.showLoading(true);

        const projects = await fetchAllProjectsForExport();
        if (!projects.length) {
            alert('출력할 프로젝트가 없습니다.');
            return;
        }

        setExcelExportProgress(`상세 데이터 조회 중... (0/${projects.length})`);
        const details = await fetchProjectDetailsForExport(projects, (done, total) => {
            setExcelExportProgress(`상세 데이터 조회 중... (${done}/${total})`);
        });

        let entries = details.map(entry => ({
            project: entry.project || {},
            attributes: entry.attributes || [],
            histories: entry.histories || []
        }));

        if (exportType === 'activity') {
            entries = entries
                .map(entry => ({
                    ...entry,
                    histories: (entry.histories || []).filter(hist => isHistoryInRange(hist, fromDate, toDate))
                }))
                .filter(entry => (entry.histories || []).length > 0);
        }

        if (!entries.length) {
            alert(exportType === 'activity'
                ? '지정 기간에 이력이 등록된 프로젝트가 없습니다.'
                : '출력할 프로젝트가 없습니다.');
            return;
        }

        setExcelExportProgress('엑셀 파일 생성 중...');
        const workbook = buildWorkbook(entries, {
            exportType,
            layout,
            fromDateRaw,
            toDateRaw
        });

        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const typeLabel = exportType === 'activity' ? '활동내역' : '필터전체';
        const fileName = `프로젝트_${typeLabel}_${stamp}.xlsx`;

        XLSX.writeFile(workbook, fileName);
        setExcelExportProgress(`완료: ${entries.length}개 프로젝트 출력`);
        closeExcelExportModal();
    } catch (error) {
        console.error('❌ 엑셀 리포트 생성 실패:', error);
        alert('엑셀 리포트 생성 중 오류가 발생했습니다.');
    } finally {
        Utils.showLoading(false);
        setExcelExportRunningState(false);
    }
}

// ===================================
// Export to window
// ===================================
window.openProjectDetail = openProjectDetail;
window.editProject = editProject;
window.switchDetailTab = switchDetailTab;
window.activateDetailTab = activateDetailTab;
window.closeModal = closeModal;
window.exportToExcel = exportToExcel;
window.openExcelExportModal = openExcelExportModal;
window.closeExcelExportModal = closeExcelExportModal;
window.onExcelExportTypeChange = onExcelExportTypeChange;
window.runExcelExport = runExcelExport;
window.initializeProjectsListPage = initializeProjectsListPage;

console.log('📦 app.js 모듈 로드 완료');
