// ===================================
// static/js/companies.js
// 회사 관리 화면
// ===================================

let companiesTable = null;
let commonTablesTable = null;

function bootstrapCompanies() {
    const tableEl = document.getElementById('companiesTable');
    if (!tableEl) {
        console.log('⚠️ 회사 테이블 요소 없음, 초기화 스킵');
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(tableEl)) {
        console.log('ℹ️ 회사 관리 비활성 페이지, 초기화 스킵');
        return;
    }

    try {
        initializeCompaniesTable();
        initializeCommonTablesTable();
        bindCompanyActions();
        refreshCompanies();
        console.log('✅ 회사 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 회사 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapCompanies);
} else {
    bootstrapCompanies();
}

function initializeCompaniesTable() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    companiesTable = new Tabulator('#companiesTable', {
        ...commonOptions,
        index: 'company_cd',
        sortMode: 'local',
        ajaxSorting: false,
        height: '600px',
        layout: 'fitDataStretch',
        pagination: true,
        paginationSize: 25,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: '데이터가 없습니다',
        selectable: true,
        selectableRangeMode: 'click',
        columnDefaults: {
            ...(commonOptions.columnDefaults || {}),
            headerHozAlign: 'center'
        },
        columns: [
            {
                formatter: 'rowSelection',
                titleFormatter: 'rowSelection',
                titleFormatterParams: { rowRange: 'active' },
                hozAlign: 'center',
                headerSort: false,
                width: 50,
                frozen: true
            },
            { title: '회사코드', field: 'company_cd', width: 160 },
            { title: '회사명', field: 'company_name', width: 220 },
            { title: '별칭', field: 'company_alias', width: 200 },
            { title: '사용', field: 'is_use', width: 80, hozAlign: 'center' },
            { title: '생성일', field: 'created_at', width: 180 },
            { title: '수정일', field: 'updated_at', width: 180 }
        ]
    });
}

function initializeCommonTablesTable() {
    const tableEl = document.getElementById('companyCommonTablesTable');
    if (!tableEl) {
        console.log('⚠️ 공통 테이블 목록 요소 없음, 초기화 스킵');
        return;
    }
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    commonTablesTable = new Tabulator('#companyCommonTablesTable', {
        ...commonOptions,
        index: 'table_name',
        sortMode: 'local',
        ajaxSorting: false,
        height: '600px',
        layout: 'fitDataStretch',
        placeholder: '테이블 목록이 없습니다',
        selectable: true,
        selectableRangeMode: 'click',
        columnDefaults: {
            ...(commonOptions.columnDefaults || {}),
            headerHozAlign: 'center'
        },
        columns: [
            {
                formatter: 'rowSelection',
                titleFormatter: 'rowSelection',
                titleFormatterParams: { rowRange: 'active' },
                hozAlign: 'center',
                headerSort: false,
                width: 48,
                frozen: true
            },
            { title: '테이블', field: 'table_name', width: 160 },
            { title: '설명', field: 'table_comment', width: 220 },
            {
                title: '건수',
                field: 'row_count',
                hozAlign: 'right',
                width: 80,
                formatter: cell => (window.Utils ? Utils.formatNumber(cell.getValue()) : cell.getValue())
            }
        ]
    });
}

function bindCompanyActions() {
    bindButton('btnCompanyRefresh', refreshCompanies);
    bindButton('btnCompanyCreate', createCompany);
    bindButton('btnCompanyReset', resetCompanyForm);
    bindButton('btnCompanyDeactivate', () => updateCompanyStatus('N'));
    bindButton('btnCompanyActivate', () => updateCompanyStatus('Y'));

    const copyCheckbox = document.getElementById('companyCopyCodes');
    const copySelect = document.getElementById('companyCopyFromSelect');
    if (copyCheckbox && copySelect) {
        copySelect.disabled = !copyCheckbox.checked;
        copyCheckbox.addEventListener('change', () => {
            copySelect.disabled = !copyCheckbox.checked;
        });
        copySelect.addEventListener('change', () => {
            refreshCommonTables();
        });
    }
}

function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

async function refreshCompanies() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.COMPANIES}/list`);
        const items = response.items || [];
        if (companiesTable) {
            companiesTable.replaceData(items);
        }
        updateCopyFromOptions(items);
        await refreshCommonTables();
    } catch (error) {
        console.error('❌ 회사 목록 조회 실패:', error);
        alert('회사 목록 조회 실패');
    }
}

function updateCopyFromOptions(items) {
    const select = document.getElementById('companyCopyFromSelect');
    if (!select) return;

    const currentCompany = (window.AUTH?.getUserInfo?.()?.company_cd) || window.AUTH?.getCompanyCd?.() || '';

    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '복사 원본 선택';
    select.appendChild(placeholder);

    items.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.company_cd;
        option.textContent = `${item.company_name} (${item.company_cd})`;
        select.appendChild(option);
    });

    if (currentCompany) {
        select.value = currentCompany;
    }
}

async function refreshCommonTables() {
    if (!commonTablesTable) return;

    const copySelect = document.getElementById('companyCopyFromSelect');
    const sourceCompany = (copySelect?.value || '').trim() ||
        (window.AUTH?.getUserInfo?.()?.company_cd) ||
        (window.AUTH?.getCompanyCd?.()) || '';

    if (!sourceCompany) {
        commonTablesTable.replaceData([]);
        return;
    }

    try {
        const response = await API.get(
            `${API_CONFIG.ENDPOINTS.COMPANIES}/common-tables?source_company_cd=${encodeURIComponent(sourceCompany)}`
        );
        const items = response.items || [];
        commonTablesTable.replaceData(items);

        if (commonTablesTable.getSelectedData().length === 0) {
            const hasComm = items.some(item => item.table_name === 'comm_code');
            if (hasComm) {
                commonTablesTable.selectRow('comm_code');
            }
        }
    } catch (error) {
        console.error('❌ 공통 테이블 목록 조회 실패:', error);
        commonTablesTable.replaceData([]);
    }
}

async function createCompany() {
    const companyCdInput = document.getElementById('companyCdInput');
    const companyNameInput = document.getElementById('companyNameInput');
    const companyAliasInput = document.getElementById('companyAliasInput');
    const companyUseSelect = document.getElementById('companyUseSelect');
    const copyCheckbox = document.getElementById('companyCopyCodes');
    const copySelect = document.getElementById('companyCopyFromSelect');

    const company_cd = (companyCdInput?.value || '').trim().toUpperCase();
    const company_name = (companyNameInput?.value || '').trim();
    const company_alias = (companyAliasInput?.value || '').trim();
    const is_use = (companyUseSelect?.value || 'Y').trim().toUpperCase();

    if (!company_cd || !company_name) {
        alert('회사 코드와 회사명은 필수입니다.');
        return;
    }

    const selectedCommonTables = commonTablesTable
        ? (commonTablesTable.getSelectedData() || []).map(row => row.table_name)
        : [];

    const copy_comm_codes = !!copyCheckbox?.checked || selectedCommonTables.length > 0;
    let copy_from_company_cd = (copySelect?.value || '').trim();
    if (copy_comm_codes && !copy_from_company_cd) {
        copy_from_company_cd = (window.AUTH?.getUserInfo?.()?.company_cd) || window.AUTH?.getCompanyCd?.() || '';
    }

    if (copy_comm_codes && selectedCommonTables.length === 0) {
        alert('복사할 공통 테이블을 선택하세요.');
        return;
    }

    const payload = {
        company_cd,
        company_name,
        company_alias: company_alias || null,
        is_use,
        copy_comm_codes
    };
    if (copy_comm_codes && copy_from_company_cd) {
        payload.copy_from_company_cd = copy_from_company_cd;
    }
    if (copy_comm_codes && selectedCommonTables.length > 0) {
        payload.copy_common_tables = selectedCommonTables;
    }

    try {
        await API.post(`${API_CONFIG.ENDPOINTS.COMPANIES}`, payload);
        alert('회사 등록 완료');
        resetCompanyForm();
        await refreshCompanies();
    } catch (error) {
        console.error('❌ 회사 등록 실패:', error);
        alert(error?.message || '회사 등록 실패');
    }
}

function resetCompanyForm() {
    const companyCdInput = document.getElementById('companyCdInput');
    const companyNameInput = document.getElementById('companyNameInput');
    const companyAliasInput = document.getElementById('companyAliasInput');
    const companyUseSelect = document.getElementById('companyUseSelect');
    const copyCheckbox = document.getElementById('companyCopyCodes');
    const copySelect = document.getElementById('companyCopyFromSelect');

    if (companyCdInput) companyCdInput.value = '';
    if (companyNameInput) companyNameInput.value = '';
    if (companyAliasInput) companyAliasInput.value = '';
    if (companyUseSelect) companyUseSelect.value = 'Y';
    if (copyCheckbox) copyCheckbox.checked = false;
    if (copySelect) copySelect.disabled = true;

    if (commonTablesTable) {
        commonTablesTable.deselectRow();
        const rows = commonTablesTable.getData() || [];
        if (rows.some(row => row.table_name === 'comm_code')) {
            commonTablesTable.selectRow('comm_code');
        }
    }
}

async function updateCompanyStatus(isUse) {
    if (!companiesTable) {
        alert('회사 테이블이 초기화되지 않았습니다.');
        return;
    }
    const selectedRows = companiesTable.getSelectedData() || [];
    if (selectedRows.length === 0) {
        alert('상태를 변경할 회사를 선택하세요.');
        return;
    }

    const actionLabel = isUse === 'N' ? '사용중지' : '사용';
    if (!confirm(`선택한 ${selectedRows.length}개 회사를 '${actionLabel}' 처리하시겠습니까?`)) {
        return;
    }

    let successCount = 0;
    const failed = [];

    for (const row of selectedRows) {
        const companyCd = (row.company_cd || '').trim();
        if (!companyCd) continue;
        try {
            await API.put(`${API_CONFIG.ENDPOINTS.COMPANIES}/${companyCd}/status`, { is_use: isUse });
            successCount += 1;
        } catch (error) {
            console.error('❌ 회사 상태 변경 실패:', companyCd, error);
            failed.push(companyCd);
        }
    }

    await refreshCompanies();

    if (failed.length > 0) {
        alert(`${actionLabel} 처리 완료: ${successCount}건\n실패: ${failed.join(', ')}`);
        return;
    }
    alert(`${actionLabel} 처리 완료: ${successCount}건`);
}
