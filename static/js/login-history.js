// ===================================
// static/js/login-history.js
// 접속 이력 관리 화면
// ===================================

let loginHistoryTable = null;
let currentLoginHistoryFilters = {
    login_id: '',
    action_type: '',
    date_from: '',
    date_to: '',
    page: 1,
    page_size: 25
};

function initializeLoginHistory() {
    const tableEl = document.getElementById('loginHistoryTable');
    if (!tableEl) {
        console.log('⚠️ loginHistoryTable 요소 없음, 초기화 스킵');
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(tableEl)) {
        console.log('ℹ️ loginHistoryTable 비활성 페이지, 초기화 스킵');
        return;
    }

    try {
        if (!loginHistoryTable) {
            createLoginHistoryTable();
        }
        bindLoginHistoryEvents();
        console.log('✅ 접속 이력 초기화 완료');
    } catch (error) {
        console.error('❌ 접속 이력 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoginHistory);
} else {
    initializeLoginHistory();
}

function createLoginHistoryTable() {
    const tableEl = document.getElementById('loginHistoryTable');
    if (!tableEl) return;

    const endpoint = API_CONFIG?.ENDPOINTS?.LOGIN_HISTORY || '/login-history';
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    loginHistoryTable = new Tabulator('#loginHistoryTable', {
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
        tableBuilt: function() {
            loginHistoryTable.setPage(1);
        },

        ajaxURL: API_CONFIG.BASE_URL + API_CONFIG.API_VERSION + endpoint + '/list',
        ajaxURLGenerator: function(url, config, params) {
            const queryParams = {
                page: params.page || 1,
                page_size: params.size || 25
            };

            if (currentLoginHistoryFilters.login_id) {
                queryParams.login_id = currentLoginHistoryFilters.login_id;
            }
            if (currentLoginHistoryFilters.action_type) {
                queryParams.action_type = currentLoginHistoryFilters.action_type;
            }
            if (currentLoginHistoryFilters.date_from) {
                queryParams.date_from = currentLoginHistoryFilters.date_from;
            }
            if (currentLoginHistoryFilters.date_to) {
                queryParams.date_to = currentLoginHistoryFilters.date_to;
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
            updateLoginHistorySummary(response);
            return {
                last_page: response.total_pages || 1,
                data: response.items || []
            };
        },
        ajaxError: function(error) {
            console.error('❌ 접속 이력 조회 오류:', error);
            updateLoginHistorySummary({ total: 0, items: [] });
            return { last_page: 1, data: [] };
        },

        columns: [
            { title: "ID", field: "history_id", width: 80, hozAlign: "center" },
            { title: "로그인 ID", field: "login_id", width: 140 },
            {
                title: "구분",
                field: "action_type",
                width: 110,
                hozAlign: "center",
                formatter: (cell) => formatActionType(cell.getValue())
            },
            {
                title: "접속시간",
                field: "action_time",
                width: 180,
                hozAlign: "center",
                formatter: (cell) => formatDateTime(cell.getValue())
            },
            { title: "PC명", field: "pc_name", width: 180 },
            { title: "접속IP", field: "ip_address", width: 160, hozAlign: "center" }
        ]
    });
}

function bindLoginHistoryEvents() {
    const searchBtn = document.getElementById('btnLoginHistorySearch');
    const resetBtn = document.getElementById('btnLoginHistoryReset');
    const exportBtn = document.getElementById('btnLoginHistoryExport');

    if (searchBtn && !searchBtn.dataset.bound) {
        searchBtn.dataset.bound = 'true';
        searchBtn.addEventListener('click', () => {
            applyLoginHistoryFilters();
        });
    }

    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', () => {
            resetLoginHistoryFilters();
        });
    }

    if (exportBtn && !exportBtn.dataset.bound) {
        exportBtn.dataset.bound = 'true';
        exportBtn.addEventListener('click', () => {
            if (!loginHistoryTable) return;
            loginHistoryTable.download('xlsx', 'login_history.xlsx', { sheetName: 'History' });
        });
    }

    const loginInput = document.getElementById('loginHistoryLoginId');
    if (loginInput && !loginInput.dataset.bound) {
        loginInput.dataset.bound = 'true';
        loginInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                applyLoginHistoryFilters();
            }
        });
    }
}

function applyLoginHistoryFilters() {
    currentLoginHistoryFilters.login_id = document.getElementById('loginHistoryLoginId')?.value.trim() || '';
    currentLoginHistoryFilters.action_type = document.getElementById('loginHistoryActionType')?.value || '';
    currentLoginHistoryFilters.date_from = document.getElementById('loginHistoryFrom')?.value || '';
    currentLoginHistoryFilters.date_to = document.getElementById('loginHistoryTo')?.value || '';
    if (loginHistoryTable) {
        loginHistoryTable.setPage(1);
    }
}

function resetLoginHistoryFilters() {
    const loginInput = document.getElementById('loginHistoryLoginId');
    const actionSelect = document.getElementById('loginHistoryActionType');
    const fromInput = document.getElementById('loginHistoryFrom');
    const toInput = document.getElementById('loginHistoryTo');

    if (loginInput) loginInput.value = '';
    if (actionSelect) actionSelect.value = '';
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';

    currentLoginHistoryFilters = {
        login_id: '',
        action_type: '',
        date_from: '',
        date_to: '',
        page: 1,
        page_size: 25
    };
    if (loginHistoryTable) {
        loginHistoryTable.setPage(1);
    }
}

function updateLoginHistorySummary(response) {
    const summaryEl = document.getElementById('loginHistorySummary');
    if (!summaryEl) return;
    const total = response?.total || response?.total_records || 0;
    summaryEl.textContent = `조회 결과: ${Number(total).toLocaleString('ko-KR')}건`;
}

function formatActionType(value) {
    const val = String(value || '').toUpperCase();
    if (val === 'LOGIN') {
        return '<span class="badge badge-success">LOGIN</span>';
    }
    if (val === 'LOGOUT') {
        return '<span class="badge badge-secondary">LOGOUT</span>';
    }
    return value || '-';
}

function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('ko-KR');
}

window.initializeLoginHistory = initializeLoginHistory;
