// ===================================
// static/js/industry-fields.js
// 분야코드 관리 화면
// ===================================

let industryFieldsTable = null;

function bootstrapIndustryFields() {
    const tableEl = document.getElementById('industryFieldsTable');
    if (!tableEl) {
        console.log('⚠️ 분야코드 테이블 요소 없음, 초기화 스킵');
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(tableEl)) {
        console.log('ℹ️ 분야코드 비활성 페이지, 초기화 스킵');
        return;
    }

    try {
        initializeIndustryFieldsTable();
        bindIndustryFieldsActions();
        refreshIndustryFields();
        console.log('✅ 분야코드 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 분야코드 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapIndustryFields);
} else {
    bootstrapIndustryFields();
}

function initializeIndustryFieldsTable() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    industryFieldsTable = new Tabulator('#industryFieldsTable', {
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
            { title: '분야코드', field: 'field_code', width: 150, editor: 'input', editable: editableNewCode, headerSort: true },
            { title: '분야명', field: 'field_name', width: 220, editor: 'input', editable: editableCell, headerSort: true },
            { title: '기관내용', field: 'org_desc', width: 220, editor: 'input', editable: editableCell, headerSort: true },
            { title: '주요시설', field: 'facility_desc', width: 220, editor: 'input', editable: editableCell, headerSort: true },
            { title: '정렬순서', field: 'sort_order', width: 70, hozAlign: 'right', editor: 'number', editable: editableCell },
            { title: '사용', field: 'is_use', width: 60, hozAlign: 'center', editor: 'select', editorParams: { values: { Y: 'Y', N: 'N' } }, editable: editableCell },
            { title: '상태', field: 'row_stat', width: 90, hozAlign: 'center', formatter: statusFormatter, headerSort: false },
            { title: '복구', field: 'restore', width: 70, hozAlign: 'center', headerSort: false, formatter: restoreFormatter }
        ],
        cellEdited: (cell) => {
            markRowUpdated(cell);
            if (cell.getField() === 'field_code') {
                validateDuplicate(industryFieldsTable, 'field_code', cell);
            }
            if (cell.getField() === 'field_name') {
                validateRequired(cell);
            }
        }
    });

    industryFieldsTable.on('cellEdited', (cell) => {
        markRowUpdated(cell);
    });
}

function bindIndustryFieldsActions() {
    bindButton('btnIndustryNew', addIndustryRow);
    bindButton('btnIndustryDelete', deleteIndustryRow);
    bindButton('btnIndustrySave', saveIndustryRows);
    bindButton('btnIndustryRefresh', refreshIndustryFields);
    bindButton('btnIndustryExcel', exportIndustryExcel);
    bindButton('btnIndustryUpload', triggerIndustryUpload);

    const input = document.getElementById('industryExcelInput');
    if (input) {
        input.addEventListener('change', (e) => handleIndustryExcelUpload(e.target.files[0]));
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
    return `<button class="btn btn-xs btn-secondary" onclick="restoreIndustryRow(${pos})">복구</button>`;
}

function restoreIndustryRow(position) {
    const row = industryFieldsTable.getRowFromPosition(position);
    if (!row) return;
    const data = row.getData();
    row.update({ row_stat: data._prev_row_stat || '', _prev_row_stat: undefined });
}

function addIndustryRow() {
    const newRow = {
        field_code: '',
        field_name: '',
        org_desc: '',
        facility_desc: '',
        sort_order: getNextSortOrder(industryFieldsTable),
        is_use: 'Y',
        row_stat: 'N'
    };
    industryFieldsTable.addRow(newRow, true);
}

function deleteIndustryRow() {
    const row = industryFieldsTable.getSelectedRows()[0];
    if (!row) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm('선택한 분야코드를 삭제하시겠습니까?')) {
        return;
    }
    const data = row.getData();
    row.update({ _prev_row_stat: data.row_stat || '', row_stat: 'D' });
}

async function refreshIndustryFields() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.INDUSTRY_FIELDS}/list`);
        const items = response.items || [];
        industryFieldsTable.replaceData(items);
    } catch (error) {
        console.error('❌ 분야코드 조회 실패:', error);
        alert('분야코드 조회 실패');
    }
}

async function saveIndustryRows() {
    const data = industryFieldsTable.getData().filter(r => r.row_stat);
    if (data.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    if (!validateIndustryRows(data)) return;

    const payload = {
        items: data.map(r => ({
            field_code: r.field_code,
            field_name: r.field_name,
            org_desc: r.org_desc,
            facility_desc: r.facility_desc,
            sort_order: r.sort_order || 0,
            is_use: r.is_use || 'Y',
            row_stat: r.row_stat
        }))
    };

    try {
        await API.post(`${API_CONFIG.ENDPOINTS.INDUSTRY_FIELDS}/bulk-save`, payload);
        await refreshIndustryFields();
        alert('저장 완료');
    } catch (error) {
        console.error('❌ 분야코드 저장 실패:', error);
        alert(error?.detail || '저장 실패');
    }
}

function validateIndustryRows(rows) {
    for (const row of rows) {
        if (row.row_stat === 'D') continue;
        if (!row.field_code || !row.field_name) {
            alert('분야코드/분야명은 필수입니다.');
            return false;
        }
    }
    return true;
}

function exportIndustryExcel() {
    if (industryFieldsTable) {
        industryFieldsTable.download('xlsx', '분야코드.xlsx', { sheetName: 'IndustryFields' });
    }
}

function triggerIndustryUpload() {
    const input = document.getElementById('industryExcelInput');
    if (input) input.click();
}

async function handleIndustryExcelUpload(file) {
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
        const headerMap = buildIndustryHeaderMap(headers);
        if (headerMap.field_code === undefined || headerMap.field_name === undefined) {
            alert('엑셀 헤더에 field_code/field_name(분야코드/분야명)이 필요합니다.');
            return;
        }

        const newRows = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const code = getCellValue(row, headerMap.field_code).trim();
            const name = getCellValue(row, headerMap.field_name).trim();
            if (!code || !name) continue;

            if (isDuplicateValue(industryFieldsTable, 'field_code', code)) {
                alert(`중복 코드 발견: ${code}`);
                continue;
            }

            const sortOrder = parseInt(getCellValue(row, headerMap.sort_order), 10);
            const isUse = (getCellValue(row, headerMap.is_use) || 'Y').toString().trim().toUpperCase() || 'Y';

            newRows.push({
                field_code: code,
                field_name: name,
                org_desc: getCellValue(row, headerMap.org_desc).trim(),
                facility_desc: getCellValue(row, headerMap.facility_desc).trim(),
                sort_order: isNaN(sortOrder) ? 0 : sortOrder,
                is_use: isUse === 'N' ? 'N' : 'Y',
                row_stat: 'N'
            });
        }

        if (newRows.length === 0) {
            alert('추가할 데이터가 없습니다.');
            return;
        }
        industryFieldsTable.addData(newRows, true);
        alert(`업로드 완료: ${newRows.length}건`);
    } catch (error) {
        console.error('❌ 엑셀 업로드 실패:', error);
        alert('엑셀 업로드 실패');
    }
}

function buildIndustryHeaderMap(headers) {
    const map = {};
    headers.forEach((h, idx) => {
        if (!h) return;
        const raw = h.toString().trim();
        const key = raw.toLowerCase();
        if (['field_code', '분야코드', '코드'].includes(raw) || key === 'field_code') {
            map.field_code = idx;
        }
        if (['field_name', '분야명', '코드명', 'name'].includes(raw) || key === 'field_name') {
            map.field_name = idx;
        }
        if (['org_desc', '기관내용'].includes(raw) || key === 'org_desc') {
            map.org_desc = idx;
        }
        if (['facility_desc', '주요시설'].includes(raw) || key === 'facility_desc') {
            map.facility_desc = idx;
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

window.bootstrapIndustryFields = bootstrapIndustryFields;
window.restoreIndustryRow = restoreIndustryRow;
