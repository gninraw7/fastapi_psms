// ===================================
// static/js/common-codes.js
// 공통코드 관리 화면
// ===================================

let codeGroupTable = null;
let codeDetailTable = null;
let selectedGroupCode = null;

function bootstrapCommonCodes() {
    const groupEl = document.getElementById('codeGroupTable');
    const detailEl = document.getElementById('codeDetailTable');
    if (!groupEl || !detailEl) {
        console.log('⚠️ 공통코드 테이블 요소 없음, 초기화 스킵');
        return;
    }

    try {
        initializeCommonCodesTables();
        bindCommonCodesActions();
        refreshCodeGroups();
        console.log('✅ 공통코드 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 공통코드 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapCommonCodes);
} else {
    bootstrapCommonCodes();
}

function initializeCommonCodesTables() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    codeGroupTable = new Tabulator("#codeGroupTable", {
        ...commonOptions,
        sortMode: "local",
        ajaxSorting: false,
        height: "600px",
        layout: "fitDataStretch",
        pagination: true,
        paginationSize: 25,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: "데이터가 없습니다",
        selectable: 1,
        selectableRangeMode: "click",
        rowFormatter: function(row) {
            const data = row.getData();
            if (data.row_stat === 'D') {
                row.getElement().style.opacity = '0.6';
                row.getElement().style.background = '#fafafa';
                row.getElement().style.border = '1px dashed #e0e0e0';
            }
        },
        columns: [
            { formatter: "rowSelection", titleFormatter: "rowSelection", width: 40, headerSort: false, hozAlign: "center" },
            { title: "대분류코드", field: "group_code", width: 180, editor: "input", editable: editableGroupCode, headerSort: true },
            { title: "코드명", field: "code_name", width: 220, editor: "input", editable: editableCell, headerSort: true },
            { title: "정렬순서", field: "sort_order", width: 70, hozAlign: "right", editor: "number", editable: editableCell },
            { title: "사용", field: "is_use", width: 60, hozAlign: "center", editor: "select", editorParams: { values: { "Y": "Y", "N": "N" } }, editable: editableCell },
            { title: "상태", field: "row_stat", width: 90, hozAlign: "center", formatter: statusFormatter, headerSort: false },
            { title: "복구", field: "restore", width: 70, hozAlign: "center", headerSort: false, formatter: groupRestoreFormatter }
        ],
        cellEdited: function(cell) {
            const row = cell.getRow();
            const data = row.getData();
            if (!data.row_stat) {
                row.update({ row_stat: 'U' });
                const statCell = row.getCell('row_stat');
                if (statCell) statCell.setValue('U', true);
            }
            if (cell.getField() === 'group_code') {
                validateDuplicate(codeGroupTable, 'group_code', cell);
            }
            if (cell.getField() === 'code_name') {
                validateRequired(cell);
            }
        }
    });

    codeDetailTable = new Tabulator("#codeDetailTable", {
        ...commonOptions,
        sortMode: "local",
        ajaxSorting: false,
        height: "600px",
        layout: "fitDataStretch",
        pagination: true,
        paginationSize: 25,
        paginationSizeSelector: [25, 50, 100, 200],
        placeholder: "대분류를 선택하세요",
        selectable: 1,
        selectableRangeMode: "click",
        rowFormatter: function(row) {
            const data = row.getData();
            if (data.row_stat === 'D') {
                row.getElement().style.opacity = '0.6';
                row.getElement().style.background = '#fafafa';
                row.getElement().style.border = '1px dashed #e0e0e0';
            }
        },
        columns: [
            { formatter: "rowSelection", titleFormatter: "rowSelection", width: 40, headerSort: false, hozAlign: "center" },
            { title: "상세코드", field: "code", width: 160, editor: "input", editable: editableDetailCode, headerSort: true },
            { title: "코드명", field: "code_name", width: 220, editor: "input", editable: editableCell, headerSort: true },
            { title: "정렬순서", field: "sort_order", width: 70, hozAlign: "right", editor: "number", editable: editableCell },
            { title: "사용", field: "is_use", width: 60, hozAlign: "center", editor: "select", editorParams: { values: { "Y": "Y", "N": "N" } }, editable: editableCell },
            { title: "상태", field: "row_stat", width: 90, hozAlign: "center", formatter: statusFormatter, headerSort: false },
            { title: "복구", field: "restore", width: 70, hozAlign: "center", headerSort: false, formatter: detailRestoreFormatter }
        ],
        cellEdited: function(cell) {
            const row = cell.getRow();
            const data = row.getData();
            if (!data.row_stat) {
                row.update({ row_stat: 'U' });
                const statCell = row.getCell('row_stat');
                if (statCell) statCell.setValue('U', true);
            }
            if (cell.getField() === 'code') {
                validateDuplicate(codeDetailTable, 'code', cell);
            }
            if (cell.getField() === 'code_name') {
                validateRequired(cell);
            }
        }
    });

    // 공통 셀 수정 이벤트 보강 (일부 에디터에서 옵션 cellEdited 누락 대비)
    codeGroupTable.on("cellEdited", (cell) => {
        markRowUpdated(cell);
    });
    codeDetailTable.on("cellEdited", (cell) => {
        markRowUpdated(cell);
    });

    codeGroupTable.on("rowClick", function(e, row) {
        codeGroupTable.deselectRow();
        row.select();
        const data = row.getData();
        selectedGroupCode = data.group_code;
        updateSelectedGroupLabel();
        refreshCodeDetails();
    });
}

function markRowUpdated(cell) {
    const row = cell.getRow();
    const data = row.getData();
    if (data.row_stat === 'N' || data.row_stat === 'D') return;
    row.update({ row_stat: 'U' });
    const statCell = row.getCell('row_stat');
    if (statCell) statCell.setValue('U', true);
}

function editableGroupCode(cell) {
    const data = cell.getRow().getData();
    return data.row_stat === 'N';
}

function editableDetailCode(cell) {
    const data = cell.getRow().getData();
    return data.row_stat === 'N';
}

function editableCell(cell) {
    const data = cell.getRow().getData();
    return data.row_stat !== 'D';
}

function statusFormatter(cell) {
    const val = cell.getValue();
    if (val === 'N') return '<span class="badge badge-new" style="background:#4caf50;color:white;padding:0.2rem 0.4rem;border-radius:4px;font-size:0.75rem;">신규</span>';
    if (val === 'U') return '<span class="badge badge-modified" style="background:#ff9800;color:white;padding:0.2rem 0.4rem;border-radius:4px;font-size:0.75rem;">수정됨</span>';
    if (val === 'D') return '<span class="badge badge-danger" style="background:#f44336;color:white;padding:0.2rem 0.4rem;border-radius:4px;font-size:0.75rem;">삭제예정</span>';
    return '';
}

function groupRestoreFormatter(cell) {
    const data = cell.getRow().getData();
    if (data.row_stat !== 'D') return '';
    return `<button class="btn-icon" style="background:#4caf50;color:white;border:none;padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;" title="복구" onclick="restoreGroupRow(${cell.getRow().getPosition()})"><i class="fas fa-undo"></i></button>`;
}

function detailRestoreFormatter(cell) {
    const data = cell.getRow().getData();
    if (data.row_stat !== 'D') return '';
    return `<button class="btn-icon" style="background:#4caf50;color:white;border:none;padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;" title="복구" onclick="restoreDetailRow(${cell.getRow().getPosition()})"><i class="fas fa-undo"></i></button>`;
}

function validateDuplicate(table, field, cell) {
    const value = (cell.getValue() || '').toString().trim();
    if (!value) return;
    const row = cell.getRow();
    const data = row.getData();
    const duplicates = table.getData().filter(r => r !== data && (r[field] || '').toString().trim() === value && r.row_stat !== 'D');
    if (duplicates.length > 0) {
        alert('이미 존재하는 코드입니다.');
        cell.setValue(cell.getOldValue(), true);
    }
}

function validateRequired(cell) {
    const value = (cell.getValue() || '').toString().trim();
    if (!value) {
        alert('필수 항목입니다.');
        cell.setValue(cell.getOldValue(), true);
    }
}

function bindCommonCodesActions() {
    const bind = (id, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    };

    bind('btnGroupNew', addGroupRow);
    bind('btnGroupDelete', deleteGroupRow);
    bind('btnGroupSave', saveGroupRows);
    bind('btnGroupRefresh', refreshCodeGroups);
    bind('btnGroupExcel', exportGroupExcel);
    bind('btnGroupUpload', triggerGroupUpload);

    bind('btnDetailNew', addDetailRow);
    bind('btnDetailDelete', deleteDetailRow);
    bind('btnDetailSave', saveDetailRows);
    bind('btnDetailRefresh', refreshCodeDetails);
    bind('btnDetailExcel', exportDetailExcel);
    bind('btnDetailUpload', triggerDetailUpload);

    const groupInput = document.getElementById('groupExcelInput');
    if (groupInput) {
        groupInput.addEventListener('change', (e) => handleExcelUpload('group', e.target.files[0]));
    }
    const detailInput = document.getElementById('detailExcelInput');
    if (detailInput) {
        detailInput.addEventListener('change', (e) => handleExcelUpload('detail', e.target.files[0]));
    }
}

function updateSelectedGroupLabel() {
    const label = document.getElementById('selectedGroupLabel');
    if (label) {
        label.textContent = selectedGroupCode ? `선택 대분류: ${selectedGroupCode}` : '대분류를 선택하세요';
    }
}

async function refreshCodeGroups() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/GROUP_CODE?is_use=`);
        const items = (response && response.items) ? response.items : [];
        const normalized = items.map(item => ({
            group_code: item.code,
            code_name: item.code_name,
            sort_order: item.sort_order || 0,
            is_use: item.is_use || 'Y',
            row_stat: ''
        }));
        codeGroupTable.setData(normalized);

        if (!selectedGroupCode && normalized.length > 0) {
            selectedGroupCode = normalized[0].group_code;
        }
        updateSelectedGroupLabel();
        refreshCodeDetails();
    } catch (error) {
        console.error('❌ 대분류 로드 실패:', error);
    }
}

async function refreshCodeDetails() {
    if (!selectedGroupCode) {
        codeDetailTable.setData([]);
        updateSelectedGroupLabel();
        return;
    }

    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/${encodeURIComponent(selectedGroupCode)}?is_use=`);
        const items = (response && response.items) ? response.items : [];
        const normalized = items.map(item => ({
            code: item.code,
            code_name: item.code_name,
            sort_order: item.sort_order || 0,
            is_use: item.is_use || 'Y',
            row_stat: ''
        }));
        codeDetailTable.setData(normalized);
    } catch (error) {
        console.error('❌ 상세코드 로드 실패:', error);
    }
}

function addGroupRow() {
    const newRow = {
        group_code: '',
        code_name: '',
        sort_order: getNextSortOrder(codeGroupTable),
        is_use: 'Y',
        row_stat: 'N'
    };
    codeGroupTable.addRow(newRow, true);
}

function deleteGroupRow() {
    const row = codeGroupTable.getSelectedRows()[0];
    if (!row) {
        alert('삭제할 대분류를 선택하세요.');
        return;
    }
    if (!confirm('선택한 대분류를 삭제하시겠습니까? (해당 상세코드도 삭제됩니다)')) {
        return;
    }
    const data = row.getData();
    row.update({ _prev_row_stat: data.row_stat || '', row_stat: 'D' });
}

async function saveGroupRows() {
    const data = codeGroupTable.getData()
        .filter(r => r.row_stat)
        .filter(r => !(r.row_stat === 'D' && !r.group_code));
    if (data.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    if (!validateRowsForSave(data, 'group')) return;
    const payload = {
        group_code: 'GROUP_CODE',
        items: data.map(r => ({
            code: r.group_code,
            code_name: r.code_name,
            sort_order: r.sort_order || 0,
            is_use: r.is_use || 'Y',
            row_stat: r.row_stat
        }))
    };
    try {
        await API.post(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/bulk-save`, payload);
        await refreshCodeGroups();
        alert('대분류 저장 완료');
    } catch (error) {
        console.error('❌ 대분류 저장 실패:', error);
        alert('대분류 저장 실패');
    }
}

function exportGroupExcel() {
    if (codeGroupTable) {
        codeGroupTable.download("xlsx", "공통코드_대분류.xlsx", { sheetName: "GroupCodes" });
    }
}

function triggerGroupUpload() {
    const input = document.getElementById('groupExcelInput');
    if (input) input.click();
}

function addDetailRow() {
    if (!selectedGroupCode) {
        alert('대분류를 먼저 선택하세요.');
        return;
    }
    const newRow = {
        code: '',
        code_name: '',
        sort_order: getNextSortOrder(codeDetailTable),
        is_use: 'Y',
        row_stat: 'N'
    };
    codeDetailTable.addRow(newRow, true);
}

function deleteDetailRow() {
    const row = codeDetailTable.getSelectedRows()[0];
    if (!row) {
        alert('삭제할 상세코드를 선택하세요.');
        return;
    }
    if (!confirm('선택한 상세코드를 삭제하시겠습니까?')) {
        return;
    }
    const data = row.getData();
    row.update({ _prev_row_stat: data.row_stat || '', row_stat: 'D' });
}

function restoreGroupRow(position) {
    const row = codeGroupTable.getRowFromPosition(position);
    if (!row) return;
    const data = row.getData();
    row.update({ row_stat: data._prev_row_stat || '', _prev_row_stat: undefined });
}

function restoreDetailRow(position) {
    const row = codeDetailTable.getRowFromPosition(position);
    if (!row) return;
    const data = row.getData();
    row.update({ row_stat: data._prev_row_stat || '', _prev_row_stat: undefined });
}

async function saveDetailRows() {
    if (!selectedGroupCode) {
        alert('대분류를 먼저 선택하세요.');
        return;
    }
    const data = codeDetailTable.getData()
        .filter(r => r.row_stat)
        .filter(r => !(r.row_stat === 'D' && !r.code));
    if (data.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    if (!validateRowsForSave(data, 'detail')) return;
    const payload = {
        group_code: selectedGroupCode,
        items: data.map(r => ({
            code: r.code,
            code_name: r.code_name,
            sort_order: r.sort_order || 0,
            is_use: r.is_use || 'Y',
            row_stat: r.row_stat
        }))
    };
    try {
        await API.post(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/bulk-save`, payload);
        await refreshCodeDetails();
        alert('상세코드 저장 완료');
    } catch (error) {
        console.error('❌ 상세코드 저장 실패:', error);
        alert('상세코드 저장 실패');
    }
}

function exportDetailExcel() {
    if (codeDetailTable) {
        codeDetailTable.download("xlsx", "공통코드_상세.xlsx", { sheetName: "DetailCodes" });
    }
}

function triggerDetailUpload() {
    const input = document.getElementById('detailExcelInput');
    if (input) input.click();
}

async function handleExcelUpload(type, file) {
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
        const headerMap = buildHeaderMap(headers, type);
        if (!headerMap.code || !headerMap.code_name) {
            alert('엑셀 헤더에 코드/코드명이 필요합니다.');
            return;
        }

        const targetTable = type === 'group' ? codeGroupTable : codeDetailTable;
        const newRows = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const code = getCellValue(row, headerMap.code).trim();
            const codeName = getCellValue(row, headerMap.code_name).trim();
            if (!code || !codeName) continue;

            if (isDuplicateValue(targetTable, type === 'group' ? 'group_code' : 'code', code)) {
                alert(`중복 코드 발견: ${code}`);
                continue;
            }

            const sortOrder = parseInt(getCellValue(row, headerMap.sort_order), 10);
            const isUse = (getCellValue(row, headerMap.is_use) || 'Y').toString().trim().toUpperCase() || 'Y';

            newRows.push({
                [type === 'group' ? 'group_code' : 'code']: code,
                code_name: codeName,
                sort_order: isNaN(sortOrder) ? 0 : sortOrder,
                is_use: (isUse === 'N') ? 'N' : 'Y',
                row_stat: 'N'
            });
        }

        if (newRows.length === 0) {
            alert('추가할 데이터가 없습니다.');
            return;
        }
        targetTable.addData(newRows, true);
        alert(`업로드 완료: ${newRows.length}건`);
    } catch (error) {
        console.error('❌ 엑셀 업로드 실패:', error);
        alert('엑셀 업로드 실패');
    }
}

function buildHeaderMap(headers, type) {
    const map = {};
    headers.forEach((h, idx) => {
        if (!h) return;
        const raw = h.toString().trim();
        const key = raw.toLowerCase();
        if (['group_code', '대분류코드', '그룹코드', 'group'].includes(raw) || key === 'group_code') {
            map.code = idx;
        }
        if (['code', '상세코드', '코드'].includes(raw) || key === 'code') {
            if (type === 'detail' || type === 'group') map.code = idx;
        }
        if (['code_name', '코드명', 'name'].includes(raw) || key === 'code_name') {
            map.code_name = idx;
        }
        if (['sort_order', '정렬순서', 'sort'].includes(raw) || key === 'sort_order') {
            map.sort_order = idx;
        }
        if (['is_use', '사용', 'use'].includes(raw) || key === 'is_use') {
            map.is_use = idx;
        }
    });
    return map;
}

function getCellValue(row, index) {
    if (index === undefined) return '';
    return (row[index] ?? '').toString();
}

function isDuplicateValue(table, field, value) {
    const data = table.getData();
    return data.some(r => (r[field] || '').toString().trim() === value && r.row_stat !== 'D');
}

function validateRowsForSave(rows, type) {
    for (const r of rows) {
        if (r.row_stat === 'D' && !r.code && !r.group_code) {
            continue;
        }
        const code = type === 'group' ? r.group_code : r.code;
        if (!code || !r.code_name) {
            alert('코드와 코드명은 필수입니다.');
            return false;
        }
    }
    return true;
}

function getNextSortOrder(table) {
    const data = table ? table.getData() : [];
    if (data.length === 0) return 0;
    return Math.max(...data.map(r => parseInt(r.sort_order || 0, 10))) + 1;
}

window.bootstrapCommonCodes = bootstrapCommonCodes;
window.restoreGroupRow = restoreGroupRow;
window.restoreDetailRow = restoreDetailRow;
