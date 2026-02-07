// ===================================
// static/js/clients-list.js
// 거래처 목록 관리 JavaScript
// 
// 기능 개선 (2026-02-01):
// - 검색구분 "전체" 지원 (search_field 없으면 전체 필드 검색)
// - [신규] 버튼 클릭 시 openClientForm('new') 호출
// - 더블클릭 시 openClientForm('edit', clientId) 호출
// - 액션 버튼 색상 개선 (파란색 수정, 빨간색 삭제)
// - navigateToClientForm을 openClientForm으로 통합
// ===================================

// ===================================
// Global State
// ===================================
let clientsTable = null;
let selectedClientRow = null;
let clientIndustryMap = {};
let currentClientFilters = {
    search_field: '',
    search_text: '',
    industry_type: '',
    is_active: '',
    page: 1,
    page_size: 25
};

// ===================================
// Initialization
// ===================================
function bootstrapClientsList() {
    console.log('🚀 거래처 목록 초기화 시작...');

    // 거래처 목록 페이지인지 확인
    const clientsTableEl = document.getElementById('clientsTable');

    if (!clientsTableEl) {
        console.log('⚠️ clientsTable 요소 없음, 초기화 스킵');
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(clientsTableEl)) {
        console.log('ℹ️ 거래처 목록 비활성 페이지, 초기화 스킵');
        return;
    }

    try {
        // 테이블 초기화
        initializeClientsTable();

        // 업종(분야) 옵션 로드
        loadClientIndustryOptions();
        
        // 이벤트 리스너 등록
        initializeClientEventListeners();
        
        console.log('✅ 거래처 목록 초기화 완료');
    } catch (error) {
        console.error('❌ 거래처 목록 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapClientsList);
} else {
    bootstrapClientsList();
}

// ===================================
// Load Industry Fields (업종)
// ===================================
async function loadClientIndustryOptions() {
    const industrySelect = document.getElementById('clientIndustryType');
    if (!industrySelect) return;

    industrySelect.innerHTML = '<option value="">전체</option>';
    clientIndustryMap = {};

    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.INDUSTRY_FIELDS}/list?is_use=Y`);
        const items = response?.items || [];
        items.forEach(item => {
            const code = item.field_code;
            const name = item.field_name || code;
            clientIndustryMap[code] = name;
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = name;
            industrySelect.appendChild(opt);
        });
    } catch (error) {
        console.warn('⚠️ 업종(분야) 목록 로드 실패:', error);
    }
}

// ===================================
// Initialize Clients Table
// ===================================
function initializeClientsTable() {
    const tableEl = document.getElementById('clientsTable');
    
    if (!tableEl) {
        console.error('❌ clientsTable 요소를 찾을 수 없음');
        return;
    }

    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};
    
    clientsTable = new Tabulator("#clientsTable", {
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
        
        selectable: true,
        selectableRangeMode: "click",
        
        ajaxURL: API_CONFIG.BASE_URL + API_CONFIG.API_VERSION + "/clients/list",
        
        ajaxURLGenerator: function(url, config, params) {
            const queryParams = {
                page: params.page || 1,
                page_size: params.size || 25
            };
            
            // ⭐ 개선: 검색어가 있을 때만 검색 필터 적용
            // search_field가 빈 값('')이면 전송하지 않음 → 백엔드에서 전체 검색
            if (currentClientFilters.search_text) {
                queryParams.search_text = currentClientFilters.search_text;
                
                // search_field가 있을 때만 추가
                if (currentClientFilters.search_field) {
                    queryParams.search_field = currentClientFilters.search_field;
                }
                // search_field가 없으면 백엔드에서 전체 필드 검색
            }
            
            if (currentClientFilters.industry_type) {
                queryParams.industry_type = currentClientFilters.industry_type;
            }
            if (currentClientFilters.is_active !== '') {
                queryParams.is_active = currentClientFilters.is_active;
            }
            const sorters = params.sorters || params.sort || params.sorter || [];
            if (sorters.length > 0) {
                queryParams.sort_field = sorters[0].field;
                queryParams.sort_dir = sorters[0].dir;
            }
            
            const query = new URLSearchParams(queryParams);
            const finalUrl = url + '?' + query.toString();
            console.log('📡 API 호출:', finalUrl);
            return finalUrl;
        },
        
        ajaxResponse: function(url, params, response) {
            updateClientStatistics(response);
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
                title: "거래처ID",
                field: "client_id",
                width: 100,
                frozen: true,
                hozAlign: "center",
                formatter: function(cell) {
                    return `<strong>${cell.getValue()}</strong>`;
                }
            },
            {
                title: "거래처명",
                field: "client_name",
                width: 250,
                formatter: function(cell) {
                    const clientName = cell.getValue() || '';
                    const isActive = cell.getRow().getData().is_active;
                    
                    let badge = '';
                    if (!isActive) {
                        badge = '<span class="badge badge-secondary">비활성</span>';
                    }
                    
                    return `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="color: #2f5597;">${clientName}</strong>
                            ${badge}
                        </div>
                    `;
                }
            },
            {
                title: "사업자번호",
                field: "business_number",
                width: 140,
                hozAlign: "center",
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value ? `<code>${value}</code>` : '-';
                }
            },
            {
                title: "대표자",
                field: "ceo_name",
                width: 120,
                hozAlign: "center"
            },
            {
                title: "업종",
                field: "industry_type",
                width: 150,
                hozAlign: "center",
                formatter: function(cell) {
                    const row = cell.getRow().getData();
                    const code = cell.getValue();
                    const name = row.industry_name || clientIndustryMap[code] || code;
                    if (!name) return '-';
                    const styleMap = {
                        'AICC': { cls: 'badge-industry-aicc', icon: 'fa-robot' },
                        '공공': { cls: 'badge-industry-public', icon: 'fa-landmark' },
                        '교육': { cls: 'badge-industry-education', icon: 'fa-graduation-cap' },
                        '교통': { cls: 'badge-industry-transport', icon: 'fa-bus' },
                        '금융': { cls: 'badge-industry-finance', icon: 'fa-coins' },
                        '문화': { cls: 'badge-industry-culture', icon: 'fa-theater-masks' },
                        '방송': { cls: 'badge-industry-broadcast', icon: 'fa-broadcast-tower' },
                        '법률': { cls: 'badge-industry-law', icon: 'fa-gavel' },
                        '숙박': { cls: 'badge-industry-hotel', icon: 'fa-hotel' },
                        '의료': { cls: 'badge-industry-health', icon: 'fa-hospital' },
                        '제조': { cls: 'badge-industry-manufacturing', icon: 'fa-industry' }
                    };
                    const style = styleMap[code] || { cls: 'badge-industry-other', icon: 'fa-tag' };

                    return `
                        <span class="badge badge-industry ${style.cls}">
                            <i class="fas ${style.icon}"></i>
                            ${name}
                        </span>
                    `;
                }
            },
            {
                title: "전화번호",
                field: "phone",
                width: 140,
                hozAlign: "center",
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value || '-';
                }
            },
            {
                title: "이메일",
                field: "email",
                width: 200,
                hozAlign: "center",
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value ? `<a href="mailto:${value}">${value}</a>` : '-';
                }
            },
            {
                title: "직원 수",
                field: "employee_count",
                width: 100,
                hozAlign: "right",
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value ? value.toLocaleString() + '명' : '-';
                }
            },
            {
                title: "설립일",
                field: "established_date",
                width: 120,
                hozAlign: "center",
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value || '-';
                }
            },
            {
                title: "등록일",
                field: "created_at",
                width: 120,
                hozAlign: "center",
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value ? value.split('T')[0] : '-';
                }
            },
            {
                title: "수정일",
                field: "updated_at",
                width: 120,
                hozAlign: "center",
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value ? value.split('T')[0] : '-';
                }
            },
            {
                title: "액션",
                field: "actions",
                width: 120,
                headerSort: false,
                hozAlign: "center",
                formatter: function(cell) {
                    const clientId = cell.getRow().getData().client_id;
                    // ⭐ 개선: navigateToClientForm 대신 editClientFromAction 사용
                    return `
                        <div class="client-action-buttons">
                            <button 
                                class="btn-icon" 
                                onclick="editClientFromAction(${clientId})"
                                title="수정"
                                style="background-color: #667eea; color: white; border: none; cursor: pointer;"
                            >
                                <i class="fas fa-edit"></i>
                            </button>
                            <button 
                                class="btn-icon" 
                                onclick="deleteClientFromAction(${clientId})"
                                title="삭제"
                                style="background-color: #e53e3e; color: white; border: none; cursor: pointer;"
                            >
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    `;
                }
            }
        ]
    });
    
    // 행 선택 이벤트
    clientsTable.on("rowSelectionChanged", function(data, rows) {
        updateSelectionActionBar(rows.length);
        updateNewClientButtonState();
    });
    
    // ⭐ 개선: 더블클릭 시 openClientForm 호출 (navigation.js와 통합)
    clientsTable.on("rowDblClick", function(e, row) {
        const clientId = row.getData().client_id;
        console.log('🖱️ 더블클릭:', clientId);
        
        // ⭐ 우선순위: openClientForm > navigateToClientForm
        if (typeof openClientForm === 'function') {
            openClientForm('edit', clientId);
        } else if (typeof navigateToClientForm === 'function') {
            navigateToClientForm('edit', clientId);
        } else {
            console.error('❌ 거래처 폼 열기 함수 없음');
            alert('거래처 폼을 열 수 없습니다. 페이지를 새로고침하세요.');
        }
    });
    
    console.log('✅ 거래처 테이블 초기화 완료');
}

// ===================================
// Update Statistics
// ===================================
function updateClientStatistics(response) {
    const clientsPage = document.getElementById('page-clients-list');
    const statTotal = clientsPage ? clientsPage.querySelector('#statTotal') : document.getElementById('statTotal');
    const statActive = clientsPage ? clientsPage.querySelector('#statActive') : document.getElementById('statActive');
    const statInactive = clientsPage ? clientsPage.querySelector('#statInactive') : document.getElementById('statInactive');
    const statFiltered = clientsPage ? clientsPage.querySelector('#statFiltered') : document.getElementById('statFiltered');

    const toNumber = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    };

    const activeCount = toNumber(response.active_count);
    const inactiveCount = toNumber(response.inactive_count);
    const summedTotal = activeCount + inactiveCount;

    const totalCount =
        (summedTotal > 0 ? summedTotal : 0) ||
        toNumber(response.total) ||
        toNumber(response.total_count) ||
        toNumber(response.count) ||
        toNumber(response.filtered_count) ||
        (response.items ? response.items.length : 0) ||
        0;

    const filteredCount =
        toNumber(response.filtered_count) ||
        toNumber(response.total) ||
        toNumber(response.total_count) ||
        toNumber(response.count) ||
        (response.items ? response.items.length : 0) ||
        0;

    if (statTotal) statTotal.textContent = totalCount;
    if (statActive) statActive.textContent = activeCount;
    if (statInactive) statInactive.textContent = inactiveCount;
    if (statFiltered) statFiltered.textContent = filteredCount;
}

// ===================================
// Event Listeners
// ===================================
function initializeClientEventListeners() {
    // 검색어 입력 시 엔터키
    const searchInput = document.getElementById('clientSearchText');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyClientFilters();
            }
        });
    }

    const industrySelect = document.getElementById('clientIndustryType');
    if (industrySelect) {
        industrySelect.addEventListener('change', () => {
            applyClientFilters();
        });
    }

    const activeSelect = document.getElementById('clientIsActive');
    if (activeSelect) {
        activeSelect.addEventListener('change', () => {
            applyClientFilters();
        });
    }
    
    // ⭐ 개선: [신규] 버튼 클릭 시 openClientForm 호출
    const btnNew = document.getElementById('btnNewClient');
    if (btnNew) {
        btnNew.addEventListener('click', handleNewClientButtonClick);
        updateNewClientButtonState();
        console.log('  ✓ btnNewClient 이벤트 등록 (openClientForm 호출)');
    } else {
        console.warn('  ✗ btnNewClient 요소 없음 - HTML에 id="btnNewClient" 버튼이 필요합니다');
    }
    
    console.log('✅ 거래처 이벤트 리스너 등록 완료');
}

// ===================================
// Filter Functions
// ===================================
function applyClientFilters() {
    console.log('🔍 필터 적용 중...');
    
    const searchField = document.getElementById('clientSearchField');
    const searchText = document.getElementById('clientSearchText');
    const industryType = document.getElementById('clientIndustryType');
    const isActive = document.getElementById('clientIsActive');
    
    currentClientFilters.search_field = searchField ? searchField.value : '';
    currentClientFilters.search_text = searchText ? searchText.value : '';
    currentClientFilters.industry_type = industryType ? industryType.value : '';
    currentClientFilters.is_active = isActive ? isActive.value : '';
    currentClientFilters.page = 1;
    
    console.log('📋 필터 조건:', currentClientFilters);
    
    if (clientsTable) {
        clientsTable.setPage(1);
    }
}

function resetClientFilters() {
    console.log('🔄 필터 초기화');
    
    const searchField = document.getElementById('clientSearchField');
    const searchText = document.getElementById('clientSearchText');
    const industryType = document.getElementById('clientIndustryType');
    const isActive = document.getElementById('clientIsActive');
    
    if (searchField) searchField.value = '';
    if (searchText) searchText.value = '';
    if (industryType) industryType.value = '';
    if (isActive) isActive.value = '';
    
    currentClientFilters = {
        search_field: '',
        search_text: '',
        industry_type: '',
        is_active: '',
        page: 1,
        page_size: 25
    };
    
    if (clientsTable) {
        clientsTable.setPage(1);
    }
}

// ===================================
// New Client Button UX (프로젝트 목록과 동일)
// ===================================
function updateNewClientButtonState() {
    const btn = document.getElementById('btnNewClient');
    if (!btn) {
        console.warn('⚠️ btnNewClient 요소 없음');
        return;
    }

    if (selectedClientRow) {
        btn.innerHTML = '<i class="fas fa-folder-open"></i> 열기';
        btn.title = '선택한 거래처 열기';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
        console.log('  → 거래처 버튼: 열기');
    } else {
        btn.innerHTML = '<i class="fas fa-plus-circle"></i> 신규';
        btn.title = '새 거래처 추가';
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
        console.log('  → 거래처 버튼: 신규');
    }
}

function handleNewClientButtonClick() {
    if (selectedClientRow) {
        const clientId = selectedClientRow.getData().client_id;
        console.log('📂 거래처 열기 버튼 클릭:', clientId);
        if (typeof openClientForm === 'function') {
            openClientForm('edit', clientId);
        } else if (typeof navigateToClientForm === 'function') {
            navigateToClientForm('edit', clientId);
        } else {
            console.error('❌ 거래처 폼 열기 함수 없음');
            alert('거래처 폼을 열 수 없습니다. 페이지를 새로고침하세요.');
        }
        return;
    }

    console.log('➕ 신규 거래처 버튼 클릭');
    if (typeof openClientForm === 'function') {
        openClientForm('new');
    } else if (typeof navigateToClientForm === 'function') {
        navigateToClientForm('new');
    } else {
        console.error('❌ 거래처 폼 열기 함수 없음');
        alert('거래처 폼을 열 수 없습니다. 페이지를 새로고침하세요.');
    }
}

// ===================================
// Selection Functions
// ===================================
function updateSelectionActionBar(count) {
    const actionBar = document.getElementById('clientSelectionActionBar');
    const countSpan = document.getElementById('clientSelectionCount');
    
    if (actionBar && countSpan) {
        if (count > 0) {
            actionBar.style.display = 'flex';
            countSpan.textContent = count;
        } else {
            actionBar.style.display = 'none';
        }
    }
}

function clearClientSelection() {
    if (clientsTable) {
        clientsTable.deselectRow();
    }
}

// ===================================
// Refresh Functions
// ===================================
function refreshClientsList(options = {}) {
    const { resetPage = false } = options;
    console.log('🔄 거래처 목록 새로고침', { resetPage });

    if (!clientsTable) {
        console.warn('⚠️ 거래처 테이블이 초기화되지 않아 새로고침을 건너뜁니다');
        return;
    }

    if (resetPage) {
        clientsTable.setPage(1);
    } else {
        clientsTable.replaceData();
    }

    selectedClientRow = null;
    updateNewClientButtonState();
    updateSelectionActionBar(0);
}

// ===================================
// Navigation Functions (기존 방식 유지 + openClientForm 통합)
// ===================================
function navigateToClientForm(mode, clientId = null) {
    console.log('📍 navigateToClientForm 호출:', mode, clientId);
    
    // ⭐ 우선순위: openClientForm 사용 (navigation.js와 통합)
    if (typeof openClientForm === 'function') {
        console.log('  → openClientForm 사용');
        openClientForm(mode, clientId);
        return;
    }
    
    // 폴백: loadPage 사용 (기존 방식)
    if (typeof loadPage === 'function') {
        console.log('  → loadPage 사용 (폴백)');
        if (mode === 'new') {
            loadPage('clients-form', { mode: 'new' });
        } else if (mode === 'edit' && clientId) {
            loadPage('clients-form', { mode: 'edit', client_id: clientId });
        }
        return;
    }
    
    console.error('❌ openClientForm, loadPage 함수 모두 없음');
    alert('거래처 폼을 열 수 없습니다. 페이지를 새로고침하세요.');
}

function navigateToClientList() {
    console.log('📍 목록으로 이동');
    
    if (typeof loadPage === 'function') {
        loadPage('clients-list');
    } else {
        console.error('❌ loadPage 함수를 찾을 수 없음');
    }
}

// ===================================
// ⭐ 액션 버튼 전역 함수 (신규 추가)
// ===================================
function editClientFromAction(clientId) {
    console.log('✏️ 액션 버튼 - 수정:', clientId);
    navigateToClientForm('edit', clientId);
}

function deleteClientFromAction(clientId) {
    console.log('🗑️ 액션 버튼 - 삭제:', clientId);
    deleteClientById(clientId);
}

// ===================================
// Delete Functions
// ===================================
async function deleteClientById(clientId) {
    if (!confirm('정말로 이 거래처를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        console.log('🗑️ 거래처 삭제:', clientId);
        
        const response = await API.delete(`/clients/${clientId}`);
        
        console.log('✅ 삭제 성공');
        alert('거래처가 삭제되었습니다.');
        
        // 테이블 새로고침
        if (clientsTable) {
            clientsTable.replaceData();
        }
        
    } catch (error) {
        console.error('❌ 삭제 실패:', error);
        alert('거래처 삭제에 실패했습니다: ' + error.message);
    }
}

async function bulkDeleteClients() {
    const selectedRows = clientsTable.getSelectedRows();
    
    if (selectedRows.length === 0) {
        alert('삭제할 거래처를 선택하세요.');
        return;
    }
    
    if (!confirm(`선택한 ${selectedRows.length}개의 거래처를 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        console.log('🗑️ 대량 삭제 시작:', selectedRows.length);
        
        const deletePromises = selectedRows.map(row => {
            const clientId = row.getData().client_id;
            return API.delete(`/clients/${clientId}`);
        });
        
        await Promise.all(deletePromises);
        
        console.log('✅ 대량 삭제 성공');
        alert(`${selectedRows.length}개의 거래처가 삭제되었습니다.`);
        
        // 테이블 새로고침
        if (clientsTable) {
            clientsTable.replaceData();
        }
        
    } catch (error) {
        console.error('❌ 대량 삭제 실패:', error);
        alert('거래처 삭제에 실패했습니다: ' + error.message);
    }
}

// ===================================
// Export Functions
// ===================================
function exportClientsToExcel() {
    if (!clientsTable) {
        console.error('❌ 테이블이 초기화되지 않음');
        return;
    }
    
    console.log('📊 엑셀 다운로드 시작');
    
    clientsTable.download("xlsx", "거래처목록.xlsx", {
        sheetName: "거래처"
    });
}

function bulkExportClients() {
    const selectedRows = clientsTable.getSelectedRows();
    
    if (selectedRows.length === 0) {
        alert('내보낼 거래처를 선택하세요.');
        return;
    }
    
    console.log('📊 선택 항목 엑셀 다운로드:', selectedRows.length);
    
    clientsTable.download("xlsx", "선택거래처.xlsx", {
        sheetName: "선택거래처"
    }, "selected");
}

// ===================================
// Export to window
// ===================================
window.editClientFromAction = editClientFromAction;      // ⭐ 신규 추가 (액션 버튼용)
window.deleteClientFromAction = deleteClientFromAction;  // ⭐ 신규 추가 (액션 버튼용)
window.navigateToClientForm = navigateToClientForm;      // 기존 유지 (호환성)
window.navigateToClientList = navigateToClientList;      // 기존 유지
window.deleteClientById = deleteClientById;
window.bulkDeleteClients = bulkDeleteClients;
window.refreshClientsList = refreshClientsList;
window.exportClientsToExcel = exportClientsToExcel;
window.bulkExportClients = bulkExportClients;
window.applyClientFilters = applyClientFilters;
window.resetClientFilters = resetClientFilters;
window.clearClientSelection = clearClientSelection;
window.bootstrapClientsList = bootstrapClientsList;

console.log('✅ clients-list.js 로드 완료');
