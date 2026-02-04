// ===================================
// static/js/sales-actual.js
// 실적관리 UI (등록/현황)
// ===================================

let salesActualLineTable = null;
let salesActualSummaryTable = null;
let cachedActualLines = [];
let currentActualViewMode = 'group';

const ACTUAL_BASE_FIELDS = [
    { field: 'pipeline_id', title: '파이프라인ID' },
    { field: 'field_name_snapshot', title: '분야' },
    { field: 'service_name_snapshot', title: '서비스' },
    { field: 'customer_name_snapshot', title: '고객사' },
    { field: 'ordering_party_name_snapshot', title: '발주처' },
    { field: 'project_name_snapshot', title: '사업명' },
    { field: 'org_name_snapshot', title: '담당부서' },
    { field: 'manager_name_snapshot', title: '담당자' },
    { field: 'contract_date', title: '계약(예정)일자' },
    { field: 'start_date', title: '계약 시작일' },
    { field: 'end_date', title: '계약 종료일' },
    { field: 'order_total', title: '수주합계' },
    { field: 'profit_total', title: '이익합계' }
];

const ACTUAL_MONTH_FIELDS = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return [
        { field: `m${month}_order`, title: `${i + 1}월 수주` },
        { field: `m${month}_profit`, title: `${i + 1}월 이익` }
    ];
}).flat();

const ACTUAL_COLUMN_GROUPS = {
    base: ACTUAL_BASE_FIELDS.map(col => col.field),
    month: ACTUAL_MONTH_FIELDS.map(col => col.field)
};

const SAMPLE_ACTUAL_LINES = [
    {
        pipeline_id: '2026-001',
        field_name_snapshot: '제조',
        service_name_snapshot: '스마트팩토리',
        project_name_snapshot: '스마트팩토리 구축',
        customer_name_snapshot: '에이원테크',
        ordering_party_name_snapshot: '에이원테크',
        org_name_snapshot: '디지털사업본부',
        manager_name_snapshot: '김지훈',
        order_total: 95000000,
        profit_total: 22000000,
        m01_order: 10000000,
        m01_profit: 2000000,
        m02_order: 8000000,
        m02_profit: 1500000
    },
    {
        pipeline_id: '2026-002',
        field_name_snapshot: '공공',
        service_name_snapshot: '데이터플랫폼',
        project_name_snapshot: '공공데이터 플랫폼',
        customer_name_snapshot: '세종시청',
        ordering_party_name_snapshot: '세종시청',
        org_name_snapshot: '공공사업본부',
        manager_name_snapshot: '박하늘',
        order_total: 70000000,
        profit_total: 18000000,
        m01_order: 0,
        m01_profit: 0,
        m02_order: 5000000,
        m02_profit: 1200000
    }
];

const SAMPLE_ACTUAL_SUMMARY = [
    {group_name: '디지털사업본부', order_total: 165000000, profit_total: 40000000},
    {group_name: '공공사업본부', order_total: 90000000, profit_total: 23000000}
];

function formatNumber(value) {
    if (typeof Utils !== 'undefined' && Utils.formatNumber) {
        return Utils.formatNumber(value || 0);
    }
    return Number(value || 0).toLocaleString('ko-KR');
}

function getCurrentLoginId() {
    if (typeof AUTH !== 'undefined' && typeof AUTH.getUserInfo === 'function') {
        const info = AUTH.getUserInfo();
        return info?.login_id || info?.loginId || info?.user_id || 'system';
    }
    return 'system';
}

function getActualColumnStorageKey() {
    return `psms.salesActual.columns.${getCurrentLoginId()}`;
}

function getActualMonthViewValue() {
    const select = document.getElementById('actualMonthView');
    return select?.value || currentActualViewMode || 'group';
}

function saveActualColumnSettings() {
    if (!salesActualLineTable) return;
    const leafColumns = getActualLeafColumns();
    const fields = leafColumns.map(col => col.getField()).filter(Boolean);
    const hidden = leafColumns
        .filter(col => col.getField() && !col.isVisible())
        .map(col => col.getField());
    const freezeSelect = document.getElementById('actualFreezeColumn');
    const frozen = freezeSelect?.value || '';
    const payload = {
        order: fields,
        hidden,
        frozen,
        view_mode: getActualMonthViewValue()
    };
    localStorage.setItem(getActualColumnStorageKey(), JSON.stringify(payload));
}

function loadActualColumnSettings() {
    try {
        const raw = localStorage.getItem(getActualColumnStorageKey());
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('⚠️ 실적 컬럼 설정 로드 실패:', error);
        return null;
    }
}

function populateActualYearOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const currentYear = new Date().getFullYear();
    const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    select.innerHTML = '';
    years.forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        if (year === currentYear) opt.selected = true;
        select.appendChild(opt);
    });
}

function buildActualLineColumns(settings = null, viewMode = 'group') {
    const hiddenSet = new Set(settings?.hidden || []);
    const order = settings?.order || [];

    const baseColumns = ACTUAL_BASE_FIELDS.map((col) => {
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
        if (col.field === 'contract_date') def.width = 140;
        if (col.field === 'start_date') def.width = 140;
        if (col.field === 'end_date') def.width = 140;
        if (col.field === 'order_total' || col.field === 'profit_total') {
            def.width = 130;
            def.hozAlign = 'right';
            def.formatter = (cell) => formatNumber(cell.getValue());
        }
        if (hiddenSet.has(col.field)) {
            def.visible = false;
        }
        return def;
    });

    if (viewMode === 'flat') {
        const monthColumns = ACTUAL_MONTH_FIELDS.map((col) => {
            const def = {
                title: col.title,
                field: col.field,
                hozAlign: 'right',
                editor: 'number',
                formatter: (cell) => formatNumber(cell.getValue()),
                cellEdited: (cell) => recalcActualRowTotal(cell.getRow())
            };
            if (hiddenSet.has(col.field)) {
                def.visible = false;
            }
            return def;
        });
        return orderColumns([...baseColumns, ...monthColumns], order);
    }

    const monthOrder = buildActualMonthOrder(order);
    const monthGroups = monthOrder.map((month) => {
        const orderField = `m${month}_order`;
        const profitField = `m${month}_profit`;
        const orderColumn = {
            title: '수주',
            field: orderField,
            hozAlign: 'right',
            editor: 'number',
            formatter: (cell) => formatNumber(cell.getValue()),
            cellEdited: (cell) => recalcActualRowTotal(cell.getRow())
        };
        const profitColumn = {
            title: '이익',
            field: profitField,
            hozAlign: 'right',
            editor: 'number',
            formatter: (cell) => formatNumber(cell.getValue()),
            cellEdited: (cell) => recalcActualRowTotal(cell.getRow())
        };
        if (hiddenSet.has(orderField)) orderColumn.visible = false;
        if (hiddenSet.has(profitField)) profitColumn.visible = false;
        return {
            title: `${Number(month)}월`,
            columns: [orderColumn, profitColumn]
        };
    });

    return [...orderColumns(baseColumns, order), ...monthGroups];
}

function recalcActualRowTotal(row) {
    const data = row.getData();
    let orderTotal = 0;
    let profitTotal = 0;
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        orderTotal += Number(data[`m${month}_order`] || 0);
        profitTotal += Number(data[`m${month}_profit`] || 0);
    }
    row.update({order_total: orderTotal, profit_total: profitTotal});
    updateActualConsistencyBadge();
}

function updateActualConsistencyBadge() {
    const badge = document.getElementById('actualConsistencyBadge');
    if (!badge) return;
    badge.innerHTML = '<i class="fas fa-circle-check"></i> 합계 계산됨';
}

function orderColumns(allColumns, orderList) {
    if (!orderList || !orderList.length) return allColumns;
    const columnMap = {};
    allColumns.forEach(col => {
        columnMap[col.field] = col;
    });
    const ordered = [];
    orderList.forEach(field => {
        if (columnMap[field]) ordered.push(columnMap[field]);
    });
    allColumns.forEach(col => {
        if (!orderList.includes(col.field)) ordered.push(col);
    });
    return ordered;
}

function buildActualMonthOrder(orderList) {
    const monthOrder = [];
    (orderList || []).forEach(field => {
        const match = /^m(\d{2})_(order|profit)$/.exec(field);
        if (!match) return;
        const month = match[1];
        if (!monthOrder.includes(month)) monthOrder.push(month);
    });
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        if (!monthOrder.includes(month)) monthOrder.push(month);
    }
    return monthOrder;
}

function getActualLeafColumns() {
    if (!salesActualLineTable) return [];
    let columns = [];
    if (typeof salesActualLineTable.getColumns === 'function') {
        columns = salesActualLineTable.getColumns(true);
        if (!columns || !columns.length) {
            columns = salesActualLineTable.getColumns();
        }
    }
    const leafColumns = [];
    const walk = (cols) => {
        if (!cols) return;
        cols.forEach(col => {
            const subColumns = typeof col.getSubColumns === 'function'
                ? col.getSubColumns()
                : (typeof col.getColumns === 'function' ? col.getColumns() : []);
            if (subColumns && subColumns.length) {
                walk(subColumns);
            } else if (col.getField && col.getField()) {
                leafColumns.push(col);
            }
        });
    };
    walk(columns);
    return leafColumns;
}

function isSelectionColumn(col) {
    if (!col || typeof col.getDefinition !== 'function') return false;
    const def = col.getDefinition();
    return def?.formatter === 'rowSelection' || def?.titleFormatter === 'rowSelection';
}

function columnHasField(col, field) {
    if (!col || !field) return false;
    if (typeof col.getField === 'function' && col.getField() === field) return true;
    const subColumns = typeof col.getSubColumns === 'function'
        ? col.getSubColumns()
        : (typeof col.getColumns === 'function' ? col.getColumns() : []);
    if (!subColumns || !subColumns.length) return false;
    return subColumns.some(subCol => columnHasField(subCol, field));
}

function populateActualFreezeOptions() {
    const select = document.getElementById('actualFreezeColumn');
    if (!select) return;
    select.innerHTML = '<option value=\"\">고정 없음</option>';
    ACTUAL_BASE_FIELDS.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.field;
        opt.textContent = `${col.title}까지`;
        select.appendChild(opt);
    });
}

function applyActualColumnFreeze(targetField) {
    if (!salesActualLineTable) return;
    if (!targetField) {
        salesActualLineTable.getColumns().forEach(col => {
            if (isSelectionColumn(col)) col.setFrozen(true);
            else col.setFrozen(false);
        });
        return;
    }
    let freeze = true;
    salesActualLineTable.getColumns().forEach(col => {
        if (isSelectionColumn(col)) {
            col.setFrozen(true);
            return;
        }
        col.setFrozen(freeze);
        if (columnHasField(col, targetField)) {
            freeze = false;
        }
    });
}

function getActualSelectionColumn() {
    return {
        formatter: "rowSelection",
        titleFormatter: "rowSelection",
        hozAlign: "center",
        headerSort: false,
        width: 50,
        frozen: true
    };
}

function applyActualMonthView(mode) {
    if (!salesActualLineTable) return;
    currentActualViewMode = mode || 'group';
    const columnSettings = loadActualColumnSettings() || {};
    columnSettings.view_mode = currentActualViewMode;
    const columns = [
        getActualSelectionColumn(),
        ...buildActualLineColumns(columnSettings, currentActualViewMode)
    ];
    salesActualLineTable.setColumns(columns);
    const freezeSelect = document.getElementById('actualFreezeColumn');
    if (freezeSelect) {
        applyActualColumnFreeze(freezeSelect.value || '');
    }
    renderActualColumnsList();
    saveActualColumnSettings();
}

function openActualColumnsModal() {
    const modal = document.getElementById('actualColumnsModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
    renderActualColumnsList();
}

function closeActualColumnsModal() {
    const modal = document.getElementById('actualColumnsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function renderActualColumnsList() {
    const container = document.getElementById('actualColumnsList');
    if (!container || !salesActualLineTable) return;
    container.innerHTML = '';

    const groups = [
        { key: 'base', title: '기본정보', fields: ACTUAL_COLUMN_GROUPS.base },
        { key: 'month', title: '월별', fields: ACTUAL_COLUMN_GROUPS.month }
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
            const col = salesActualLineTable.getColumn(field);
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
                saveActualColumnSettings();
                renderActualColumnsList();
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

function setAllActualColumns(show) {
    if (!salesActualLineTable) return;
    salesActualLineTable.getColumns().forEach(col => {
        if (!col.getField()) return;
        if (show) col.show();
        else col.hide();
    });
    saveActualColumnSettings();
    renderActualColumnsList();
}

function toggleActualColumnGroup(groupKey) {
    if (!salesActualLineTable) return;
    const fields = ACTUAL_COLUMN_GROUPS[groupKey] || [];
    const columns = fields.map(field => salesActualLineTable.getColumn(field)).filter(Boolean);
    if (!columns.length) return;
    const allVisible = columns.every(col => col.isVisible());
    columns.forEach(col => {
        if (allVisible) col.hide();
        else col.show();
    });
    saveActualColumnSettings();
    renderActualColumnsList();
}

async function fetchActualLines(actualYear, filters = {}) {
    if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.SALES_ACTUAL_LINES) {
        return SAMPLE_ACTUAL_LINES;
    }
    try {
        const params = new URLSearchParams({ actual_year: actualYear });
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_ACTUAL_LINES}?${params.toString()}`);
        return response?.items || [];
    } catch (error) {
        console.warn('⚠️ 실적 라인 조회 실패, 샘플로 대체합니다.', error);
        return SAMPLE_ACTUAL_LINES;
    }
}

async function loadActualFilters() {
    const orgSelect = document.getElementById('actualFilterOrg');
    const managerSelect = document.getElementById('actualFilterManager');
    const fieldSelect = document.getElementById('actualFilterField');
    const serviceSelect = document.getElementById('actualFilterService');

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
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.service_code;
                opt.textContent = item.display_name || item.service_name || item.service_code;
                serviceSelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.warn('⚠️ 실적 필터 로딩 실패:', error);
    }
}

function getActualLineFilters() {
    return {
        org_id: document.getElementById('actualFilterOrg')?.value || '',
        manager_id: document.getElementById('actualFilterManager')?.value || '',
        field_code: document.getElementById('actualFilterField')?.value || '',
        service_code: document.getElementById('actualFilterService')?.value || '',
        keyword: document.getElementById('actualFilterKeyword')?.value || ''
    };
}

async function initializeSalesActualEntry() {
    const tableEl = document.getElementById('salesActualLineTable');
    if (!tableEl) return;

    populateActualYearOptions('salesActualYear');

    if (!salesActualLineTable) {
        const columnSettings = loadActualColumnSettings();
        currentActualViewMode = columnSettings?.view_mode || currentActualViewMode || 'group';
        const sortElement = window.TABULATOR_COMMON_OPTIONS?.headerSortElement
            || function(column, dir) {
                if (dir === "asc") return "▲";
                if (dir === "desc") return "▼";
                return "";
            };
        salesActualLineTable = new Tabulator('#salesActualLineTable', {
            height: '600px',
            layout: 'fitDataStretch',
            selectable: true,
            selectableRangeMode: "click",
            placeholder: '실적 라인 데이터가 없습니다.',
            movableColumns: true,
            headerSortElement: sortElement,
            columnDefaults: {
                headerSort: true
            },
            columns: [
                getActualSelectionColumn(),
                ...buildActualLineColumns(columnSettings, currentActualViewMode)
            ]
        });
        salesActualLineTable.on("columnMoved", () => {
            saveActualColumnSettings();
            renderActualColumnsList();
        });
        salesActualLineTable.on("columnVisibilityChanged", () => {
            saveActualColumnSettings();
            renderActualColumnsList();
        });
        populateActualFreezeOptions();
        const freezeSelect = document.getElementById('actualFreezeColumn');
        if (freezeSelect) {
            freezeSelect.value = columnSettings?.frozen || '';
            applyActualColumnFreeze(freezeSelect.value);
        }
        const viewSelect = document.getElementById('actualMonthView');
        if (viewSelect) {
            viewSelect.value = currentActualViewMode;
        }
    }

    await loadActualFilters();
    const year = document.getElementById('salesActualYear')?.value || new Date().getFullYear();
    const lines = await fetchActualLines(year, getActualLineFilters());
    cachedActualLines = lines;
    salesActualLineTable.setData(lines);
    updateActualConsistencyBadge();

    const recalcBtn = document.getElementById('btnActualRecalc');
    if (recalcBtn && !recalcBtn.dataset.bound) {
        recalcBtn.dataset.bound = 'true';
        recalcBtn.addEventListener('click', () => {
            salesActualLineTable.getRows().forEach(row => recalcActualRowTotal(row));
        });
    }

    const saveBtn = document.getElementById('btnActualSave');
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', async () => {
            const actualYear = Number(document.getElementById('salesActualYear')?.value || new Date().getFullYear());
            const payload = {
                actual_year: actualYear,
                updated_by: getCurrentLoginId(),
                lines: salesActualLineTable.getData()
            };
            try {
                await API.post(API_CONFIG.ENDPOINTS.SALES_ACTUAL_LINES, payload);
                alert('실적 라인이 저장되었습니다.');
            } catch (error) {
                alert('실적 저장 실패: ' + (error.message || error));
            }
        });
    }

    const exportBtn = document.getElementById('btnActualExport');
    if (exportBtn && !exportBtn.dataset.bound) {
        exportBtn.dataset.bound = 'true';
        exportBtn.addEventListener('click', () => {
            if (!salesActualLineTable) return;
            salesActualLineTable.download('xlsx', 'sales_actual_lines.xlsx', {sheetName: 'Actuals'});
        });
    }

    const viewSelect = document.getElementById('actualMonthView');
    if (viewSelect && !viewSelect.dataset.bound) {
        viewSelect.dataset.bound = 'true';
        viewSelect.addEventListener('change', () => {
            applyActualMonthView(viewSelect.value);
        });
    }

    const columnsBtn = document.getElementById('btnActualColumns');
    if (columnsBtn && !columnsBtn.dataset.bound) {
        columnsBtn.dataset.bound = 'true';
        columnsBtn.addEventListener('click', () => {
            openActualColumnsModal();
        });
    }

    const freezeSelect = document.getElementById('actualFreezeColumn');
    if (freezeSelect && !freezeSelect.dataset.bound) {
        freezeSelect.dataset.bound = 'true';
        freezeSelect.addEventListener('change', () => {
            applyActualColumnFreeze(freezeSelect.value);
            saveActualColumnSettings();
        });
    }

    const yearSelect = document.getElementById('salesActualYear');
    if (yearSelect && !yearSelect.dataset.bound) {
        yearSelect.dataset.bound = 'true';
        yearSelect.addEventListener('change', async () => {
            const actualYear = Number(yearSelect.value);
            const lines = await fetchActualLines(actualYear, getActualLineFilters());
            cachedActualLines = lines;
            salesActualLineTable.setData(lines);
            updateActualConsistencyBadge();
        });
    }
}

async function initializeSalesActualDashboard() {
    const tableEl = document.getElementById('salesActualSummaryTable');
    if (!tableEl) return;

    populateActualYearOptions('actualSummaryYear');

    if (!salesActualSummaryTable) {
        salesActualSummaryTable = new Tabulator('#salesActualSummaryTable', {
            height: '520px',
            layout: 'fitDataStretch',
            placeholder: '집계 데이터가 없습니다.',
            columns: [
                {title: '구분', field: 'group_name', minWidth: 200},
                {title: '수주합계', field: 'order_total', hozAlign: 'right', formatter: (cell) => formatNumber(cell.getValue())},
                {title: '이익합계', field: 'profit_total', hozAlign: 'right', formatter: (cell) => formatNumber(cell.getValue())}
            ]
        });
    }

    const summary = await fetchActualSummary();
    salesActualSummaryTable.setData(summary);
    updateActualSummaryStats(summary);

    const runBtn = document.getElementById('btnActualSummaryRun');
    if (runBtn && !runBtn.dataset.bound) {
        runBtn.dataset.bound = 'true';
        runBtn.addEventListener('click', async () => {
            const summary = await fetchActualSummary();
            salesActualSummaryTable.setData(summary);
            updateActualSummaryStats(summary);
        });
    }

    const exportBtn = document.getElementById('btnActualSummaryExport');
    if (exportBtn && !exportBtn.dataset.bound) {
        exportBtn.dataset.bound = 'true';
        exportBtn.addEventListener('click', () => {
            if (!salesActualSummaryTable) return;
            salesActualSummaryTable.download('xlsx', 'sales_actual_summary.xlsx', {sheetName: 'Summary'});
        });
    }
}

async function fetchActualSummary() {
    if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.SALES_ACTUALS) {
        return SAMPLE_ACTUAL_SUMMARY;
    }
    try {
        const year = document.getElementById('actualSummaryYear')?.value || new Date().getFullYear();
        const group = document.getElementById('actualSummaryGroup')?.value || 'org';
        const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_ACTUALS}/summary?actual_year=${year}&group=${group}`);
        return response?.items || [];
    } catch (error) {
        console.warn('⚠️ 실적 집계 조회 실패, 샘플로 대체합니다.', error);
        return SAMPLE_ACTUAL_SUMMARY;
    }
}

function updateActualSummaryStats(data) {
    const orderSum = data.reduce((acc, row) => acc + Number(row.order_total || 0), 0);
    const profitSum = data.reduce((acc, row) => acc + Number(row.profit_total || 0), 0);

    const orderEl = document.getElementById('actualStatOrder');
    const profitEl = document.getElementById('actualStatProfit');
    const yearEl = document.getElementById('actualStatYear');
    const groupEl = document.getElementById('actualStatGroup');
    const yearSelect = document.getElementById('actualSummaryYear');
    const groupSelect = document.getElementById('actualSummaryGroup');

    if (orderEl) orderEl.textContent = formatNumber(orderSum);
    if (profitEl) profitEl.textContent = formatNumber(profitSum);
    if (yearEl && yearSelect) yearEl.textContent = yearSelect.value || '-';
    if (groupEl && groupSelect) groupEl.textContent = groupSelect.options[groupSelect.selectedIndex]?.text || '-';
}

// DOMContentLoaded Hook

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('salesActualLineTable')) {
        initializeSalesActualEntry();
    }
    if (document.getElementById('salesActualSummaryTable')) {
        initializeSalesActualDashboard();
    }
});

// Expose to navigation
window.initializeSalesActualEntry = initializeSalesActualEntry;
window.initializeSalesActualDashboard = initializeSalesActualDashboard;
window.openActualColumnsModal = openActualColumnsModal;
window.closeActualColumnsModal = closeActualColumnsModal;
window.setAllActualColumns = setAllActualColumns;
window.toggleActualColumnGroup = toggleActualColumnGroup;
