// ===================================
// static/js/notice-templates.js
// 공지 템플릿 관리
// ===================================

let noticeTemplatesTable = null;
let selectedTemplateId = null;
let noticeTemplateEditor = null;
let noticeTemplateEditorType = 'fallback';

const TEMPLATE_FONTS = [
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
const TEMPLATE_FONT_SIZES = ['10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const TEMPLATE_LINE_HEIGHTS = ['1', '1.2', '1.5', '1.8', '2', '2.5', '3'];
const TEMPLATE_COLOR_PALETTE = [
    '#111827', '#1f2937', '#334155', '#0f766e', '#2563eb',
    '#7c3aed', '#be123c', '#b45309', '#059669', '#0ea5e9',
    '#f59e0b', '#f97316', '#ec4899'
];
const TEMPLATE_BG_PALETTE = [
    '#f8fafc', '#e2e8f0', '#cbd5f5', '#bfdbfe', '#bae6fd',
    '#bbf7d0', '#fef3c7', '#fde68a', '#fecaca', '#fbcfe8',
    '#ddd6fe', '#e9d5ff'
];

function bootstrapNoticeTemplates() {
    const tableEl = document.getElementById('noticeTemplatesTable');
    if (!tableEl) {
        return;
    }
    if (typeof window.isElementInActivePage === 'function' && !window.isElementInActivePage(tableEl)) {
        return;
    }

    try {
        initializeNoticeTemplatesTable();
        ensureNoticeTemplateEditor();
        bindNoticeTemplateActions();
        refreshNoticeTemplates();
        console.log('✅ 공지 템플릿 관리 초기화 완료');
    } catch (error) {
        console.error('❌ 공지 템플릿 관리 초기화 실패:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapNoticeTemplates);
} else {
    bootstrapNoticeTemplates();
}

function ensureNoticeTemplateEditor() {
    const editorEl = document.getElementById('noticeTemplateEditor');
    const fallback = document.getElementById('noticeTemplateContent');
    if (!editorEl || !fallback) return;

    if (window.Quill) {
        noticeTemplateEditorType = 'quill';
        fallback.style.display = 'none';
        editorEl.style.display = 'block';
        if (!noticeTemplateEditor) {
            const BetterTable = (() => {
                const lib = window.QuillBetterTable;
                if (!lib) return null;
                if (typeof lib === 'function') return lib;
                if (lib.default && typeof lib.default === 'function') return lib.default;
                return null;
            })();

            if (!window.__noticeTemplateFontRegistered) {
                const Font = Quill.import('formats/font');
                Font.whitelist = TEMPLATE_FONTS;
                Quill.register(Font, true);
                const Size = Quill.import('attributors/style/size');
                Size.whitelist = TEMPLATE_FONT_SIZES;
                Quill.register(Size, true);
                const Parchment = Quill.import('parchment');
                const LineHeightStyle = new Parchment.Attributor.Style(
                    'lineheight',
                    'line-height',
                    { scope: Parchment.Scope.BLOCK, whitelist: TEMPLATE_LINE_HEIGHTS }
                );
                Quill.register(LineHeightStyle, true);
                if (!window.__noticeTemplateCustomFormats) {
                    const Inline = Quill.import('blots/inline');
                    class AttachmentBlot extends Inline {}
                    AttachmentBlot.blotName = 'attachment';
                    AttachmentBlot.tagName = 'A';
                    Quill.register(AttachmentBlot, true);
                    window.__noticeTemplateCustomFormats = true;
                }
                if (BetterTable) {
                    Quill.register({ 'modules/better-table': BetterTable }, true);
                }
                window.__noticeTemplateFontRegistered = true;
            }

            const toolbarItems = [
                [{ font: TEMPLATE_FONTS }, { size: TEMPLATE_FONT_SIZES }],
                [{ lineheight: TEMPLATE_LINE_HEIGHTS }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: TEMPLATE_COLOR_PALETTE }, { background: TEMPLATE_BG_PALETTE }],
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

            noticeTemplateEditor = new Quill('#noticeTemplateEditor', {
                theme: 'snow',
                placeholder: '템플릿 내용을 입력하세요...',
                modules
            });
            noticeTemplateEditor.root.classList.add('ql-font-맑은고딕');
            noticeTemplateEditor.format('font', '맑은고딕');

            const toolbar = noticeTemplateEditor.getModule('toolbar');
            toolbar.addHandler('image', () => {
                const input = document.createElement('input');
                input.setAttribute('type', 'file');
                input.setAttribute('accept', 'image/*');
                input.click();
                input.onchange = async () => {
                    const file = input.files ? input.files[0] : null;
                    if (!file) return;
                    if (typeof insertNoticeImage !== 'function') {
                        alert('이미지 업로드 기능을 사용할 수 없습니다.');
                        return;
                    }
                    try {
                        await insertNoticeImage(noticeTemplateEditor, file);
                    } catch (error) {
                        console.error('❌ 이미지 업로드 실패:', error);
                    }
                };
            });

            toolbar.addHandler('video', () => {
                const url = prompt('동영상 URL을 입력하세요.');
                if (!url) return;
                const range = noticeTemplateEditor.getSelection(true);
                noticeTemplateEditor.insertEmbed(range ? range.index : 0, 'video', url);
            });

            toolbar.addHandler('table', () => {
                if (!BetterTable) {
                    alert('표 기능 모듈이 로드되지 않았습니다.');
                    return;
                }
                if (typeof window.setNoticeTableTargetEditor === 'function') {
                    window.setNoticeTableTargetEditor(noticeTemplateEditor);
                }
                if (typeof openNoticeTablePopover === 'function') {
                    openNoticeTablePopover();
                } else if (typeof openNoticeTableModal === 'function') {
                    openNoticeTableModal();
                } else {
                    const rows = Number(prompt('행 수를 입력하세요.', '3')) || 3;
                    const cols = Number(prompt('열 수를 입력하세요.', '3')) || 3;
                    const tableModule = noticeTemplateEditor.getModule('better-table');
                    if (tableModule) tableModule.insertTable(rows, cols);
                }
            });

            toolbar.addHandler('attachment', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.click();
                input.onchange = async () => {
                    const file = input.files ? input.files[0] : null;
                    if (!file) return;
                    if (typeof uploadNoticeFile !== 'function') {
                        alert('첨부 업로드 기능을 사용할 수 없습니다.');
                        return;
                    }
                    try {
                        const result = await uploadNoticeFile(file);
                        const url = result?.url || '';
                        const text = result?.file_name || file.name;
                        if (!url) {
                            alert('파일 업로드 실패: URL이 없습니다.');
                            return;
                        }
                        const range = noticeTemplateEditor.getSelection(true);
                        const index = range ? range.index : noticeTemplateEditor.getLength();
                        noticeTemplateEditor.insertText(index, text, { link: url });
                        noticeTemplateEditor.insertText(index + text.length, '\n');
                    } catch (error) {
                        console.error('❌ 첨부 업로드 실패:', error);
                        alert('첨부 업로드 실패');
                    }
                };
            });

            const root = noticeTemplateEditor.root;
            root.addEventListener('dragover', (event) => event.preventDefault());
            root.addEventListener('drop', async (event) => {
                event.preventDefault();
                const files = Array.from(event.dataTransfer?.files || []);
                const images = files.filter(file => file.type.startsWith('image/'));
                if (!images.length) return;
                if (typeof insertNoticeImage !== 'function') return;
                for (const file of images) {
                    try {
                        await insertNoticeImage(noticeTemplateEditor, file);
                    } catch (error) {
                        console.error('❌ 드래그 이미지 업로드 실패:', error);
                    }
                }
            });

            if (typeof setupNoticeTableUi === 'function') {
                setupNoticeTableUi();
            }
        }
    } else {
        noticeTemplateEditorType = 'fallback';
        fallback.style.display = 'block';
        editorEl.style.display = 'none';
    }
}

function getNoticeTemplateContent() {
    if (noticeTemplateEditorType === 'quill' && noticeTemplateEditor) {
        return noticeTemplateEditor.root.innerHTML || '';
    }
    const fallback = document.getElementById('noticeTemplateContent');
    return fallback?.value || '';
}

function setNoticeTemplateContent(content) {
    if (noticeTemplateEditorType === 'quill' && noticeTemplateEditor) {
        noticeTemplateEditor.root.innerHTML = content || '';
        return;
    }
    const fallback = document.getElementById('noticeTemplateContent');
    if (fallback) fallback.value = content || '';
}

function initializeNoticeTemplatesTable() {
    const commonOptions = window.TABULATOR_COMMON_OPTIONS || {};

    noticeTemplatesTable = new Tabulator('#noticeTemplatesTable', {
        ...commonOptions,
        index: 'template_id',
        sortMode: 'local',
        ajaxSorting: false,
        height: '600px',
        layout: 'fitDataStretch',
        placeholder: '템플릿이 없습니다',
        selectable: 1,
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
            { title: 'ID', field: 'template_id', width: 80, hozAlign: 'center' },
            { title: '제목', field: 'title', minWidth: 220 },
            { title: '분류', field: 'category', width: 140 },
            {
                title: '정렬',
                field: 'sort_order',
                width: 80,
                hozAlign: 'right',
                formatter: cell => cell.getValue() ?? 0
            },
            {
                title: '공유',
                field: 'is_shared',
                width: 80,
                hozAlign: 'center',
                formatter: cell => (String(cell.getValue() || '').toUpperCase() === 'Y' ? 'Y' : 'N')
            },
            {
                title: '사용',
                field: 'is_use',
                width: 90,
                hozAlign: 'center',
                formatter: cell => (String(cell.getValue() || '').toUpperCase() === 'Y' ? 'Y' : 'N')
            },
            { title: '수정일', field: 'updated_at', width: 180, hozAlign: 'center' }
        ],
        rowClick: function(e, row) {
            row.select();
            const data = row.getData();
            fillNoticeTemplateForm(data);
        }
    });
}

function bindNoticeTemplateActions() {
    bindNoticeTemplateButton('btnNoticeTemplateNew', resetNoticeTemplateForm);
    bindNoticeTemplateButton('btnNoticeTemplateSave', saveNoticeTemplate);
    bindNoticeTemplateButton('btnNoticeTemplateDelete', deleteNoticeTemplate);
    bindNoticeTemplateButton('btnNoticeTemplateRefresh', refreshNoticeTemplates);
}

function bindNoticeTemplateButton(id, handler) {
    const el = document.getElementById(id);
    if (el && !el.dataset.bound) {
        el.dataset.bound = 'true';
        el.addEventListener('click', handler);
    }
}

async function refreshNoticeTemplates() {
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.NOTICE_TEMPLATES_LIST}`);
        const items = response.items || [];
        if (noticeTemplatesTable) {
            noticeTemplatesTable.replaceData(items);
        }
    } catch (error) {
        console.error('❌ 공지 템플릿 목록 조회 실패:', error);
        alert('공지 템플릿 목록 조회 실패');
    }
}

function fillNoticeTemplateForm(data) {
    if (!data) return;
    selectedTemplateId = data.template_id;
    setNoticeTemplateValue('noticeTemplateTitle', data.title || '');
    setNoticeTemplateValue('noticeTemplateCategory', data.category || '');
    setNoticeTemplateValue('noticeTemplateSort', data.sort_order ?? 0);
    setNoticeTemplateValue('noticeTemplateShared', data.is_shared || 'N');
    setNoticeTemplateValue('noticeTemplateUse', data.is_use || 'Y');
    setNoticeTemplateContent(data.content || '');
}

function resetNoticeTemplateForm() {
    selectedTemplateId = null;
    setNoticeTemplateValue('noticeTemplateTitle', '');
    setNoticeTemplateValue('noticeTemplateCategory', '');
    setNoticeTemplateValue('noticeTemplateSort', 0);
    setNoticeTemplateValue('noticeTemplateShared', 'N');
    setNoticeTemplateValue('noticeTemplateUse', 'Y');
    setNoticeTemplateContent('');
}

function setNoticeTemplateValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
}

async function saveNoticeTemplate() {
    const title = (document.getElementById('noticeTemplateTitle')?.value || '').trim();
    const content = (getNoticeTemplateContent() || '').trim();
    const category = (document.getElementById('noticeTemplateCategory')?.value || '').trim();
    const sortOrderRaw = document.getElementById('noticeTemplateSort')?.value;
    const sort_order = Number.isFinite(Number(sortOrderRaw)) ? Number(sortOrderRaw) : 0;
    const is_shared = document.getElementById('noticeTemplateShared')?.value || 'N';
    const isUse = document.getElementById('noticeTemplateUse')?.value || 'Y';

    if (!title) {
        alert('템플릿 제목을 입력하세요.');
        return;
    }
    if (!content) {
        alert('템플릿 내용을 입력하세요.');
        return;
    }

    const payload = {
        title,
        content,
        category,
        sort_order,
        is_shared,
        is_use: isUse
    };

    try {
        if (selectedTemplateId) {
            await API.put(`${API_CONFIG.ENDPOINTS.NOTICE_TEMPLATES}/${selectedTemplateId}`, payload);
            alert('템플릿이 수정되었습니다.');
        } else {
            const response = await API.post(API_CONFIG.ENDPOINTS.NOTICE_TEMPLATES, payload);
            selectedTemplateId = response.template_id || null;
            alert('템플릿이 등록되었습니다.');
        }
        await refreshNoticeTemplates();
        if (typeof window.loadNoticeTemplates === 'function') {
            window.loadNoticeTemplates();
        }
    } catch (error) {
        console.error('❌ 공지 템플릿 저장 실패:', error);
        alert('템플릿 저장 실패');
    }
}

async function deleteNoticeTemplate() {
    if (!selectedTemplateId) {
        alert('삭제할 템플릿을 선택하세요.');
        return;
    }
    if (!confirm('선택한 템플릿을 삭제하시겠습니까?')) {
        return;
    }
    try {
        await API.delete(`${API_CONFIG.ENDPOINTS.NOTICE_TEMPLATES}/${selectedTemplateId}`);
        resetNoticeTemplateForm();
        await refreshNoticeTemplates();
        alert('템플릿이 삭제되었습니다.');
        if (typeof window.loadNoticeTemplates === 'function') {
            window.loadNoticeTemplates();
        }
    } catch (error) {
        console.error('❌ 공지 템플릿 삭제 실패:', error);
        alert('템플릿 삭제 실패');
    }
}

window.bootstrapNoticeTemplates = bootstrapNoticeTemplates;
