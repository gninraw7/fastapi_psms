// ===================================
// static/js/service-codes.js
// 서비스코드 관리 화면
// ===================================

let serviceCodesTable = null;

function bootstrapServiceCodes() {
    const tableEl = document.getElementById('serviceCodesTable');
    if (!tableEl) {
        console.log('⚠️ 서비스코드 테이블 요소 없음, 초기화 스킵');
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(tableEl)) {
        console.log('ℹ️ 서비스코드 비활성 페이지, 초기화 스킵');
        return;
    }

    try {
        initializeServiceCodesTable();
        bindServiceCodesActions();
        refreshServiceCodes();
        console.log('✅ 서비스코드 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 서비스코드 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapServiceCodes);
} else {
    bootstrapServiceCodes();
}

function initializeServiceCodesTable() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    serviceCodesTable = new Tabulator('#serviceCodesTable', {
        ...commonOptions,
        sortMode: 'local',
        ajaxSorting: false,
        height: '600px',
        layout: 'fitDataStretch',
        pagination: true,
        paginationSize: 25,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: '데이터가 없습니다',
        selectable: 1,
        selectableRangeMode: 'click',
        rowFormatter: (row) => {
            const data = row.getData();
            if (data.row_stat === 'D') {
                row.getElement().style.opacity = '0.6';
                row.getElement().style.background = '#fafafa';
                row.getElement().style.border = '1px dashed #e0e0e0';
            }
        },
        columns: [
            { formatter: 'rowSelection', titleFormatter: 'rowSelection', width: 40, headerSort: false, hozAlign: 'center' },
            { title: '서비스코드', field: 'service_code', width: 150, editor: 'input', editable: editableNewCode, headerSort: true },
            { title: '상위코드', field: 'parent_code', width: 140, editor: 'list', editorParams: { values: getServiceCodeOptions, clearable: true }, editable: editableCell },
            { title: '상위명', field: 'parent_name', width: 180, headerSort: true },
            { title: '서비스명', field: 'service_name', width: 200, editor: 'input', editable: editableCell, headerSort: true },
            { title: '표시명', field: 'display_name', width: 220, editor: 'input', editable: editableCell, headerSort: true },
            { title: '정렬순서', field: 'sort_order', width: 70, hozAlign: 'right', editor: 'number', editable: editableCell },
            { title: '사용', field: 'is_use', width: 60, hozAlign: 'center', editor: 'select', editorParams: { values: { Y: 'Y', N: 'N' } }, editable: editableCell },
            { title: '상태', field: 'row_stat', width: 90, hozAlign: 'center', formatter: statusFormatter, headerSort: false },
            { title: '복구', field: 'restore', width: 70, hozAlign: 'center', headerSort: false, formatter: restoreFormatter }
        ],
        cellEdited: (cell) => {
            markRowUpdated(cell);
            if (cell.getField() === 'service_code') {
                validateDuplicate(serviceCodesTable, 'service_code', cell);
            }
            if (cell.getField() === 'parent_code') {
                updateParentName(cell.getRow());
            }
            if (cell.getField() === 'service_name') {
                validateRequired(cell);
                autoFillDisplayName(cell);
            }
        }
    });

    serviceCodesTable.on('cellEdited', (cell) => {
        markRowUpdated(cell);
    });
}

function bindServiceCodesActions() {
    bindButton('btnServiceNew', addServiceRow);
    bindButton('btnServiceDelete', deleteServiceRow);
    bindButton('btnServiceSave', saveServiceRows);
    bindButton('btnServiceRefresh', refreshServiceCodes);
    bindButton('btnServiceExcel', exportServiceExcel);
    bindButton('btnServiceUpload', triggerServiceUpload);

    const input = document.getElementById('serviceExcelInput');
    if (input) {
        input.addEventListener('change', (e) => handleServiceExcelUpload(e.target.files[0]));
    }
}

function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

function editableCell() {
    return true;
}

function editableNewCode(cell) {
    const data = cell.getRow().getData();
    return data.row_stat === 'N';
}

function markRowUpdated(cell) {
    const row = cell.getRow();
    const data = row.getData();
    if (data.row_stat === 'N' || data.row_stat === 'D') return;
    row.update({ row_stat: 'U' });
    const statCell = row.getCell('row_stat');
    if (statCell) statCell.setValue('U', true);
}

function statusFormatter(cell) {
    const value = cell.getValue();
    if (value === 'N') return '<span class="status-new">신규</span>';
    if (value === 'U') return '<span class="status-updated">수정됨</span>';
    if (value === 'D') return '<span class="status-deleted">삭제예정</span>';
    return '';
}

function restoreFormatter(cell) {
    const row = cell.getRow();
    const data = row.getData();
    if (data.row_stat !== 'D') return '';
    const pos = row.getPosition();
    return `<button class="btn btn-xs btn-secondary" onclick="restoreServiceRow(${pos})">복구</button>`;
}

function restoreServiceRow(position) {
    const row = serviceCodesTable.getRowFromPosition(position);
    if (!row) return;
    const data = row.getData();
    row.update({ row_stat: data._prev_row_stat || '', _prev_row_stat: undefined });
}

function addServiceRow() {
    const newRow = {
        service_code: '',
        parent_code: '',
        parent_name: '',
        service_name: '',
        display_name: '',
        sort_order: getNextSortOrder(serviceCodesTable),
        is_use: 'Y',
        row_stat: 'N'
    };
    serviceCodesTable.addRow(newRow, true);
}

function updateParentName(row) {
    const data = row.getData();
    if (!data.parent_code) {
        row.update({ parent_name: '' });
        return;
    }
    const parent = serviceCodesTable.getData().find(r => r.service_code === data.parent_code);
    row.update({ parent_name: parent ? parent.service_name : '' });
}

function deleteServiceRow() {
    const row = serviceCodesTable.getSelectedRows()[0];
    if (!row) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm('선택한 서비스코드를 삭제하시겠습니까?')) {
        return;
    }
    const data = row.getData();
    row.update({ _prev_row_stat: data.row_stat || '', row_stat: 'D' });
}

async function refreshServiceCodes() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.SERVICE_CODES}/list`);
        const items = response.items || [];
        serviceCodesTable.replaceData(items);
    } catch (error) {
        console.error('❌ 서비스코드 조회 실패:', error);
        alert('서비스코드 조회 실패');
    }
}

async function saveServiceRows() {
    const data = serviceCodesTable.getData().filter(r => r.row_stat);
    if (data.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    if (!validateServiceRows(data)) return;

    const payload = {
        items: data.map(r => ({
            service_code: r.service_code,
            parent_code: r.parent_code || null,
            service_name: r.service_name,
            display_name: r.display_name || r.service_name,
            sort_order: r.sort_order || 0,
            is_use: r.is_use || 'Y',
            row_stat: r.row_stat
        }))
    };

    try {
        await API.post(`${API_CONFIG.ENDPOINTS.SERVICE_CODES}/bulk-save`, payload);
        await refreshServiceCodes();
        alert('저장 완료');
    } catch (error) {
        console.error('❌ 서비스코드 저장 실패:', error);
        alert(error?.detail || '저장 실패');
    }
}

function validateServiceRows(rows) {
    for (const row of rows) {
        if (row.row_stat === 'D') continue;
        if (!row.service_code || !row.service_name) {
            alert('서비스코드/서비스명은 필수입니다.');
            return false;
        }
    }
    return true;
}

function exportServiceExcel() {
    if (serviceCodesTable) {
        serviceCodesTable.download('xlsx', '서비스코드.xlsx', { sheetName: 'ServiceCodes' });
    }
}

function triggerServiceUpload() {
    const input = document.getElementById('serviceExcelInput');
    if (input) input.click();
}

async function handleServiceExcelUpload(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        alert('엑셀 업로드를 위해 XLSX 라이브러리가 필요합니다.');
        return;
    }
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (!rows || rows.length < 2) {
            alert('엑셀 데이터가 없습니다.');
            return;
        }

        const headers = rows[0].map(h => (h || '').toString().trim());
        const headerMap = buildServiceHeaderMap(headers);
        if (headerMap.service_code === undefined || headerMap.service_name === undefined) {
            alert('엑셀 헤더에 service_code/service_name(서비스코드/서비스명)이 필요합니다.');
            return;
        }

        const newRows = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const code = getCellValue(row, headerMap.service_code).trim();
            const name = getCellValue(row, headerMap.service_name).trim();
            if (!code || !name) continue;

            if (isDuplicateValue(serviceCodesTable, 'service_code', code)) {
                alert(`중복 코드 발견: ${code}`);
                continue;
            }

            const sortOrder = parseInt(getCellValue(row, headerMap.sort_order), 10);
            const isUse = (getCellValue(row, headerMap.is_use) || 'Y').toString().trim().toUpperCase() || 'Y';

            newRows.push({
                service_code: code,
                parent_code: getCellValue(row, headerMap.parent_code).trim(),
                parent_name: '',
                service_name: name,
                display_name: getCellValue(row, headerMap.display_name).trim() || name,
                sort_order: isNaN(sortOrder) ? 0 : sortOrder,
                is_use: isUse === 'N' ? 'N' : 'Y',
                row_stat: 'N'
            });
        }

        if (newRows.length === 0) {
            alert('추가할 데이터가 없습니다.');
            return;
        }
        serviceCodesTable.addData(newRows, true);
        alert(`업로드 완료: ${newRows.length}건`);
    } catch (error) {
        console.error('❌ 엑셀 업로드 실패:', error);
        alert('엑셀 업로드 실패');
    }
}

function buildServiceHeaderMap(headers) {
    const map = {};
    headers.forEach((h, idx) => {
        if (!h) return;
        const raw = h.toString().trim();
        const key = raw.toLowerCase();
        if (['service_code', '서비스코드', '코드'].includes(raw) || key === 'service_code') {
            map.service_code = idx;
        }
        if (['parent_code', '상위코드'].includes(raw) || key === 'parent_code') {
            map.parent_code = idx;
        }
        if (['service_name', '서비스명', '코드명', 'name'].includes(raw) || key === 'service_name') {
            map.service_name = idx;
        }
        if (['display_name', '표시명'].includes(raw) || key === 'display_name') {
            map.display_name = idx;
        }
        if (['sort_order', '정렬순서'].includes(raw) || key === 'sort_order') {
            map.sort_order = idx;
        }
        if (['is_use', '사용', '사용여부'].includes(raw) || key === 'is_use') {
            map.is_use = idx;
        }
    });
    return map;
}

function autoFillDisplayName(cell) {
    const row = cell.getRow();
    const data = row.getData();
    if (!data.display_name && data.service_name) {
        row.update({ display_name: data.service_name });
    }
}

function getServiceCodeOptions() {
    if (!serviceCodesTable) return [];
    const data = serviceCodesTable.getData();
    return data
        .filter(r => r.service_code)
        .map(r => ({ label: `${r.service_code} - ${r.service_name || ''}`.trim(), value: r.service_code }));
}

function getCellValue(row, index) {
    if (index === undefined || index === null) return '';
    return (row[index] ?? '').toString();
}

function getNextSortOrder(table) {
    const data = table ? table.getData() : [];
    if (!data.length) return 0;
    const max = Math.max(...data.map(d => d.sort_order || 0));
    return max + 1;
}

function validateDuplicate(table, field, cell) {
    const value = cell.getValue();
    if (!value) return;
    const duplicates = table.getData().filter(r => r[field] === value);
    if (duplicates.length > 1) {
        alert(`중복된 코드입니다: ${value}`);
        cell.setValue('', true);
    }
}

function validateRequired(cell) {
    const value = cell.getValue();
    if (!value) {
        alert('필수 입력값입니다.');
    }
}

function isDuplicateValue(table, field, value) {
    if (!table) return false;
    return table.getData().some(row => row[field] === value);
}

window.bootstrapServiceCodes = bootstrapServiceCodes;
window.restoreServiceRow = restoreServiceRow;
