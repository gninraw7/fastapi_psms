// ===================================
// static/js/users-list.js
// 사용자 목록 관리 JavaScript
// ===================================

// ===================================
// Global State
// ===================================
let usersTable = null;
let currentUserFilters = {
    search_field: '',
    search_text: '',
    status: 'ACTIVE',
    page: 1,
    page_size: 25
};

// ===================================
// Initialization
// ===================================
function bootstrapUsersList() {
    console.log('🚀 사용자 목록 초기화 시작...');

    const usersTableEl = document.getElementById('usersTable');
    if (!usersTableEl) {
        console.log('⚠️ usersTable 요소 없음, 초기화 스킵');
        return;
    }

    try {
        const statusFilter = document.getElementById('userStatusFilter');
        if (statusFilter) {
            statusFilter.value = 'ACTIVE';
        }

        if (!usersTable) {
            initializeUsersTable();
        }
        initializeUserEventListeners();
        if (usersTable) {
            // 강제 로드 (초기 생성/숨김 상태 대비)
            usersTable.setPage(1);
        }
        console.log('✅ 사용자 목록 초기화 완료');
    } catch (error) {
        console.error('❌ 사용자 목록 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapUsersList);
} else {
    bootstrapUsersList();
}

// ===================================
// Initialize Users Table
// ===================================
function initializeUsersTable() {
    const tableEl = document.getElementById('usersTable');
    if (!tableEl) {
        console.error('❌ usersTable 요소를 찾을 수 없음');
        return;
    }

    const usersListEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS_LIST)
        ? API_CONFIG.ENDPOINTS.USERS_LIST
        : "/users/list";

    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    usersTable = new Tabulator("#usersTable", {
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

        ajaxURL: API_CONFIG.BASE_URL + API_CONFIG.API_VERSION + usersListEndpoint,
        ajaxURLGenerator: function(url, config, params) {
            const queryParams = {
                page: params.page || 1,
                page_size: params.size || 25
            };

            if (currentUserFilters.search_text) {
                queryParams.search_text = currentUserFilters.search_text;
                if (currentUserFilters.search_field) {
                    queryParams.search_field = currentUserFilters.search_field;
                }
            }

            if (currentUserFilters.status) {
                queryParams.status = currentUserFilters.status;
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
            updateUserStatistics(response);
            return {
                last_page: response.total_pages || 1,
                data: response.items || []
            };
        },

        ajaxError: function(error) {
            console.error('❌ AJAX 에러:', error);
            return { last_page: 1, data: [] };
        },

        rowDblClick: function(e, row) {
            const data = row.getData();
            openUserForm('edit', data.user_no);
        },
        cellDblClick: function(e, cell) {
            const data = cell.getRow().getData();
            openUserForm('edit', data.user_no);
        },
        rowClick: function(e, row) {
            if (e && e.detail === 2) {
                const data = row.getData();
                openUserForm('edit', data.user_no);
            }
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
                title: "사용자번호",
                field: "user_no",
                width: 90,
                frozen: true,
                hozAlign: "center",
                formatter: cell => `<strong>${cell.getValue()}</strong>`
            },
            {
                title: "로그인 ID",
                field: "login_id",
                width: 140,
                headerSort: true
            },
            {
                title: "사용자명",
                field: "user_name",
                width: 140,
                headerSort: true
            },
            {
                title: "권한",
                field: "role",
                width: 100,
                hozAlign: "center"
            },
            {
                title: "영업담당",
                field: "is_sales_rep",
                width: 100,
                hozAlign: "center",
                formatter: cell => (cell.getValue() ? '<span class="badge badge-success">Y</span>' : '<span class="badge badge-secondary">N</span>')
            },
            {
                title: "이메일",
                field: "email",
                width: 200,
                headerSort: true
            },
            {
                title: "연락처",
                field: "phone",
                width: 130,
                hozAlign: "center"
            },
            {
                title: "조직",
                field: "org_name",
                width: 180,
                headerSort: true
            },
            {
                title: "시작일",
                field: "start_date",
                width: 110,
                hozAlign: "center",
                formatter: cell => Utils.formatDate(cell.getValue())
            },
            {
                title: "종료일",
                field: "end_date",
                width: 110,
                hozAlign: "center",
                formatter: cell => Utils.formatDate(cell.getValue())
            },
            {
                title: "상태",
                field: "status",
                width: 110,
                hozAlign: "center"
            },
            {
                title: "생성일시",
                field: "created_at",
                width: 160,
                hozAlign: "center",
                formatter: cell => Utils.formatDate(cell.getValue())
            },
            {
                title: "수정일시",
                field: "updated_at",
                width: 160,
                hozAlign: "center",
                formatter: cell => Utils.formatDate(cell.getValue())
            },
            {
                title: "생성자",
                field: "created_by",
                width: 120,
                headerSort: true
            },
            {
                title: "수정자",
                field: "updated_by",
                width: 120,
                headerSort: true
            },
            {
                title: "Action",
                field: "action",
                width: 120,
                headerSort: false,
                hozAlign: "center",
                frozen: true,
                formatter: function(cell) {
                    const data = cell.getRow().getData();
                    return `
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            <button class="btn btn-sm btn-primary" onclick="editUserFromAction(${data.user_no})">
                                변경
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUserFromAction(${data.user_no})">
                                삭제
                            </button>
                        </div>
                    `;
                }
            }
        ]
    });

    // DOM dblclick fallback (Tabulator 이벤트 미동작 대비)
    if (tableEl) {
        tableEl.addEventListener('dblclick', (e) => {
            if (!usersTable || typeof usersTable.getRowFromEvent !== 'function') return;
            const row = usersTable.getRowFromEvent(e);
            if (row) {
                const data = row.getData();
                openUserForm('edit', data.user_no);
            }
        });
    }
}

// ===================================
// Event Listeners
// ===================================
function initializeUserEventListeners() {
    const searchInput = document.getElementById('userSearchText');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                applyUserFilters();
            }
        });
    }
}

// ===================================
// Filters
// ===================================
function applyUserFilters() {
    const searchField = document.getElementById('userSearchField');
    const searchText = document.getElementById('userSearchText');
    const statusFilter = document.getElementById('userStatusFilter');

    currentUserFilters.search_field = searchField ? searchField.value : '';
    currentUserFilters.search_text = searchText ? searchText.value.trim() : '';
    currentUserFilters.status = statusFilter ? statusFilter.value : 'ACTIVE';

    if (usersTable) {
        usersTable.setPage(1);
    }
}

function resetUserFilters() {
    const searchField = document.getElementById('userSearchField');
    const searchText = document.getElementById('userSearchText');
    const statusFilter = document.getElementById('userStatusFilter');

    if (searchField) searchField.value = '';
    if (searchText) searchText.value = '';
    if (statusFilter) statusFilter.value = 'ACTIVE';

    currentUserFilters = {
        search_field: '',
        search_text: '',
        status: 'ACTIVE',
        page: 1,
        page_size: 25
    };

    if (usersTable) {
        usersTable.setPage(1);
    }
}

function refreshUsersList() {
    if (usersTable) {
        usersTable.replaceData();
    }
}

// ===================================
// Statistics
// ===================================
function updateUserStatistics(response) {
    const totalEl = document.getElementById('userStatTotal');
    const activeEl = document.getElementById('userStatActive');
    const inactiveEl = document.getElementById('userStatInactive');
    const filteredEl = document.getElementById('userStatFiltered');

    if (totalEl) totalEl.textContent = Utils.formatNumber(response.total_count || response.total || 0);
    if (activeEl) activeEl.textContent = Utils.formatNumber(response.active_count || 0);
    if (inactiveEl) inactiveEl.textContent = Utils.formatNumber(response.inactive_count || 0);
    if (filteredEl) filteredEl.textContent = Utils.formatNumber(response.filtered_count || response.total || 0);
}

// ===================================
// Actions
// ===================================
function editUserFromAction(userNo) {
    openUserForm('edit', userNo);
}

async function deleteUserFromAction(userNo) {
    await deleteUserById(userNo);
}

async function deleteUserById(userNo) {
    if (!confirm('선택한 사용자를 삭제하시겠습니까?')) {
        return;
    }

    try {
        const baseEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS)
            ? API_CONFIG.ENDPOINTS.USERS
            : "/users";
        await API.delete(`${baseEndpoint}/${userNo}`);
        alert('사용자가 삭제되었습니다.');
        refreshUsersList();
    } catch (error) {
        console.error('❌ 사용자 삭제 실패:', error);
        alert('사용자 삭제에 실패했습니다: ' + error.message);
    }
}

async function bulkResetPasswords() {
    if (!usersTable) return;

    const selectedRows = usersTable.getSelectedRows();
    if (selectedRows.length === 0) {
        alert('비밀번호를 초기화할 사용자를 선택하세요.');
        return;
    }

    if (!confirm(`선택한 ${selectedRows.length}명의 비밀번호를 login_id 해시로 초기화할까요?`)) {
        return;
    }

    try {
        const userNos = selectedRows.map(row => row.getData().user_no);
        const actor = window.AUTH?.getUserInfo?.()?.login_id || null;
        const resetEndpoint = (API_CONFIG && API_CONFIG.ENDPOINTS && API_CONFIG.ENDPOINTS.USERS_PASSWORD_RESET)
            ? API_CONFIG.ENDPOINTS.USERS_PASSWORD_RESET
            : "/users/password/reset";
        await API.post(resetEndpoint, { user_nos: userNos, updated_by: actor });
        alert('비밀번호가 초기화되었습니다.');
        refreshUsersList();
    } catch (error) {
        console.error('❌ 비밀번호 초기화 실패:', error);
        alert('비밀번호 초기화에 실패했습니다: ' + error.message);
    }
}

function exportUsersToExcel() {
    if (!usersTable) {
        console.error('❌ 테이블이 초기화되지 않음');
        return;
    }

    usersTable.download("xlsx", "사용자목록.xlsx", {
        sheetName: "사용자"
    });
}

// ===================================
// Export to window
// ===================================
window.refreshUsersList = refreshUsersList;
window.applyUserFilters = applyUserFilters;
window.resetUserFilters = resetUserFilters;
window.exportUsersToExcel = exportUsersToExcel;
window.bulkResetPasswords = bulkResetPasswords;
window.editUserFromAction = editUserFromAction;
window.deleteUserFromAction = deleteUserFromAction;
window.deleteUserById = deleteUserById;
window.initializeUsersTable = initializeUsersTable;
window.bootstrapUsersList = bootstrapUsersList;

console.log('✅ users-list.js 로드 완료');

// 현재 페이지가 users라면 즉시 로드
try {
    const activePage = document.querySelector('.page-content.active');
    if (activePage && activePage.id === 'page-users') {
        bootstrapUsersList();
    }
} catch (e) {
    console.warn('⚠️ 사용자 목록 즉시 로드 실패:', e);
}
