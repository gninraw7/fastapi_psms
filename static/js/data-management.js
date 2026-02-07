// ===================================
// static/js/data-management.js
// 회사 간 데이터 복제 UI
// ===================================

let sourceTablesTable = null;
let targetTablesTable = null;

function bootstrapDataManagement() {
    const sourceEl = document.getElementById('sourceTablesTable');
    const targetEl = document.getElementById('targetTablesTable');
    if (!sourceEl || !targetEl) {
        console.log('⚠️ 데이터 관리 테이블 요소 없음, 초기화 스킵');
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(sourceEl)) {
        console.log('ℹ️ 데이터 관리 비활성 페이지, 초기화 스킵');
        return;
    }

    try {
        initializeDataTables();
        bindDataActions();
        loadCompanyOptions().then(refreshDataTables);
        console.log('✅ 데이터 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 데이터 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapDataManagement);
} else {
    bootstrapDataManagement();
}

function initializeDataTables() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    sourceTablesTable = new Tabulator('#sourceTablesTable', {
        ...commonOptions,
        sortMode: 'local',
        ajaxSorting: false,
        height: '620px',
        layout: 'fitDataStretch',
        pagination: true,
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: '데이터가 없습니다',
        selectable: true,
        columns: [
            { formatter: 'rowSelection', titleFormatter: 'rowSelection', width: 40, headerSort: false, hozAlign: 'center' },
            { title: '테이블', field: 'table_name', width: 240 },
            { title: '설명', field: 'table_comment', width: 260 },
            { title: '건수', field: 'source_count', width: 120, hozAlign: 'right' }
        ]
    });

    targetTablesTable = new Tabulator('#targetTablesTable', {
        ...commonOptions,
        sortMode: 'local',
        ajaxSorting: false,
        height: '620px',
        layout: 'fitDataStretch',
        pagination: true,
        paginationSize: 50,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: '데이터가 없습니다',
        columns: [
            { title: '테이블', field: 'table_name', width: 240 },
            { title: '설명', field: 'table_comment', width: 260 },
            { title: '건수', field: 'target_count', width: 120, hozAlign: 'right' },
            { title: '상태', field: 'status', width: 120, hozAlign: 'center' },
            { title: '결과', field: 'message', width: 220 }
        ]
    });
}

function bindDataActions() {
    bindButton('btnDataRefresh', refreshDataTables);
    bindButton('btnDataCopy', copySelectedTables);

    const sourceSelect = document.getElementById('sourceCompanySelect');
    const targetSelect = document.getElementById('targetCompanySelect');
    const excludeInput = document.getElementById('excludeTablesInput');
    if (sourceSelect) sourceSelect.addEventListener('change', refreshDataTables);
    if (targetSelect) targetSelect.addEventListener('change', refreshDataTables);
    if (excludeInput) excludeInput.addEventListener('change', refreshDataTables);
}

function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

async function loadCompanyOptions() {
    const sourceSelect = document.getElementById('sourceCompanySelect');
    const targetSelect = document.getElementById('targetCompanySelect');
    if (!sourceSelect || !targetSelect) return;

    try {
        const serverUrl = AUTH.getServerUrl();
        const response = await fetch(`${serverUrl}/api/v1/auth/companies`, { method: 'GET' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const items = data.items || [];

        sourceSelect.innerHTML = '';
        targetSelect.innerHTML = '';

        items.forEach((item) => {
            const option1 = document.createElement('option');
            option1.value = item.company_cd;
            option1.textContent = `${item.company_name || item.company_cd} (${item.company_cd})`;
            sourceSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = item.company_cd;
            option2.textContent = `${item.company_name || item.company_cd} (${item.company_cd})`;
            targetSelect.appendChild(option2);
        });

        const currentCompany = AUTH.getUserInfo()?.company_cd || AUTH.getCompanyCd() || items[0]?.company_cd || '';
        if (currentCompany) {
            sourceSelect.value = currentCompany;
        }
        if (items.length > 1) {
            const other = items.find(i => i.company_cd !== sourceSelect.value);
            targetSelect.value = other?.company_cd || items[0]?.company_cd || '';
        } else if (items.length === 1) {
            targetSelect.value = items[0].company_cd;
        }
    } catch (error) {
        console.error('❌ 회사 목록 로드 실패:', error);
    }
}

async function refreshDataTables() {
    const sourceSelect = document.getElementById('sourceCompanySelect');
    const targetSelect = document.getElementById('targetCompanySelect');
    const excludeInput = document.getElementById('excludeTablesInput');
    if (!sourceSelect || !targetSelect) return;

    const source = (sourceSelect.value || '').trim();
    const target = (targetSelect.value || '').trim();
    if (!source || !target) return;
    const excludeTables = excludeInput ? excludeInput.value.trim() : '';

    try {
        const query = `?source_company_cd=${encodeURIComponent(source)}&target_company_cd=${encodeURIComponent(target)}`
            + (excludeTables ? `&exclude_tables=${encodeURIComponent(excludeTables)}` : '');
        const response = await API.get(`${API_CONFIG.ENDPOINTS.DATA_MANAGEMENT_TABLES}${query}`);
        const items = response.items || [];

        const sourceRows = items.map(item => ({
            table_name: item.table_name,
            table_comment: item.table_comment || '',
            source_count: item.source_count
        }));
        const targetRows = items.map(item => ({
            table_name: item.table_name,
            table_comment: item.table_comment || '',
            target_count: item.target_count,
            status: '',
            message: ''
        }));

        sourceTablesTable.replaceData(sourceRows);
        targetTablesTable.replaceData(targetRows);
        return items;
    } catch (error) {
        console.error('❌ 테이블 목록 조회 실패:', error);
        alert('테이블 목록 조회 실패');
        return [];
    }
}

async function copySelectedTables() {
    const sourceSelect = document.getElementById('sourceCompanySelect');
    const targetSelect = document.getElementById('targetCompanySelect');
    const excludeInput = document.getElementById('excludeTablesInput');
    if (!sourceSelect || !targetSelect) return;

    const source = (sourceSelect.value || '').trim();
    const target = (targetSelect.value || '').trim();
    if (!source || !target) {
        alert('Source/Target 회사를 확인하세요.');
        return;
    }
    if (source === target) {
        alert('Source/Target 회사는 동일할 수 없습니다.');
        return;
    }

    const selectedRows = sourceTablesTable.getSelectedData() || [];
    if (selectedRows.length === 0) {
        alert('복제할 테이블을 선택하세요.');
        return;
    }
    const excludeTables = excludeInput ? excludeInput.value.trim() : '';

    if (!confirm(`선택된 ${selectedRows.length}개 테이블을 복제합니다.\nTarget 회사의 기존 데이터는 삭제됩니다.\n진행하시겠습니까?`)) {
        return;
    }

    const tables = selectedRows.map(r => r.table_name);
    try {
        const result = await API.post(API_CONFIG.ENDPOINTS.DATA_MANAGEMENT_COPY, {
            source_company_cd: source,
            target_company_cd: target,
            tables,
            exclude_tables: excludeTables ? excludeTables.split(',').map(t => t.trim()).filter(Boolean) : []
        });

        const results = result.results || [];
        const statusMap = {};
        results.forEach(r => {
            statusMap[r.table_name] = r;
        });

        await refreshDataTables();
        const currentTargetRows = targetTablesTable.getData();
        currentTargetRows.forEach(row => {
            const r = statusMap[row.table_name];
            if (r) {
                row.status = r.status;
                row.message = `DEL ${r.deleted} / INS ${r.inserted}${r.auto_included ? ' (AUTO)' : ''}`;
            }
        });
        targetTablesTable.replaceData(currentTargetRows);
        renderCopySummary(result.report);
        alert('복제가 완료되었습니다.');
    } catch (error) {
        console.error('❌ 복제 실패:', error);
        alert(error?.message || '복제 실패');
    }
}

function renderCopySummary(report) {
    const el = document.getElementById('dataCopySummary');
    if (!el) return;
    if (!report || !report.totals) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    const t = report.totals || {};
    el.style.display = 'flex';
    el.style.flexWrap = 'wrap';
    el.style.gap = '1rem';
    el.innerHTML = `
        <div><strong>Source:</strong> ${report.source_company_cd}</div>
        <div><strong>Target:</strong> ${report.target_company_cd}</div>
        <div><strong>Tables:</strong> ${t.table_count || 0}</div>
        <div><strong>Deleted:</strong> ${t.deleted_total || 0}</div>
        <div><strong>Inserted:</strong> ${t.inserted_total || 0}</div>
        <div><strong>Target Before:</strong> ${t.target_before_total || 0}</div>
        <div><strong>Target After:</strong> ${t.target_after_total || 0}</div>
        <div><strong>Started:</strong> ${t.started_at || '-'}</div>
        <div><strong>Ended:</strong> ${t.ended_at || '-'}</div>
    `;
}
