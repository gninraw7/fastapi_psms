// ===================================
// static/js/notices.js
// 게시판 관리
// ===================================

let noticeListTable = null;
let noticeListReady = false;
let noticeListPendingRefresh = false;
let pendingNoticeViewUpdates = new Set();
let noticeLastClickAt = 0;
let noticeLastClickId = null;
let noticeLastSelectedId = null;
let noticeAttachmentsCache = [];
let pendingNoticeFiles = [];
let pendingReplyFiles = [];
let noticeAttachmentEditable = false;
const NOTICE_DBLCLICK_WINDOW_MS = 700;
let noticeEditor = null;
let noticeEditorType = 'fallback';
let currentNoticeId = null;
let currentNoticeMode = 'view';
let noticeTemplatesCache = [];
let noticeTemplatesById = {};
let noticeTableDefaults = { rows: 3, cols: 3 };
let noticeTablePopoverBound = false;
let noticeTableTargetEditor = null;
let noticeReplyEditor = null;
let noticeReplyEditorType = 'fallback';
let noticeRepliesPage = 1;
let noticeRepliesTotalPages = 1;
let noticeRepliesTotalRecords = 0;
let noticeRepliesCache = [];
let noticeReplyParentId = null;
let noticeReactionState = { LIKE: false, CHECK: false };
let noticeReadersVisible = false;
let noticeFileInputEl = null;
let noticeReplyFileInputEl = null;
let noticeUploadInProgress = false;
let noticeReplyUploadInProgress = false;

const noticeFilters = {
    search_field: 'title',
    search_text: '',
    category: '',
    active_only: '',
    author: '',
    created_from: '',
    created_to: '',
    has_files: '',
    tags: '',
    status: ''
};

const NOTICE_CATEGORY_CONFIG = {
    SYSTEM: { label: 'SYSTEM', icon: 'fa-shield-halved', className: 'notice-badge-system' },
    GENERAL: { label: 'GENERAL', icon: 'fa-comments', className: 'notice-badge-general' },
    URGENT: { label: 'URGENT', icon: 'fa-triangle-exclamation', className: 'notice-badge-urgent' }
};

const NOTICE_STATUS_CONFIG = {
    NORMAL: { label: '일반', className: 'notice-status-normal' },
    IN_PROGRESS: { label: '진행 중', className: 'notice-status-progress' },
    DONE: { label: '완료', className: 'notice-status-done' },
    HOLD: { label: '보류', className: 'notice-status-hold' }
};

const NOTICE_FONTS = [
    '맑은고딕',
    '굴림',
    '굴림체',
    '궁서',
    '궁서체',
    '돋움',
    '돋움채',
    '바탕',
    '바탕체'
];
const NOTICE_FONT_SIZES = ['10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const NOTICE_LINE_HEIGHTS = ['1', '1.2', '1.5', '1.8', '2', '2.5', '3'];
const NOTICE_COLOR_PALETTE = [
    '#111827', '#1f2937', '#334155', '#0f766e', '#2563eb',
    '#7c3aed', '#be123c', '#b45309', '#059669', '#0ea5e9',
    '#f59e0b', '#f97316', '#ec4899'
];
const NOTICE_BG_PALETTE = [
    '#f8fafc', '#e2e8f0', '#cbd5f5', '#bfdbfe', '#bae6fd',
    '#bbf7d0', '#fef3c7', '#fde68a', '#fecaca', '#fbcfe8',
    '#ddd6fe', '#e9d5ff'
];
const NOTICE_ALLOWED_EXTS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.hwp', '.zip',
    '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav'
]);
const NOTICE_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);
const NOTICE_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const NOTICE_MAX_UPLOAD_MB = 20;

function isNoticeListActive() {
    const page = document.getElementById('page-notices-list');
    return !!(page && page.classList.contains('active'));
}

function bootstrapNoticeList() {
    const listEl = document.getElementById('noticesTable');
    if (!listEl) return;
    if (typeof Tabulator === 'undefined') {
        setTimeout(bootstrapNoticeList, 100);
        return;
    }
    if (!noticeListTable && isNoticeListActive()) {
        initializeNoticeListTable();
    }
    bindNoticeListActions();
    if (noticeListTable && isNoticeListActive()) {
        if (noticeListReady) {
            noticeListTable.setData();
        } else {
            noticeListPendingRefresh = true;
        }
    }
}

function initializeNoticeListTable() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    noticeListReady = false;
    noticeListTable = new Tabulator('#noticesTable', {
        ...commonOptions,
        index: 'notice_id',
        sortMode: 'remote',
        ajaxSorting: true,
        height: '600px',
        layout: 'fitDataStretch',
        pagination: true,
        paginationMode: 'remote',
        paginationSize: 20,
        paginationSizeSelector: [20, 50, 100],
        placeholder: '데이터가 없습니다',
        selectable: 1,
        selectableRangeMode: 'click',
        tableBuilt: function() {
            noticeListReady = true;
            if (noticeListPendingRefresh || isNoticeListActive()) {
                noticeListPendingRefresh = false;
                noticeListTable.setData();
            }
        },
        ajaxURL: API_CONFIG.BASE_URL + API_CONFIG.API_VERSION + API_CONFIG.ENDPOINTS.NOTICES_LIST,
        ajaxURLGenerator: function(url, config, params) {
            const queryParams = {
                page: params.page || 1,
                page_size: params.size || 20
            };
            if (noticeFilters.search_text) {
                queryParams.search_text = noticeFilters.search_text;
                queryParams.search_field = noticeFilters.search_field || 'title';
            }
            if (noticeFilters.category) {
                queryParams.category = noticeFilters.category;
            }
            if (noticeFilters.active_only) {
                queryParams.active_only = true;
            }
            if (noticeFilters.author) {
                queryParams.author = noticeFilters.author;
            }
            if (noticeFilters.created_from) {
                queryParams.created_from = noticeFilters.created_from;
            }
            if (noticeFilters.created_to) {
                queryParams.created_to = noticeFilters.created_to;
            }
            if (noticeFilters.has_files) {
                queryParams.has_files = noticeFilters.has_files;
            }
            if (noticeFilters.tags) {
                queryParams.tags = noticeFilters.tags;
            }
            if (noticeFilters.status) {
                queryParams.status = noticeFilters.status;
            }
            const sorters = params.sorters || params.sort || [];
            if (sorters.length > 0) {
                queryParams.sort_field = sorters[0].field;
                queryParams.sort_dir = sorters[0].dir;
            }
            const query = new URLSearchParams(queryParams);
            return url + '?' + query.toString();
        },
        ajaxResponse: function(url, params, response) {
            return {
                last_page: response.total_pages || 1,
                data: response.items || []
            };
        },
        rowDblClick: function(e, row) {
            const data = row.getData();
            openNoticeDetail('view', data.notice_id);
        },
        cellDblClick: function(e, cell) {
            const data = cell.getRow().getData();
            openNoticeDetail('view', data.notice_id);
        },
        rowClick: function(e, row) {
            row.select();
            const data = row.getData();
            const noticeId = Number(data.notice_id);
            noticeLastSelectedId = Number.isNaN(noticeId) ? data.notice_id : noticeId;
            const now = Date.now();
            if ((e && e.detail >= 2) || (noticeLastClickId === noticeLastSelectedId && (now - noticeLastClickAt) < NOTICE_DBLCLICK_WINDOW_MS)) {
                openNoticeDetail('view', noticeLastSelectedId);
            }
            noticeLastClickId = noticeLastSelectedId;
            noticeLastClickAt = now;
        },
        rowFormatter: function(row) {
            const el = row.getElement();
            if (!el.dataset.noticeDbl) {
                el.dataset.noticeDbl = '1';
                el.addEventListener('dblclick', () => {
                    const data = row.getData();
                    if (data && data.notice_id !== undefined && data.notice_id !== null) {
                        openNoticeDetail('view', data.notice_id);
                    }
                });
            }
        },
        columns: [
            {
                title: '',
                field: 'is_fixed',
                width: 40,
                hozAlign: 'center',
                headerSort: false,
                formatter: cell => {
                    const val = String(cell.getValue() || 'N').toUpperCase();
                    return val === 'Y' ? '<i class="fas fa-thumbtack notice-pin"></i>' : '';
                }
            },
            { title: '번호', field: 'notice_id', width: 70, hozAlign: 'center' },
            {
                title: '제목',
                field: 'title',
                minWidth: 280,
                formatter: cell => `<span class="notice-title">${cell.getValue() || ''}</span>`
            },
            {
                title: '카테고리',
                field: 'category',
                width: 130,
                hozAlign: 'center',
                formatter: cell => renderNoticeCategoryBadge(cell.getValue())
            },
            {
                title: '상태',
                field: 'status',
                width: 120,
                hozAlign: 'center',
                formatter: cell => renderNoticeStatusBadge(cell.getValue())
            },
            { title: '작성자', field: 'author_name', width: 140 },
            { title: '게시 시작', field: 'start_date', width: 120, hozAlign: 'center', formatter: cell => formatNoticeDate(cell.getValue()) },
            { title: '게시 종료', field: 'end_date', width: 120, hozAlign: 'center', formatter: cell => formatNoticeDate(cell.getValue()) },
            {
                title: '답글',
                field: 'reply_count',
                width: 90,
                hozAlign: 'right',
                formatter: cell => Number(cell.getValue() || 0).toLocaleString()
            },
            {
                title: '첨부',
                field: 'has_attachments',
                width: 70,
                hozAlign: 'center',
                headerSort: false,
                formatter: cell => renderNoticeAttachmentIcon(cell.getValue())
            },
            { title: '조회수', field: 'view_count', width: 90, hozAlign: 'right' },
            { title: '작성일', field: 'created_at', width: 180, hozAlign: 'center', formatter: cell => formatNoticeDateTime(cell.getValue()) }
        ]
    });

    noticeListTable.on('tableBuilt', () => {
        noticeListReady = true;
        if (noticeListPendingRefresh || isNoticeListActive()) {
            noticeListPendingRefresh = false;
            noticeListTable.setData();
        }
    });

    noticeListTable.on('dataLoaded', () => {
        noticeListReady = true;
        if (pendingNoticeViewUpdates.size > 0) {
            pendingNoticeViewUpdates.forEach((noticeId) => {
                const row = noticeListTable.getRow(noticeId);
                if (row) {
                    const data = row.getData();
                    const currentCount = Number(data.view_count || 0);
                    row.update({ view_count: currentCount + 1 });
                }
            });
            pendingNoticeViewUpdates.clear();
        }
    });
}

function bindNoticeListActions() {
    bindNoticeButton('btnNoticeNew', () => openNoticeDetail('new'));
    bindNoticeButton('btnNoticeOpen', openSelectedNotice);
    bindNoticeButton('btnNoticeRefresh', refreshNoticeList);
    bindNoticeButton('btnNoticeSearch', applyNoticeFilters);
    bindNoticeButton('btnNoticeExportExcel', exportNoticeListToExcel);
    bindNoticeButton('btnNoticeExportPdf', exportNoticeListToPdf);

    const searchText = document.getElementById('noticeSearchText');
    if (searchText && !searchText.dataset.bound) {
        searchText.dataset.bound = 'true';
        searchText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyNoticeFilters();
            }
        });
    }
}

function bindNoticeButton(id, handler) {
    const el = document.getElementById(id);
    if (el && !el.dataset.bound) {
        el.dataset.bound = 'true';
        el.addEventListener('click', handler);
    }
}

function applyNoticeFilters() {
    const searchField = document.getElementById('noticeSearchField');
    const searchText = document.getElementById('noticeSearchText');
    const category = document.getElementById('noticeCategory');
    const activeOnly = document.getElementById('noticeActiveOnly');
    const author = document.getElementById('noticeAuthorFilter');
    const dateFrom = document.getElementById('noticeDateFrom');
    const dateTo = document.getElementById('noticeDateTo');
    const status = document.getElementById('noticeStatusFilter');
    const hasFiles = document.getElementById('noticeHasFilesFilter');
    const tags = document.getElementById('noticeTagsFilter');

    noticeFilters.search_field = (searchField?.value || 'title').trim();
    noticeFilters.search_text = (searchText?.value || '').trim();
    noticeFilters.category = (category?.value || '').trim();
    noticeFilters.active_only = (activeOnly?.value || '').trim();
    noticeFilters.author = (author?.value || '').trim();
    noticeFilters.created_from = (dateFrom?.value || '').trim();
    noticeFilters.created_to = (dateTo?.value || '').trim();
    noticeFilters.status = (status?.value || '').trim();
    noticeFilters.has_files = (hasFiles?.value || '').trim();
    noticeFilters.tags = normalizeHashtags((tags?.value || '').trim());

    refreshNoticeList();
}

function refreshNoticeList() {
    if (!noticeListTable || !noticeListReady || !isNoticeListActive()) {
        noticeListPendingRefresh = true;
        return;
    }
    noticeListTable.setPage(1);
    noticeListTable.setData();
}

function formatNoticeDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatNoticeDateTime(value) {
    if (!value) return '-';
    if (typeof value === 'string') {
        const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
        if (match) {
            return `${match[1]} ${match[2]}`;
        }
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)}KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)}GB`;
}

function normalizeFileUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_CONFIG.BASE_URL}${url}`;
}

function normalizeHashtags(value) {
    if (!value) return '';
    const tokens = value
        .split(/[\s,]+/)
        .map(token => token.trim())
        .filter(Boolean)
        .map(token => token.startsWith('#') ? token.slice(1) : token)
        .filter(Boolean);
    const unique = Array.from(new Set(tokens));
    return unique.map(tag => `#${tag}`).join(' ');
}

function renderNoticeAttachments() {
    const listEl = document.getElementById('noticeAttachmentsList');
    if (!listEl) return;
    const selectAll = document.getElementById('noticeFilesSelectAll');
    if (selectAll) selectAll.checked = false;
    const items = dedupeAttachments([...noticeAttachmentsCache, ...pendingNoticeFiles]);
    if (!items.length) {
        listEl.innerHTML = '<div class="notice-attachment-empty">첨부된 파일이 없습니다.</div>';
        return;
    }
    listEl.innerHTML = items.map((file) => {
        const badge = file.pending ? '<span class="notice-attachment-badge">대기</span>' : '';
        const sizeText = formatFileSize(file.file_size || 0);
        const deleteBtn = noticeAttachmentEditable
            ? `<button class="btn btn-danger btn-sm notice-attachment-delete" data-file-id="${file.file_id}" data-pending="${file.pending ? '1' : '0'}"><i class="fas fa-trash"></i> 삭제</button>`
            : '';
        return `
            <div class="notice-attachment-item" data-file-id="${file.file_id}">
                <label class="notice-attachment-info">
                    <input type="checkbox" class="notice-file-checkbox" data-url="${file.file_url || ''}" data-name="${file.file_name || file.original_name || ''}">
                    <span>${file.file_name || file.original_name || ''}</span>
                </label>
                <div class="notice-attachment-meta">${sizeText}</div>
                ${badge}
                ${deleteBtn}
            </div>
        `;
    }).join('');

    listEl.querySelectorAll('.notice-attachment-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const fileId = Number(btn.getAttribute('data-file-id'));
            const isPending = btn.getAttribute('data-pending') === '1';
            if (!fileId) return;
            if (isPending) {
                pendingNoticeFiles = pendingNoticeFiles.filter(f => Number(f.file_id) !== fileId);
                renderNoticeAttachments();
                return;
            }
            if (!currentNoticeId) return;
            if (!confirm('첨부파일을 삭제하시겠습니까?')) return;
            try {
                await API.delete(`${API_CONFIG.ENDPOINTS.NOTICES}/${currentNoticeId}/files/${fileId}`);
                await loadNoticeAttachments(currentNoticeId);
            } catch (error) {
                console.error('❌ 첨부 파일 삭제 실패:', error);
                alert('첨부 파일 삭제 실패');
            }
        });
    });
}

function renderReplyPendingAttachments() {
    const listEl = document.getElementById('noticeReplyAttachmentsList');
    if (!listEl) return;
    const selectAll = document.getElementById('noticeReplyFilesSelectAll');
    if (selectAll) selectAll.checked = false;
    const items = dedupeAttachments(pendingReplyFiles);
    if (!items.length) {
        listEl.innerHTML = '<div class="notice-attachment-empty">첨부된 파일이 없습니다.</div>';
        return;
    }
    listEl.innerHTML = items.map((file) => {
        const sizeText = formatFileSize(file.file_size || 0);
        return `
            <div class="notice-attachment-item" data-file-id="${file.file_id}">
                <label class="notice-attachment-info">
                    <input type="checkbox" class="notice-reply-file-checkbox" data-url="${file.file_url || ''}" data-name="${file.file_name || file.original_name || ''}">
                    <span>${file.file_name || file.original_name || ''}</span>
                </label>
                <div class="notice-attachment-meta">${sizeText}</div>
                <span class="notice-attachment-badge">대기</span>
            </div>
        `;
    }).join('');
}

function setNoticeAttachmentMode(isEditable) {
    const uploadBtn = document.getElementById('btnNoticeFileUpload');
    if (uploadBtn) uploadBtn.style.display = isEditable ? 'inline-flex' : 'none';
    noticeAttachmentEditable = !!isEditable;
    renderNoticeAttachments();
}

function setNoticeUploadButtonState(disabled) {
    const btn = document.getElementById('btnNoticeFileUpload');
    if (btn) btn.disabled = !!disabled;
}

function setNoticeReplyUploadButtonState(disabled) {
    const btn = document.getElementById('btnNoticeReplyFileUpload');
    if (btn) btn.disabled = !!disabled;
}

function setUploadStatus(kind, message, isError = false) {
    const statusEl = document.getElementById(kind === 'reply' ? 'noticeReplyUploadStatus' : 'noticeUploadStatus');
    const textEl = document.getElementById(kind === 'reply' ? 'noticeReplyUploadText' : 'noticeUploadText');
    if (!statusEl || !textEl) return;
    textEl.textContent = message || '';
    statusEl.classList.toggle('error', !!isError);
    statusEl.style.display = message ? 'flex' : 'none';
}

function setUploadProgress(kind, percent, show = true) {
    const progressEl = document.getElementById(kind === 'reply' ? 'noticeReplyUploadProgress' : 'noticeUploadProgress');
    const barEl = document.getElementById(kind === 'reply' ? 'noticeReplyUploadProgressBar' : 'noticeUploadProgressBar');
    if (!progressEl || !barEl) return;
    if (!show) {
        progressEl.style.display = 'none';
        barEl.style.width = '0%';
        return;
    }
    progressEl.style.display = 'block';
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    barEl.style.width = `${safePercent}%`;
}

function dedupeAttachments(items) {
    const seen = new Set();
    const result = [];
    items.forEach((item) => {
        const name = item.file_name || item.original_name || '';
        const size = item.file_size || 0;
        const key = `${name}|${size}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    });
    return result;
}

function openSelectedNotice() {
    if (!noticeListTable) {
        alert('테이블 초기화 중입니다. 잠시 후 다시 시도하세요.');
        bootstrapNoticeList();
        return;
    }
    const selected = noticeListTable.getSelectedData() || [];
    const fallbackId = noticeLastSelectedId;
    if (!selected.length && !fallbackId) {
        alert('열기할 게시글을 선택하세요.');
        return;
    }
    const targetId = selected.length ? selected[0].notice_id : fallbackId;
    openNoticeDetail('view', targetId);
}

function renderNoticeCategoryBadge(category) {
    const key = (category || 'GENERAL').toString().toUpperCase();
    const config = NOTICE_CATEGORY_CONFIG[key] || NOTICE_CATEGORY_CONFIG.GENERAL;
    return `
        <span class="badge notice-badge ${config.className}">
            <i class="fas ${config.icon}"></i>
            ${config.label}
        </span>
    `;
}

function renderNoticeStatusBadge(status) {
    const key = (status || 'NORMAL').toString().toUpperCase();
    const config = NOTICE_STATUS_CONFIG[key] || NOTICE_STATUS_CONFIG.NORMAL;
    return `<span class="badge notice-status ${config.className}">${config.label}</span>`;
}

function renderNoticeAttachmentIcon(flag) {
    const has = String(flag || '').toUpperCase() === 'Y' || flag === 1 || flag === true;
    return has ? '<i class="fas fa-paperclip notice-attach-icon"></i>' : '';
}

function openNoticeDetail(mode, noticeId) {
    if (noticeId && noticeListTable) {
        const rowId = Number(noticeId);
        const row = noticeListTable.getRow(Number.isNaN(rowId) ? noticeId : rowId);
        if (row) {
            const data = row.getData();
            const currentCount = Number(data.view_count || 0);
            pendingNoticeViewUpdates.add(rowId);
            if (noticeListReady) {
                row.update({ view_count: currentCount + 1 });
                pendingNoticeViewUpdates.delete(rowId);
            }
        }
    }

    const params = new URLSearchParams();
    params.set('page', 'notice-detail');
    params.set('mode', mode || 'view');
    if (noticeId) params.set('notice_id', noticeId);
    const url = `${window.location.pathname}?${params.toString()}`;
    if (history.pushState) {
        history.pushState({ page: 'notice-detail', mode, notice_id: noticeId }, '', url);
    }
    if (typeof navigateTo === 'function') {
        navigateTo('notice-detail');
    }
}

function openNoticeList() {
    const url = `${window.location.pathname}?page=notices-list`;
    if (history.pushState) {
        history.pushState({ page: 'notices-list' }, '', url);
    }
    if (typeof navigateTo === 'function') {
        navigateTo('notices-list');
    }
}

function initializeNoticeDetailPage() {
    bindNoticeDetailActions();
    bindNoticeReadersActions();
    ensureNoticeEditor();
    ensureNoticeReplyEditor();
    bindNoticeReplyActions();
    bindNoticeAttachmentActions();
    bindNoticeReplyFileActions();
    bindNoticeAttachmentDropZones();
    bindNoticeReactionActions();
    bindNoticeRepliesPagination();
    renderNoticeAttachments();
    renderReplyPendingAttachments();
    loadNoticeTemplates();
    setupNoticeTableUi();

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || 'view';
    const noticeId = params.get('notice_id');
    currentNoticeId = noticeId ? Number(noticeId) : null;

    if (!currentNoticeId) {
        resetNoticeDetailForm();
        resetNoticeReplies();
        resetNoticeAttachments();
        setNoticeEditMode(true);
        const panel = document.getElementById('noticeReadersPanel');
        if (panel) panel.style.display = 'none';
        noticeReadersVisible = false;
        return;
    }

    loadNoticeDetail(currentNoticeId, mode);
}

function bindNoticeDetailActions() {
    bindNoticeButton('btnNoticeSave', saveNoticeDetail);
    bindNoticeButton('btnNoticeDelete', deleteNoticeDetail);
    bindNoticeButton('btnNoticeBack', openNoticeList);
    bindNoticeButton('btnNoticeDetailExportExcel', exportNoticeDetailToExcel);
    bindNoticeButton('btnNoticeDetailExportPdf', exportNoticeDetailToPdf);
}

function bindNoticeReadersActions() {
    const btn = document.getElementById('btnNoticeReadersToggle');
    if (btn && !btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', async () => {
            noticeReadersVisible = !noticeReadersVisible;
            const panel = document.getElementById('noticeReadersPanel');
            if (panel) panel.style.display = noticeReadersVisible ? 'block' : 'none';
            btn.textContent = noticeReadersVisible ? '숨기기' : '보기';
            if (noticeReadersVisible && currentNoticeId) {
                await loadNoticeReaders(currentNoticeId);
            }
        });
    }
}

function bindNoticeReactionActions() {
    bindNoticeButton('btnNoticeLike', () => toggleNoticeReaction('LIKE'));
    bindNoticeButton('btnNoticeCheck', () => toggleNoticeReaction('CHECK'));
}

function bindNoticeRepliesPagination() {
    bindNoticeButton('btnNoticeRepliesMore', async () => {
        if (!currentNoticeId) return;
        if (noticeRepliesPage >= noticeRepliesTotalPages) return;
        await loadNoticeReplies(currentNoticeId, noticeRepliesPage + 1, true);
    });
}

function bindNoticeAttachmentActions() {
    bindNoticeButton('btnNoticeFileUpload', handleNoticeFileUpload);
    bindNoticeButton('btnNoticeFileDownloadSelected', () => downloadNoticeFiles(false));
    bindNoticeButton('btnNoticeFileDownloadAll', () => downloadNoticeFiles(true));

    const input = document.getElementById('noticeFileInput');
    if (input && !input.dataset.bound) {
        input.dataset.bound = 'true';
        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []);
            if (!files.length) return;
            noticeUploadInProgress = true;
            setNoticeUploadButtonState(true);
            try {
                await uploadNoticeFiles(files);
            } finally {
                noticeUploadInProgress = false;
                setNoticeUploadButtonState(false);
                input.value = '';
            }
        });
    }
    if (input) noticeFileInputEl = input;

    const selectAll = document.getElementById('noticeFilesSelectAll');
    if (selectAll && !selectAll.dataset.bound) {
        selectAll.dataset.bound = 'true';
        selectAll.addEventListener('change', (e) => {
            document.querySelectorAll('.notice-file-checkbox').forEach((checkbox) => {
                checkbox.checked = e.target.checked;
            });
        });
    }
}

function bindNoticeReplyFileActions() {
    bindNoticeButton('btnNoticeReplyFileUpload', handleReplyFileUpload);
    bindNoticeButton('btnNoticeReplyFileDownloadSelected', () => downloadReplyPendingFiles(false));
    bindNoticeButton('btnNoticeReplyFileDownloadAll', () => downloadReplyPendingFiles(true));

    const input = document.getElementById('noticeReplyFileInput');
    if (input && !input.dataset.bound) {
        input.dataset.bound = 'true';
        input.addEventListener('change', async () => {
            const files = Array.from(input.files || []);
            if (!files.length) return;
            noticeReplyUploadInProgress = true;
            setNoticeReplyUploadButtonState(true);
            try {
                await uploadReplyFiles(files);
            } finally {
                noticeReplyUploadInProgress = false;
                setNoticeReplyUploadButtonState(false);
                input.value = '';
            }
        });
    }
    if (input) noticeReplyFileInputEl = input;

    const selectAll = document.getElementById('noticeReplyFilesSelectAll');
    if (selectAll && !selectAll.dataset.bound) {
        selectAll.dataset.bound = 'true';
        selectAll.addEventListener('change', (e) => {
            document.querySelectorAll('.notice-reply-file-checkbox').forEach((checkbox) => {
                checkbox.checked = e.target.checked;
            });
        });
    }
}

function bindNoticeAttachmentDropZones() {
    const panel = document.querySelector('.notice-attachments-panel');
    if (panel && !panel.dataset.dropBound) {
        panel.dataset.dropBound = 'true';
        panel.addEventListener('dragover', (e) => {
            e.preventDefault();
            panel.classList.add('dragover');
        });
        panel.addEventListener('dragleave', (e) => {
            if (!panel.contains(e.relatedTarget)) {
                panel.classList.remove('dragover');
            }
        });
        panel.addEventListener('drop', async (e) => {
            e.preventDefault();
            panel.classList.remove('dragover');
            if (noticeUploadInProgress) {
                alert('파일 업로드 진행 중입니다. 잠시만 기다려 주세요.');
                return;
            }
            const files = Array.from(e.dataTransfer?.files || []);
            if (!files.length) return;
            await uploadNoticeFiles(files);
        });
    }

    const replyPanel = document.querySelector('.notice-reply-files');
    if (replyPanel && !replyPanel.dataset.dropBound) {
        replyPanel.dataset.dropBound = 'true';
        replyPanel.addEventListener('dragover', (e) => {
            e.preventDefault();
            replyPanel.classList.add('dragover');
        });
        replyPanel.addEventListener('dragleave', (e) => {
            if (!replyPanel.contains(e.relatedTarget)) {
                replyPanel.classList.remove('dragover');
            }
        });
        replyPanel.addEventListener('drop', async (e) => {
            e.preventDefault();
            replyPanel.classList.remove('dragover');
            if (noticeReplyUploadInProgress) {
                alert('파일 업로드 진행 중입니다. 잠시만 기다려 주세요.');
                return;
            }
            const files = Array.from(e.dataTransfer?.files || []);
            if (!files.length) return;
            await uploadReplyFiles(files);
        });
    }
}

function resetNoticeDetailForm() {
    currentNoticeMode = 'edit';
    currentNoticeId = null;
    document.getElementById('noticeDetailTitle').textContent = '게시판 등록';
    setNoticeInputValue('noticeTitleInput', '');
    setNoticeInputValue('noticeCategorySelect', 'GENERAL');
    setNoticeInputValue('noticeFixedSelect', 'N');
    setNoticeInputValue('noticeStatusSelect', 'NORMAL');
    setNoticeInputValue('noticeHashtagsInput', '');
    setNoticeInputValue('noticeStartDate', '');
    setNoticeInputValue('noticeEndDate', '');
    setNoticeInputValue('noticeAuthor', AUTH?.getUserInfo?.()?.user_name || AUTH?.getUserInfo?.()?.login_id || '');
    setNoticeInputValue('noticeViewCount', '0');
    setNoticeInputValue('noticeReadCount', '0');
    setNoticeInputValue('noticeCreatedAt', '');
    setNoticeContent('');
    resetNoticeReactions();
    renderNoticeReaders([]);
}

function resetNoticeAttachments() {
    noticeAttachmentsCache = [];
    pendingNoticeFiles = [];
    renderNoticeAttachments();
}

function resetNoticeReactions() {
    noticeReactionState = { LIKE: false, CHECK: false };
    updateNoticeReactionUI({ LIKE: 0, CHECK: 0 });
}

function updateNoticeReactionUI(counts = {}) {
    const likeCount = document.getElementById('noticeLikeCount');
    const checkCount = document.getElementById('noticeCheckCount');
    if (likeCount) likeCount.textContent = counts.LIKE ?? 0;
    if (checkCount) checkCount.textContent = counts.CHECK ?? 0;
    const likeBtn = document.getElementById('btnNoticeLike');
    const checkBtn = document.getElementById('btnNoticeCheck');
    if (likeBtn) likeBtn.classList.toggle('active', !!noticeReactionState.LIKE);
    if (checkBtn) checkBtn.classList.toggle('active', !!noticeReactionState.CHECK);
}

async function loadNoticeReactions(noticeId) {
    if (!noticeId) {
        resetNoticeReactions();
        return;
    }
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}/reactions`);
        const counts = response.counts || {};
        const userReactions = response.user_reactions || [];
        noticeReactionState = {
            LIKE: userReactions.includes('LIKE'),
            CHECK: userReactions.includes('CHECK')
        };
        updateNoticeReactionUI({
            LIKE: counts.LIKE || 0,
            CHECK: counts.CHECK || 0
        });
    } catch (error) {
        console.error('❌ 반응 조회 실패:', error);
    }
}

async function toggleNoticeReaction(reactionType) {
    if (!currentNoticeId) return;
    try {
        const response = await API.post(`${API_CONFIG.ENDPOINTS.NOTICES}/${currentNoticeId}/reactions`, {
            reaction: reactionType
        });
        const counts = response.counts || {};
        const userReactions = response.user_reactions || [];
        noticeReactionState = {
            LIKE: userReactions.includes('LIKE'),
            CHECK: userReactions.includes('CHECK')
        };
        updateNoticeReactionUI({
            LIKE: counts.LIKE || 0,
            CHECK: counts.CHECK || 0
        });
    } catch (error) {
        console.error('❌ 반응 처리 실패:', error);
        alert('반응 처리 실패');
    }
}

async function loadNoticeReads(noticeId) {
    const readInput = document.getElementById('noticeReadCount');
    if (!noticeId) {
        if (readInput) readInput.value = '0';
        return;
    }
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}/reads`);
        if (readInput) readInput.value = response.count ?? 0;
    } catch (error) {
        console.error('❌ 읽음 수 조회 실패:', error);
    }
}

async function loadNoticeReaders(noticeId) {
    if (!noticeId) return;
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}/reads?include_users=true`);
        if (response && typeof response.count !== 'undefined') {
            const readInput = document.getElementById('noticeReadCount');
            if (readInput) readInput.value = response.count ?? 0;
        }
        renderNoticeReaders(response.items || []);
    } catch (error) {
        console.error('❌ 읽음 사용자 조회 실패:', error);
        renderNoticeReaders([]);
    }
}

function renderNoticeReaders(items) {
    const list = document.getElementById('noticeReadersList');
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<div class="notice-reader-empty">읽음 기록이 없습니다.</div>';
        return;
    }
    list.innerHTML = items.map((item) => {
        const name = item.reader_name || item.reader_id || '';
        const date = formatNoticeDateTime(item.created_at);
        return `
            <div class="notice-reader-item">
                <span class="notice-reader-name">${name}</span>
                <span class="notice-reader-date">${date}</span>
            </div>
        `;
    }).join('');
}

async function loadNoticeDetail(noticeId, mode) {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}?increase_view=true`);
        const canEdit = response.can_edit || false;

        currentNoticeMode = mode === 'new' ? 'edit' : (canEdit ? 'edit' : 'view');
        document.getElementById('noticeDetailTitle').textContent = currentNoticeMode === 'edit' ? '게시판 수정' : '게시판 상세';

        setNoticeInputValue('noticeTitleInput', response.title || '');
        setNoticeInputValue('noticeCategorySelect', response.category || 'GENERAL');
        setNoticeInputValue('noticeFixedSelect', response.is_fixed || 'N');
        setNoticeInputValue('noticeStatusSelect', response.status || 'NORMAL');
        setNoticeInputValue('noticeHashtagsInput', response.hashtags || '');
        setNoticeInputValue('noticeStartDate', response.start_date || '');
        setNoticeInputValue('noticeEndDate', response.end_date || '');
        setNoticeInputValue('noticeAuthor', response.author_name || response.author_id || '');
        setNoticeInputValue('noticeViewCount', response.view_count ?? '0');
        setNoticeInputValue('noticeCreatedAt', response.created_at || '');
        setNoticeContent(response.content || '');

        setNoticeEditMode(currentNoticeMode === 'edit', canEdit);
        pendingReplyFiles = [];
        clearNoticeReplyTarget();
        renderReplyPendingAttachments();
        loadNoticeAttachments(noticeId);
        loadNoticeReplies(noticeId, 1, false);
        loadNoticeReads(noticeId);
        if (noticeReadersVisible) {
            loadNoticeReaders(noticeId);
        } else {
            renderNoticeReaders([]);
        }
        loadNoticeReactions(noticeId);
    } catch (error) {
        console.error('❌ 게시글 조회 실패:', error);
        alert('게시글 조회 실패');
        openNoticeList();
    }
}

function setNoticeInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
}

function setNoticeEditMode(canEdit, canDelete) {
    const isEditable = !!canEdit;
    const detailContainer = document.querySelector('#page-notice-detail .notice-detail-container');
    if (detailContainer) {
        detailContainer.classList.toggle('notice-view-mode', !isEditable);
    }
    const inputs = [
        'noticeTitleInput',
        'noticeCategorySelect',
        'noticeFixedSelect',
        'noticeStatusSelect',
        'noticeHashtagsInput',
        'noticeStartDate',
        'noticeEndDate'
    ];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !isEditable;
    });

    if (noticeEditorType === 'quill' && noticeEditor) {
        noticeEditor.enable(isEditable);
    }
    const fallback = document.getElementById('noticeContentFallback');
    if (fallback) fallback.disabled = !isEditable;

    const saveBtn = document.getElementById('btnNoticeSave');
    const deleteBtn = document.getElementById('btnNoticeDelete');
    if (saveBtn) saveBtn.style.display = isEditable ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = (canDelete && currentNoticeId) ? 'inline-flex' : 'none';
    setNoticeAttachmentMode(isEditable);
}

async function loadNoticeAttachments(noticeId) {
    if (!noticeId) {
        resetNoticeAttachments();
        return;
    }
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}/files`);
        const items = dedupeAttachments(response.items || []);
        noticeAttachmentsCache = items;
        renderNoticeAttachments();
        if (!items.length && pendingNoticeFiles.length) {
            setUploadStatus('notice', '첨부 파일 연결 확인이 필요합니다. 잠시 후 새로고침 해주세요.', true);
        }
    } catch (error) {
        console.error('❌ 첨부 파일 조회 실패:', error);
        setUploadStatus('notice', `첨부 파일 조회 실패: ${error.message || '알 수 없는 오류'}`, true);
        renderNoticeAttachments();
    }
}

async function attachNoticeFiles(noticeId, fileIds) {
    if (!noticeId || !fileIds.length) return;
    await API.post(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}/files`, { file_ids: fileIds });
}

async function attachReplyFiles(replyId, fileIds) {
    if (!replyId || !fileIds.length) return;
    const primaryPath = currentNoticeId
        ? `${API_CONFIG.ENDPOINTS.NOTICES}/${currentNoticeId}/replies/${replyId}/files`
        : null;
    const fallbackPath = `${API_CONFIG.ENDPOINTS.NOTICES}/replies/${replyId}/files`;
    try {
        if (primaryPath) {
            await API.post(primaryPath, { file_ids: fileIds });
            return;
        }
    } catch (error) {
        const msg = String(error?.message || '');
        if (!msg.includes('404')) {
            throw error;
        }
        console.warn('⚠️ 답글 첨부 1차 경로 실패, 대체 경로 시도', error);
    }
    await API.post(fallbackPath, { file_ids: fileIds });
}

function collectCheckedFiles(selector) {
    return Array.from(document.querySelectorAll(selector))
        .filter(cb => cb.checked)
        .map(cb => ({
            url: cb.getAttribute('data-url'),
            name: cb.getAttribute('data-name') || ''
        }))
        .filter(item => item.url)
        .map(item => ({ ...item, url: normalizeFileUrl(item.url) }));
}

function downloadFiles(files) {
    if (!files.length) {
        alert('다운로드할 파일을 선택하세요.');
        return;
    }
    files.forEach((file) => {
        const link = document.createElement('a');
        link.href = file.url;
        if (file.name) link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        link.remove();
    });
}

function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/\r?\n/g, ' ');
    if (str.includes(',') || str.includes('"')) {
        return `"${str.replace(/\"/g, '""')}"`;
    }
    return str;
}

function buildCsv(headers, rows) {
    const lines = [];
    lines.push(headers.map(escapeCsvValue).join(','));
    rows.forEach((row) => {
        lines.push(row.map(escapeCsvValue).join(','));
    });
    return lines.join('\n');
}

function exportNoticeListToExcel() {
    if (!noticeListTable) {
        alert('테이블이 아직 준비되지 않았습니다.');
        return;
    }
    const data = noticeListTable.getData() || [];
    const headers = ['번호', '제목', '카테고리', '상태', '작성자', '게시 시작', '게시 종료', '답글', '첨부', '조회수', '작성일'];
    const rows = data.map((row) => [
        row.notice_id ?? '',
        row.title ?? '',
        row.category ?? '',
        row.status ?? '',
        row.author_name ?? '',
        formatNoticeDate(row.start_date),
        formatNoticeDate(row.end_date),
        row.reply_count ?? 0,
        String(row.has_attachments || '').toUpperCase() === 'Y' ? 'Y' : 'N',
        row.view_count ?? 0,
        formatNoticeDateTime(row.created_at)
    ]);
    const csv = buildCsv(headers, rows);
    downloadBlob(csv, `게시판_목록_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

function exportNoticeListToPdf() {
    if (!noticeListTable) {
        alert('테이블이 아직 준비되지 않았습니다.');
        return;
    }
    const data = noticeListTable.getData() || [];
    const htmlRows = data.map((row) => `
        <tr>
            <td>${row.notice_id ?? ''}</td>
            <td>${row.title ?? ''}</td>
            <td>${row.category ?? ''}</td>
            <td>${row.status ?? ''}</td>
            <td>${row.author_name ?? ''}</td>
            <td>${formatNoticeDate(row.start_date)}</td>
            <td>${formatNoticeDate(row.end_date)}</td>
            <td>${row.reply_count ?? 0}</td>
            <td>${String(row.has_attachments || '').toUpperCase() === 'Y' ? 'Y' : 'N'}</td>
            <td>${row.view_count ?? 0}</td>
            <td>${formatNoticeDateTime(row.created_at)}</td>
        </tr>
    `).join('');

    const html = `
        <html>
        <head>
            <title>게시판 목록</title>
            <style>
                body { font-family: 'Malgun Gothic', Arial, sans-serif; padding: 24px; }
                h2 { margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th, td { border: 1px solid #333; padding: 6px; text-align: left; }
                th { background: #f1f5f9; }
            </style>
        </head>
        <body>
            <h2>게시판 목록</h2>
            <table>
                <thead>
                    <tr>
                        <th>번호</th>
                        <th>제목</th>
                        <th>카테고리</th>
                        <th>상태</th>
                        <th>작성자</th>
                        <th>게시 시작</th>
                        <th>게시 종료</th>
                        <th>답글</th>
                        <th>첨부</th>
                        <th>조회수</th>
                        <th>작성일</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlRows}
                </tbody>
            </table>
        </body>
        </html>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
}

async function exportNoticeDetailToExcel() {
    if (!currentNoticeId) return;
    const replies = await fetchAllRepliesForExport(currentNoticeId);
    const title = document.getElementById('noticeTitleInput')?.value || '';
    const noticeContent = getNoticeContent().replace(/<[^>]*>/g, ' ').trim();
    const headers = ['구분', '내용', '작성자', '작성일'];
    const rows = [
        ['게시글', `${title} ${noticeContent}`.trim(), document.getElementById('noticeAuthor')?.value || '', document.getElementById('noticeCreatedAt')?.value || '']
    ];
    replies.forEach((reply) => {
        rows.push([
            '답글',
            (reply.content || '').replace(/<[^>]*>/g, ' ').trim(),
            reply.author_name || reply.author_id || '',
            formatNoticeDateTime(reply.created_at)
        ]);
    });
    const csv = buildCsv(headers, rows);
    downloadBlob(csv, `게시판_상세_${currentNoticeId}.csv`, 'text/csv;charset=utf-8;');
}

async function exportNoticeDetailToPdf() {
    if (!currentNoticeId) return;
    const replies = await fetchAllRepliesForExport(currentNoticeId);
    const title = document.getElementById('noticeTitleInput')?.value || '';
    const content = getNoticeContent() || '';
    const author = document.getElementById('noticeAuthor')?.value || '';
    const createdAt = document.getElementById('noticeCreatedAt')?.value || '';
    const repliesHtml = replies.map((reply) => `
        <div class="reply">
            <div><strong>${reply.author_name || reply.author_id || ''}</strong> (${formatNoticeDateTime(reply.created_at)})</div>
            <div>${reply.content || ''}</div>
        </div>
    `).join('');
    const html = `
        <html>
        <head>
            <title>게시판 상세</title>
            <style>
                body { font-family: 'Malgun Gothic', Arial, sans-serif; padding: 24px; }
                h2 { margin-bottom: 8px; }
                .meta { color: #475569; margin-bottom: 16px; }
                .content { border: 1px solid #cbd5f5; padding: 12px; margin-bottom: 20px; }
                .reply { border-top: 1px solid #e2e8f0; padding: 8px 0; }
            </style>
        </head>
        <body>
            <h2>${title}</h2>
            <div class="meta">작성자: ${author} | 작성일: ${createdAt}</div>
            <div class="content">${content}</div>
            <h3>답글</h3>
            ${repliesHtml || '<div>등록된 답글이 없습니다.</div>'}
        </body>
        </html>
    `;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
}

async function fetchAllRepliesForExport(noticeId) {
    const items = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}/replies?page=${page}&page_size=200`);
        const pageItems = response.items || [];
        items.push(...pageItems);
        totalPages = response.total_pages || 1;
        page += 1;
    }
    return items;
}

function downloadNoticeFiles(all) {
    if (all) {
        const files = [...noticeAttachmentsCache, ...pendingNoticeFiles]
            .map(file => ({
                url: normalizeFileUrl(file.file_url),
                name: file.file_name || file.original_name || ''
            }))
            .filter(item => item.url);
        downloadFiles(files);
        return;
    }
    const files = collectCheckedFiles('.notice-file-checkbox');
    downloadFiles(files);
}

function downloadReplyPendingFiles(all) {
    if (all) {
        const files = pendingReplyFiles.map(file => ({
            url: normalizeFileUrl(file.file_url),
            name: file.file_name || file.original_name || ''
        })).filter(item => item.url);
        downloadFiles(files);
        return;
    }
    const files = collectCheckedFiles('.notice-reply-file-checkbox');
    downloadFiles(files);
}

async function handleNoticeFileUpload() {
    if (noticeUploadInProgress) {
        alert('파일 업로드 진행 중입니다. 잠시만 기다려 주세요.');
        return;
    }
    if (!noticeFileInputEl) {
        noticeFileInputEl = document.createElement('input');
        noticeFileInputEl.type = 'file';
        noticeFileInputEl.multiple = true;
        noticeFileInputEl.style.display = 'none';
        noticeFileInputEl.addEventListener('change', async () => {
            const files = Array.from(noticeFileInputEl.files || []);
            if (!files.length) return;
            noticeUploadInProgress = true;
            setNoticeUploadButtonState(true);
            try {
                await uploadNoticeFiles(files);
            } finally {
                noticeUploadInProgress = false;
                setNoticeUploadButtonState(false);
                noticeFileInputEl.value = '';
            }
        });
        document.body.appendChild(noticeFileInputEl);
    }
    noticeFileInputEl.value = '';
    noticeFileInputEl.click();
}

async function handleReplyFileUpload() {
    if (noticeReplyUploadInProgress) {
        alert('파일 업로드 진행 중입니다. 잠시만 기다려 주세요.');
        return;
    }
    if (!noticeReplyFileInputEl) {
        noticeReplyFileInputEl = document.createElement('input');
        noticeReplyFileInputEl.type = 'file';
        noticeReplyFileInputEl.multiple = true;
        noticeReplyFileInputEl.style.display = 'none';
        noticeReplyFileInputEl.addEventListener('change', async () => {
            const files = Array.from(noticeReplyFileInputEl.files || []);
            if (!files.length) return;
            noticeReplyUploadInProgress = true;
            setNoticeReplyUploadButtonState(true);
            try {
                await uploadReplyFiles(files);
            } finally {
                noticeReplyUploadInProgress = false;
                setNoticeReplyUploadButtonState(false);
                noticeReplyFileInputEl.value = '';
            }
        });
        document.body.appendChild(noticeReplyFileInputEl);
    }
    noticeReplyFileInputEl.value = '';
    noticeReplyFileInputEl.click();
}

async function uploadNoticeFiles(files) {
    const manageState = !noticeUploadInProgress;
    if (manageState) {
        noticeUploadInProgress = true;
        setNoticeUploadButtonState(true);
    }
    const uploaded = [];
    const existing = dedupeAttachments([...noticeAttachmentsCache, ...pendingNoticeFiles]);
    try {
        setUploadStatus('notice', `업로드 준비중... (${files.length}개)`);
        setUploadProgress('notice', 0, true);
        for (const file of files) {
            const isDup = existing.some(item =>
                (item.file_name || item.original_name || '') === file.name &&
                Number(item.file_size || 0) === Number(file.size || 0)
            );
            if (isDup) {
                alert(`이미 등록된 파일입니다: ${file.name}`);
                continue;
            }
            try {
                setUploadStatus('notice', `업로드 중: ${file.name}`);
                const result = await uploadNoticeFile(file, (evt) => {
                    if (evt.lengthComputable) {
                        const percent = Math.round((evt.loaded / evt.total) * 100);
                        setUploadProgress('notice', percent, true);
                    }
                });
                uploaded.push({
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_url: result.url,
                    file_size: result.size
                });
            } catch (error) {
                console.error('❌ 파일 업로드 실패:', error);
                setUploadStatus('notice', `업로드 실패: ${error.message || '알 수 없는 오류'}`, true);
                alert(`파일 업로드 실패: ${error.message || '알 수 없는 오류'}`);
            }
        }
        if (!uploaded.length) return;
        if (currentNoticeId) {
            uploaded.forEach((item) => pendingNoticeFiles.push({ ...item, pending: true }));
            renderNoticeAttachments();
            const ids = uploaded.map(f => f.file_id).filter(Boolean);
            try {
                if (!ids.length) {
                    throw new Error('업로드 결과를 확인할 수 없습니다.');
                }
                await attachNoticeFiles(currentNoticeId, ids);
                await loadNoticeAttachments(currentNoticeId);
                if (noticeAttachmentsCache.length) {
                    pendingNoticeFiles = [];
                    renderNoticeAttachments();
                } else {
                    setUploadStatus('notice', '첨부 파일 연결 결과가 비어 있습니다. 새로고침 후 확인해주세요.', true);
                }
            } catch (error) {
                console.error('❌ 첨부 파일 연결 실패:', error);
                setUploadStatus('notice', `첨부 파일 연결 실패: ${error.message || '알 수 없는 오류'}`, true);
            }
        } else {
            uploaded.forEach((item) => pendingNoticeFiles.push({ ...item, pending: true }));
            renderNoticeAttachments();
        }
        setUploadStatus('notice', '업로드 완료');
        setUploadProgress('notice', 100, true);
        setTimeout(() => {
            setUploadStatus('notice', '');
            setUploadProgress('notice', 0, false);
        }, 1500);
    } finally {
        if (manageState) {
            noticeUploadInProgress = false;
            setNoticeUploadButtonState(false);
        }
    }
}

async function uploadReplyFiles(files) {
    const manageState = !noticeReplyUploadInProgress;
    if (manageState) {
        noticeReplyUploadInProgress = true;
        setNoticeReplyUploadButtonState(true);
    }
    const uploaded = [];
    const existing = dedupeAttachments(pendingReplyFiles);
    try {
        setUploadStatus('reply', `업로드 준비중... (${files.length}개)`);
        setUploadProgress('reply', 0, true);
        for (const file of files) {
            const isDup = existing.some(item =>
                (item.file_name || item.original_name || '') === file.name &&
                Number(item.file_size || 0) === Number(file.size || 0)
            );
            if (isDup) {
                alert(`이미 등록된 파일입니다: ${file.name}`);
                continue;
            }
            try {
                setUploadStatus('reply', `업로드 중: ${file.name}`);
                const result = await uploadNoticeFile(file, (evt) => {
                    if (evt.lengthComputable) {
                        const percent = Math.round((evt.loaded / evt.total) * 100);
                        setUploadProgress('reply', percent, true);
                    }
                });
                uploaded.push({
                    file_id: result.file_id,
                    file_name: result.file_name,
                    file_url: result.url,
                    file_size: result.size
                });
            } catch (error) {
                console.error('❌ 답글 파일 업로드 실패:', error);
                setUploadStatus('reply', `업로드 실패: ${error.message || '알 수 없는 오류'}`, true);
                alert(`파일 업로드 실패: ${error.message || '알 수 없는 오류'}`);
            }
        }
        if (!uploaded.length) return;
        uploaded.forEach((item) => pendingReplyFiles.push({ ...item, pending: true }));
        renderReplyPendingAttachments();
        setUploadStatus('reply', '업로드 완료');
        setUploadProgress('reply', 100, true);
        setTimeout(() => {
            setUploadStatus('reply', '');
            setUploadProgress('reply', 0, false);
        }, 1500);
    } finally {
        if (manageState) {
            noticeReplyUploadInProgress = false;
            setNoticeReplyUploadButtonState(false);
        }
    }
}

function ensureNoticeEditor() {
    const editorEl = document.getElementById('noticeEditor');
    const fallback = document.getElementById('noticeContentFallback');
    if (!editorEl || !fallback) return;

    if (window.Quill) {
        noticeEditorType = 'quill';
        fallback.style.display = 'none';
        editorEl.style.display = 'block';
        if (!noticeEditor) {
            const BetterTable = (() => {
                const lib = window.QuillBetterTable;
                if (!lib) return null;
                if (typeof lib === 'function') return lib;
                if (lib.default && typeof lib.default === 'function') return lib.default;
                return null;
            })();
            if (!window.__noticeFontRegistered) {
                const Font = Quill.import('formats/font');
                Font.whitelist = NOTICE_FONTS;
                Quill.register(Font, true);
                const Size = Quill.import('attributors/style/size');
                Size.whitelist = NOTICE_FONT_SIZES;
                Quill.register(Size, true);
                const Parchment = Quill.import('parchment');
                const LineHeightStyle = new Parchment.Attributor.Style(
                    'lineheight',
                    'line-height',
                    { scope: Parchment.Scope.BLOCK, whitelist: NOTICE_LINE_HEIGHTS }
                );
                Quill.register(LineHeightStyle, true);
                if (!window.__noticeCustomFormats) {
                    const Inline = Quill.import('blots/inline');
                    class AttachmentBlot extends Inline {}
                    AttachmentBlot.blotName = 'attachment';
                    AttachmentBlot.tagName = 'A';
                    Quill.register(AttachmentBlot, true);
                    class TemplateBlot extends Inline {}
                    TemplateBlot.blotName = 'template';
                    TemplateBlot.tagName = 'SPAN';
                    Quill.register(TemplateBlot, true);
                    window.__noticeCustomFormats = true;
                }
                if (BetterTable) {
                    Quill.register({ 'modules/better-table': BetterTable }, true);
                }
                window.__noticeFontRegistered = true;
            }

            const toolbarItems = [
                [{ font: NOTICE_FONTS }, { size: NOTICE_FONT_SIZES }],
                [{ lineheight: NOTICE_LINE_HEIGHTS }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: NOTICE_COLOR_PALETTE }, { background: NOTICE_BG_PALETTE }],
                [{ align: [] }],
                [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
                ['blockquote', 'code-block']
            ];
            const actionRow = ['link', 'image', 'video'];
            if (BetterTable) {
                actionRow.push('table');
            }
            actionRow.push('attachment');
            toolbarItems.push(actionRow);
            toolbarItems.push([{ template: [] }]);
            toolbarItems.push(['clean']);

            const modules = { toolbar: toolbarItems };
            if (BetterTable) {
                modules['better-table'] = {
                    operationMenu: {
                        items: {
                            unmergeCells: { text: '셀 병합 해제' },
                            insertColumnRight: { text: '오른쪽 열 추가' },
                            insertColumnLeft: { text: '왼쪽 열 추가' },
                            insertRowAbove: { text: '위 행 추가' },
                            insertRowBelow: { text: '아래 행 추가' },
                            deleteColumn: { text: '열 삭제' },
                            deleteRow: { text: '행 삭제' },
                            deleteTable: { text: '표 삭제' }
                        }
                    }
                };
                if (BetterTable.keyboardBindings) {
                    modules.keyboard = { bindings: BetterTable.keyboardBindings };
                }
            }

            noticeEditor = new Quill('#noticeEditor', {
                theme: 'snow',
                placeholder: '내용을 입력하세요...',
                modules
            });
            noticeEditor.root.classList.add('ql-font-맑은고딕');
            noticeEditor.format('font', '맑은고딕');

            const toolbar = noticeEditor.getModule('toolbar');
            toolbar.addHandler('image', () => {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                input.click();
                input.onchange = async () => {
                    const file = input.files ? input.files[0] : null;
                    if (!file) return;
                    try {
                        await insertNoticeImage(noticeEditor, file);
                    } catch (error) {
                        console.error('❌ 이미지 업로드 실패:', error);
                    }
                };
            });

            toolbar.addHandler('video', () => {
                const url = prompt('동영상 URL을 입력하세요.');
                if (!url) return;
                const range = noticeEditor.getSelection(true);
                noticeEditor.insertEmbed(range ? range.index : 0, 'video', url);
            });

            toolbar.addHandler('table', () => {
                if (!BetterTable) {
                    alert('표 기능 모듈이 로드되지 않았습니다.');
                    return;
                }
                noticeTableTargetEditor = noticeEditor;
                openNoticeTablePopover();
            });

            toolbar.addHandler('attachment', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.click();
                input.onchange = async () => {
                    const file = input.files ? input.files[0] : null;
                    if (!file) return;
                    try {
                        const result = await uploadNoticeFile(file);
                        const url = result?.url || '';
                        const text = result?.file_name || file.name;
                        if (!url) {
                            alert('파일 업로드 실패: URL이 없습니다.');
                            return;
                        }
                        const range = noticeEditor.getSelection(true);
                        const index = range ? range.index : noticeEditor.getLength();
                        noticeEditor.insertText(index, text, { link: url });
                        noticeEditor.insertText(index + text.length, '\n');
                    } catch (error) {
                        console.error('❌ 첨부 업로드 실패:', error);
                        alert('첨부 업로드 실패');
                    }
                };
            });

            toolbar.addHandler('template', (value) => {
                if (!value) return;
                const template = noticeTemplatesById[value];
                const content = template?.content || '';
                if (!content) return;
                const range = noticeEditor.getSelection(true);
                const index = range ? range.index : noticeEditor.getLength();
                noticeEditor.clipboard.dangerouslyPasteHTML(index, content);
                const picker = toolbar.container.querySelector('.ql-template');
                if (picker) picker.value = '';
            });

            const root = noticeEditor.root;
            root.addEventListener('dragover', (event) => {
                event.preventDefault();
            });
            root.addEventListener('drop', async (event) => {
                event.preventDefault();
                const files = Array.from(event.dataTransfer?.files || []);
                const images = files.filter(file => file.type.startsWith('image/'));
                if (!images.length) return;
                for (const file of images) {
                    try {
                        await insertNoticeImage(noticeEditor, file);
                    } catch (error) {
                        console.error('❌ 드래그 이미지 업로드 실패:', error);
                    }
                }
            });

            loadNoticeTemplates();
            setupNoticeTableUi();
        }
    } else {
        noticeEditorType = 'fallback';
        fallback.style.display = 'block';
        editorEl.style.display = 'none';
    }
}

async function loadNoticeTemplates() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICE_TEMPLATES_LIST}?is_use=Y`);
        noticeTemplatesCache = response.items || [];
        noticeTemplatesById = {};
        noticeTemplatesCache.forEach((tpl) => {
            if (tpl && tpl.template_id !== undefined && tpl.template_id !== null) {
                noticeTemplatesById[String(tpl.template_id)] = tpl;
            }
        });
        updateNoticeTemplatePicker();
    } catch (error) {
        console.warn('⚠️ 공지 템플릿 로드 실패:', error);
    }
}

function updateNoticeTemplatePicker() {
    if (!noticeEditor) return;
    const toolbar = noticeEditor.getModule('toolbar');
    if (!toolbar || !toolbar.container) return;
    const picker = toolbar.container.querySelector('.ql-template');
    if (!picker) return;

    const options = ['<option value=""></option>'];
    noticeTemplatesCache.forEach((tpl) => {
        const value = String(tpl.template_id);
        const title = tpl.title || `템플릿 ${value}`;
        options.push(`<option value="${value}" data-label="${title}"></option>`);
    });
    picker.innerHTML = options.join('');
    picker.value = '';

    const label = picker.parentElement?.querySelector('.ql-picker-label');
    if (label) {
        label.dataset.label = '템플릿 선택';
    }
    const items = picker.parentElement?.querySelectorAll('.ql-picker-item') || [];
    items.forEach((item) => {
        const value = item.dataset.value;
        const tpl = noticeTemplatesById[String(value)];
        item.dataset.label = tpl?.title || value || '';
    });
}

function setupNoticeTableUi() {
    if (noticeTablePopoverBound) return;
    const popover = document.getElementById('noticeTablePopover');
    const modal = document.getElementById('noticeTableModal');
    if (!popover || !modal) return;

    const popRows = document.getElementById('noticeTableRowsPopover');
    const popCols = document.getElementById('noticeTableColsPopover');
    const popInsert = document.getElementById('btnNoticeTablePopoverInsert');
    const popMore = document.getElementById('btnNoticeTablePopoverMore');
    const modalRows = document.getElementById('noticeTableRows');
    const modalCols = document.getElementById('noticeTableCols');
    const modalInsert = document.getElementById('btnNoticeTableInsert');

    if (popInsert) {
        popInsert.addEventListener('click', () => {
            const rows = parseInt(popRows?.value || noticeTableDefaults.rows, 10);
            const cols = parseInt(popCols?.value || noticeTableDefaults.cols, 10);
            insertNoticeTable(rows, cols);
            closeNoticeTablePopover();
        });
    }
    if (popMore) {
        popMore.addEventListener('click', () => {
            closeNoticeTablePopover();
            openNoticeTableModal();
        });
    }
    if (modalInsert) {
        modalInsert.addEventListener('click', () => {
            const rows = parseInt(modalRows?.value || noticeTableDefaults.rows, 10);
            const cols = parseInt(modalCols?.value || noticeTableDefaults.cols, 10);
            insertNoticeTable(rows, cols);
            closeNoticeTableModal();
        });
    }

    document.addEventListener('click', (event) => {
        if (!popover.classList.contains('active')) return;
        const target = event.target;
        if (popover.contains(target)) return;
        if (target && target.closest && target.closest('.ql-table')) return;
        closeNoticeTablePopover();
    });

    noticeTablePopoverBound = true;
}

function openNoticeTablePopover() {
    const popover = document.getElementById('noticeTablePopover');
    if (!popover) return;

    const rowsEl = document.getElementById('noticeTableRowsPopover');
    const colsEl = document.getElementById('noticeTableColsPopover');
    if (rowsEl) rowsEl.value = noticeTableDefaults.rows;
    if (colsEl) colsEl.value = noticeTableDefaults.cols;

    const targetEditor = noticeTableTargetEditor || noticeEditor;
    const button = targetEditor?.container?.querySelector('.ql-table');
    if (!button) {
        openNoticeTableModal();
        return;
    }
    const rect = button.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 8;
    const left = Math.min(rect.left + window.scrollX, window.innerWidth - 240);

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.classList.add('active');
}

function closeNoticeTablePopover() {
    const popover = document.getElementById('noticeTablePopover');
    if (popover) popover.classList.remove('active');
}

function openNoticeTableModal() {
    const modal = document.getElementById('noticeTableModal');
    if (!modal) return;
    const rowsEl = document.getElementById('noticeTableRows');
    const colsEl = document.getElementById('noticeTableCols');
    if (rowsEl) rowsEl.value = noticeTableDefaults.rows;
    if (colsEl) colsEl.value = noticeTableDefaults.cols;
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function closeNoticeTableModal() {
    const modal = document.getElementById('noticeTableModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function insertNoticeTable(rows, cols) {
    const targetEditor = noticeTableTargetEditor || noticeEditor;
    if (!targetEditor) return;
    const tableModule = targetEditor.getModule('better-table');
    if (!tableModule) {
        alert('표 기능 모듈이 로드되지 않았습니다.');
        return;
    }
    const safeRows = Math.max(1, Math.min(30, Number(rows) || noticeTableDefaults.rows));
    const safeCols = Math.max(1, Math.min(20, Number(cols) || noticeTableDefaults.cols));
    noticeTableDefaults = { rows: safeRows, cols: safeCols };
    tableModule.insertTable(safeRows, safeCols);
    noticeTableTargetEditor = null;
}

function getFileExtension(filename) {
    const ext = (filename || '').toLowerCase().split('.').pop();
    return ext ? `.${ext}` : '';
}

function validateNoticeFile(file, allowedExts, maxBytes) {
    if (!file) return '파일이 없습니다.';
    const ext = getFileExtension(file.name);
    if (!ext || !allowedExts.has(ext)) {
        return `지원하지 않는 파일 형식입니다. (${ext || 'unknown'})`;
    }
    if (maxBytes && file.size > maxBytes) {
        return `파일 용량은 ${NOTICE_MAX_UPLOAD_MB}MB 이하만 가능합니다.`;
    }
    return null;
}

async function insertNoticeImage(editor, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 첨부할 수 있습니다.');
        return;
    }
    const error = validateNoticeFile(file, NOTICE_IMAGE_EXTS, NOTICE_MAX_UPLOAD_BYTES);
    if (error) {
        alert(error);
        return;
    }
    const result = await uploadNoticeFile(file);
    const url = result?.url;
    if (!url) {
        alert('이미지 업로드 실패: URL이 없습니다.');
        return;
    }
    const range = editor.getSelection(true);
    const index = range ? range.index : editor.getLength();
    editor.insertEmbed(index, 'image', url);
    editor.insertText(index + 1, '\n');
}

async function uploadNoticeFile(file, onProgress) {
    const error = validateNoticeFile(file, NOTICE_ALLOWED_EXTS, NOTICE_MAX_UPLOAD_BYTES);
    if (error) {
        alert(error);
        throw new Error(error);
    }
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${API_CONFIG.ENDPOINTS.FILES_UPLOAD}`;
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    try {
        if (typeof AUTH !== 'undefined' && typeof AUTH.getAccessToken === 'function') {
            const token = AUTH.getAccessToken();
            if (token) headers['Authorization'] = `Bearer ${token}`;
        }
    } catch (e) {
        console.warn('⚠️ 토큰 헤더 구성 실패:', e);
    }

    if (!headers['X-Company-CD']) {
        const fallbackCompany = (window.AUTH?.getUserInfo?.()?.company_cd) ||
                                (window.AUTH?.getCompanyCd?.()) ||
                                (window.COMPANY_CONFIG && window.COMPANY_CONFIG.DEFAULT_COMPANY_CD) ||
                                'TESTCOMP';
        headers['X-Company-CD'] = fallbackCompany;
    }

    return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
        });
        xhr.upload.onprogress = (evt) => {
            if (typeof onProgress === 'function') {
                onProgress(evt);
            }
        };
        xhr.onload = () => {
            const ok = xhr.status >= 200 && xhr.status < 300;
            let data = null;
            try {
                data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            } catch (e) {
                data = null;
            }
            if (ok) {
                if (!data) {
                    reject(new Error('서버 응답을 해석할 수 없습니다.'));
                    return;
                }
                if (!data.file_id || !data.url) {
                    reject(new Error('업로드 응답이 올바르지 않습니다.'));
                    return;
                }
                if (!data.file_name && file && file.name) {
                    data.file_name = file.name;
                }
                if (!data.size && file && file.size) {
                    data.size = file.size;
                }
                resolve(data);
                return;
            }
            const detail = (data && (data.detail || data.message)) || `HTTP ${xhr.status}`;
            reject(new Error(detail));
        };
        xhr.onerror = () => {
            reject(new Error('네트워크 오류가 발생했습니다.'));
        };
        xhr.send(formData);
    });
}

function ensureNoticeReplyEditor() {
    const editorEl = document.getElementById('noticeReplyEditor');
    const fallback = document.getElementById('noticeReplyFallback');
    if (!editorEl || !fallback) return;

    if (window.Quill) {
        noticeReplyEditorType = 'quill';
        fallback.style.display = 'none';
        editorEl.style.display = 'block';
        if (!noticeReplyEditor) {
            const toolbarItems = [
                [{ font: NOTICE_FONTS }, { size: NOTICE_FONT_SIZES }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['link', 'image'],
                ['clean']
            ];
            noticeReplyEditor = new Quill('#noticeReplyEditor', {
                theme: 'snow',
                placeholder: '답글을 입력하세요...',
                modules: {
                    toolbar: toolbarItems
                }
            });
            noticeReplyEditor.root.classList.add('ql-font-맑은고딕');
            noticeReplyEditor.format('font', '맑은고딕');

            const toolbar = noticeReplyEditor.getModule('toolbar');
            toolbar.addHandler('image', () => {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                input.click();
                input.onchange = async () => {
                    const file = input.files ? input.files[0] : null;
                    if (!file) return;
                    try {
                        await insertNoticeImage(noticeReplyEditor, file);
                    } catch (error) {
                        console.error('❌ 답글 이미지 업로드 실패:', error);
                    }
                };
            });

            const root = noticeReplyEditor.root;
            root.addEventListener('dragover', (event) => {
                event.preventDefault();
            });
            root.addEventListener('drop', async (event) => {
                event.preventDefault();
                const files = Array.from(event.dataTransfer?.files || []);
                const images = files.filter(file => file.type.startsWith('image/'));
                if (!images.length) return;
                for (const file of images) {
                    try {
                        await insertNoticeImage(noticeReplyEditor, file);
                    } catch (error) {
                        console.error('❌ 답글 드래그 이미지 업로드 실패:', error);
                    }
                }
            });
        }
    } else {
        noticeReplyEditorType = 'fallback';
        fallback.style.display = 'block';
        editorEl.style.display = 'none';
    }
}

function getNoticeReplyContent() {
    if (noticeReplyEditorType === 'quill' && noticeReplyEditor) {
        return noticeReplyEditor.root.innerHTML || '';
    }
    const fallback = document.getElementById('noticeReplyFallback');
    return fallback?.value || '';
}

function setNoticeReplyContent(content) {
    if (noticeReplyEditorType === 'quill' && noticeReplyEditor) {
        noticeReplyEditor.root.innerHTML = content || '';
        return;
    }
    const fallback = document.getElementById('noticeReplyFallback');
    if (fallback) fallback.value = content || '';
}

function setNoticeReplyEnabled(enabled) {
    const btn = document.getElementById('btnNoticeReplySave');
    if (btn) btn.disabled = !enabled;
    if (noticeReplyEditorType === 'quill' && noticeReplyEditor) {
        noticeReplyEditor.enable(enabled);
    }
    const fallback = document.getElementById('noticeReplyFallback');
    if (fallback) fallback.disabled = !enabled;
}

function setNoticeReplyTarget(reply) {
    if (!reply) return;
    noticeReplyParentId = reply.reply_id || null;
    const label = document.getElementById('noticeReplyTargetLabel');
    const target = document.getElementById('noticeReplyTarget');
    const author = reply.author_name || reply.author_id || `#${reply.reply_id}`;
    const snippet = (reply.content || '').replace(/<[^>]*>/g, '').trim().slice(0, 40);
    if (label) {
        label.textContent = `답글 대상: ${author}${snippet ? ` - ${snippet}` : ''}`;
    }
    if (target) target.style.display = 'flex';
}

function clearNoticeReplyTarget() {
    noticeReplyParentId = null;
    const label = document.getElementById('noticeReplyTargetLabel');
    const target = document.getElementById('noticeReplyTarget');
    if (label) label.textContent = '';
    if (target) target.style.display = 'none';
}

function bindNoticeReplyActions() {
    const btn = document.getElementById('btnNoticeReplySave');
    if (btn && !btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', saveNoticeReply);
    }
    const cancelBtn = document.getElementById('btnNoticeReplyCancel');
    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.dataset.bound = 'true';
        cancelBtn.addEventListener('click', clearNoticeReplyTarget);
    }
}

function resetNoticeReplies() {
    setNoticeReplyContent('');
    noticeRepliesPage = 1;
    noticeRepliesTotalPages = 1;
    noticeRepliesTotalRecords = 0;
    noticeRepliesCache = [];
    clearNoticeReplyTarget();
    renderNoticeReplies([]);
    pendingReplyFiles = [];
    renderReplyPendingAttachments();
    setNoticeReplyEnabled(false);
}

async function loadNoticeReplies(noticeId, page = 1, append = false) {
    if (!noticeId) {
        resetNoticeReplies();
        return;
    }
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICES}/${noticeId}/replies?page=${page}&page_size=10`);
        const items = response.items || [];
        noticeRepliesPage = response.current_page || page;
        noticeRepliesTotalPages = response.total_pages || 1;
        noticeRepliesTotalRecords = response.total_records ?? items.length;
        if (append) {
            noticeRepliesCache = [...noticeRepliesCache, ...items];
        } else {
            noticeRepliesCache = items;
        }
        renderNoticeReplies(noticeRepliesCache);
        setNoticeReplyEnabled(true);
        const moreBtn = document.getElementById('btnNoticeRepliesMore');
        if (moreBtn) {
            moreBtn.style.display = noticeRepliesPage < noticeRepliesTotalPages ? 'inline-flex' : 'none';
        }
    } catch (error) {
        console.error('❌ 답글 조회 실패:', error);
        renderNoticeReplies([]);
        setNoticeReplyEnabled(false);
    }
}

function renderNoticeReplies(items) {
    const list = document.getElementById('noticeRepliesList');
    const count = document.getElementById('noticeReplyCount');
    if (count) {
        const total = noticeRepliesTotalRecords || items.length;
        count.textContent = `${total}건`;
    }
    if (!list) return;
    const currentUser = window.AUTH?.getUserInfo?.() || {};
    const currentLogin = currentUser.login_id || '';

    if (!items.length) {
        list.innerHTML = '<div class="notice-reply-empty">등록된 답글이 없습니다.</div>';
        return;
    }

    const replyMap = new Map();
    items.forEach((reply) => {
        replyMap.set(reply.reply_id, { ...reply, children: [] });
    });
    const roots = [];
    replyMap.forEach((reply) => {
        if (reply.parent_reply_id && replyMap.has(reply.parent_reply_id)) {
            replyMap.get(reply.parent_reply_id).children.push(reply);
        } else {
            roots.push(reply);
        }
    });

    const sortFn = (a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        if (da !== db) return db - da;
        return (b.reply_id || 0) - (a.reply_id || 0);
    };

    const ordered = [];
    const walk = (nodes, depth) => {
        nodes.sort(sortFn);
        nodes.forEach((node) => {
            ordered.push({ ...node, _depth: depth });
            if (node.children && node.children.length) {
                walk(node.children, depth + 1);
            }
        });
    };
    walk(roots, 0);

    list.innerHTML = ordered.map((reply) => {
        const canDelete = reply.author_id === currentLogin;
        const deleteBtn = canDelete
            ? `<button class="btn btn-danger btn-sm notice-reply-delete" data-id="${reply.reply_id}"><i class="fas fa-trash"></i> 삭제</button>`
            : '';
        const replyBtn = `<button class="btn btn-outline-secondary btn-sm notice-reply-reply" data-id="${reply.reply_id}"><i class="fas fa-reply"></i> 답글</button>`;
        const authorName = reply.author_name || reply.author_id || '';
        const createdAt = formatNoticeDateTime(reply.created_at);
        const parent = reply.parent_reply_id ? replyMap.get(reply.parent_reply_id) : null;
        const parentLabel = parent ? `↳ ${parent.author_name || parent.author_id || parent.reply_id}` : (reply.parent_reply_id ? '↳ 답글' : '');
        const attachments = Array.isArray(reply.attachments) ? reply.attachments : [];
        const attachmentsHtml = attachments.length ? `
            <div class="notice-reply-files" data-reply-id="${reply.reply_id}">
                <div class="notice-attachments-header">
                    <span>첨부 파일</span>
                    <div class="notice-attachments-actions">
                        <button class="btn btn-outline-secondary btn-sm notice-reply-download-selected" type="button">선택 다운로드</button>
                        <button class="btn btn-outline-secondary btn-sm notice-reply-download-all" type="button">전체 다운로드</button>
                    </div>
                </div>
                <label class="notice-attachments-selectall">
                    <input type="checkbox" class="notice-reply-selectall" data-reply-id="${reply.reply_id}"> 전체 선택
                </label>
                <div class="notice-attachments-list">
                    ${attachments.map((file) => {
                        const sizeText = formatFileSize(file.file_size || 0);
                        return `
                            <div class="notice-attachment-item" data-file-id="${file.file_id}">
                                <label class="notice-attachment-info">
                                    <input type="checkbox" class="notice-reply-attachment-checkbox" data-reply-id="${reply.reply_id}" data-url="${file.file_url || ''}" data-name="${file.file_name || ''}">
                                    <span>${file.file_name || ''}</span>
                                </label>
                                <div class="notice-attachment-meta">${sizeText}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';
        return `
            <div class="notice-reply-item depth-${reply._depth || 0}" style="margin-left: ${Math.min(reply._depth || 0, 4) * 24}px;">
                <div class="notice-reply-header">
                    <div class="notice-reply-meta">
                        <span class="notice-reply-author">${authorName}</span>
                        <span class="notice-reply-date">${createdAt}</span>
                        ${parentLabel ? `<span class="notice-reply-parent">${parentLabel}</span>` : ''}
                    </div>
                    <div class="notice-reply-actions-right">
                        ${replyBtn}
                        ${deleteBtn}
                    </div>
                </div>
                <div class="notice-reply-content">${reply.content || ''}</div>
                ${attachmentsHtml}
            </div>
        `;
    }).join('');

    list.querySelectorAll('.notice-reply-delete').forEach((btn) => {
        btn.addEventListener('click', () => {
            const replyId = btn.getAttribute('data-id');
            if (replyId) deleteNoticeReply(replyId);
        });
    });

    list.querySelectorAll('.notice-reply-selectall').forEach((checkbox) => {
        checkbox.addEventListener('change', (e) => {
            const replyId = e.target.getAttribute('data-reply-id');
            list.querySelectorAll(`.notice-reply-attachment-checkbox[data-reply-id="${replyId}"]`).forEach((cb) => {
                cb.checked = e.target.checked;
            });
        });
    });

    list.querySelectorAll('.notice-reply-download-selected').forEach((btn) => {
        btn.addEventListener('click', () => {
            const container = btn.closest('.notice-reply-files');
            if (!container) return;
            const replyId = container.getAttribute('data-reply-id');
            const files = Array.from(container.querySelectorAll(`.notice-reply-attachment-checkbox[data-reply-id="${replyId}"]`))
                .filter(cb => cb.checked)
                .map(cb => ({
                    url: cb.getAttribute('data-url'),
                    name: cb.getAttribute('data-name') || ''
                }))
                .filter(item => item.url)
                .map(item => ({ ...item, url: normalizeFileUrl(item.url) }));
            downloadFiles(files);
        });
    });

    list.querySelectorAll('.notice-reply-download-all').forEach((btn) => {
        btn.addEventListener('click', () => {
            const container = btn.closest('.notice-reply-files');
            if (!container) return;
            const files = Array.from(container.querySelectorAll('.notice-reply-attachment-checkbox'))
                .map(cb => ({
                    url: cb.getAttribute('data-url'),
                    name: cb.getAttribute('data-name') || ''
                }))
                .filter(item => item.url)
                .map(item => ({ ...item, url: normalizeFileUrl(item.url) }));
            downloadFiles(files);
        });
    });

    list.querySelectorAll('.notice-reply-reply').forEach((btn) => {
        btn.addEventListener('click', () => {
            const replyId = Number(btn.getAttribute('data-id'));
            const reply = replyMap.get(replyId);
            if (reply) {
                setNoticeReplyTarget(reply);
            }
        });
    });
}

async function saveNoticeReply() {
    if (!currentNoticeId) {
        alert('먼저 게시글을 저장하세요.');
        return;
    }
    const content = getNoticeReplyContent().trim();
    if (!content) {
        alert('답글 내용을 입력하세요.');
        return;
    }
    try {
        const response = await API.post(`${API_CONFIG.ENDPOINTS.NOTICES}/${currentNoticeId}/replies`, {
            content,
            parent_reply_id: noticeReplyParentId || null
        });
        const replyId = response.reply_id;
        let attachError = null;
        if (replyId && pendingReplyFiles.length) {
            const ids = pendingReplyFiles.map(f => f.file_id).filter(Boolean);
            try {
                await attachReplyFiles(replyId, ids);
                pendingReplyFiles = [];
                renderReplyPendingAttachments();
            } catch (error) {
                attachError = error;
                console.error('❌ 답글 첨부 파일 연결 실패:', error);
                setUploadStatus('reply', `첨부 파일 연결 실패: ${error.message || '알 수 없는 오류'}`, true);
            }
        }
        setNoticeReplyContent('');
        clearNoticeReplyTarget();
        await loadNoticeReplies(currentNoticeId, 1, false);
        if (attachError) {
            alert(`답글 저장은 완료되었습니다.\n첨부 파일 연결 실패: ${attachError.message || '알 수 없는 오류'}`);
        }
    } catch (error) {
        console.error('❌ 답글 저장 실패:', error);
        alert(`답글 저장 실패: ${error.message || '알 수 없는 오류'}`);
    }
}

async function deleteNoticeReply(replyId) {
    if (!confirm('답글을 삭제하시겠습니까?')) return;
    try {
        await API.delete(`${API_CONFIG.ENDPOINTS.NOTICES}/replies/${replyId}`);
        await loadNoticeReplies(currentNoticeId, 1, false);
    } catch (error) {
        console.error('❌ 답글 삭제 실패:', error);
        alert('답글 삭제 실패');
    }
}

function setNoticeContent(content) {
    if (noticeEditorType === 'quill' && noticeEditor) {
        noticeEditor.root.innerHTML = content || '';
        return;
    }
    const fallback = document.getElementById('noticeContentFallback');
    if (fallback) fallback.value = content || '';
}

function getNoticeContent() {
    if (noticeEditorType === 'quill' && noticeEditor) {
        return noticeEditor.root.innerHTML || '';
    }
    const fallback = document.getElementById('noticeContentFallback');
    return fallback?.value || '';
}

async function saveNoticeDetail() {
    const title = (document.getElementById('noticeTitleInput')?.value || '').trim();
    if (!title) {
        alert('제목을 입력하세요.');
        return;
    }

    const payload = {
        title,
        content: getNoticeContent(),
        category: document.getElementById('noticeCategorySelect')?.value || 'GENERAL',
        is_fixed: document.getElementById('noticeFixedSelect')?.value || 'N',
        status: document.getElementById('noticeStatusSelect')?.value || 'NORMAL',
        hashtags: normalizeHashtags(document.getElementById('noticeHashtagsInput')?.value || ''),
        start_date: document.getElementById('noticeStartDate')?.value || null,
        end_date: document.getElementById('noticeEndDate')?.value || null
    };

    try {
        if (currentNoticeId) {
            await API.put(`${API_CONFIG.ENDPOINTS.NOTICES}/${currentNoticeId}`, payload);
            alert('게시글이 수정되었습니다.');
        } else {
            const response = await API.post(API_CONFIG.ENDPOINTS.NOTICES, payload);
            currentNoticeId = response.notice_id;
            if (pendingNoticeFiles.length) {
                const ids = pendingNoticeFiles.map(f => f.file_id).filter(Boolean);
                await attachNoticeFiles(currentNoticeId, ids);
                pendingNoticeFiles = [];
            }
            alert('게시글이 등록되었습니다.');
        }
        if (currentNoticeId) {
            await loadNoticeAttachments(currentNoticeId);
        }
        openNoticeList();
    } catch (error) {
        console.error('❌ 게시글 저장 실패:', error);
        alert('저장 실패: ' + (error.message || error));
    }
}

async function deleteNoticeDetail() {
    if (!currentNoticeId) return;
    if (!confirm('게시글을 삭제하시겠습니까?')) return;

    try {
        await API.delete(`${API_CONFIG.ENDPOINTS.NOTICES}/${currentNoticeId}`);
        alert('삭제되었습니다.');
        openNoticeList();
    } catch (error) {
        console.error('❌ 게시글 삭제 실패:', error);
        alert('삭제 실패: ' + (error.message || error));
    }
}

window.bootstrapNoticeList = bootstrapNoticeList;
window.refreshNoticeList = refreshNoticeList;
window.openNoticeDetail = openNoticeDetail;
window.initializeNoticeDetailPage = initializeNoticeDetailPage;
window.openNoticeTableModal = openNoticeTableModal;
window.closeNoticeTableModal = closeNoticeTableModal;
window.loadNoticeTemplates = loadNoticeTemplates;
window.setNoticeTableTargetEditor = function(editor) {
    noticeTableTargetEditor = editor;
};
