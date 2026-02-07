// ===================================
// static/js/sales-actual.js
// 실적관리 UI (등록/현황)
// ===================================

let salesActualLineTable = null;
let salesActualSummaryTable = null;
let actualTargetPreviewTable = null;
let cachedActualLines = [];
let currentActualViewMode = 'group';
let cachedActualPlans = [];
let pendingActualCandidates = [];
let pendingActualMergeMode = 'append';
let pendingActualPreviewMeta = null;
let currentActualEditPipelineId = null;
let actualStickyConfig = { active: false, columns: [] };
let salesActualLineTableReady = false;
let pendingActualLineData = null;
let actualExcelCompactMode = false;
let actualPasteCache = null;

function hasPipelineHeader(text) {
    const firstLine = String(text || '').split(/\r?\n/)[0] || '';
    return /파이프라인|pipeline/i.test(firstLine);
}

const ACTUAL_COMPACT_WIDTHS = {
    month: 110,
    total: 120
};

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

const ACTUAL_SUMMARY_DIMENSIONS = {
    org: { title: '조직', field: 'org_name_snapshot' },
    manager: { title: '담당자', field: 'manager_name_snapshot' },
    field: { title: '분야', field: 'field_name_snapshot' },
    service: { title: '서비스', field: 'service_name_snapshot' },
    customer: { title: '고객사', field: 'customer_name_snapshot' },
    pipeline: { title: '파이프라인', field: 'pipeline_id' }
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

function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
}

function toText(value) {
    return value === null || value === undefined ? '' : String(value);
}

function parseNumberInput(value) {
    const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
}

function hasRegisteredActualAmount(row = {}) {
    if (!row || typeof row !== 'object') return false;
    if (parseNumberInput(row.order_total) !== 0 || parseNumberInput(row.profit_total) !== 0) {
        return true;
    }
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        if (parseNumberInput(row[`m${month}_order`]) !== 0 || parseNumberInput(row[`m${month}_profit`]) !== 0) {
            return true;
        }
    }
    return false;
}

function formatIntegerLike(value) {
    const n = Number(value || 0);
    return n.toLocaleString('ko-KR');
}

function amountEditor(cell, onRendered, success, cancel) {
    const input = document.createElement('input');
    input.type = 'text';
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.textAlign = 'right';
    input.value = formatNumber(cell.getValue() || 0);

    const commit = () => {
        const value = parseNumberInput(input.value);
        success(value);
    };

    input.addEventListener('focus', () => {
        input.value = String(parseNumberInput(input.value) || '');
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

function createManualActualLine() {
    const row = {
        _is_manual: true,
        pipeline_id: `MANUAL-${Date.now()}`,
        project_name_snapshot: '수기 입력',
        field_name_snapshot: '',
        service_name_snapshot: '',
        customer_name_snapshot: '',
        ordering_party_name_snapshot: '',
        org_name_snapshot: '',
        manager_name_snapshot: '',
        contract_date: '',
        start_date: '',
        end_date: '',
        order_total: 0,
        profit_total: 0
    };
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        row[`m${month}_order`] = 0;
        row[`m${month}_profit`] = 0;
    }
    return row;
}

function mapPlanLineToActualRow(line) {
    const row = {
        _is_manual: false,
        pipeline_id: line.pipeline_id,
        field_code: line.field_code || null,
        service_code: line.service_code || null,
        customer_id: toNumberOrNull(line.customer_id),
        ordering_party_id: toNumberOrNull(line.ordering_party_id),
        org_id: toNumberOrNull(line.org_id),
        manager_id: toText(line.manager_id) || null,
        field_name_snapshot: line.field_name_snapshot || '',
        service_name_snapshot: line.service_name_snapshot || '',
        customer_name_snapshot: line.customer_name_snapshot || '',
        ordering_party_name_snapshot: line.ordering_party_name_snapshot || '',
        project_name_snapshot: line.project_name_snapshot || '',
        org_name_snapshot: line.org_name_snapshot || '',
        manager_name_snapshot: line.manager_name_snapshot || '',
        contract_date: line.contract_plan_date || line.contract_date || '',
        start_date: line.start_plan_date || line.start_date || '',
        end_date: line.end_plan_date || line.end_date || '',
        order_total: Number(line.order_total || 0),
        profit_total: Number(line.profit_total || 0)
    };
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        row[`m${month}_order`] = Number(line[`m${month}_order`] || 0);
        row[`m${month}_profit`] = Number(line[`m${month}_profit`] || 0);
    }
    return row;
}

function mapProjectToActualRow(project) {
    const row = {
        _is_manual: false,
        pipeline_id: project.pipeline_id,
        field_code: project.field_code || null,
        service_code: project.service_code || null,
        customer_id: toNumberOrNull(project.customer_id),
        ordering_party_id: toNumberOrNull(project.ordering_party_id),
        org_id: toNumberOrNull(project.org_id),
        manager_id: toText(project.manager_id) || null,
        field_name_snapshot: project.field_name || project.field_name_snapshot || '',
        service_name_snapshot: project.service_name || project.service_name_snapshot || '',
        customer_name_snapshot: project.customer_name || project.customer_name_snapshot || '',
        ordering_party_name_snapshot: project.ordering_party_name || project.ordering_party_name_snapshot || '',
        project_name_snapshot: project.project_name || project.project_name_snapshot || '',
        org_name_snapshot: project.org_name || project.org_name_snapshot || '',
        manager_name_snapshot: project.manager_name || project.manager_name_snapshot || '',
        contract_date: project.contract_date || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        order_total: Number(project.order_total || 0),
        profit_total: Number(project.profit_total || 0)
    };
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        row[`m${month}_order`] = Number(project[`m${month}_order`] || 0);
        row[`m${month}_profit`] = Number(project[`m${month}_profit`] || 0);
    }
    return row;
}

function mergeActualRows(existingRows, incomingRows, mergeMode = 'append') {
    if (mergeMode === 'replace') {
        return incomingRows;
    }
    const map = new Map((existingRows || []).map(row => [row.pipeline_id, row]));
    (incomingRows || []).forEach(row => {
        if (!map.has(row.pipeline_id)) {
            map.set(row.pipeline_id, row);
        }
    });
    return Array.from(map.values());
}

function getRegisteredPipelineSet() {
    const rows = salesActualLineTable?.getData?.() || [];
    return new Set(rows.map(row => row.pipeline_id));
}

function markRegisteredStatus(candidates) {
    const registered = getRegisteredPipelineSet();
    return (candidates || []).map(row => ({
        ...row,
        _registered: registered.has(row.pipeline_id),
        _registered_label: registered.has(row.pipeline_id) ? '등록완료' : '미등록'
    }));
}

function stripPreviewMeta(rows) {
    return (rows || []).map(row => {
        const next = { ...row };
        delete next._registered;
        delete next._registered_label;
        return next;
    });
}

function refreshActualPreviewRegistrationStatus() {
    if (!actualTargetPreviewTable || !pendingActualCandidates.length) return;
    pendingActualCandidates = markRegisteredStatus(stripPreviewMeta(pendingActualCandidates));
    actualTargetPreviewTable.setData(pendingActualCandidates);
    updateActualPreviewSummary();
}

function ensureActualTargetPreviewTable() {
    if (actualTargetPreviewTable) return;
    actualTargetPreviewTable = new Tabulator('#actualTargetPreviewTable', {
        height: '420px',
        layout: 'fitDataStretch',
        selectable: true,
        placeholder: '대상 데이터가 없습니다.',
        columnDefaults: {
            headerSort: true
        },
        columns: [
            { formatter: "rowSelection", titleFormatter: "rowSelection", hozAlign: "center", headerSort: false, width: 48 },
            { title: '등록상태', field: '_registered_label', width: 110, hozAlign: 'center' },
            { title: '파이프라인ID', field: 'pipeline_id', width: 140 },
            { title: '프로젝트명', field: 'project_name_snapshot', minWidth: 240 },
            { title: '분야', field: 'field_name_snapshot', width: 120 },
            { title: '서비스', field: 'service_name_snapshot', width: 140 },
            { title: '고객사', field: 'customer_name_snapshot', width: 140 },
            { title: '담당조직', field: 'org_name_snapshot', width: 140 },
            { title: '담당자', field: 'manager_name_snapshot', width: 120 }
        ]
    });
    actualTargetPreviewTable.on("dataFiltered", () => updateActualPreviewSummary());
    actualTargetPreviewTable.on("dataSorted", () => updateActualPreviewSummary());
}

function openActualTargetPreviewModal(candidates, mergeMode) {
    const modal = document.getElementById('actualTargetPreviewModal');
    if (!modal) return;
    pendingActualCandidates = markRegisteredStatus(candidates || []);
    pendingActualMergeMode = mergeMode || 'append';

    const countEl = document.getElementById('actualTargetPreviewCount');
    if (countEl) countEl.textContent = String(pendingActualCandidates.length);

    ensureActualTargetPreviewTable();
    actualTargetPreviewTable.setData(pendingActualCandidates);
    updateActualPreviewSummary();
    modal.classList.add('active');
    modal.style.display = 'flex';
    setTimeout(() => actualTargetPreviewTable?.redraw(true), 0);
}

function showActualTargetPreviewModal() {
    const modal = document.getElementById('actualTargetPreviewModal');
    if (!modal) return;
    ensureActualTargetPreviewTable();
    modal.classList.add('active');
    modal.style.display = 'flex';
    setTimeout(() => actualTargetPreviewTable?.redraw(true), 0);
}

function closeActualTargetPreviewModal() {
    const modal = document.getElementById('actualTargetPreviewModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
    const searchInput = document.getElementById('actualTargetPreviewSearch');
    if (searchInput) searchInput.value = '';
    if (actualTargetPreviewTable) actualTargetPreviewTable.clearFilter(true);
}

function applySelectedActualTargetsFromPreview() {
    if (!salesActualLineTable || !actualTargetPreviewTable) return;
    const selectedRows = actualTargetPreviewTable.getSelectedData() || [];
    if (!selectedRows.length) {
        alert('반영할 대상을 선택하세요.');
        return;
    }
    const newTargets = selectedRows.filter(row => !row._registered);
    const targets = stripPreviewMeta(newTargets);
    if (!targets.length) {
        alert('선택된 항목은 모두 이미 등록되어 있습니다.');
        return;
    }
    const merged = mergeActualRows(salesActualLineTable.getData(), targets, pendingActualMergeMode);
    salesActualLineTable.setData(merged);
    updateActualConsistencyBadge();
    pendingActualCandidates = markRegisteredStatus(pendingActualCandidates);
    actualTargetPreviewTable.setData(pendingActualCandidates);
    updateActualPreviewSummary();
}

function getActualPreviewModeLabel(mode) {
    if (mode === 'plan') return '영업계획 등록 프로젝트';
    if (mode === 'unplanned') return '영업계획 미등록 프로젝트';
    if (mode === 'project') return '프로젝트 직접 선택';
    if (mode === 'manual') return '수기 추가';
    return mode || '-';
}

function updateActualPreviewSummary() {
    const summaryEl = document.getElementById('actualTargetPreviewSummary');
    if (!summaryEl) return;
    const filters = pendingActualPreviewMeta?.filters || {};
    const modeLabel = getActualPreviewModeLabel(pendingActualPreviewMeta?.mode);
    const mergeLabel = pendingActualPreviewMeta?.mergeMode === 'replace' ? '현재 화면 행 교체' : '기존 유지 + 신규 추가';
    const filterParts = [];
    if (filters.org_id) filterParts.push(`조직:${filters.org_id}`);
    if (filters.manager_id) filterParts.push(`담당자:${filters.manager_id}`);
    if (filters.field_code) filterParts.push(`분야:${filters.field_code}`);
    if (filters.service_code) filterParts.push(`서비스:${filters.service_code}`);
    if (filters.keyword) filterParts.push(`검색:${filters.keyword}`);
    const filterText = filterParts.length ? filterParts.join(', ') : '없음';

    const total = pendingActualCandidates.length;
    const filtered = actualTargetPreviewTable ? actualTargetPreviewTable.getDataCount("active") : total;
    const registered = pendingActualCandidates.filter(row => row._registered).length;
    summaryEl.textContent = `등록방식: ${modeLabel} | 반영방식: ${mergeLabel} | 필터: ${filterText} | 미리보기: ${filtered}/${total}건 | 등록완료: ${registered}건 | 정렬: 헤더 클릭`;
}

function applyActualPreviewSearch() {
    const searchInput = document.getElementById('actualTargetPreviewSearch');
    if (!actualTargetPreviewTable || !searchInput) return;
    const keyword = String(searchInput.value || '').trim().toLowerCase();
    if (!keyword) {
        actualTargetPreviewTable.clearFilter(true);
        return;
    }
    actualTargetPreviewTable.setFilter((rowData) => {
        const targets = [
            rowData.pipeline_id,
            rowData.project_name_snapshot,
            rowData.customer_name_snapshot,
            rowData.org_name_snapshot,
            rowData.manager_name_snapshot
        ].map(v => String(v || '').toLowerCase());
        return targets.some(v => v.includes(keyword));
    });
}

function validateManualActualRows(rows) {
    const errors = [];
    (rows || []).forEach((row, idx) => {
        if (!row?._is_manual) return;
        const rowNo = idx + 1;
        if (!row.pipeline_id || !String(row.pipeline_id).trim()) {
            errors.push(`${rowNo}행: 파이프라인ID는 필수입니다.`);
        }
        if (!row.project_name_snapshot || !String(row.project_name_snapshot).trim()) {
            errors.push(`${rowNo}행: 사업명은 필수입니다.`);
        }
        if (!row.org_name_snapshot || !String(row.org_name_snapshot).trim()) {
            errors.push(`${rowNo}행: 담당부서는 필수입니다.`);
        }
        if (!row.manager_name_snapshot || !String(row.manager_name_snapshot).trim()) {
            errors.push(`${rowNo}행: 담당자는 필수입니다.`);
        }
    });
    return errors;
}

function buildActualLineMonthEditors() {
    const container = document.getElementById('actualLineMonthGrid');
    if (!container) return;
    if (container.children.length > 0) return;
    const html = [];
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        html.push(`
            <div class="actual-line-month-item">
                <div class="actual-line-month-item-title">${i}월</div>
                <div>
                    <label for="actualEditM${month}Order">${i}월 수주</label>
                    <input type="text" id="actualEditM${month}Order" class="form-input actual-amount-input align-right" inputmode="numeric" autocomplete="off">
                </div>
                <div>
                    <label for="actualEditM${month}Profit">${i}월 이익</label>
                    <input type="text" id="actualEditM${month}Profit" class="form-input actual-amount-input align-right" inputmode="numeric" autocomplete="off">
                </div>
            </div>
        `);
    }
    container.innerHTML = html.join('');
    bindActualAmountInputFormatters();
}

function bindActualAmountInputFormatters() {
    const inputs = document.querySelectorAll('.actual-amount-input');
    inputs.forEach(input => {
        if (input.dataset.boundFormatter) return;
        input.dataset.boundFormatter = 'true';
        input.addEventListener('focus', () => {
            const numeric = parseNumberInput(input.value);
            input.value = numeric ? String(numeric) : '';
            input.select();
        });
        input.addEventListener('blur', () => {
            const numeric = parseNumberInput(input.value);
            input.value = formatIntegerLike(numeric);
        });
    });
}

function getSelectedActualRow() {
    if (!salesActualLineTable) return null;
    const selected = salesActualLineTable.getSelectedData() || [];
    if (!selected.length) return null;
    return selected[0];
}

function openActualLineEditModal() {
    const selected = getSelectedActualRow();
    if (!selected) {
        alert('실적 입력할 프로젝트를 1건 선택하세요.');
        return;
    }
    currentActualEditPipelineId = selected.pipeline_id;
    buildActualLineMonthEditors();
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value ?? '';
    };
    setValue('actualEditPipelineId', selected.pipeline_id || '');
    setValue('actualEditProjectName', selected.project_name_snapshot || '');
    setValue('actualEditCustomerName', selected.customer_name_snapshot || '');
    setValue('actualEditOrgName', selected.org_name_snapshot || '');
    setValue('actualEditManagerName', selected.manager_name_snapshot || '');

    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        setValue(`actualEditM${month}Order`, formatIntegerLike(selected[`m${month}_order`] ?? 0));
        setValue(`actualEditM${month}Profit`, formatIntegerLike(selected[`m${month}_profit`] ?? 0));
    }

    const modal = document.getElementById('actualLineEditModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeActualLineEditModal() {
    const modal = document.getElementById('actualLineEditModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.style.display = 'none';
}

function applyActualLineEditModal() {
    if (!salesActualLineTable || !currentActualEditPipelineId) return;
    const rows = salesActualLineTable.getRows() || [];
    const row = rows.find(r => (r.getData()?.pipeline_id === currentActualEditPipelineId));
    if (!row) {
        alert('선택한 프로젝트를 찾을 수 없습니다.');
        return;
    }
    const payload = {};
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        const orderVal = document.getElementById(`actualEditM${month}Order`)?.value;
        const profitVal = document.getElementById(`actualEditM${month}Profit`)?.value;
        payload[`m${month}_order`] = parseNumberInput(orderVal);
        payload[`m${month}_profit`] = parseNumberInput(profitVal);
    }
    let orderTotal = 0;
    let profitTotal = 0;
    for (let i = 1; i <= 12; i += 1) {
        const month = String(i).padStart(2, '0');
        orderTotal += Number(payload[`m${month}_order`] || 0);
        profitTotal += Number(payload[`m${month}_profit`] || 0);
    }
    payload.order_total = orderTotal;
    payload.profit_total = profitTotal;
    row.update(payload);
    updateActualConsistencyBadge();
    closeActualLineEditModal();
}

async function saveActualLines() {
    if (!salesActualLineTable) return;
    const actualYear = Number(document.getElementById('salesActualYear')?.value || new Date().getFullYear());
    const rows = salesActualLineTable.getData() || [];
    const validationErrors = validateManualActualRows(rows);
    if (validationErrors.length) {
        alert(`수기 입력 검증 실패\n- ${validationErrors.join('\n- ')}`);
        return;
    }
    const payload = {
        actual_year: actualYear,
        updated_by: getCurrentLoginId(),
        lines: rows
    };
    try {
        await API.post(API_CONFIG.ENDPOINTS.SALES_ACTUAL_LINES, payload);
        alert('실적 라인이 저장되었습니다.');
    } catch (error) {
        alert('실적 저장 실패: ' + (error.message || error));
    }
}

function getActualColumnStorageKey() {
    return `psms.salesActual.columns.${getCurrentLoginId()}`;
}

function getActualExcelModeStorageKey() {
    return `psms.salesActual.excelCompact.${getCurrentLoginId()}`;
}

function getActualMonthViewValue() {
    const select = document.getElementById('actualMonthView');
    return select?.value || currentActualViewMode || 'group';
}

function saveActualColumnSettings() {
    if (!salesActualLineTable) return;
    const leafColumns = getActualLeafColumns();
    const fields = Array.from(new Set(leafColumns.map(col => col.getField()).filter(Boolean)));
    const hidden = leafColumns
        .filter(col => col.getField() && !col.isVisible())
        .map(col => col.getField());
    const freezeSelect = document.getElementById('actualFreezeColumn');
    const frozen = freezeSelect?.value || '';
    const payload = {
        order: fields,
        hidden: Array.from(new Set(hidden)),
        frozen,
        view_mode: getActualMonthViewValue()
    };
    localStorage.setItem(getActualColumnStorageKey(), JSON.stringify(payload));
}

function loadActualColumnSettings() {
    try {
        const raw = localStorage.getItem(getActualColumnStorageKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return {
            ...parsed,
            order: Array.from(new Set(parsed?.order || [])),
            hidden: Array.from(new Set(parsed?.hidden || []))
        };
    } catch (error) {
        console.warn('⚠️ 실적 컬럼 설정 로드 실패:', error);
        return null;
    }
}

function loadActualExcelMode() {
    try {
        const raw = localStorage.getItem(getActualExcelModeStorageKey());
        return raw ? JSON.parse(raw) : false;
    } catch (error) {
        console.warn('⚠️ 엑셀 모드 설정 로드 실패:', error);
        return false;
    }
}

function saveActualExcelMode(enabled) {
    localStorage.setItem(getActualExcelModeStorageKey(), JSON.stringify(!!enabled));
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

function buildActualLineColumns(settings = null, viewMode = 'group', compact = false) {
    const hiddenSet = new Set(settings?.hidden || []);
    const order = settings?.order || [];

    const baseColumns = ACTUAL_BASE_FIELDS.map((col) => {
        const def = {
            title: col.title,
            field: col.field
        };
        const manualEditableFields = new Set([
            'pipeline_id',
            'field_name_snapshot',
            'service_name_snapshot',
            'customer_name_snapshot',
            'ordering_party_name_snapshot',
            'project_name_snapshot',
            'org_name_snapshot',
            'manager_name_snapshot'
        ]);
        if (manualEditableFields.has(col.field)) {
            def.editor = 'input';
            def.editable = (cell) => !!cell.getRow()?.getData()?._is_manual;
        }
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
            def.width = compact ? ACTUAL_COMPACT_WIDTHS.total : 130;
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
                ...(compact ? { width: ACTUAL_COMPACT_WIDTHS.month } : {}),
                editor: amountEditor,
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
            ...(compact ? { width: ACTUAL_COMPACT_WIDTHS.month } : {}),
            editor: amountEditor,
            formatter: (cell) => formatNumber(cell.getValue()),
            cellEdited: (cell) => recalcActualRowTotal(cell.getRow())
        };
        const profitColumn = {
            title: '이익',
            field: profitField,
            hozAlign: 'right',
            ...(compact ? { width: ACTUAL_COMPACT_WIDTHS.month } : {}),
            editor: amountEditor,
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
    const uniqueOrder = Array.from(new Set(orderList));
    uniqueOrder.forEach(field => {
        if (columnMap[field]) ordered.push(columnMap[field]);
    });
    allColumns.forEach(col => {
        if (!uniqueOrder.includes(col.field)) ordered.push(col);
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
    const seenFields = new Set();
    let selectionAdded = false;
    const walk = (cols) => {
        if (!cols) return;
        cols.forEach(col => {
            const subColumns = typeof col.getSubColumns === 'function'
                ? col.getSubColumns()
                : (typeof col.getColumns === 'function' ? col.getColumns() : []);
            if (subColumns && subColumns.length) {
                walk(subColumns);
            } else {
                const field = col.getField?.();
                if (!field) {
                    if (!selectionAdded) {
                        leafColumns.push(col);
                        selectionAdded = true;
                    }
                    return;
                }
                if (seenFields.has(field)) return;
                seenFields.add(field);
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

function clearActualStickyStyles() {
    const tableEl = document.getElementById('salesActualLineTable');
    if (!tableEl) return;
    tableEl.querySelectorAll('[data-actual-frozen="1"]').forEach(el => {
        el.style.position = '';
        el.style.left = '';
        el.style.zIndex = '';
        el.style.backgroundColor = '';
        delete el.dataset.actualFrozen;
    });
}

function applyActualStickyHeaderStyles() {
    if (!salesActualLineTable || !actualStickyConfig.active) return;
    actualStickyConfig.columns.forEach(item => {
        const headerEl = item.col.getElement?.();
        if (!headerEl) return;
        headerEl.dataset.actualFrozen = '1';
        headerEl.style.position = 'sticky';
        headerEl.style.left = `${item.left}px`;
        headerEl.style.zIndex = '4';
        headerEl.style.backgroundColor = '#f8f9fa';
    });
}

function applyActualStickyToRow(row) {
    if (!actualStickyConfig.active || !row) return;
    const cells = row.getCells();
    const rowEl = row.getElement?.();
    const rowBg = rowEl ? window.getComputedStyle(rowEl).backgroundColor : '#ffffff';
    actualStickyConfig.columns.forEach(item => {
        const cell = cells.find(c => c.getColumn && c.getColumn() === item.col);
        if (!cell) return;
        const el = cell.getElement();
        if (!el) return;
        el.dataset.actualFrozen = '1';
        el.style.position = 'sticky';
        el.style.left = `${item.left}px`;
        el.style.zIndex = '3';
        el.style.backgroundColor = rowBg || '#ffffff';
    });
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
    const leafColumns = getActualLeafColumns();
    const supportsFreeze = leafColumns.some(col => typeof col.freeze === 'function' || typeof col.setFrozen === 'function');
    const visibleColumns = leafColumns.filter(col => (typeof col.isVisible === 'function' ? col.isVisible() : true));
    let targetIndex = -1;

    visibleColumns.forEach((col, idx) => {
        const field = col.getField?.();
        if (field === targetField) targetIndex = idx;
    });

    if (!targetField) {
        if (supportsFreeze) {
            leafColumns.forEach((col) => {
                const field = col.getField?.();
                const isSelection = !field;
                if (typeof col.freeze === 'function') {
                    if (isSelection) col.freeze();
                    else col.unfreeze?.();
                } else if (typeof col.setFrozen === 'function') {
                    col.setFrozen(isSelection);
                }
            });
        }
        actualStickyConfig = { active: false, columns: [] };
        clearActualStickyStyles();
        salesActualLineTable.redraw(true);
        return;
    }

    if (!supportsFreeze) {
        let left = 0;
        const frozenColumns = [];
        visibleColumns.forEach((col, idx) => {
            if (idx > targetIndex) return;
            const headerEl = col.getElement?.();
            const width = col.getWidth?.() || headerEl?.offsetWidth || 0;
            const safeWidth = width || 80;
            frozenColumns.push({ col, left });
            left += safeWidth;
        });
        actualStickyConfig = { active: true, columns: frozenColumns };
        clearActualStickyStyles();
        applyActualStickyHeaderStyles();
        salesActualLineTable.redraw(true);
        return;
    }

    leafColumns.forEach((col, idx) => {
        const field = col.getField?.();
        const isSelection = !field;
        const freeze = (frozen) => {
            if (frozen) {
                if (typeof col.freeze === 'function') {
                    col.freeze();
                    return;
                }
                if (typeof col.setFrozen === 'function') {
                    col.setFrozen(true);
                    return;
                }
            } else {
                if (typeof col.unfreeze === 'function') {
                    col.unfreeze();
                    return;
                }
                if (typeof col.setFrozen === 'function') {
                    col.setFrozen(false);
                }
            }
        };
        if (targetIndex < 0) {
            freeze(isSelection);
            return;
        }
        freeze(idx <= targetIndex || isSelection);
    });

    salesActualLineTable.redraw(true);
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

function syncActualExcelModeUI() {
    const toggle = document.getElementById('actualExcelMode');
    if (toggle) {
        toggle.checked = actualExcelCompactMode;
    }
    const pasteBtn = document.getElementById('btnActualPasteExcel');
    if (pasteBtn) {
        pasteBtn.disabled = !actualExcelCompactMode;
    }
    const tableEl = document.getElementById('salesActualLineTable');
    if (tableEl) {
        tableEl.classList.toggle('grid-excel-compact', actualExcelCompactMode);
    }
}

function applyActualExcelMode(enabled) {
    actualExcelCompactMode = !!enabled;
    syncActualExcelModeUI();
    if (!salesActualLineTable) return;
    const columnSettings = loadActualColumnSettings() || {};
    const columns = [
        getActualSelectionColumn(),
        ...buildActualLineColumns(columnSettings, currentActualViewMode, actualExcelCompactMode)
    ];
    salesActualLineTable.setColumns(columns);
    const freezeSelect = document.getElementById('actualFreezeColumn');
    if (freezeSelect) {
        applyActualColumnFreeze(freezeSelect.value || '');
    }
    renderActualColumnsList();
    saveActualColumnSettings();
}

function actualClipboardPasteParser(clipboard) {
    if (!actualExcelCompactMode) return clipboard;
    if (typeof clipboard === 'string' && hasPipelineHeader(clipboard)) {
        const result = parseActualPaste(clipboard);
        renderActualPastePreview(result);
        applyActualPasteResult(result);
        return [];
    }
    return clipboard;
}

function bindActualTablePasteHandler() {
    const tableEl = document.getElementById('salesActualLineTable');
    if (!tableEl || tableEl.dataset.pasteBound) return;
    tableEl.dataset.pasteBound = 'true';
    tableEl.addEventListener('paste', (event) => {
        if (!actualExcelCompactMode) return;
        const text = event.clipboardData?.getData('text/plain') || '';
        if (!text || !hasPipelineHeader(text)) return;
        event.preventDefault();
        const result = parseActualPaste(text);
        renderActualPastePreview(result);
        applyActualPasteResult(result);
    });
}

function parsePasteNumber(value) {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '-') return null;
    const cleaned = raw.replace(/,/g, '');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

function normalizePasteHeader(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[_\-()]/g, '');
}

function openActualPasteModal() {
    const modal = document.getElementById('actualPasteModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
    const preview = document.getElementById('actualPastePreview');
    if (preview) preview.innerHTML = '';
    actualPasteCache = null;
}

function closeActualPasteModal() {
    const modal = document.getElementById('actualPasteModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function parseActualPaste(text) {
    const rows = String(text || '')
        .split(/\r?\n/)
        .map(line => line.replace(/\r/g, ''))
        .filter(line => line.trim().length > 0)
        .map(line => line.split('\t'));

    if (rows.length < 2) {
        return { error: '붙여넣기 데이터가 부족합니다. 헤더 포함 2줄 이상 필요합니다.' };
    }

    const headers = rows[0];
    const mapping = mapActualPasteHeaders(headers);
    if (mapping.pipeline === undefined) {
        return { error: '헤더에 파이프라인ID 컬럼이 없습니다.' };
    }
    const monthFields = Object.keys(mapping).filter(key => key.startsWith('m') && (key.endsWith('_order') || key.endsWith('_profit')));
    if (monthFields.length === 0) {
        return { error: '헤더에서 월별 수주/이익 컬럼을 찾지 못했습니다.' };
    }

    const parsedRows = [];
    rows.slice(1).forEach(row => {
        const pipelineId = String(row[mapping.pipeline] ?? '').trim();
        if (!pipelineId) return;
        const updates = {};
        monthFields.forEach(field => {
            const idx = mapping[field];
            const value = parsePasteNumber(row[idx]);
            if (value !== null) updates[field] = value;
        });
        if (Object.keys(updates).length > 0) {
            parsedRows.push({ pipeline_id: pipelineId, updates });
        }
    });

    return {
        headers,
        mapping,
        monthFields,
        rows: parsedRows,
        totalRows: rows.length - 1
    };
}

function mapActualPasteHeaders(headers) {
    const mapping = {};
    headers.forEach((header, idx) => {
        const raw = String(header ?? '').trim();
        const norm = normalizePasteHeader(raw);
        if (mapping.pipeline === undefined && (norm.includes('pipeline') || norm.includes('파이프라인') || norm === 'id' || norm === '파이프라인id')) {
            mapping.pipeline = idx;
        }
        const monthMatch = raw.match(/(\d{1,2})\s*월/);
        if (!monthMatch) return;
        const month = Number(monthMatch[1]);
        if (month < 1 || month > 12) return;
        let type = null;
        if (norm.includes('수주') || norm.includes('order')) type = 'order';
        if (norm.includes('이익') || norm.includes('매출') || norm.includes('profit')) type = type || 'profit';
        if (!type) return;
        mapping[`m${String(month).padStart(2, '0')}_${type}`] = idx;
    });
    return mapping;
}

function renderActualPastePreview(result) {
    const preview = document.getElementById('actualPastePreview');
    if (!preview) return;
    if (result.error) {
        preview.innerHTML = `<div class="paste-preview-summary">⚠️ ${result.error}</div>`;
        return;
    }
    const monthFields = result.monthFields.sort();
    const sampleRows = result.rows.slice(0, 5);
    const headerLabels = ['파이프라인ID', ...monthFields.map(field => {
        const month = Number(field.slice(1, 3));
        const label = field.endsWith('_order') ? '수주' : '이익';
        return `${month}월 ${label}`;
    })];
    const tableRows = sampleRows.map(row => {
        const cells = [row.pipeline_id, ...monthFields.map(field => formatNumber(row.updates[field] ?? ''))];
        return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
    }).join('');
    preview.innerHTML = `
        <div class="paste-preview-summary">
            매칭 컬럼: 파이프라인ID + ${monthFields.length}개 금액 |
            대상행: ${result.rows.length} / ${result.totalRows}행
        </div>
        <table class="paste-preview-table">
            <thead><tr>${headerLabels.map(label => `<th>${label}</th>`).join('')}</tr></thead>
            <tbody>${tableRows || '<tr><td colspan="' + headerLabels.length + '">미리보기 데이터가 없습니다.</td></tr>'}</tbody>
        </table>
    `;
}

function applyActualPasteResult(result) {
    if (result.error) {
        alert(result.error);
        return;
    }
    if (!salesActualLineTable) {
        alert('그리드가 준비되지 않았습니다.');
        return;
    }
    const rowMap = new Map();
    salesActualLineTable.getRows().forEach(row => {
        const data = row.getData();
        if (data?.pipeline_id !== undefined && data?.pipeline_id !== null) {
            rowMap.set(String(data.pipeline_id).trim(), row);
        }
    });

    let matched = 0;
    let missing = 0;
    let updatedCells = 0;
    const missingIds = [];

    result.rows.forEach(item => {
        const row = rowMap.get(String(item.pipeline_id).trim());
        if (!row) {
            missing += 1;
            if (missingIds.length < 10) missingIds.push(item.pipeline_id);
            return;
        }
        const payload = {};
        Object.entries(item.updates).forEach(([field, value]) => {
            payload[field] = value;
            updatedCells += 1;
        });
        row.update(payload);
        recalcActualRowTotal(row);
        matched += 1;
    });
    updateActualConsistencyBadge();

    let message = `붙여넣기 완료: ${matched}행 반영, ${missing}행 미매칭, ${updatedCells}칸 업데이트`;
    if (missingIds.length) {
        message += `\n미매칭 예시: ${missingIds.join(', ')}${missing > missingIds.length ? ' ...' : ''}`;
    }
    alert(message);
}

function applyActualMonthView(mode) {
    if (!salesActualLineTable) return;
    currentActualViewMode = mode || 'group';
    const columnSettings = loadActualColumnSettings() || {};
    columnSettings.view_mode = currentActualViewMode;
    const columns = [
        getActualSelectionColumn(),
        ...buildActualLineColumns(columnSettings, currentActualViewMode, actualExcelCompactMode)
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
            let title = col.getDefinition().title || field;
            const monthMatch = /^m(\d{2})_(order|profit)$/.exec(field);
            if (monthMatch) {
                const monthLabel = `${Number(monthMatch[1])}월`;
                const metricLabel = monthMatch[2] === 'order' ? '수주' : '이익';
                title = `${monthLabel} ${metricLabel}`;
            }
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

async function reloadActualLines() {
    if (!salesActualLineTable) return;
    const actualYear = Number(document.getElementById('salesActualYear')?.value || new Date().getFullYear());
    const lines = await fetchActualLines(actualYear, getActualLineFilters());
    cachedActualLines = lines;
    if (!salesActualLineTableReady) {
        pendingActualLineData = lines;
        return;
    }
    salesActualLineTable.setData(lines);
    updateActualConsistencyBadge();
    refreshActualPreviewRegistrationStatus();
}

async function fetchPlansByYear(planYear) {
    if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.SALES_PLANS) {
        return [];
    }
    try {
        const params = new URLSearchParams();
        if (planYear) params.append('plan_year', String(planYear));
        const query = params.toString();
        const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/list${query ? `?${query}` : ''}`);
        return response?.items || [];
    } catch (error) {
        console.warn('⚠️ 영업계획 목록 조회 실패:', error);
        return [];
    }
}

function populateActualPlanOptions(plans) {
    const select = document.getElementById('actualPlanSelect');
    if (!select) return;
    select.innerHTML = '<option value="">자동(최신 계획)</option>';
    (plans || []).forEach(plan => {
        const opt = document.createElement('option');
        opt.value = plan.plan_id;
        opt.textContent = `${plan.plan_year} ${plan.plan_version} (${plan.status_code || 'DRAFT'})`;
        select.appendChild(opt);
    });
}

function pickActualTargetPlan(plans) {
    const selectedId = document.getElementById('actualPlanSelect')?.value;
    if (selectedId) {
        return (plans || []).find(p => String(p.plan_id) === String(selectedId)) || null;
    }
    if (!(plans || []).length) return null;
    const sorted = [...plans].sort((a, b) => {
        if ((a.plan_year || 0) !== (b.plan_year || 0)) return (b.plan_year || 0) - (a.plan_year || 0);
        return String(b.plan_version || '').localeCompare(String(a.plan_version || ''));
    });
    return sorted[0];
}

async function fetchPlanLinesForActual(planId, filters = {}) {
    if (!planId || typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.SALES_PLANS) {
        return [];
    }
    try {
        const params = new URLSearchParams();
        Object.entries(filters || {}).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') params.append(key, value);
        });
        const query = params.toString();
        const response = await API.get(`${API_CONFIG.ENDPOINTS.SALES_PLANS}/${planId}/lines${query ? `?${query}` : ''}`);
        return response?.items || [];
    } catch (error) {
        console.warn('⚠️ 계획 라인 조회 실패:', error);
        return [];
    }
}

async function fetchProjectsForActual(filters = {}) {
    if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.PROJECTS_LIST) {
        return [];
    }
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') params.append(key, value);
    });
    const pageSize = 300;
    const items = [];
    let page = 1;
    while (true) {
        params.set('page', String(page));
        params.set('page_size', String(pageSize));
        try {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECTS_LIST}?${params.toString()}`);
            const rows = response?.items || [];
            items.push(...rows);
            if (rows.length < pageSize) break;
            if (page >= (response?.total_pages || 1)) break;
            page += 1;
        } catch (error) {
            console.warn('⚠️ 프로젝트 목록 조회 실패:', error);
            break;
        }
    }
    return items;
}

function getActualTargetMode() {
    return document.getElementById('actualTargetMode')?.value || 'plan';
}

function updateActualTargetModeUI() {
    const mode = getActualTargetMode();
    const planWrap = document.getElementById('actualPlanSelectWrap');
    const hint = document.getElementById('actualFlowHint');
    const showPlan = mode === 'plan' || mode === 'unplanned';
    if (planWrap) planWrap.style.display = showPlan ? '' : 'none';
    if (!hint) return;
    if (mode === 'plan') hint.textContent = '선택한 영업계획의 프로젝트를 실적 입력 대상으로 가져옵니다.';
    if (mode === 'unplanned') hint.textContent = '선택한 영업계획에 없는 프로젝트만 추려서 실적 대상으로 가져옵니다.';
    if (mode === 'project') hint.textContent = '프로젝트 목록에서 현재 필터 조건에 맞는 대상을 직접 가져옵니다.';
    if (mode === 'manual') hint.textContent = '행을 수기로 추가해 임시/예외 실적을 등록합니다.';
}

async function loadActualTargetPlans() {
    const year = Number(document.getElementById('salesActualYear')?.value || new Date().getFullYear());
    cachedActualPlans = await fetchPlansByYear(year);
    populateActualPlanOptions(cachedActualPlans);
}

async function handleActualLoadTargets() {
    const mode = getActualTargetMode();
    const mergeMode = document.getElementById('actualMergeMode')?.value || 'append';
    const filters = getActualLineFilters();

    let candidates = [];
    if (mode === 'manual') {
        candidates = [createManualActualLine()];
    } else if (mode === 'plan' || mode === 'unplanned') {
        const plan = pickActualTargetPlan(cachedActualPlans);
        if (!plan) {
            alert('기준 계획을 찾을 수 없습니다. 계획을 먼저 생성하거나 선택하세요.');
            return;
        }
        const planLines = await fetchPlanLinesForActual(plan.plan_id, filters);
        if (mode === 'plan') {
            candidates = planLines.map(mapPlanLineToActualRow);
        } else {
            const projects = await fetchProjectsForActual(filters);
            const planned = new Set(planLines.map(line => line.pipeline_id));
            candidates = projects
                .filter(project => !planned.has(project.pipeline_id))
                .map(mapProjectToActualRow);
        }
    } else {
        const projects = await fetchProjectsForActual(filters);
        candidates = projects.map(mapProjectToActualRow);
    }
    pendingActualPreviewMeta = { mode, mergeMode, filters: { ...filters } };
    openActualTargetPreviewModal(candidates, mergeMode);
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
    actualExcelCompactMode = loadActualExcelMode();

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
            selectableRange: true,
            selectableRangeMode: "drag",
            clipboard: true,
            clipboardPasteAction: "range",
            clipboardPasteParser: actualClipboardPasteParser,
            placeholder: '실적 라인 데이터가 없습니다.',
            movableColumns: true,
            headerSortElement: sortElement,
            columnDefaults: {
                headerSort: true
            },
            rowFormatter: function(row) {
                applyActualStickyToRow(row);
            },
            columns: [
                getActualSelectionColumn(),
                ...buildActualLineColumns(columnSettings, currentActualViewMode, actualExcelCompactMode)
            ]
        });
        salesActualLineTable.on('tableBuilt', () => {
            salesActualLineTableReady = true;
            if (pendingActualLineData) {
                salesActualLineTable.setData(pendingActualLineData);
                pendingActualLineData = null;
            }
            syncActualExcelModeUI();
            if (!salesActualLineTable?.modules?.clipboard) {
                console.warn('⚠️ Tabulator clipboard 모듈이 없습니다. full build가 필요할 수 있습니다.');
            }
            if (!salesActualLineTable?.modules?.selectRange) {
                console.warn('⚠️ Tabulator range 선택 모듈이 없습니다. full build가 필요할 수 있습니다.');
            }
            bindActualTablePasteHandler();
        });
        salesActualLineTable.on("columnMoved", () => {
            saveActualColumnSettings();
            renderActualColumnsList();
            const freezeSelect = document.getElementById('actualFreezeColumn');
            if (freezeSelect?.value) {
                applyActualColumnFreeze(freezeSelect.value);
            }
        });
        salesActualLineTable.on("columnVisibilityChanged", () => {
            saveActualColumnSettings();
            renderActualColumnsList();
            const freezeSelect = document.getElementById('actualFreezeColumn');
            if (freezeSelect?.value) {
                applyActualColumnFreeze(freezeSelect.value);
            }
        });
        if (!salesActualLineTableReady) {
            await new Promise(resolve => salesActualLineTable.on('tableBuilt', resolve));
        }
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
    if (salesActualLineTable) {
        syncActualExcelModeUI();
    }

    await loadActualFilters();
    await loadActualTargetPlans();
    updateActualTargetModeUI();
    await reloadActualLines();

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
            await saveActualLines();
        });
    }

    const headerSaveBtn = document.getElementById('btnActualHeaderSave');
    if (headerSaveBtn && !headerSaveBtn.dataset.bound) {
        headerSaveBtn.dataset.bound = 'true';
        headerSaveBtn.addEventListener('click', async () => {
            await saveActualLines();
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

    const pasteBtn = document.getElementById('btnActualPasteExcel');
    if (pasteBtn && !pasteBtn.dataset.bound) {
        pasteBtn.dataset.bound = 'true';
        pasteBtn.addEventListener('click', () => {
            if (!actualExcelCompactMode) {
                const ok = confirm('엑셀 모드에서 붙여넣기를 사용할 수 있습니다. 엑셀 모드로 전환할까요?');
                if (!ok) return;
                applyActualExcelMode(true);
                saveActualExcelMode(true);
            }
            openActualPasteModal();
        });
    }

    const pastePreviewBtn = document.getElementById('btnActualPastePreview');
    if (pastePreviewBtn && !pastePreviewBtn.dataset.bound) {
        pastePreviewBtn.dataset.bound = 'true';
        pastePreviewBtn.addEventListener('click', () => {
            const text = document.getElementById('actualPasteInput')?.value || '';
            actualPasteCache = parseActualPaste(text);
            renderActualPastePreview(actualPasteCache);
        });
    }

    const pasteApplyBtn = document.getElementById('btnActualPasteApply');
    if (pasteApplyBtn && !pasteApplyBtn.dataset.bound) {
        pasteApplyBtn.dataset.bound = 'true';
        pasteApplyBtn.addEventListener('click', () => {
            if (!actualPasteCache) {
                const text = document.getElementById('actualPasteInput')?.value || '';
                actualPasteCache = parseActualPaste(text);
            }
            renderActualPastePreview(actualPasteCache);
            applyActualPasteResult(actualPasteCache);
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

    const excelToggle = document.getElementById('actualExcelMode');
    if (excelToggle && !excelToggle.dataset.bound) {
        excelToggle.dataset.bound = 'true';
        excelToggle.checked = actualExcelCompactMode;
        excelToggle.addEventListener('change', () => {
            applyActualExcelMode(excelToggle.checked);
            saveActualExcelMode(excelToggle.checked);
        });
    }

    const yearSelect = document.getElementById('salesActualYear');
    if (yearSelect && !yearSelect.dataset.bound) {
        yearSelect.dataset.bound = 'true';
        yearSelect.addEventListener('change', async () => {
            await loadActualTargetPlans();
            await reloadActualLines();
        });
    }

    const searchBtn = document.getElementById('btnActualSearch');
    if (searchBtn && !searchBtn.dataset.bound) {
        searchBtn.dataset.bound = 'true';
        searchBtn.addEventListener('click', async () => {
            await reloadActualLines();
        });
    }

    const excludeBtn = document.getElementById('btnActualExcludeSelected');
    if (excludeBtn && !excludeBtn.dataset.bound) {
        excludeBtn.dataset.bound = 'true';
        excludeBtn.addEventListener('click', async () => {
            if (!salesActualLineTable) return;
            const selected = salesActualLineTable.getSelectedData() || [];
            if (!selected.length) {
                alert('제외할 대상을 선택하세요.');
                return;
            }
            const actualYear = Number(document.getElementById('salesActualYear')?.value || new Date().getFullYear());
            const pipelineIds = Array.from(new Set(selected.map(row => row.pipeline_id).filter(Boolean)));
            const rowsWithAmounts = selected.filter(hasRegisteredActualAmount);
            if (rowsWithAmounts.length > 0) {
                const ok = confirm(
                    `선택한 ${selected.length}건 중 ${rowsWithAmounts.length}건은 실적 금액(수주/이익)이 입력되어 있습니다.\n제외 시 입력된 금액이 삭제됩니다.\n계속 진행하시겠습니까?`
                );
                if (!ok) return;
            }
            try {
                await API.post(`${API_CONFIG.ENDPOINTS.SALES_ACTUAL_LINES}/delete`, {
                    actual_year: actualYear,
                    pipeline_ids: pipelineIds,
                    updated_by: getCurrentLoginId()
                });
            } catch (error) {
                console.warn('⚠️ 실적 제외 API 실패, 화면에서만 제외합니다.', error);
            }

            const remain = (salesActualLineTable.getData() || []).filter(row => !pipelineIds.includes(row.pipeline_id));
            salesActualLineTable.setData(remain);
            updateActualConsistencyBadge();
            refreshActualPreviewRegistrationStatus();
        });
    }

    const targetModeSelect = document.getElementById('actualTargetMode');
    if (targetModeSelect && !targetModeSelect.dataset.bound) {
        targetModeSelect.dataset.bound = 'true';
        targetModeSelect.addEventListener('change', () => {
            updateActualTargetModeUI();
        });
    }

    const loadTargetsBtn = document.getElementById('btnActualLoadTargets');
    if (loadTargetsBtn && !loadTargetsBtn.dataset.bound) {
        loadTargetsBtn.dataset.bound = 'true';
        loadTargetsBtn.addEventListener('click', () => {
            showActualTargetPreviewModal();
            updateActualTargetModeUI();
        });
    }

    const planSelect = document.getElementById('actualPlanSelect');
    if (planSelect && !planSelect.dataset.bound) {
        planSelect.dataset.bound = 'true';
        planSelect.addEventListener('change', () => {
            updateActualTargetModeUI();
        });
    }

    const previewApplyBtn = document.getElementById('btnActualPreviewApply');
    if (previewApplyBtn && !previewApplyBtn.dataset.bound) {
        previewApplyBtn.dataset.bound = 'true';
        previewApplyBtn.addEventListener('click', () => {
            applySelectedActualTargetsFromPreview();
        });
    }
    const previewCloseBtn = document.getElementById('btnActualPreviewClose');
    if (previewCloseBtn && !previewCloseBtn.dataset.bound) {
        previewCloseBtn.dataset.bound = 'true';
        previewCloseBtn.addEventListener('click', () => {
            closeActualTargetPreviewModal();
        });
    }

    const targetSearchBtn = document.getElementById('btnActualTargetSearch');
    if (targetSearchBtn && !targetSearchBtn.dataset.bound) {
        targetSearchBtn.dataset.bound = 'true';
        targetSearchBtn.addEventListener('click', async () => {
            await handleActualLoadTargets();
        });
    }

    const previewSearchInput = document.getElementById('actualTargetPreviewSearch');
    if (previewSearchInput && !previewSearchInput.dataset.bound) {
        previewSearchInput.dataset.bound = 'true';
        previewSearchInput.addEventListener('input', () => {
            applyActualPreviewSearch();
            updateActualPreviewSummary();
        });
    }
    const previewSearchClearBtn = document.getElementById('btnActualPreviewSearchClear');
    if (previewSearchClearBtn && !previewSearchClearBtn.dataset.bound) {
        previewSearchClearBtn.dataset.bound = 'true';
        previewSearchClearBtn.addEventListener('click', () => {
            const input = document.getElementById('actualTargetPreviewSearch');
            if (input) input.value = '';
            applyActualPreviewSearch();
            updateActualPreviewSummary();
        });
    }

    const editSelectedBtn = document.getElementById('btnActualEditSelected');
    if (editSelectedBtn && !editSelectedBtn.dataset.bound) {
        editSelectedBtn.dataset.bound = 'true';
        editSelectedBtn.addEventListener('click', () => {
            openActualLineEditModal();
        });
    }

    const lineApplyBtn = document.getElementById('btnActualLineApply');
    if (lineApplyBtn && !lineApplyBtn.dataset.bound) {
        lineApplyBtn.dataset.bound = 'true';
        lineApplyBtn.addEventListener('click', () => {
            applyActualLineEditModal();
        });
    }

    const actualFilterIds = ['actualFilterOrg', 'actualFilterManager', 'actualFilterField', 'actualFilterService', 'actualFilterKeyword'];
    actualFilterIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.boundActualFilter) return;
        el.dataset.boundActualFilter = 'true';
        const eventName = id === 'actualFilterKeyword' ? 'input' : 'change';
        const handler = async () => {
            await reloadActualLines();
        };
        el.addEventListener(eventName, handler);
    });
}

async function initializeSalesActualDashboard() {
    const tableEl = document.getElementById('salesActualSummaryTable');
    if (!tableEl) return;

    populateActualYearOptions('actualSummaryYear');
    toggleActualSummaryPeriodOptions();

    if (!salesActualSummaryTable) {
        salesActualSummaryTable = new Tabulator('#salesActualSummaryTable', {
            height: '520px',
            layout: 'fitDataTable',
            renderHorizontal: 'basic',
            placeholder: '집계 데이터가 없습니다.',
            columns: [],
            columnDefaults: {
                headerSort: false,
                headerHozAlign: 'center'
            },
            rowFormatter: (row) => {
                const data = row.getData() || {};
                const el = row.getElement();
                if (!el) return;
                if (data.row_type === 'total') el.classList.add('actual-summary-total');
                else el.classList.remove('actual-summary-total');
            }
        });
    }
    await runActualSummaryReport();

    const runBtn = document.getElementById('btnActualSummaryRun');
    if (runBtn && !runBtn.dataset.bound) {
        runBtn.dataset.bound = 'true';
        runBtn.addEventListener('click', async () => {
            await runActualSummaryReport();
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

    bindActualSummaryControlEvents();
}

function bindActualSummaryControlEvents() {
    const periodSelect = document.getElementById('actualSummaryPeriod');
    if (periodSelect && !periodSelect.dataset.bound) {
        periodSelect.dataset.bound = 'true';
        periodSelect.addEventListener('change', () => {
            toggleActualSummaryPeriodOptions();
        });
    }

    const groupSelect = document.getElementById('actualSummaryGroups');
    if (groupSelect && !groupSelect.dataset.bound) {
        groupSelect.dataset.bound = 'true';
        groupSelect.addEventListener('change', () => updateActualSummaryGroupStat());
    }

    const upBtn = document.getElementById('btnActualSummaryGroupUp');
    if (upBtn && !upBtn.dataset.bound) {
        upBtn.dataset.bound = 'true';
        upBtn.addEventListener('click', () => moveActualSummaryGroupOption(-1));
    }
    const downBtn = document.getElementById('btnActualSummaryGroupDown');
    if (downBtn && !downBtn.dataset.bound) {
        downBtn.dataset.bound = 'true';
        downBtn.addEventListener('click', () => moveActualSummaryGroupOption(1));
    }
    const allBtn = document.getElementById('btnActualSummaryGroupAll');
    if (allBtn && !allBtn.dataset.bound) {
        allBtn.dataset.bound = 'true';
        allBtn.addEventListener('click', () => {
            const select = document.getElementById('actualSummaryGroups');
            if (!select) return;
            Array.from(select.options).forEach(option => { option.selected = true; });
            updateActualSummaryGroupStat();
        });
    }
    const clearBtn = document.getElementById('btnActualSummaryGroupClear');
    if (clearBtn && !clearBtn.dataset.bound) {
        clearBtn.dataset.bound = 'true';
        clearBtn.addEventListener('click', () => {
            const select = document.getElementById('actualSummaryGroups');
            if (!select) return;
            Array.from(select.options).forEach(option => { option.selected = false; });
            const first = select.options[0];
            if (first) first.selected = true;
            updateActualSummaryGroupStat();
        });
    }
}

function moveActualSummaryGroupOption(direction) {
    const select = document.getElementById('actualSummaryGroups');
    if (!select) return;
    const options = Array.from(select.options);
    const selectedIndexes = options
        .map((option, idx) => ({ option, idx }))
        .filter(item => item.option.selected)
        .map(item => item.idx);
    if (!selectedIndexes.length) return;

    if (direction < 0) {
        selectedIndexes.forEach(idx => {
            if (idx <= 0) return;
            const current = select.options[idx];
            const prev = select.options[idx - 1];
            if (prev.selected) return;
            select.insertBefore(current, prev);
        });
    } else {
        selectedIndexes.reverse().forEach(idx => {
            if (idx >= select.options.length - 1) return;
            const current = select.options[idx];
            const next = select.options[idx + 1];
            if (next.selected) return;
            select.insertBefore(next, current);
        });
    }
    updateActualSummaryGroupStat();
}

function toggleActualSummaryPeriodOptions() {
    const period = document.getElementById('actualSummaryPeriod')?.value || 'year';
    const quarterWrap = document.getElementById('actualSummaryQuarterWrap');
    const monthWrap = document.getElementById('actualSummaryMonthWrap');
    if (quarterWrap) quarterWrap.style.display = period === 'quarter' ? '' : 'none';
    if (monthWrap) monthWrap.style.display = period === 'month' ? '' : 'none';
}

function getSelectedSummaryDimensions() {
    const select = document.getElementById('actualSummaryGroups');
    const selected = Array.from(select?.options || [])
        .filter(option => option.selected)
        .map(option => option.value)
        .filter(value => ACTUAL_SUMMARY_DIMENSIONS[value]);
    return selected.length ? selected : ['org'];
}

function getSelectedSummaryPeriods(period) {
    if (period === 'year') {
        return [{ key: 'year', title: '연간합계', months: [1,2,3,4,5,6,7,8,9,10,11,12] }];
    }
    if (period === 'quarter') {
        const selected = Array.from(document.querySelectorAll('.actual-summary-quarter:checked'))
            .map(el => Number(el.value))
            .filter(v => v >= 1 && v <= 4);
        const quarters = selected.length ? selected : [1, 2, 3, 4];
        return quarters.map(q => ({
            key: `q${q}`,
            title: `Q${q}`,
            months: [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3]
        }));
    }
    const selected = Array.from(document.querySelectorAll('.actual-summary-month:checked'))
        .map(el => Number(el.value))
        .filter(v => v >= 1 && v <= 12);
    const months = selected.length ? selected : Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map(m => ({ key: `m${String(m).padStart(2, '0')}`, title: `${m}월`, months: [m] }));
}

async function fetchActualSummaryLines(year) {
    const lines = await fetchActualLines(Number(year), {});
    return lines || [];
}

function buildActualSummaryColumns(dimensions, periods) {
    const dimensionColumns = dimensions.map((key) => ({
        title: ACTUAL_SUMMARY_DIMENSIONS[key]?.title || key,
        field: `dim_${key}`,
        width: 160,
        frozen: false
    }));
    const sumColumns = [
        {
            title: '수주 합계',
            field: 'sum_order',
            width: 150,
            hozAlign: 'right',
            frozen: false,
            formatter: (cell) => formatNumber(cell.getValue())
        },
        {
            title: '이익 합계',
            field: 'sum_profit',
            width: 150,
            hozAlign: 'right',
            frozen: false,
            formatter: (cell) => formatNumber(cell.getValue())
        }
    ];
    const periodColumns = periods.map(period => ({
        title: period.title,
        columns: [
            { title: '수주', field: `${period.key}_order`, width: 140, hozAlign: 'right', formatter: (cell) => formatNumber(cell.getValue()) },
            { title: '이익', field: `${period.key}_profit`, width: 140, hozAlign: 'right', formatter: (cell) => formatNumber(cell.getValue()) }
        ]
    }));
    return [...dimensionColumns, ...sumColumns, ...periodColumns];
}

function buildActualSummaryRows(lines, dimensions, periods) {
    const map = new Map();
    const safeText = (v) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v));

    (lines || []).forEach(line => {
        const dimValues = dimensions.map(key => safeText(line[ACTUAL_SUMMARY_DIMENSIONS[key].field]));
        const rowKey = dimValues.join('|');
        if (!map.has(rowKey)) {
            const base = {};
            dimensions.forEach((key, idx) => {
                base[`dim_${key}`] = dimValues[idx];
            });
            periods.forEach(period => {
                base[`${period.key}_order`] = 0;
                base[`${period.key}_profit`] = 0;
            });
            map.set(rowKey, base);
        }
        const target = map.get(rowKey);
        periods.forEach(period => {
            period.months.forEach(month => {
                const m = String(month).padStart(2, '0');
                target[`${period.key}_order`] += Number(line[`m${m}_order`] || 0);
                target[`${period.key}_profit`] += Number(line[`m${m}_profit`] || 0);
            });
        });
        target.sum_order = periods.reduce((acc, period) => acc + Number(target[`${period.key}_order`] || 0), 0);
        target.sum_profit = periods.reduce((acc, period) => acc + Number(target[`${period.key}_profit`] || 0), 0);
    });

    const rows = Array.from(map.values());
    rows.sort((a, b) => {
        for (const key of dimensions) {
            const av = String(a[`dim_${key}`] || '');
            const bv = String(b[`dim_${key}`] || '');
            const cmp = av.localeCompare(bv, 'ko');
            if (cmp !== 0) return cmp;
        }
        return 0;
    });

    const totalRow = {};
    dimensions.forEach((key, idx) => {
        totalRow[`dim_${key}`] = idx === 0 ? '합계' : '';
    });
    periods.forEach(period => {
        totalRow[`${period.key}_order`] = rows.reduce((acc, row) => acc + Number(row[`${period.key}_order`] || 0), 0);
        totalRow[`${period.key}_profit`] = rows.reduce((acc, row) => acc + Number(row[`${period.key}_profit`] || 0), 0);
    });
    totalRow.sum_order = rows.reduce((acc, row) => acc + Number(row.sum_order || 0), 0);
    totalRow.sum_profit = rows.reduce((acc, row) => acc + Number(row.sum_profit || 0), 0);
    totalRow.row_type = 'total';
    rows.push(totalRow);
    return rows;
}

async function runActualSummaryReport() {
    const year = Number(document.getElementById('actualSummaryYear')?.value || new Date().getFullYear());
    const period = document.getElementById('actualSummaryPeriod')?.value || 'year';
    const dimensions = getSelectedSummaryDimensions();
    const periods = getSelectedSummaryPeriods(period);
    const lines = await fetchActualSummaryLines(year);
    const columns = buildActualSummaryColumns(dimensions, periods);
    const rows = buildActualSummaryRows(lines, dimensions, periods);
    if (salesActualSummaryTable) {
        salesActualSummaryTable.setColumns(columns);
        salesActualSummaryTable.setData(rows);
        salesActualSummaryTable.redraw(true);
    }
    updateActualSummaryStats(rows, dimensions, year);
}

function updateActualSummaryStats(data, dimensions = ['org'], year = null) {
    const total = (data || []).find(row => row.row_type === 'total');
    const orderSum = total ? Number(total.sum_order || 0) : 0;
    const profitSum = total ? Number(total.sum_profit || 0) : 0;

    const orderEl = document.getElementById('actualStatOrder');
    const profitEl = document.getElementById('actualStatProfit');
    const yearEl = document.getElementById('actualStatYear');
    const groupEl = document.getElementById('actualStatGroup');

    if (orderEl) orderEl.textContent = formatNumber(orderSum);
    if (profitEl) profitEl.textContent = formatNumber(profitSum);
    if (yearEl) yearEl.textContent = year || document.getElementById('actualSummaryYear')?.value || '-';
    if (groupEl) {
        groupEl.textContent = dimensions.map(key => ACTUAL_SUMMARY_DIMENSIONS[key]?.title || key).join(' > ');
    }
}

function updateActualSummaryGroupStat() {
    const groupEl = document.getElementById('actualStatGroup');
    if (!groupEl) return;
    const dims = getSelectedSummaryDimensions();
    groupEl.textContent = dims.map(key => ACTUAL_SUMMARY_DIMENSIONS[key]?.title || key).join(' > ');
}

// DOMContentLoaded Hook

document.addEventListener('DOMContentLoaded', () => {
    const lineEl = document.getElementById('salesActualLineTable');
    if (lineEl && (typeof window.isElementInActivePage !== 'function' || window.isElementInActivePage(lineEl))) {
        initializeSalesActualEntry();
    }
    const summaryEl = document.getElementById('salesActualSummaryTable');
    if (summaryEl && (typeof window.isElementInActivePage !== 'function' || window.isElementInActivePage(summaryEl))) {
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
window.closeActualTargetPreviewModal = closeActualTargetPreviewModal;
window.closeActualLineEditModal = closeActualLineEditModal;
window.closeActualPasteModal = closeActualPasteModal;
