// ===================================
// static/js/sales-plan.js
// 영업계획 UI (목록/입력)
// ===================================

let salesPlanTable = null;
let salesPlanLineTable = null;
let currentSalesPlan = null;
let usingPlanFallback = false;
let cachedSalesPlans = [];
let missingProjectsTable = null;
let isFilterSyncing = false;
let currentPlanEditPipelineId = null;

const PLAN_LINE_FIELDS = [
    { field: 'pipeline_id', title: '파이프라인ID' },
    { field: 'field_name_snapshot', title: '분야' },
    { field: 'service_name_snapshot', title: '서비스' },
    { field: 'customer_name_snapshot', title: '고객사' },
    { field: 'ordering_party_name_snapshot', title: '발주처' },
    { field: 'project_name_snapshot', title: '사업명' },
    { field: 'org_name_snapshot', title: '담당부서' },
    { field: 'manager_name_snapshot', title: '담당자' },
    { field: 'contract_plan_date', title: '계약(예정)일자' },
    { field: 'start_plan_date', title: '계약 시작일' },
    { field: 'end_plan_date', title: '계약 종료일' },
    { field: 'plan_total', title: '계획 합계' }
];

const PLAN_MONTH_FIELDS = Array.from({ length: 12 }, (_, i) => `plan_m${String(i + 1).padStart(2, '0')}`);
const PLAN_COLUMN_GROUPS = {
    base: PLAN_LINE_FIELDS.map(col => col.field),
    month: [...PLAN_MONTH_FIELDS]
};

const SAMPLE_PLANS = [
    {
        plan_id: 1,
        plan_year: 2026,
        plan_version: 'v1',
        status_code: 'DRAFT',
        base_date: '2026-01-05',
        remarks: '본부 초안',
        updated_at: '2026-02-02'
    },
    {
        plan_id: 2,
        plan_year: 2025,
        plan_version: 'v2',
        status_code: 'FINAL',
        base_date: '2025-02-01',
        remarks: '확정본',
        updated_at: '2025-12-20'
    }
];

const SAMPLE_PLAN_LINES = [
    {
        plan_id: 1,
        pipeline_id: '2026-001',
        project_name_snapshot: '스마트팩토리 구축',
        customer_name_snapshot: '에이원테크',
        manager_name_snapshot: '김지훈',
        plan_total: 120000000,
        plan_m01: 10000000,
        plan_m02: 12000000,
        plan_m03: 15000000,
        plan_m04: 10000000,
        plan_m05: 12000000,
        plan_m06: 10000000,
        plan_m07: 9000000,
        plan_m08: 8000000,
        plan_m09: 9000000,
        plan_m10: 7000000,
        plan_m11: 6000000,
        plan_m12: 8000000
    },
    {
        plan_id: 1,
        pipeline_id: '2026-002',
        project_name_snapshot: '공공데이터 플랫폼',
        customer_name_snapshot: '세종시청',
        manager_name_snapshot: '박하늘',
        plan_total: 80000000,
        plan_m01: 0,
        plan_m02: 0,
        plan_m03: 8000000,
        plan_m04: 8000000,
        plan_m05: 8000000,
        plan_m06: 8000000,
        plan_m07: 8000000,
        plan_m08: 8000000,
        plan_m09: 8000000,
        plan_m10: 8000000,
        plan_m11: 8000000,
        plan_m12: 8000000
    }
];

function getPlanFromStorage() {
    try {
        const raw = localStorage.getItem('psms.salesPlan.current');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('⚠️ plan storage parse 실패', error);
        return null;
    }
}

function setPlanToStorage(plan) {
    if (!plan) {
        localStorage.removeItem('psms.salesPlan.current');
        return;
    }
    localStorage.setItem('psms.salesPlan.current', JSON.stringify(plan));
}

function findPlanById(items, planId) {
    if (!planId) return null;
    const target = String(planId);
    return (items || []).find(item => String(item.plan_id) === target) || null;
}

function resolveCurrentPlanFromList(items) {
    const storedPlan = getPlanFromStorage();
    if (storedPlan?.plan_id) {
        const matched = findPlanById(items, storedPlan.plan_id);
        if (matched) return matched;
    }
    if (currentSalesPlan?.plan_id) {
        const matched = findPlanById(items, currentSalesPlan.plan_id);
        if (matched) return matched;
    }
    return (items || [])[0] || null;
}

function resolveSelectedPlanFromTable() {
    if (!salesPlanTable) return currentSalesPlan;
    const selected = salesPlanTable.getSelectedData?.() || [];
    if (selected.length > 0) {
        return selected[0];
    }
    return currentSalesPlan;
}

function normalizePlanStatus(code) {
    switch (code) {
        case 'FINAL':
            return '확정';
        case 'REVIEW':
            return '검토중';
        case 'CANCELLED':
            return '폐기';
        default:
            return '작성중';
    }
}

function isPlanLocked(plan) {
    if (!plan) return false;
    return plan.status_code === 'FINAL' || plan.status_code === 'CANCELLED';
}

function formatNumber(value) {
    if (typeof Utils !== 'undefined' && Utils.formatNumber) {
        return Utils.formatNumber(value || 0);
    }
    return Number(value || 0).toLocaleString('ko-KR');
}

function amountEditor(cell, onRendered, success, cancel) {
    const input = document.createElement('input');
    input.type = 'text';
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.textAlign = 'right';
    input.value = formatNumber(cell.getValue() || 0);

    const commit = () => {
        const value = parsePlanAmountInput(input.value);
        success(value);
    };

    input.addEventListener('focus', () => {
        input.value = String(parsePlanAmountInput(input.value) || '');
        input.select();
    });
    input.addEventListener('input', () => {
        const cleaned = input.value.replace(/[^\d.-]/g, '');
        if (cleaned !== input.value) input.value = cleaned;
    });
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') cancel();
    });

    onRendered(() => {
        input.focus();
        input.select();
    });

    return input;
}

function parsePlanAmountInput(value) {
    const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
}

function bindPlanAmountInputFormatters() {
    const inputs = document.querySelectorAll('#planLineMonthGrid input[id^="planEditM"]');
    inputs.forEach(input => {
        if (input.dataset.boundFormatter) return;
        input.dataset.boundFormatter = 'true';
        input.addEventListener('focus', () => {
            const numeric = parsePlanAmountInput(input.value);
            input.value = numeric ? String(numeric) : '';
            input.select();
        });
        input.addEventListener('blur', () => {
            const numeric = parsePlanAmountInput(input.value);
            input.value = formatNumber(numeric);
        });
    });
}

function getCurrentLoginId() {
    if (typeof AUTH !== 'undefined' && typeof AUTH.getUserInfo === 'function') {
        const info = AUTH.getUserInfo();
        return info?.login_id || info?.loginId || info?.user_id || 'system';
    }
    return 'system';
}

function getPlanColumnStorageKey() {
    return `psms.salesPlan.columns.${getCurrentLoginId()}`;
}

function savePlanColumnSettings() {
    if (!salesPlanLineTable) return;
    const fields = salesPlanLineTable.getColumns()
        .map(col => col.getField())
        .filter(Boolean);
    const hidden = salesPlanLineTable.getColumns()
        .filter(col => col.getField() && !col.isVisible())
        .map(col => col.getField());
    const freezeSelect = document.getElementById('planFreezeColumn');
    const frozen = freezeSelect?.value || '';
    const payload = {
        order: fields,
        hidden,
        frozen
    };
    localStorage.setItem(getPlanColumnStorageKey(), JSON.stringify(payload));
}

function loadPlanColumnSettings() {
    try {
        const raw = localStorage.getItem(getPlanColumnStorageKey());
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('⚠️ 컬럼 설정 로드 실패:', error);
        return null;
    }
}

function populatePlanYearOptions() {
    const select = document.getElementById('planYearFilter');
    if (!select) return;
    const currentYear = new Date().getFullYear();
    const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    select.innerHTML = '<option value="">전체</option>';
    years.forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        select.appendChild(opt);
    });
}

function updatePlanStats(plans, stats) {
    const totalEl = document.getElementById('planStatTotal');
    const latestEl = document.getElementById('planStatLatest');
    const draftEl = document.getElementById('planStatDraft');
    const finalEl = document.getElementById('planStatFinal');

    if (!totalEl) return;

    const total = stats?.total ?? plans.length;
    const latestYear = stats?.latest_year ?? (plans.length ? Math.max(...plans.map(p => p.plan_year || 0)) : '-');
    const draft = stats?.draft ?? plans.filter(p => p.status_code === 'DRAFT').length;
    const final = stats?.final ?? plans.filter(p => p.status_code === 'FINAL').length;

    totalEl.textContent = total;
    latestEl.textContent = latestYear === 0 ? '-' : latestYear;
    draftEl.textContent = draft;
    finalEl.textContent = final;
}

async function fetchSalesPlans(filters = {}) {
    const fallback = { items: SAMPLE_PLANS.slice(), stats: null };
    if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.SALES_PLANS) {
        usingPlanFallback = true;
        return fallback;
    }
    try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        const query = params.toString();
        const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/list${query ? `?${query}` : ''}`);
        return { items: response?.items || [], stats: response?.stats || null };
    } catch (error) {
        console.warn('⚠️ 영업계획 API 실패, 샘플로 대체합니다.', error);
        usingPlanFallback = true;
        return fallback;
    }
}

async function initializeSalesPlanList() {
    const tableEl = document.getElementById('salesPlanTable');
    if (!tableEl || salesPlanTable) return;

    populatePlanYearOptions();

    salesPlanTable = new Tabulator('#salesPlanTable', {
        height: '600px',
        layout: 'fitDataStretch',
        selectable: 1,
        placeholder: '영업계획 데이터가 없습니다.',
        rowFormatter: function(row) {
            const data = row.getData();
            if (data.status_code === 'CANCELLED') {
                row.getElement().style.opacity = '0.6';
                row.getElement().style.background = '#fafafa';
            }
        },
        columns: [
            {
                formatter: "rowSelection",
                titleFormatter: "rowSelection",
                hozAlign: "center",
                headerSort: false,
                width: 50
            },
            {title: 'ID', field: 'plan_id', width: 80, hozAlign: 'center'},
            {title: '연도', field: 'plan_year', width: 90, hozAlign: 'center'},
            {title: '버전', field: 'plan_version', width: 90, hozAlign: 'center'},
            {title: '상태', field: 'status_code', width: 110, hozAlign: 'center', formatter: (cell) => normalizePlanStatus(cell.getValue())},
            {title: '기준일', field: 'base_date', width: 120, hozAlign: 'center'},
            {title: '비고', field: 'remarks', minWidth: 200},
            {title: '최근 수정', field: 'updated_at', width: 140, hozAlign: 'center'}
        ],
        rowClick: (e, row) => {
            currentSalesPlan = row.getData();
            setPlanToStorage(currentSalesPlan);
        },
        rowSelectionChanged: (data) => {
            if (data && data.length > 0) {
                currentSalesPlan = data[0];
                setPlanToStorage(currentSalesPlan);
            }
        },
        rowDblClick: () => {
            if (currentSalesPlan) {
                navigateTo('sales-plan-edit');
            }
        }
    });

    const { items, stats } = await fetchSalesPlans();
    cachedSalesPlans = items;
    salesPlanTable.setData(items);
    updatePlanStats(items, stats);

    bindSalesPlanListEvents();
}

function getPlanListFilters() {
    return {
        plan_year: document.getElementById('planYearFilter')?.value || '',
        plan_version: document.getElementById('planVersionFilter')?.value || '',
        status_code: document.getElementById('planStatusFilter')?.value || '',
        keyword: document.getElementById('planKeywordFilter')?.value || ''
    };
}

function bindSalesPlanListEvents() {
    const newBtn = document.getElementById('btnNewPlan');
    const editBtn = document.getElementById('btnEditPlan');
    const refreshBtn = document.getElementById('btnRefreshPlan');
    const copyBtn = document.getElementById('btnCopyPlan');
    const exportBtn = document.getElementById('btnExportPlan');
    const cancelBtn = document.getElementById('btnCancelPlan');

    if (newBtn) {
        newBtn.addEventListener('click', () => {
            currentSalesPlan = null;
            setPlanToStorage(null);
            navigateTo('sales-plan-edit');
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const selectedPlan = resolveSelectedPlanFromTable();
            if (!selectedPlan) {
                alert('편집할 계획을 선택하세요.');
                return;
            }
            currentSalesPlan = selectedPlan;
            setPlanToStorage(currentSalesPlan);
            navigateTo('sales-plan-edit');
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const { items, stats } = await fetchSalesPlans(getPlanListFilters());
            cachedSalesPlans = items;
            salesPlanTable.setData(items);
            updatePlanStats(items, stats);
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!currentSalesPlan) {
                alert('복사할 계획을 선택하세요.');
                return;
            }
            alert('버전 복사 기능은 API 연동 이후 활성화됩니다.');
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
            const selectedPlan = resolveSelectedPlanFromTable();
            if (!selectedPlan) {
                alert('폐기할 계획을 선택하세요.');
                return;
            }
            if (selectedPlan.status_code === 'CANCELLED') {
                alert('이미 폐기된 계획입니다.');
                return;
            }
            if (!confirm('선택한 계획을 폐기 처리하시겠습니까?')) {
                return;
            }
            await updateSalesPlanStatus(selectedPlan, 'CANCELLED');
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!salesPlanTable) return;
            salesPlanTable.download('xlsx', 'sales_plan_list.xlsx', {sheetName: 'Plans'});
        });
    }
}

async function updateSalesPlanStatus(plan, statusCode) {
    if (!plan?.plan_id) return;
    try {
        const payload = {
            status_code: statusCode,
            updated_by: getCurrentLoginId()
        };
        await API.put(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${plan.plan_id}`, payload);
        if (currentSalesPlan && currentSalesPlan.plan_id === plan.plan_id) {
            currentSalesPlan = { ...currentSalesPlan, status_code: statusCode };
            setPlanToStorage(currentSalesPlan);
        }
        const { items, stats } = await fetchSalesPlans(getPlanListFilters());
        cachedSalesPlans = items;
        if (salesPlanTable) salesPlanTable.setData(items);
        updatePlanStats(items, stats);
        alert('계획 상태가 변경되었습니다.');
    } catch (error) {
        alert('상태 변경 실패: ' + (error.message || error));
    }
}

function buildPlanLineColumns(settings = null) {
    const hiddenSet = new Set(settings?.hidden || []);
    const baseColumns = PLAN_LINE_FIELDS.map((col) => {
        const def = {
            title: col.title,
            field: col.field
        };
        if (col.field === 'pipeline_id') def.width = 120;
        if (col.field === 'project_name_snapshot') def.minWidth = 220;
        if (col.field === 'customer_name_snapshot') def.width = 140;
        if (col.field === 'ordering_party_name_snapshot') def.width = 140;
        if (col.field === 'field_name_snapshot') def.width = 120;
        if (col.field === 'service_name_snapshot') def.width = 140;
        if (col.field === 'org_name_snapshot') def.width = 140;
        if (col.field === 'manager_name_snapshot') def.width = 120;
        if (col.field === 'contract_plan_date') def.width = 140;
        if (col.field === 'start_plan_date') def.width = 140;
        if (col.field === 'end_plan_date') def.width = 140;
        if (col.field === 'plan_total') {
            def.width = 130;
            def.hozAlign = 'right';
            def.formatter = (cell) => formatNumber(cell.getValue());
        }
        if (hiddenSet.has(col.field)) {
            def.visible = false;
        }
        return def;
    });

    const monthColumns = [];
    for (let i = 1; i <= 12; i += 1) {
        const key = `plan_m${String(i).padStart(2, '0')}`;
        monthColumns.push({
            title: `${i}월`,
            field: key,
            hozAlign: 'right',
            editor: amountEditor,
            formatter: (cell) => formatNumber(cell.getValue()),
            cellEdited: (cell) => recalcPlanRowTotal(cell.getRow())
        });
        if (hiddenSet.has(key)) {
            monthColumns[monthColumns.length - 1].visible = false;
        }
    }

    const allColumns = [...baseColumns, ...monthColumns];
    const order = settings?.order || [];
    if (!order.length) return allColumns;

    const columnMap = {};
    allColumns.forEach(col => {
        columnMap[col.field] = col;
    });

    const ordered = [];
    order.forEach(field => {
        if (columnMap[field]) {
            ordered.push(columnMap[field]);
        }
    });
    allColumns.forEach(col => {
        if (!order.includes(col.field)) {
            ordered.push(col);
        }
    });
    return ordered;
}

function recalcPlanRowTotal(row) {
    const data = row.getData();
    let total = 0;
    for (let i = 1; i <= 12; i += 1) {
        const key = `plan_m${String(i).padStart(2, '0')}`;
        total += Number(data[key] || 0);
    }
    row.update({plan_total: total});
    updatePlanConsistencyBadge();
}

function buildPlanLineMonthEditors() {
    const container = document.getElementById('planLineMonthGrid');
    if (!container || container.children.length > 0) return;
    const html = [];
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        html.push(`
            <div class="plan-line-month-item">
                <div class="plan-line-month-item-title">${i}월</div>
                <div>
                    <label for="planEditM${month}">${i}월 금액</label>
                    <input type="text" id="planEditM${month}" class="form-input align-right" inputmode="numeric" autocomplete="off">
                </div>
            </div>
        `);
    }
    container.innerHTML = html.join('');
    bindPlanAmountInputFormatters();
}

function getSelectedPlanLineRow() {
    if (!salesPlanLineTable) return null;
    const selected = salesPlanLineTable.getSelectedData() || [];
    if (!selected.length) return null;
    return selected[0];
}

function openPlanLineEditModal() {
    const selected = getSelectedPlanLineRow();
    if (!selected) {
        alert('입력할 프로젝트를 1건 선택하세요.');
        return;
    }
    currentPlanEditPipelineId = selected.pipeline_id;
    buildPlanLineMonthEditors();

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };
    setValue('planEditPipelineId', selected.pipeline_id || '');
    setValue('planEditProjectName', selected.project_name_snapshot || '');
    setValue('planEditCustomerName', selected.customer_name_snapshot || '');
    setValue('planEditOrgName', selected.org_name_snapshot || '');
    setValue('planEditManagerName', selected.manager_name_snapshot || '');
    setValue('planEditContractDate', selected.contract_plan_date || '');
    setValue('planEditStartDate', selected.start_plan_date || '');
    setValue('planEditEndDate', selected.end_plan_date || '');

    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        setValue(`planEditM${month}`, formatNumber(selected[`plan_m${month}`] || 0));
    }

    const modal = document.getElementById('planLineEditModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closePlanLineEditModal() {
    const modal = document.getElementById('planLineEditModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
}

function applyPlanLineEditModal() {
    if (!salesPlanLineTable || !currentPlanEditPipelineId) return;
    const row = salesPlanLineTable.getRows().find(r => r.getData()?.pipeline_id === currentPlanEditPipelineId);
    if (!row) {
        alert('선택한 프로젝트를 찾을 수 없습니다.');
        return;
    }
    const payload = {
        contract_plan_date: document.getElementById('planEditContractDate')?.value || null,
        start_plan_date: document.getElementById('planEditStartDate')?.value || null,
        end_plan_date: document.getElementById('planEditEndDate')?.value || null
    };
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        payload[`plan_m${month}`] = parsePlanAmountInput(document.getElementById(`planEditM${month}`)?.value);
    }
    row.update(payload);
    recalcPlanRowTotal(row);
    closePlanLineEditModal();
}

function updatePlanConsistencyBadge() {
    const badge = document.getElementById('planConsistencyBadge');
    if (!badge || !salesPlanLineTable) return;
    badge.innerHTML = '<i class="fas fa-circle-check"></i> 합계 계산됨';
}

function loadPlanHeader(plan) {
    const select = document.getElementById('salesPlanSelect');
    const year = document.getElementById('salesPlanYear');
    const version = document.getElementById('salesPlanVersion');
    const status = document.getElementById('salesPlanStatus');
    const baseDate = document.getElementById('salesPlanBaseDate');
    const remarks = document.getElementById('salesPlanRemarks');

    if (!plan) {
        if (select) select.value = '';
        if (year) year.value = new Date().getFullYear();
        if (version) version.value = 'v1';
        if (status) status.value = 'DRAFT';
        if (baseDate) baseDate.value = '';
        if (remarks) remarks.value = '';
        return;
    }

    if (select) select.value = plan.plan_id || '';
    if (year) year.value = plan.plan_year || '';
    if (version) version.value = plan.plan_version || '';
    if (status) status.value = plan.status_code || 'DRAFT';
    if (baseDate) baseDate.value = plan.base_date || '';
    if (remarks) remarks.value = plan.remarks || '';
}

function populatePlanSelect(plans) {
    const select = document.getElementById('salesPlanSelect');
    if (!select) return;
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '새 계획 작성';
    select.appendChild(placeholder);
    plans.forEach(plan => {
        const opt = document.createElement('option');
        opt.value = plan.plan_id;
        opt.textContent = `${plan.plan_year} ${plan.plan_version} (${normalizePlanStatus(plan.status_code)})`;
        select.appendChild(opt);
    });
}

async function fetchPlanLines(planId, filters = {}) {
    if (!planId) return [];
    if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.SALES_PLANS) {
        return SAMPLE_PLAN_LINES.filter(line => line.plan_id === planId);
    }
    try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        const query = params.toString();
        const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${planId}/lines${query ? `?${query}` : ''}`);
        return response?.items || [];
    } catch (error) {
        console.warn('⚠️ 영업계획 라인 조회 실패, 샘플로 대체합니다.', error);
        return SAMPLE_PLAN_LINES.filter(line => line.plan_id === planId);
    }
}

async function initializeSalesPlanEdit() {
    const tableEl = document.getElementById('salesPlanLineTable');
    if (!tableEl) return;

    if (!salesPlanLineTable) {
        const columnSettings = loadPlanColumnSettings();
        const sortElement = window.TABULATOR_COMMON_OPTIONS?.headerSortElement
            || function(column, dir) {
                if (dir === "asc") return "▲";
                if (dir === "desc") return "▼";
                return "";
            };
        salesPlanLineTable = new Tabulator('#salesPlanLineTable', {
            height: '600px',
            layout: 'fitDataStretch',
            selectable: true,
            selectableRangeMode: "click",
            placeholder: '계획 라인 데이터가 없습니다.',
            movableColumns: true,
            headerSortElement: sortElement,
            columnDefaults: {
                headerSort: true
            },
            columns: [
                {
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    hozAlign: "center",
                    headerSort: false,
                    width: 50,
                    frozen: true
                },
                ...buildPlanLineColumns(columnSettings)
            ]
        });
        salesPlanLineTable.on("columnMoved", () => {
            savePlanColumnSettings();
            renderPlanColumnsList();
        });
        salesPlanLineTable.on("columnVisibilityChanged", () => {
            savePlanColumnSettings();
            renderPlanColumnsList();
        });
        populatePlanFreezeOptions();
        const freezeSelect = document.getElementById('planFreezeColumn');
        if (freezeSelect) {
            freezeSelect.value = columnSettings?.frozen || '';
            applyPlanColumnFreeze(freezeSelect.value);
        }
    }

    const { items } = await fetchSalesPlans();
    cachedSalesPlans = items;
    populatePlanSelect(items);

    currentSalesPlan = resolveCurrentPlanFromList(items);
    if (!currentSalesPlan && items.length === 0) {
        const storedPlan = getPlanFromStorage();
        if (storedPlan?.plan_id) {
            currentSalesPlan = storedPlan;
            populatePlanSelect([storedPlan]);
        }
    }
    loadPlanHeader(currentSalesPlan);
    setPlanToStorage(currentSalesPlan);
    if (currentSalesPlan) {
        const lines = await fetchPlanLines(currentSalesPlan.plan_id);
        salesPlanLineTable.setData(lines);
        updatePlanConsistencyBadge();
    } else {
        salesPlanLineTable.setData([]);
    }

    await loadPlanFilters();
    bindSalesPlanEditEvents();
}

async function loadPlanFilters() {
    const orgSelect = document.getElementById('planFilterOrg');
    const managerSelect = document.getElementById('planFilterManager');
    const fieldSelect = document.getElementById('planFilterField');
    const serviceSelect = document.getElementById('planFilterService');

    try {
        if (orgSelect) {
            const response = await API.get(API_CONFIG.ENDPOINTS.ORG_UNITS);
            orgSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.org_id;
                opt.textContent = item.org_name || item.name || item.org_id;
                orgSelect.appendChild(opt);
            });
        }
        if (managerSelect) {
            const response = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
            managerSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.manager_id || item.login_id;
                opt.textContent = item.manager_name || item.user_name || item.login_id;
                managerSelect.appendChild(opt);
            });
        }
        if (fieldSelect) {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.INDUSTRY_FIELDS}/list?is_use=Y`);
            fieldSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.field_code;
                opt.textContent = item.field_name || item.field_code;
                fieldSelect.appendChild(opt);
            });
        }
        if (serviceSelect) {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.SERVICE_CODES}/list?is_use=Y`);
            serviceSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || [])
                .filter(item => item.parent_code !== null && item.parent_code !== undefined && String(item.parent_code).trim() !== '')
                .forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.service_code;
                opt.textContent = item.display_name || item.service_name || item.service_code;
                serviceSelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.warn('⚠️ 영업계획 필터 로딩 실패:', error);
    }

    const keywordInput = document.getElementById('planFilterKeyword');
    const onFilterChanged = () => {
        handleMainFiltersChanged();
    };
    const onKeywordChanged = getDebounced(onFilterChanged, 300);

    if (orgSelect && !orgSelect.dataset.bound) {
        orgSelect.dataset.bound = 'true';
        orgSelect.addEventListener('change', onFilterChanged);
    }
    if (managerSelect && !managerSelect.dataset.bound) {
        managerSelect.dataset.bound = 'true';
        managerSelect.addEventListener('change', onFilterChanged);
    }
    if (fieldSelect && !fieldSelect.dataset.bound) {
        fieldSelect.dataset.bound = 'true';
        fieldSelect.addEventListener('change', onFilterChanged);
    }
    if (serviceSelect && !serviceSelect.dataset.bound) {
        serviceSelect.dataset.bound = 'true';
        serviceSelect.addEventListener('change', onFilterChanged);
    }
    if (keywordInput && !keywordInput.dataset.bound) {
        keywordInput.dataset.bound = 'true';
        keywordInput.addEventListener('input', onKeywordChanged);
    }
    const onlyUnplanned = document.getElementById('missingOnlyUnplanned');
    if (onlyUnplanned && !onlyUnplanned.dataset.bound) {
        onlyUnplanned.dataset.bound = 'true';
        onlyUnplanned.addEventListener('change', onFilterChanged);
    }
}

function getPlanLineFilters() {
    return {
        org_id: document.getElementById('planFilterOrg')?.value || '',
        manager_id: document.getElementById('planFilterManager')?.value || '',
        field_code: document.getElementById('planFilterField')?.value || '',
        service_code: document.getElementById('planFilterService')?.value || '',
        keyword: document.getElementById('planFilterKeyword')?.value || ''
    };
}

function clearPlanFilters() {
    const orgSelect = document.getElementById('planFilterOrg');
    const managerSelect = document.getElementById('planFilterManager');
    const fieldSelect = document.getElementById('planFilterField');
    const serviceSelect = document.getElementById('planFilterService');
    const keywordInput = document.getElementById('planFilterKeyword');

    if (orgSelect) orgSelect.value = '';
    if (managerSelect) managerSelect.value = '';
    if (fieldSelect) fieldSelect.value = '';
    if (serviceSelect) serviceSelect.value = '';
    if (keywordInput) keywordInput.value = '';
}

function buildQueryParams(filters) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            params.append(key, value);
        }
    });
    return params.toString();
}

function getMissingFilters() {
    const orgSelect = document.getElementById('missingFilterOrg');
    const managerSelect = document.getElementById('missingFilterManager');
    const fieldSelect = document.getElementById('missingFilterField');
    const serviceSelect = document.getElementById('missingFilterService');
    const keywordInput = document.getElementById('missingFilterKeyword');

    if (!orgSelect && !managerSelect && !fieldSelect && !serviceSelect && !keywordInput) {
        return getPlanLineFilters();
    }

    return {
        org_id: orgSelect?.value || '',
        manager_id: managerSelect?.value || '',
        field_code: fieldSelect?.value || '',
        service_code: serviceSelect?.value || '',
        keyword: keywordInput?.value || ''
    };
}

function clearMissingFilters() {
    const orgSelect = document.getElementById('missingFilterOrg');
    const managerSelect = document.getElementById('missingFilterManager');
    const fieldSelect = document.getElementById('missingFilterField');
    const serviceSelect = document.getElementById('missingFilterService');
    const keywordInput = document.getElementById('missingFilterKeyword');

    if (orgSelect) orgSelect.value = '';
    if (managerSelect) managerSelect.value = '';
    if (fieldSelect) fieldSelect.value = '';
    if (serviceSelect) serviceSelect.value = '';
    if (keywordInput) keywordInput.value = '';
}

function syncMissingFiltersFromMain() {
    const mainFilters = getPlanLineFilters();
    const orgSelect = document.getElementById('missingFilterOrg');
    const managerSelect = document.getElementById('missingFilterManager');
    const fieldSelect = document.getElementById('missingFilterField');
    const serviceSelect = document.getElementById('missingFilterService');
    const keywordInput = document.getElementById('missingFilterKeyword');

    if (orgSelect) orgSelect.value = mainFilters.org_id || '';
    if (managerSelect) managerSelect.value = mainFilters.manager_id || '';
    if (fieldSelect) fieldSelect.value = mainFilters.field_code || '';
    if (serviceSelect) serviceSelect.value = mainFilters.service_code || '';
    if (keywordInput) keywordInput.value = mainFilters.keyword || '';
}

function syncMainFiltersFromMissing() {
    const filters = getMissingFilters();
    const orgSelect = document.getElementById('planFilterOrg');
    const managerSelect = document.getElementById('planFilterManager');
    const fieldSelect = document.getElementById('planFilterField');
    const serviceSelect = document.getElementById('planFilterService');
    const keywordInput = document.getElementById('planFilterKeyword');

    if (orgSelect) orgSelect.value = filters.org_id || '';
    if (managerSelect) managerSelect.value = filters.manager_id || '';
    if (fieldSelect) fieldSelect.value = filters.field_code || '';
    if (serviceSelect) serviceSelect.value = filters.service_code || '';
    if (keywordInput) keywordInput.value = filters.keyword || '';
}

function getDebounced(fn, wait = 300) {
    if (typeof Utils !== 'undefined' && typeof Utils.debounce === 'function') {
        return Utils.debounce(fn, wait);
    }
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}

async function handleMissingFiltersChanged() {
    if (isFilterSyncing) return;
    isFilterSyncing = true;
    try {
        syncMainFiltersFromMissing();
        if (currentSalesPlan?.plan_id && salesPlanLineTable) {
            const lines = await fetchPlanLines(currentSalesPlan.plan_id, getPlanLineFilters());
            salesPlanLineTable.setData(lines);
            updatePlanConsistencyBadge();
        }
        await refreshMissingProjects();
    } finally {
        isFilterSyncing = false;
    }
}

function isMissingModalOpen() {
    const modal = document.getElementById('missingProjectsModal');
    return !!(modal && modal.classList.contains('active'));
}

async function handleMainFiltersChanged() {
    if (isFilterSyncing) return;
    isFilterSyncing = true;
    try {
        if (currentSalesPlan?.plan_id && salesPlanLineTable) {
            const lines = await fetchPlanLines(currentSalesPlan.plan_id, getPlanLineFilters());
            salesPlanLineTable.setData(lines);
            updatePlanConsistencyBadge();
        }
        if (isMissingModalOpen()) {
            syncMissingFiltersFromMain();
            await refreshMissingProjects();
        }
    } finally {
        isFilterSyncing = false;
    }
}

function getPlanColumnMeta() {
    const meta = [...PLAN_LINE_FIELDS];
    for (let i = 1; i <= 12; i += 1) {
        meta.push({
            field: `plan_m${String(i).padStart(2, '0')}`,
            title: `${i}월`
        });
    }
    return meta;
}

function populatePlanFreezeOptions() {
    const select = document.getElementById('planFreezeColumn');
    if (!select) return;
    select.innerHTML = '<option value=\"\">고정 없음</option>';
    PLAN_LINE_FIELDS.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.field;
        opt.textContent = `${col.title}까지`;
        select.appendChild(opt);
    });
}

function applyPlanColumnFreeze(targetField) {
    if (!salesPlanLineTable) return;
    const leafColumns = salesPlanLineTable.getColumns(true);
    let targetIndex = -1;

    leafColumns.forEach((col, idx) => {
        const field = col.getField?.();
        if (field === targetField) {
            targetIndex = idx;
        }
    });

    leafColumns.forEach((col, idx) => {
        const field = col.getField?.();
        const isSelection = !field;
        if (!targetField) {
            col.setFrozen(isSelection);
            return;
        }
        if (targetIndex < 0) {
            col.setFrozen(isSelection);
            return;
        }
        col.setFrozen(idx <= targetIndex || isSelection);
    });

    salesPlanLineTable.redraw(true);
}

function openPlanColumnsModal() {
    const modal = document.getElementById('planColumnsModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
    renderPlanColumnsList();
}

function closePlanColumnsModal() {
    const modal = document.getElementById('planColumnsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function renderPlanColumnsList() {
    const container = document.getElementById('planColumnsList');
    if (!container || !salesPlanLineTable) return;
    container.innerHTML = '';
    const groups = [
        { key: 'base', title: '기본정보', fields: PLAN_COLUMN_GROUPS.base },
        { key: 'month', title: '월별', fields: PLAN_COLUMN_GROUPS.month }
    ];

    groups.forEach(group => {
        const section = document.createElement('div');
        section.className = 'column-group-section';

        const header = document.createElement('div');
        header.className = 'column-group-header';
        header.textContent = group.title;
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'column-group-grid';

        group.fields.forEach(field => {
            const col = salesPlanLineTable.getColumn(field);
            if (!col) return;
            const title = col.getDefinition().title || field;
            const isVisible = col.isVisible();

            const wrapper = document.createElement('label');
            wrapper.className = 'column-visibility-item';
            if (!isVisible) wrapper.classList.add('is-hidden');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isVisible;
            checkbox.dataset.field = field;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    col.show();
                } else {
                    col.hide();
                }
                savePlanColumnSettings();
                renderPlanColumnsList();
            });

            const text = document.createElement('span');
            text.textContent = title;

            wrapper.appendChild(checkbox);
            wrapper.appendChild(text);
            grid.appendChild(wrapper);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

function setAllPlanColumns(show) {
    if (!salesPlanLineTable) return;
    salesPlanLineTable.getColumns().forEach(col => {
        if (!col.getField()) return;
        if (show) col.show();
        else col.hide();
    });
    savePlanColumnSettings();
    renderPlanColumnsList();
}

function togglePlanColumnGroup(groupKey) {
    if (!salesPlanLineTable) return;
    const fields = PLAN_COLUMN_GROUPS[groupKey] || [];
    const columns = fields.map(field => salesPlanLineTable.getColumn(field)).filter(Boolean);
    if (!columns.length) return;
    const allVisible = columns.every(col => col.isVisible());
    columns.forEach(col => {
        if (allVisible) col.hide();
        else col.show();
    });
    savePlanColumnSettings();
    renderPlanColumnsList();
}

function bindSalesPlanEditEvents() {
    const select = document.getElementById('salesPlanSelect');
    if (select && !select.dataset.bound) {
        select.dataset.bound = 'true';
        select.addEventListener('change', async () => {
            const planId = select.value;
            currentSalesPlan = findPlanById(cachedSalesPlans, planId) || null;
            setPlanToStorage(currentSalesPlan);
            loadPlanHeader(currentSalesPlan);
            if (currentSalesPlan) {
                const lines = await fetchPlanLines(currentSalesPlan.plan_id, getPlanLineFilters());
                salesPlanLineTable.setData(lines);
                updatePlanConsistencyBadge();
            } else {
                salesPlanLineTable.setData([]);
            }
        });
    }

    const recalcBtn = document.getElementById('btnPlanRecalc');
    if (recalcBtn) {
        recalcBtn.addEventListener('click', () => {
            if (!salesPlanLineTable) return;
            salesPlanLineTable.getRows().forEach(row => recalcPlanRowTotal(row));
        });
    }

    const saveBtn = document.getElementById('btnPlanSave');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!currentSalesPlan?.plan_id) {
                alert('먼저 계획 헤더를 저장하세요.');
                return;
            }
            if (isPlanLocked(currentSalesPlan)) {
                alert('확정 또는 폐기된 계획은 수정할 수 없습니다.');
                return;
            }
            const payload = {
                plan_id: currentSalesPlan.plan_id,
                updated_by: getCurrentLoginId(),
                lines: salesPlanLineTable.getData()
            };
            try {
                await API.post(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${currentSalesPlan.plan_id}/lines`, payload);
                alert('계획 라인이 저장되었습니다.');
            } catch (error) {
                alert('계획 라인 저장 실패: ' + (error.message || error));
            }
        });
    }

    const importBtn = document.getElementById('btnPlanImport');
    if (importBtn && !importBtn.dataset.bound) {
        importBtn.dataset.bound = 'true';
        importBtn.addEventListener('click', async () => {
            if (!currentSalesPlan?.plan_id) {
                alert('먼저 계획을 선택/저장하세요.');
                return;
            }
            if (isPlanLocked(currentSalesPlan)) {
                alert('확정 또는 폐기된 계획은 수정할 수 없습니다.');
                return;
            }
            openMissingProjectsModal();
            await loadMissingFilters();
            syncMissingFiltersFromMain();
            await refreshMissingProjects();
        });
    }

    const excludeBtn = document.getElementById('btnPlanExclude');
    if (excludeBtn && !excludeBtn.dataset.bound) {
        excludeBtn.dataset.bound = 'true';
        excludeBtn.addEventListener('click', async () => {
            if (!currentSalesPlan?.plan_id) {
                alert('먼저 계획을 선택하세요.');
                return;
            }
            if (isPlanLocked(currentSalesPlan)) {
                alert('확정 또는 폐기된 계획은 제외할 수 없습니다.');
                return;
            }
            if (!salesPlanLineTable) return;
            const selected = salesPlanLineTable.getSelectedData() || [];
            if (selected.length === 0) {
                alert('제외할 행을 선택하세요.');
                return;
            }
            const payload = {
                plan_line_ids: selected.map(row => row.plan_line_id).filter(Boolean),
                pipeline_ids: selected.map(row => row.pipeline_id).filter(Boolean),
                updated_by: getCurrentLoginId()
            };
            try {
                await API.post(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${currentSalesPlan.plan_id}/lines/delete`, payload);
                const lines = await fetchPlanLines(currentSalesPlan.plan_id, getPlanLineFilters());
                salesPlanLineTable.setData(lines);
                updatePlanConsistencyBadge();
            } catch (error) {
                alert('선택 제외 실패: ' + (error.message || error));
            }
        });
    }

    const showAllBtn = document.getElementById('btnPlanShowAll');
    if (showAllBtn && !showAllBtn.dataset.bound) {
        showAllBtn.dataset.bound = 'true';
        showAllBtn.addEventListener('click', async () => {
            if (!currentSalesPlan?.plan_id) {
                alert('먼저 계획을 선택하세요.');
                return;
            }
            clearPlanFilters();
            const lines = await fetchPlanLines(currentSalesPlan.plan_id, {});
            salesPlanLineTable.setData(lines);
            updatePlanConsistencyBadge();
        });
    }

    const filterSearchBtn = document.getElementById('btnPlanSearch');
    if (filterSearchBtn && !filterSearchBtn.dataset.bound) {
        filterSearchBtn.dataset.bound = 'true';
        filterSearchBtn.addEventListener('click', async () => {
            await handleMainFiltersChanged();
        });
    }

    const exportBtn = document.getElementById('btnPlanExport');
    if (exportBtn && !exportBtn.dataset.bound) {
        exportBtn.dataset.bound = 'true';
        exportBtn.addEventListener('click', () => {
            if (!salesPlanLineTable) return;
            salesPlanLineTable.download('xlsx', 'sales_plan_lines.xlsx', {sheetName: 'PlanLines'});
        });
    }

    const columnsBtn = document.getElementById('btnPlanColumns');
    if (columnsBtn && !columnsBtn.dataset.bound) {
        columnsBtn.dataset.bound = 'true';
        columnsBtn.addEventListener('click', () => {
            openPlanColumnsModal();
        });
    }

    const editSelectedBtn = document.getElementById('btnPlanEditSelected');
    if (editSelectedBtn && !editSelectedBtn.dataset.bound) {
        editSelectedBtn.dataset.bound = 'true';
        editSelectedBtn.addEventListener('click', () => {
            openPlanLineEditModal();
        });
    }

    const lineApplyBtn = document.getElementById('btnPlanLineApply');
    if (lineApplyBtn && !lineApplyBtn.dataset.bound) {
        lineApplyBtn.dataset.bound = 'true';
        lineApplyBtn.addEventListener('click', () => {
            applyPlanLineEditModal();
        });
    }

    const freezeSelect = document.getElementById('planFreezeColumn');
    if (freezeSelect && !freezeSelect.dataset.bound) {
        freezeSelect.dataset.bound = 'true';
        freezeSelect.addEventListener('change', () => {
            applyPlanColumnFreeze(freezeSelect.value);
            savePlanColumnSettings();
        });
    }

    const headerSaveBtn = document.getElementById('btnPlanHeaderSave');
    if (headerSaveBtn && !headerSaveBtn.dataset.bound) {
        headerSaveBtn.dataset.bound = 'true';
        headerSaveBtn.addEventListener('click', async () => {
            if (currentSalesPlan && isPlanLocked(currentSalesPlan)) {
                alert('확정 또는 폐기된 계획은 수정할 수 없습니다.');
                return;
            }
            const payload = {
                plan_year: Number(document.getElementById('salesPlanYear')?.value || new Date().getFullYear()),
                plan_version: document.getElementById('salesPlanVersion')?.value || 'v1',
                status_code: document.getElementById('salesPlanStatus')?.value || 'DRAFT',
                base_date: document.getElementById('salesPlanBaseDate')?.value || null,
                remarks: document.getElementById('salesPlanRemarks')?.value || null,
                created_by: getCurrentLoginId(),
                updated_by: getCurrentLoginId()
            };

            try {
                if (currentSalesPlan?.plan_id) {
                    await API.put(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${currentSalesPlan.plan_id}`, payload);
                    alert('계획 헤더가 저장되었습니다.');
                } else {
                    const response = await API.post(`${API_CONFIG.ENDPOINTS.SALES_PLANS}`, payload);
                    const newId = response?.plan_id;
                    if (newId) {
                        currentSalesPlan = { ...payload, plan_id: newId };
                        setPlanToStorage(currentSalesPlan);
                    }
                    alert('계획 헤더가 생성되었습니다.');
                }
                const listResponse = await fetchSalesPlans();
                cachedSalesPlans = listResponse.items;
                populatePlanSelect(listResponse.items);
                loadPlanHeader(currentSalesPlan);
            } catch (error) {
                alert('계획 헤더 저장 실패: ' + (error.message || error));
            }
        });
    }
}

function openMissingProjectsModal() {
    const modal = document.getElementById('missingProjectsModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeMissingProjectsModal() {
    const modal = document.getElementById('missingProjectsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

async function refreshMissingProjects() {
    if (!currentSalesPlan?.plan_id) return;
    const summary = document.getElementById('missingProjectsFilterSummary');
    const currentLineSummary = document.getElementById('missingProjectsCurrentLineSummary');
    const onlyUnplanned = !!document.getElementById('missingOnlyUnplanned')?.checked;
    const existingSet = new Set((salesPlanLineTable?.getData() || []).map(row => row.pipeline_id));

    if (currentLineSummary) {
        const selectedRows = salesPlanLineTable?.getSelectedData?.() || [];
        const selectedIds = selectedRows.slice(0, 5).map(row => row.pipeline_id).filter(Boolean);
        const selectedText = selectedRows.length
            ? `선택 ${selectedRows.length}건${selectedIds.length ? ` (${selectedIds.join(', ')}${selectedRows.length > 5 ? '...' : ''})` : ''}`
            : '선택 없음';
        currentLineSummary.textContent = `현재 계획 라인: 총 ${existingSet.size}건 | 현재 선택: ${selectedText}`;
    }

    if (summary) {
        const filters = getMissingFilters();
        const parts = [];
        parts.push(onlyUnplanned ? '옵션: 미편성만' : '옵션: 전체 프로젝트');
        if (filters.org_id) parts.push(`조직: ${filters.org_id}`);
        if (filters.manager_id) parts.push(`담당자: ${filters.manager_id}`);
        if (filters.field_code) parts.push(`분야: ${filters.field_code}`);
        if (filters.service_code) parts.push(`서비스: ${filters.service_code}`);
        if (filters.keyword) parts.push(`검색어: ${filters.keyword}`);
        summary.textContent = parts.length ? `현재 필터 조건: ${parts.join(' / ')}` : '현재 필터 조건 없음 (전체)';
    }

    if (!missingProjectsTable) {
        missingProjectsTable = new Tabulator('#missingProjectsTable', {
            height: '520px',
            layout: 'fitDataStretch',
            selectable: true,
            placeholder: '조회된 프로젝트가 없습니다.',
            columns: [
                {
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    hozAlign: "center",
                    headerSort: false,
                    width: 50
                },
                {title: '반영상태', field: '_registered_label', width: 110, hozAlign: 'center'},
                {title: '파이프라인', field: 'pipeline_id', width: 120},
                {title: '프로젝트명', field: 'project_name', minWidth: 200},
                {title: '고객사', field: 'customer_name', width: 140},
                {title: '발주처', field: 'ordering_party_name', width: 140},
                {title: '분야', field: 'field_name', width: 120},
                {title: '서비스', field: 'service_name', width: 140},
                {title: '조직', field: 'org_name', width: 140},
                {title: '담당자', field: 'manager_name', width: 120}
            ]
        });
    }

    const params = buildQueryParams(getMissingFilters());
    try {
        let items = [];
        if (onlyUnplanned) {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${currentSalesPlan.plan_id}/missing-projects${params ? `?${params}` : ''}`);
            items = response?.items || [];
        } else {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECTS_LIST}?${buildQueryParams({
                page: 1,
                page_size: 500,
                ...getMissingFilters()
            })}`);
            items = response?.items || [];
        }
        const withStatus = items.map(row => ({
            ...row,
            _registered: existingSet.has(row.pipeline_id),
            _registered_label: existingSet.has(row.pipeline_id) ? '반영됨' : '미반영'
        }));
        missingProjectsTable.setData(withStatus);
    } catch (error) {
        alert('대상 프로젝트 조회 실패: ' + (error.message || error));
    }
}

async function addSelectedMissingProjects() {
    if (!currentSalesPlan?.plan_id) return;
    if (!missingProjectsTable) return;
    const selected = missingProjectsTable.getSelectedData() || [];
    if (selected.length === 0) {
        alert('반영할 프로젝트를 선택하세요.');
        return;
    }
    const existingSet = new Set((salesPlanLineTable?.getData() || []).map(row => row.pipeline_id));
    const selectedForAdd = selected.filter(row => !existingSet.has(row.pipeline_id));
    if (!selectedForAdd.length) {
        alert('선택된 항목은 모두 이미 반영되어 있습니다.');
        return;
    }
    const payload = {
        plan_id: currentSalesPlan.plan_id,
        updated_by: getCurrentLoginId(),
        lines: selectedForAdd.map(row => ({ pipeline_id: row.pipeline_id }))
    };
    try {
        await API.post(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${currentSalesPlan.plan_id}/lines`, payload);
        const lines = await fetchPlanLines(currentSalesPlan.plan_id, getPlanLineFilters());
        salesPlanLineTable.setData(lines);
        updatePlanConsistencyBadge();
        await refreshMissingProjects();
    } catch (error) {
        alert('대상 프로젝트 반영 실패: ' + (error.message || error));
    }
}

async function loadMissingFilters() {
    const orgSelect = document.getElementById('missingFilterOrg');
    const managerSelect = document.getElementById('missingFilterManager');
    const fieldSelect = document.getElementById('missingFilterField');
    const serviceSelect = document.getElementById('missingFilterService');

    try {
        if (orgSelect) {
            const response = await API.get(API_CONFIG.ENDPOINTS.ORG_UNITS);
            orgSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.org_id;
                opt.textContent = item.org_name || item.name || item.org_id;
                orgSelect.appendChild(opt);
            });
        }
        if (managerSelect) {
            const response = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
            managerSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.manager_id || item.login_id;
                opt.textContent = item.manager_name || item.user_name || item.login_id;
                managerSelect.appendChild(opt);
            });
        }
        if (fieldSelect) {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.INDUSTRY_FIELDS}/list?is_use=Y`);
            fieldSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.field_code;
                opt.textContent = item.field_name || item.field_code;
                fieldSelect.appendChild(opt);
            });
        }
        if (serviceSelect) {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.SERVICE_CODES}/list?is_use=Y`);
            serviceSelect.innerHTML = '<option value=\"\">전체</option>';
            (response?.items || [])
                .filter(item => item.parent_code !== null && item.parent_code !== undefined && String(item.parent_code).trim() !== '')
                .forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.service_code;
                opt.textContent = item.display_name || item.service_name || item.service_code;
                serviceSelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.warn('⚠️ 미편성 필터 로딩 실패:', error);
    }

    const keywordInput = document.getElementById('missingFilterKeyword');
    const onFilterChanged = () => {
        handleMissingFiltersChanged();
    };
    const onKeywordChanged = getDebounced(onFilterChanged, 300);

    if (orgSelect && !orgSelect.dataset.bound) {
        orgSelect.dataset.bound = 'true';
        orgSelect.addEventListener('change', onFilterChanged);
    }
    if (managerSelect && !managerSelect.dataset.bound) {
        managerSelect.dataset.bound = 'true';
        managerSelect.addEventListener('change', onFilterChanged);
    }
    if (fieldSelect && !fieldSelect.dataset.bound) {
        fieldSelect.dataset.bound = 'true';
        fieldSelect.addEventListener('change', onFilterChanged);
    }
    if (serviceSelect && !serviceSelect.dataset.bound) {
        serviceSelect.dataset.bound = 'true';
        serviceSelect.addEventListener('change', onFilterChanged);
    }
    if (keywordInput && !keywordInput.dataset.bound) {
        keywordInput.dataset.bound = 'true';
        keywordInput.addEventListener('input', onKeywordChanged);
    }

    const applyBtn = document.getElementById('btnMissingApply');
    if (applyBtn && !applyBtn.dataset.bound) {
        applyBtn.dataset.bound = 'true';
        applyBtn.addEventListener('click', async () => {
            syncMainFiltersFromMissing();
            if (currentSalesPlan?.plan_id && salesPlanLineTable) {
                const lines = await fetchPlanLines(currentSalesPlan.plan_id, getPlanLineFilters());
                salesPlanLineTable.setData(lines);
                updatePlanConsistencyBadge();
            }
            await refreshMissingProjects();
        });
    }

    const resetBtn = document.getElementById('btnMissingReset');
    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', async () => {
            clearMissingFilters();
            syncMainFiltersFromMissing();
            if (currentSalesPlan?.plan_id && salesPlanLineTable) {
                const lines = await fetchPlanLines(currentSalesPlan.plan_id, getPlanLineFilters());
                salesPlanLineTable.setData(lines);
                updatePlanConsistencyBadge();
            }
            await refreshMissingProjects();
        });
    }
}

window.openMissingProjectsModal = openMissingProjectsModal;
window.closeMissingProjectsModal = closeMissingProjectsModal;
window.refreshMissingProjects = refreshMissingProjects;
window.addSelectedMissingProjects = addSelectedMissingProjects;
window.openPlanColumnsModal = openPlanColumnsModal;
window.closePlanColumnsModal = closePlanColumnsModal;
window.closePlanLineEditModal = closePlanLineEditModal;
window.setAllPlanColumns = setAllPlanColumns;
window.togglePlanColumnGroup = togglePlanColumnGroup;

// DOMContentLoaded Hook

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('salesPlanTable')) {
        initializeSalesPlanList();
    }
    if (document.getElementById('salesPlanLineTable')) {
        initializeSalesPlanEdit();
    }
});

// Expose to navigation
window.initializeSalesPlanList = initializeSalesPlanList;
window.initializeSalesPlanEdit = initializeSalesPlanEdit;
