// ===================================
// static/js/org-units.js
// 조직 관리 화면
// ===================================

let orgUnitsTable = null;

function bootstrapOrgUnits() {
    const tableEl = document.getElementById('orgUnitsTable');
    if (!tableEl) {
        console.log('⚠️ 조직 테이블 요소 없음, 초기화 스킵');
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(tableEl)) {
        console.log('ℹ️ 조직 관리 비활성 페이지, 초기화 스킵');
        return;
    }

    try {
        initializeOrgUnitsTable();
        bindOrgUnitsActions();
        refreshOrgUnits();
        console.log('✅ 조직 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 조직 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapOrgUnits);
} else {
    bootstrapOrgUnits();
}

function initializeOrgUnitsTable() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    orgUnitsTable = new Tabulator('#orgUnitsTable', {
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
            { title: '조직ID', field: 'org_id', width: 80, hozAlign: 'right', headerSort: true },
            { title: '조직명', field: 'org_name', width: 220, editor: 'input', editable: editableCell, headerSort: true },
            { title: '상위조직', field: 'parent_id', width: 120, editor: 'list', editorParams: { values: getOrgOptions, clearable: true }, editable: editableCell },
            { title: '상위명', field: 'parent_name', width: 180, headerSort: true },
            { title: '유형', field: 'org_type', width: 110, editor: 'select', editorParams: { values: { HQ: 'HQ', DEPT: 'DEPT', TEAM: 'TEAM' } }, editable: editableCell },
            { title: '정렬순서', field: 'sort_order', width: 70, hozAlign: 'right', editor: 'number', editable: editableCell },
            { title: '사용', field: 'is_use', width: 60, hozAlign: 'center', editor: 'select', editorParams: { values: { Y: 'Y', N: 'N' } }, editable: editableCell },
            { title: '상태', field: 'row_stat', width: 90, hozAlign: 'center', formatter: statusFormatter, headerSort: false },
            { title: '복구', field: 'restore', width: 70, hozAlign: 'center', headerSort: false, formatter: restoreFormatter }
        ],
        cellEdited: (cell) => {
            markRowUpdated(cell);
            if (cell.getField() === 'org_name') {
                validateRequired(cell);
            }
            if (cell.getField() === 'parent_id') {
                updateParentName(cell.getRow());
            }
        }
    });

    orgUnitsTable.on('cellEdited', (cell) => {
        markRowUpdated(cell);
    });
}

function bindOrgUnitsActions() {
    bindButton('btnOrgNew', addOrgRow);
    bindButton('btnOrgDelete', deleteOrgRow);
    bindButton('btnOrgSave', saveOrgRows);
    bindButton('btnOrgRefresh', refreshOrgUnits);
    bindButton('btnOrgExcel', exportOrgExcel);
    bindButton('btnOrgUpload', triggerOrgUpload);

    const input = document.getElementById('orgExcelInput');
    if (input) {
        input.addEventListener('change', (e) => handleOrgExcelUpload(e.target.files[0]));
    }
}

function bindButton(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

function editableCell() {
    return true;
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
    return `<button class="btn btn-xs btn-secondary" onclick="restoreOrgRow(${pos})">복구</button>`;
}

function restoreOrgRow(position) {
    const row = orgUnitsTable.getRowFromPosition(position);
    if (!row) return;
    const data = row.getData();
    row.update({ row_stat: data._prev_row_stat || '', _prev_row_stat: undefined });
}

function addOrgRow() {
    const newRow = {
        org_id: '',
        org_name: '',
        parent_id: '',
        parent_name: '',
        org_type: '',
        sort_order: getNextSortOrder(orgUnitsTable),
        is_use: 'Y',
        row_stat: 'N'
    };
    orgUnitsTable.addRow(newRow, true);
}

function updateParentName(row) {
    const data = row.getData();
    if (!data.parent_id) {
        row.update({ parent_name: '' });
        return;
    }
    const parent = orgUnitsTable.getData().find(r => String(r.org_id) === String(data.parent_id));
    row.update({ parent_name: parent ? parent.org_name : '' });
}

function deleteOrgRow() {
    const row = orgUnitsTable.getSelectedRows()[0];
    if (!row) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm('선택한 조직을 삭제하시겠습니까?')) {
        return;
    }
    const data = row.getData();
    row.update({ _prev_row_stat: data.row_stat || '', row_stat: 'D' });
}

async function refreshOrgUnits() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.ORG_UNITS_ADMIN}/list`);
        const items = response.items || [];
        orgUnitsTable.replaceData(items);
    } catch (error) {
        console.error('❌ 조직 조회 실패:', error);
        alert('조직 조회 실패');
    }
}

async function saveOrgRows() {
    const data = orgUnitsTable.getData().filter(r => r.row_stat);
    if (data.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    if (!validateOrgRows(data)) return;

    const payload = {
        items: data.map(r => ({
            org_id: r.org_id || null,
            org_name: r.org_name,
            parent_id: r.parent_id || null,
            org_type: r.org_type || null,
            sort_order: r.sort_order || 0,
            is_use: r.is_use || 'Y',
            row_stat: r.row_stat
        }))
    };

    try {
        await API.post(`${API_CONFIG.ENDPOINTS.ORG_UNITS_ADMIN}/bulk-save`, payload);
        await refreshOrgUnits();
        alert('저장 완료');
    } catch (error) {
        console.error('❌ 조직 저장 실패:', error);
        alert(error?.detail || '저장 실패');
    }
}

function validateOrgRows(rows) {
    for (const row of rows) {
        if (row.row_stat === 'D') continue;
        if (!row.org_name) {
            alert('조직명은 필수입니다.');
            return false;
        }
    }
    return true;
}

function exportOrgExcel() {
    if (orgUnitsTable) {
        orgUnitsTable.download('xlsx', '조직관리.xlsx', { sheetName: 'OrgUnits' });
    }
}

function triggerOrgUpload() {
    const input = document.getElementById('orgExcelInput');
    if (input) input.click();
}

async function handleOrgExcelUpload(file) {
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
        const headerMap = buildOrgHeaderMap(headers);
        if (headerMap.org_name === undefined) {
            alert('엑셀 헤더에 org_name(조직명)이 필요합니다.');
            return;
        }

        const newRows = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const name = getCellValue(row, headerMap.org_name).trim();
            if (!name) continue;

            const sortOrder = parseInt(getCellValue(row, headerMap.sort_order), 10);
            const isUse = (getCellValue(row, headerMap.is_use) || 'Y').toString().trim().toUpperCase() || 'Y';

            newRows.push({
                org_id: '',
                org_name: name,
                parent_id: getCellValue(row, headerMap.parent_id).trim(),
                parent_name: '',
                org_type: getCellValue(row, headerMap.org_type).trim(),
                sort_order: isNaN(sortOrder) ? 0 : sortOrder,
                is_use: isUse === 'N' ? 'N' : 'Y',
                row_stat: 'N'
            });
        }

        if (newRows.length === 0) {
            alert('추가할 데이터가 없습니다.');
            return;
        }
        orgUnitsTable.addData(newRows, true);
        alert(`업로드 완료: ${newRows.length}건`);
    } catch (error) {
        console.error('❌ 엑셀 업로드 실패:', error);
        alert('엑셀 업로드 실패');
    }
}

function buildOrgHeaderMap(headers) {
    const map = {};
    headers.forEach((h, idx) => {
        if (!h) return;
        const raw = h.toString().trim();
        const key = raw.toLowerCase();
        if (['org_id', '조직id', '조직ID'].includes(raw) || key === 'org_id') {
            map.org_id = idx;
        }
        if (['org_name', '조직명', 'name'].includes(raw) || key === 'org_name') {
            map.org_name = idx;
        }
        if (['parent_id', '상위조직', '상위id'].includes(raw) || key === 'parent_id') {
            map.parent_id = idx;
        }
        if (['org_type', '유형'].includes(raw) || key === 'org_type') {
            map.org_type = idx;
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

function getOrgOptions() {
    if (!orgUnitsTable) return [];
    const data = orgUnitsTable.getData();
    return data
        .filter(r => r.org_id)
        .map(r => ({ label: `${r.org_id} - ${r.org_name || ''}`.trim(), value: r.org_id }));
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

function validateRequired(cell) {
    const value = cell.getValue();
    if (!value) {
        alert('필수 입력값입니다.');
    }
}

window.bootstrapOrgUnits = bootstrapOrgUnits;
window.restoreOrgRow = restoreOrgRow;
