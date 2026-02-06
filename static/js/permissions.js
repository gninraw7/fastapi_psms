// ===================================
// static/js/permissions.js
// 권한 관리 화면
// ===================================

let permissionsFormsTable = null;
let permissionsRolesTable = null;
let permissionsUsersTable = null;

let permissionFormMap = {};
let permissionFormOptions = {};
let permissionRoleOptions = {};
let permissionUserMap = {};
let permissionUserOptions = {};

function initializePermissions() {
    const formsEl = document.getElementById('permissionsFormsTable');
    const rolesEl = document.getElementById('permissionsRolesTable');
    const usersEl = document.getElementById('permissionsUsersTable');
    if (!formsEl && !rolesEl && !usersEl) {
        console.log('⚠️ 권한 관리 요소 없음, 초기화 스킵');
        return;
    }

    try {
        bindPermissionTabs();
        initializePermissionTables();
        bindPermissionActions();
        refreshAllPermissions();
        setTimeout(() => {
            const activeTab = document.querySelector('#permissionsTabs .detail-tab.active');
            const tabId = activeTab?.dataset.tab || 'forms';
            switchPermissionTab(tabId);
        }, 0);
        console.log('✅ 권한 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 권한 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePermissions);
} else {
    initializePermissions();
}

function bindPermissionTabs() {
    const tabs = document.querySelectorAll('#permissionsTabs .detail-tab');
    tabs.forEach(tab => {
        if (tab.dataset.bound) return;
        tab.dataset.bound = 'true';
        tab.addEventListener('click', () => switchPermissionTab(tab.dataset.tab));
    });
}

function switchPermissionTab(tabId) {
    const tabs = document.querySelectorAll('#permissionsTabs .detail-tab');
    const panes = document.querySelectorAll('#permissionsPanes .detail-pane');
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));

    const activeTab = document.querySelector(`#permissionsTabs .detail-tab[data-tab="${tabId}"]`);
    const activePane = document.getElementById(`permissions-pane-${tabId}`);
    if (activeTab) activeTab.classList.add('active');
    if (activePane) activePane.classList.add('active');

    if (tabId === 'forms' && permissionsFormsTable) {
        permissionsFormsTable.redraw(true);
    } else if (tabId === 'roles' && permissionsRolesTable) {
        permissionsRolesTable.redraw(true);
    } else if (tabId === 'users' && permissionsUsersTable) {
        permissionsUsersTable.redraw(true);
    }
}

function initializePermissionTables() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    if (!permissionsFormsTable) {
        permissionsFormsTable = new Tabulator('#permissionsFormsTable', {
            ...commonOptions,
            sortMode: "local",
            ajaxSorting: false,
            height: "560px",
            layout: "fitDataStretch",
            pagination: true,
            paginationSize: 25,
            paginationSizeSelector: [25, 50, 100, 200],
            placeholder: "데이터가 없습니다",
            selectable: 1,
            selectableRangeMode: "click",
            rowFormatter: permissionRowFormatter,
            columns: [
                { formatter: "rowSelection", titleFormatter: "rowSelection", width: 40, headerSort: false, hozAlign: "center" },
                { title: "화면 ID", field: "form_id", width: 180, editor: "input", editable: editableFormId, headerSort: true },
                { title: "화면명", field: "form_name", minWidth: 220, editor: "input", editable: editablePermissionCell },
                { title: "상태", field: "row_stat", width: 90, hozAlign: "center", formatter: permissionStatusFormatter, headerSort: false },
                { title: "복구", field: "restore", width: 70, hozAlign: "center", headerSort: false, formatter: permissionRestoreFormatter('forms') }
            ]
        });
        permissionsFormsTable.on("cellEdited", markPermissionRowUpdated);
    }

    if (!permissionsRolesTable) {
        permissionsRolesTable = new Tabulator('#permissionsRolesTable', {
            ...commonOptions,
            sortMode: "local",
            ajaxSorting: false,
            height: "560px",
            layout: "fitDataStretch",
            pagination: true,
            paginationSize: 25,
            paginationSizeSelector: [25, 50, 100, 200],
            placeholder: "데이터가 없습니다",
            selectable: 1,
            selectableRangeMode: "click",
            rowFormatter: permissionRowFormatter,
            columns: [
                { formatter: "rowSelection", titleFormatter: "rowSelection", width: 40, headerSort: false, hozAlign: "center" },
                {
                    title: "역할",
                    field: "role",
                    width: 120,
                    editor: "select",
                    editorParams: () => ({ values: permissionRoleOptions }),
                    editable: editablePermissionCell
                },
                {
                    title: "화면 ID",
                    field: "form_id",
                    width: 180,
                    editor: "select",
                    editorParams: () => ({ values: permissionFormOptions }),
                    editable: editablePermissionCell
                },
                { title: "화면명", field: "form_name", minWidth: 220, headerSort: true },
                { title: "조회", field: "can_view", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "등록", field: "can_create", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "수정", field: "can_update", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "삭제", field: "can_delete", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "상태", field: "row_stat", width: 90, hozAlign: "center", formatter: permissionStatusFormatter, headerSort: false },
                { title: "복구", field: "restore", width: 70, hozAlign: "center", headerSort: false, formatter: permissionRestoreFormatter('roles') }
            ]
        });
        permissionsRolesTable.on("cellEdited", (cell) => {
            handlePermissionCellEdited(cell, 'roles');
        });
    }

    if (!permissionsUsersTable) {
        permissionsUsersTable = new Tabulator('#permissionsUsersTable', {
            ...commonOptions,
            sortMode: "local",
            ajaxSorting: false,
            height: "560px",
            layout: "fitDataStretch",
            pagination: true,
            paginationSize: 25,
            paginationSizeSelector: [25, 50, 100, 200],
            placeholder: "데이터가 없습니다",
            selectable: 1,
            selectableRangeMode: "click",
            rowFormatter: permissionRowFormatter,
            columns: [
                { formatter: "rowSelection", titleFormatter: "rowSelection", width: 40, headerSort: false, hozAlign: "center" },
                {
                    title: "로그인 ID",
                    field: "login_id",
                    width: 140,
                    editor: "select",
                    editorParams: () => ({ values: permissionUserOptions }),
                    editable: editablePermissionCell
                },
                { title: "사용자명", field: "user_name", width: 160 },
                {
                    title: "화면 ID",
                    field: "form_id",
                    width: 180,
                    editor: "select",
                    editorParams: () => ({ values: permissionFormOptions }),
                    editable: editablePermissionCell
                },
                { title: "화면명", field: "form_name", minWidth: 220 },
                { title: "조회", field: "can_view", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "등록", field: "can_create", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "수정", field: "can_update", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "삭제", field: "can_delete", width: 90, hozAlign: "center", editor: "select", editorParams: { values: { Y: "Y", N: "N" } }, formatter: permissionFlagFormatter },
                { title: "상태", field: "row_stat", width: 90, hozAlign: "center", formatter: permissionStatusFormatter, headerSort: false },
                { title: "복구", field: "restore", width: 70, hozAlign: "center", headerSort: false, formatter: permissionRestoreFormatter('users') }
            ]
        });
        permissionsUsersTable.on("cellEdited", (cell) => {
            handlePermissionCellEdited(cell, 'users');
        });
    }
}

function permissionRowFormatter(row) {
    const data = row.getData();
    if (data.row_stat === 'D') {
        row.getElement().style.opacity = '0.6';
        row.getElement().style.background = '#fafafa';
        row.getElement().style.border = '1px dashed #e0e0e0';
    }
}

function editableFormId(cell) {
    const data = cell.getRow().getData();
    return data.row_stat === 'N';
}

function editablePermissionCell(cell) {
    const data = cell.getRow().getData();
    return data.row_stat !== 'D';
}

function permissionStatusFormatter(cell) {
    const val = cell.getValue();
    if (val === 'N') return '<span class="badge badge-success">신규</span>';
    if (val === 'U') return '<span class="badge badge-warning">수정</span>';
    if (val === 'D') return '<span class="badge badge-danger">삭제예정</span>';
    return '';
}

function permissionFlagFormatter(cell) {
    const val = String(cell.getValue() || 'N').toUpperCase();
    if (val === 'Y') return '<span class="badge badge-success">Y</span>';
    return '<span class="badge badge-secondary">N</span>';
}

function permissionRestoreFormatter(tableKey) {
    return function(cell) {
        const data = cell.getRow().getData();
        if (data.row_stat !== 'D') return '';
        return `<button class="btn-icon" style="background:#4caf50;color:white;border:none;padding:0.3rem 0.5rem;border-radius:4px;cursor:pointer;" title="복구" onclick="restorePermissionRow('${tableKey}', ${cell.getRow().getPosition()})"><i class="fas fa-undo"></i></button>`;
    };
}

function markPermissionRowUpdated(cell) {
    const row = cell.getRow();
    const data = row.getData();
    if (data.row_stat === 'N' || data.row_stat === 'D') return;
    row.update({ row_stat: 'U' });
    const statCell = row.getCell('row_stat');
    if (statCell) statCell.setValue('U', true);
}

function handlePermissionCellEdited(cell, tableKey) {
    const row = cell.getRow();
    const data = row.getData();
    if (data.row_stat !== 'N' && data.row_stat !== 'D') {
        row.update({ row_stat: 'U' });
        const statCell = row.getCell('row_stat');
        if (statCell) statCell.setValue('U', true);
    }

    if (cell.getField() === 'form_id') {
        row.update({ form_name: permissionFormMap[data.form_id] || data.form_name || '' });
        if (tableKey === 'roles') {
            validateDuplicateRow(permissionsRolesTable, ['role', 'form_id'], '이미 존재하는 역할-화면 조합입니다.');
        }
        if (tableKey === 'users') {
            validateDuplicateRow(permissionsUsersTable, ['login_id', 'form_id'], '이미 존재하는 사용자-화면 조합입니다.');
        }
    }
    if (cell.getField() === 'login_id') {
        row.update({ user_name: permissionUserMap[data.login_id] || data.user_name || '' });
        validateDuplicateRow(permissionsUsersTable, ['login_id', 'form_id'], '이미 존재하는 사용자-화면 조합입니다.');
    }
    if (cell.getField() === 'role') {
        validateDuplicateRow(permissionsRolesTable, ['role', 'form_id'], '이미 존재하는 역할-화면 조합입니다.');
    }
}

function bindPermissionActions() {
    bindPermissionFormActions();
    bindPermissionRoleActions();
    bindPermissionUserActions();
}

function bindPermissionFormActions() {
    const newBtn = document.getElementById('btnPermFormsNew');
    const deleteBtn = document.getElementById('btnPermFormsDelete');
    const saveBtn = document.getElementById('btnPermFormsSave');
    const refreshBtn = document.getElementById('btnPermFormsRefresh');
    const excelBtn = document.getElementById('btnPermFormsExcel');

    if (newBtn && !newBtn.dataset.bound) {
        newBtn.dataset.bound = 'true';
        newBtn.addEventListener('click', () => {
            if (!permissionsFormsTable) return;
            permissionsFormsTable.addRow({ form_id: '', form_name: '', row_stat: 'N' }, true);
        });
    }
    if (deleteBtn && !deleteBtn.dataset.bound) {
        deleteBtn.dataset.bound = 'true';
        deleteBtn.addEventListener('click', () => markPermissionRowDeleted('forms'));
    }
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', () => savePermissionForms());
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.dataset.bound = 'true';
        refreshBtn.addEventListener('click', () => refreshPermissionForms());
    }
    if (excelBtn && !excelBtn.dataset.bound) {
        excelBtn.dataset.bound = 'true';
        excelBtn.addEventListener('click', () => {
            if (permissionsFormsTable) permissionsFormsTable.download('xlsx', 'permission_forms.xlsx', { sheetName: 'Forms' });
        });
    }
}

function bindPermissionRoleActions() {
    const newBtn = document.getElementById('btnPermRolesNew');
    const deleteBtn = document.getElementById('btnPermRolesDelete');
    const saveBtn = document.getElementById('btnPermRolesSave');
    const refreshBtn = document.getElementById('btnPermRolesRefresh');
    const excelBtn = document.getElementById('btnPermRolesExcel');

    if (newBtn && !newBtn.dataset.bound) {
        newBtn.dataset.bound = 'true';
        newBtn.addEventListener('click', () => {
            if (!permissionsRolesTable) return;
            permissionsRolesTable.addRow({
                role: '',
                form_id: '',
                form_name: '',
                can_view: 'N',
                can_create: 'N',
                can_update: 'N',
                can_delete: 'N',
                row_stat: 'N'
            }, true);
        });
    }
    if (deleteBtn && !deleteBtn.dataset.bound) {
        deleteBtn.dataset.bound = 'true';
        deleteBtn.addEventListener('click', () => markPermissionRowDeleted('roles'));
    }
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', () => savePermissionRoles());
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.dataset.bound = 'true';
        refreshBtn.addEventListener('click', () => refreshPermissionRoles());
    }
    if (excelBtn && !excelBtn.dataset.bound) {
        excelBtn.dataset.bound = 'true';
        excelBtn.addEventListener('click', () => {
            if (permissionsRolesTable) permissionsRolesTable.download('xlsx', 'permission_roles.xlsx', { sheetName: 'Roles' });
        });
    }
}

function bindPermissionUserActions() {
    const newBtn = document.getElementById('btnPermUsersNew');
    const deleteBtn = document.getElementById('btnPermUsersDelete');
    const saveBtn = document.getElementById('btnPermUsersSave');
    const refreshBtn = document.getElementById('btnPermUsersRefresh');
    const excelBtn = document.getElementById('btnPermUsersExcel');

    if (newBtn && !newBtn.dataset.bound) {
        newBtn.dataset.bound = 'true';
        newBtn.addEventListener('click', () => {
            if (!permissionsUsersTable) return;
            permissionsUsersTable.addRow({
                login_id: '',
                user_name: '',
                form_id: '',
                form_name: '',
                can_view: 'N',
                can_create: 'N',
                can_update: 'N',
                can_delete: 'N',
                row_stat: 'N'
            }, true);
        });
    }
    if (deleteBtn && !deleteBtn.dataset.bound) {
        deleteBtn.dataset.bound = 'true';
        deleteBtn.addEventListener('click', () => markPermissionRowDeleted('users'));
    }
    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.dataset.bound = 'true';
        saveBtn.addEventListener('click', () => savePermissionUsers());
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.dataset.bound = 'true';
        refreshBtn.addEventListener('click', () => refreshPermissionUsers());
    }
    if (excelBtn && !excelBtn.dataset.bound) {
        excelBtn.dataset.bound = 'true';
        excelBtn.addEventListener('click', () => {
            if (permissionsUsersTable) permissionsUsersTable.download('xlsx', 'permission_users.xlsx', { sheetName: 'Users' });
        });
    }
}

function markPermissionRowDeleted(tableKey) {
    const table = getPermissionTable(tableKey);
    if (!table) return;
    const row = table.getSelectedRows()[0];
    if (!row) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }
    if (!confirm('선택한 항목을 삭제하시겠습니까?')) return;
    const data = row.getData();
    row.update({ _prev_row_stat: data.row_stat || '', row_stat: 'D' });
}

function restorePermissionRow(tableKey, position) {
    const table = getPermissionTable(tableKey);
    if (!table) return;
    const row = table.getRowFromPosition(position);
    if (!row) return;
    const data = row.getData();
    row.update({ row_stat: data._prev_row_stat || '', _prev_row_stat: undefined });
}

function getPermissionTable(tableKey) {
    if (tableKey === 'forms') return permissionsFormsTable;
    if (tableKey === 'roles') return permissionsRolesTable;
    if (tableKey === 'users') return permissionsUsersTable;
    return null;
}

async function refreshAllPermissions() {
    await refreshPermissionForms();
    await refreshPermissionRoles();
    await refreshPermissionUsers();
}

async function refreshPermissionForms() {
    const items = await fetchPermissionForms();
    if (permissionsFormsTable) {
        permissionsFormsTable.setData(items.map(item => ({ ...item, row_stat: '' })));
    }
}

async function refreshPermissionRoles() {
    await loadPermissionLookups();
    try {
        const response = await API.get(API_CONFIG.ENDPOINTS.PERMISSIONS_ROLES);
        const items = response?.items || [];
        const normalized = items.map(item => ({
            ...item,
            form_name: item.form_name || permissionFormMap[item.form_id] || '',
            can_view: item.can_view || 'N',
            can_create: item.can_create || 'N',
            can_update: item.can_update || 'N',
            can_delete: item.can_delete || 'N',
            row_stat: ''
        }));
        if (permissionsRolesTable) permissionsRolesTable.setData(normalized);
    } catch (error) {
        console.error('❌ 역할 권한 로드 실패:', error);
        if (permissionsRolesTable) permissionsRolesTable.setData([]);
    }
}

async function refreshPermissionUsers() {
    await loadPermissionLookups();
    try {
        const response = await API.get(API_CONFIG.ENDPOINTS.PERMISSIONS_USERS);
        const items = response?.items || [];
        const normalized = items.map(item => ({
            ...item,
            user_name: item.user_name || permissionUserMap[item.login_id] || '',
            form_name: item.form_name || permissionFormMap[item.form_id] || '',
            can_view: item.can_view || 'N',
            can_create: item.can_create || 'N',
            can_update: item.can_update || 'N',
            can_delete: item.can_delete || 'N',
            row_stat: ''
        }));
        if (permissionsUsersTable) permissionsUsersTable.setData(normalized);
    } catch (error) {
        console.error('❌ 사용자 권한 로드 실패:', error);
        if (permissionsUsersTable) permissionsUsersTable.setData([]);
    }
}

async function fetchPermissionForms() {
    try {
        const response = await API.get(API_CONFIG.ENDPOINTS.PERMISSIONS_FORMS);
        const items = response?.items || [];
        permissionFormMap = {};
        permissionFormOptions = {};
        items.forEach(item => {
            if (!item.form_id) return;
            permissionFormMap[item.form_id] = item.form_name || '';
            permissionFormOptions[item.form_id] = item.form_name ? `${item.form_id} (${item.form_name})` : item.form_id;
        });
        return items;
    } catch (error) {
        console.error('❌ 화면 목록 조회 실패:', error);
        permissionFormMap = {};
        permissionFormOptions = {};
        return [];
    }
}

async function loadPermissionLookups() {
    await Promise.all([
        fetchPermissionForms(),
        fetchPermissionRoles(),
        fetchPermissionUsers()
    ]);
}

async function fetchPermissionRoles() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/ROLE`);
        const items = response?.items || [];
        permissionRoleOptions = {};
        items.forEach(item => {
            const code = item.code || item.role || item.value;
            const name = item.code_name || item.name || item.label || code;
            if (!code) return;
            permissionRoleOptions[code] = name ? `${code} (${name})` : code;
        });
    } catch (error) {
        console.error('❌ ROLE 코드 로드 실패:', error);
        permissionRoleOptions = {};
    }
}

async function fetchPermissionUsers() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.USERS_LIST}?page=1&page_size=200`);
        const items = response?.items || [];
        permissionUserMap = {};
        permissionUserOptions = {};
        items.forEach(item => {
            if (!item.login_id) return;
            permissionUserMap[item.login_id] = item.user_name || '';
            permissionUserOptions[item.login_id] = item.user_name ? `${item.login_id} (${item.user_name})` : item.login_id;
        });
    } catch (error) {
        console.error('❌ 사용자 목록 로드 실패:', error);
        permissionUserMap = {};
        permissionUserOptions = {};
    }
}

function validateDuplicateRow(table, fields, message) {
    if (!table) return;
    const rows = table.getData().filter(r => r.row_stat !== 'D');
    const seen = new Set();
    for (const row of rows) {
        const key = fields.map(f => (row[f] || '')).join('||');
        if (!key || key.includes('||')) continue;
        if (seen.has(key)) {
            alert(message);
            break;
        }
        seen.add(key);
    }
}

function collectPermissionChanges(table, requiredFields) {
    if (!table) return [];
    const rows = table.getData().filter(r => r.row_stat);
    const changes = [];
    for (const row of rows) {
        const missing = requiredFields.find(field => !row[field]);
        if (row.row_stat === 'D' && missing) {
            continue;
        }
        if (row.row_stat !== 'D' && missing) {
            alert(`필수 값이 누락되었습니다: ${missing}`);
            return null;
        }
        changes.push(row);
    }
    return changes;
}

async function savePermissionForms() {
    const changes = collectPermissionChanges(permissionsFormsTable, ['form_id', 'form_name']);
    if (changes === null) return;
    if (!changes.length) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    const payload = {
        user_id: getCurrentLoginId(),
        items: changes.map(row => ({
            form_id: row.form_id,
            form_name: row.form_name,
            row_stat: row.row_stat
        }))
    };
    try {
        await API.post(`${API_CONFIG.ENDPOINTS.PERMISSIONS_FORMS}/bulk-save`, payload);
        alert('화면 목록이 저장되었습니다.');
        refreshPermissionForms();
    } catch (error) {
        alert('저장 실패: ' + (error.message || error));
    }
}

async function savePermissionRoles() {
    const changes = collectPermissionChanges(permissionsRolesTable, ['role', 'form_id']);
    if (changes === null) return;
    if (!changes.length) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    const payload = {
        user_id: getCurrentLoginId(),
        items: changes.map(row => ({
            role: row.role,
            form_id: row.form_id,
            can_view: row.can_view || 'N',
            can_create: row.can_create || 'N',
            can_update: row.can_update || 'N',
            can_delete: row.can_delete || 'N',
            row_stat: row.row_stat
        }))
    };
    try {
        await API.post(`${API_CONFIG.ENDPOINTS.PERMISSIONS_ROLES}/bulk-save`, payload);
        alert('역할 권한이 저장되었습니다.');
        refreshPermissionRoles();
    } catch (error) {
        alert('저장 실패: ' + (error.message || error));
    }
}

async function savePermissionUsers() {
    const changes = collectPermissionChanges(permissionsUsersTable, ['login_id', 'form_id']);
    if (changes === null) return;
    if (!changes.length) {
        alert('변경된 내용이 없습니다.');
        return;
    }
    const payload = {
        user_id: getCurrentLoginId(),
        items: changes.map(row => ({
            login_id: row.login_id,
            form_id: row.form_id,
            can_view: row.can_view || 'N',
            can_create: row.can_create || 'N',
            can_update: row.can_update || 'N',
            can_delete: row.can_delete || 'N',
            row_stat: row.row_stat
        }))
    };
    try {
        await API.post(`${API_CONFIG.ENDPOINTS.PERMISSIONS_USERS}/bulk-save`, payload);
        alert('사용자 권한이 저장되었습니다.');
        refreshPermissionUsers();
    } catch (error) {
        alert('저장 실패: ' + (error.message || error));
    }
}

function getCurrentLoginId() {
    if (typeof AUTH !== 'undefined' && typeof AUTH.getUserInfo === 'function') {
        const info = AUTH.getUserInfo();
        return info?.login_id || info?.loginId || info?.user_id || 'system';
    }
    return 'system';
}

window.restorePermissionRow = restorePermissionRow;
window.initializePermissions = initializePermissions;
