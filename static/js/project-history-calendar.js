// static/js/project-history-calendar.js
// 진행상황 조회 (Project History Calendar)
console.log('📦 project-history-calendar.js loaded');

let historyCalendarInitialized = false;
let historyFiltersLoaded = false;
let historyCalendarInstance = null;
let historyCalendarData = [];
let historyDateIndex = {};
let historySelectedDates = new Set();
let historyActiveView = 'year';
let historyDailyDate = null;
let historyMonthAnchorDate = new Date();
let historyWeekAnchorDate = new Date();
let historyWeekStartDay = 1;
let historyWeekCustomRange = { start: '', end: '' };
let historySortOrder = 'start';
let historyModifierState = { ctrl: false, meta: false, shift: false };
let historyHolidayIndex = {};
let historyHolidayYears = new Set();
let historyTooltipInitialized = false;
let historyTooltipTarget = null;
let historyTooltipEnabled = false;
let historyProjectKeyword = '';
let historyProjectPage = 1;
let historyProjectTotalPages = 1;
let historyProjectSelected = '__ALL__';
let historyProjectSearchTimer = null;
let historySavedState = null;
let historyRestoringState = false;
let historyRestoreStatus = { filters: false, projects: false };
let historyActivitySummary = {};
let historyActivityTypeOptions = [];

const HISTORY_STATE_KEY = 'psms_history_calendar_state';
const HISTORY_ACTIVITY_TYPE_COLOR_MAP = window.PSMS_ACTIVITY_TYPE_COLOR_MAP || {
    MEETING: '#2563eb',
    PROPOSAL: '#7c3aed',
    CONTRACT: '#16a34a',
    FOLLOWUP: '#f59e0b',
    SUPPORT: '#0ea5e9',
    ETC: '#94a3b8',
    UNKNOWN: '#cbd5f5'
};
window.PSMS_ACTIVITY_TYPE_COLOR_MAP = HISTORY_ACTIVITY_TYPE_COLOR_MAP;

const HISTORY_COLOR_SET = [
    '#0ea5e9', '#22c55e', '#f97316', '#6366f1', '#14b8a6',
    '#e11d48', '#a855f7', '#facc15', '#64748b', '#06b6d4'
];

function initializeProjectHistoryCalendar() {
    console.log('🧭 initializeProjectHistoryCalendar 호출');
    const page = document.getElementById('page-project-history-calendar');
    if (!page) {
        console.warn('⚠️ 진행상황 조회 페이지 요소 없음');
        return;
    }
    if (!window.isElementInActivePage || !isElementInActivePage(page)) {
        console.warn('⚠️ 진행상황 조회 페이지가 활성 상태가 아님');
        return;
    }

    if (!historyCalendarInitialized) {
        bindHistoryCalendarEvents();
        initializeHistoryTooltip();
        historyCalendarInitialized = true;
    }

    ensureHistoryYearOptions();
    initializeHistoryAnchors();
    const tooltipToggle = document.getElementById('historyTooltipToggle');
    if (tooltipToggle) {
        historyTooltipEnabled = !!tooltipToggle.checked;
    }
    historyFiltersLoaded = false;
    const layoutSelect = document.getElementById('historyYearLayout');
    if (layoutSelect && !layoutSelect.value) layoutSelect.value = '4x3';
    const restored = loadHistorySettings();
    if (restored) {
        historyRestoringState = true;
        historyRestoreStatus = { filters: false, projects: false };
    }
    updateHistorySortToggle();
    setHistoryView(historyActiveView);
    syncMonthSlotInput();

    loadHistoryFilters(true);
    loadHistoryProjectOptions(1, !restored);
}

function bindHistoryCalendarEvents() {
    bindButton('btnHistoryRefresh', () => loadHistoryCalendarData());
    bindButton('btnHistoryPrevRange', () => shiftHistoryRange(-1));
    bindButton('btnHistoryNextRange', () => shiftHistoryRange(1));
    bindButton('btnHistoryToday', () => moveHistoryToToday());
    bindButton('btnHistoryViewSelection', () => openProjectHistoryModal());
    bindButton('btnHistoryExportSelection', () => exportSelectedHistoryToExcel());
    bindButton('btnHistoryModalExport', () => exportSelectedHistoryToExcel());

    const viewButtons = document.querySelectorAll('.ph-view-toggle .btn');
    viewButtons.forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
            setHistoryView(btn.dataset.view || 'month');
            saveHistorySettings();
        });
    });

    if (!document.body.dataset.historyModifierBound) {
        document.body.dataset.historyModifierBound = 'true';
        window.addEventListener('keydown', updateHistoryModifierState, true);
        window.addEventListener('keyup', updateHistoryModifierState, true);
        window.addEventListener('blur', resetHistoryModifierState, true);
    }

    const tooltipToggle = document.getElementById('historyTooltipToggle');
    if (tooltipToggle && !tooltipToggle.dataset.bound) {
        tooltipToggle.dataset.bound = 'true';
        tooltipToggle.addEventListener('change', () => {
            setHistoryTooltipEnabled(tooltipToggle.checked);
        });
    }

    const sortToggle = document.getElementById('historySortToggle');
    if (sortToggle && !sortToggle.dataset.bound) {
        sortToggle.dataset.bound = 'true';
        sortToggle.addEventListener('change', () => {
            const order = sortToggle.checked ? 'recent' : 'start';
            setHistorySortOrder(order);
        });
    }

    const selectAllToggle = document.getElementById('historySelectAllToggle');
    if (selectAllToggle && !selectAllToggle.dataset.bound) {
        selectAllToggle.dataset.bound = 'true';
        selectAllToggle.addEventListener('change', () => {
            if (historyActiveView !== 'week') return;
            const dates = getVisibleWeekDatesWithItems();
            if (selectAllToggle.checked) {
                historySelectedDates = new Set(dates);
            } else {
                historySelectedDates = new Set();
            }
            updateHistorySelectionSummary();
            updateCalendarSelectionStyles();
            renderHistoryYearView();
            renderHistoryWeekList();
        });
    }

    const weekStartSelect = document.getElementById('historyWeekStartDay');
    if (weekStartSelect && !weekStartSelect.dataset.bound) {
        weekStartSelect.dataset.bound = 'true';
        weekStartSelect.addEventListener('change', () => {
            historyWeekStartDay = normalizeHistoryWeekStartDay(weekStartSelect.value);
            syncHistoryWeekControls();
            saveHistorySettings();
            if (historyActiveView === 'week' && !isHistoryWeekCustomRangeActive()) {
                renderHistoryWeekList();
                loadHistoryCalendarData();
            }
        });
    }

    bindButton('btnHistoryWeekApply', () => {
        applyHistoryWeekCustomRange();
    });
    bindButton('btnHistoryWeekClear', () => {
        clearHistoryWeekCustomRange(true);
        if (historyActiveView === 'week') {
            renderHistoryWeekList();
            loadHistoryCalendarData();
        }
        saveHistorySettings();
    });

    const weekRangeInputs = ['historyWeekFrom', 'historyWeekTo'];
    weekRangeInputs.forEach(id => {
        const input = document.getElementById(id);
        if (!input || input.dataset.bound) return;
        input.dataset.bound = 'true';
        input.addEventListener('keydown', evt => {
            if (evt.key === 'Enter') {
                evt.preventDefault();
                applyHistoryWeekCustomRange();
            }
        });
    });

    const selects = [
        'historyFilterField',
        'historyFilterService',
        'historyFilterActivityType',
        'historyFilterManager',
        'historyFilterOrg'
    ];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.bound) return;
        el.dataset.bound = 'true';
        el.addEventListener('change', () => {
            normalizeAllOptionSelection(el);
            saveHistorySettings();
            loadHistoryCalendarData();
        });
    });

    const yearSelect = document.getElementById('historyYearSelect');
    if (yearSelect && !yearSelect.dataset.bound) {
        yearSelect.dataset.bound = 'true';
        yearSelect.addEventListener('change', () => {
            const year = Number(yearSelect.value || new Date().getFullYear());
            setHistoryYearAnchor(year);
            saveHistorySettings();
            loadHistoryCalendarData();
            renderHistoryYearView();
        });
    }

    const layoutSelect = document.getElementById('historyYearLayout');
    if (layoutSelect && !layoutSelect.dataset.bound) {
        layoutSelect.dataset.bound = 'true';
        layoutSelect.addEventListener('change', () => {
            renderHistoryYearView();
            saveHistorySettings();
        });
    }

    const orderSelect = document.getElementById('historyMonthOrder');
    if (orderSelect && !orderSelect.dataset.bound) {
        orderSelect.dataset.bound = 'true';
        orderSelect.addEventListener('change', () => {
            syncMonthSlotInput();
            renderHistoryYearView();
            loadHistoryCalendarData();
            saveHistorySettings();
        });
    }

    const slotInput = document.getElementById('historyMonthSlot');
    if (slotInput && !slotInput.dataset.bound) {
        slotInput.dataset.bound = 'true';
        slotInput.addEventListener('change', () => {
            renderHistoryYearView();
            loadHistoryCalendarData();
            saveHistorySettings();
        });
    }

    const projectSearch = document.getElementById('historyProjectSearch');
    if (projectSearch && !projectSearch.dataset.bound) {
        projectSearch.dataset.bound = 'true';
        projectSearch.addEventListener('input', () => {
            if (historyProjectSearchTimer) {
                clearTimeout(historyProjectSearchTimer);
            }
            historyProjectSearchTimer = setTimeout(() => {
                loadHistoryProjectOptions(1, true);
                loadHistoryCalendarData();
                saveHistorySettings();
            }, 300);
        });
    }

    const projectSelect = document.getElementById('historyProjectSelect');
    if (projectSelect && !projectSelect.dataset.bound) {
        projectSelect.dataset.bound = 'true';
        projectSelect.addEventListener('change', () => {
            historyProjectSelected = projectSelect.value || '__ALL__';
            saveHistorySettings();
            loadHistoryCalendarData();
        });
    }

    const projectPaging = document.getElementById('historyProjectPaging');
    if (projectPaging && !projectPaging.dataset.bound) {
        projectPaging.dataset.bound = 'true';
        projectPaging.addEventListener('click', (evt) => {
            const btn = evt.target.closest('button[data-page]');
            if (!btn) return;
            const page = Number(btn.dataset.page || '1');
            if (!page || page === historyProjectPage) return;
            loadHistoryProjectOptions(page, false);
        });
    }
}

function resetHistoryToDefaults() {
    historyRestoringState = true;
    historySavedState = null;
    historyRestoreStatus = { filters: false, projects: false };

    historyActiveView = 'year';
    historySelectedDates = new Set();
    historyProjectKeyword = '';
    historyProjectPage = 1;
    historyProjectTotalPages = 1;
    historyProjectSelected = '__ALL__';
    historyTooltipEnabled = false;
    historyWeekStartDay = 1;
    historyWeekCustomRange = { start: '', end: '' };
    historySortOrder = 'start';

    const today = new Date();
    historyMonthAnchorDate = new Date(today);
    historyWeekAnchorDate = new Date(today);
    historyDailyDate = formatDateInput(today);

    const yearSelect = document.getElementById('historyYearSelect');
    if (yearSelect) yearSelect.value = String(today.getFullYear());
    setHistoryYearAnchor(today.getFullYear());

    const layoutSelect = document.getElementById('historyYearLayout');
    if (layoutSelect) layoutSelect.value = '4x3';
    const orderSelect = document.getElementById('historyMonthOrder');
    if (orderSelect) orderSelect.value = 'current-last';
    const slotInput = document.getElementById('historyMonthSlot');
    if (slotInput) slotInput.value = '1';

    const projectSearch = document.getElementById('historyProjectSearch');
    if (projectSearch) projectSearch.value = '';
    const tooltipToggle = document.getElementById('historyTooltipToggle');
    if (tooltipToggle) tooltipToggle.checked = false;
    syncHistoryWeekControls();
    updateHistorySortToggle();

    applyMultiSelectValues('historyFilterField', []);
    applyMultiSelectValues('historyFilterService', []);
    applyMultiSelectValues('historyFilterActivityType', []);
    applyMultiSelectValues('historyFilterManager', []);
    applyMultiSelectValues('historyFilterOrg', []);

    loadHistoryProjectOptions(1, true);
    setHistoryView('year');
    renderHistoryYearView();
    updateHistorySelectionSummary();
    updateCalendarSelectionStyles();
    updateHistoryNavRight();
    updateHistoryPeriodLabel();
    clearHistoryTooltipAttributes();

    try {
        localStorage.removeItem(HISTORY_STATE_KEY);
    } catch (error) {
        console.warn('⚠️ 진행상황 설정 초기화 실패:', error);
    }
}

function bindButton(id, handler) {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', handler);
}

function initializeHistoryAnchors() {
    const today = new Date();
    historyMonthAnchorDate = new Date(today);
    historyWeekAnchorDate = new Date(today);
    if (!historyDailyDate) historyDailyDate = formatDateInput(today);

    const yearSelect = document.getElementById('historyYearSelect');
    if (yearSelect) {
        yearSelect.value = String(today.getFullYear());
    }
}

function ensureHistoryYearOptions() {
    const select = document.getElementById('historyYearSelect');
    if (!select || select.dataset.ready) return;
    select.dataset.ready = 'true';

    const now = new Date();
    const currentYear = now.getFullYear();
    const start = currentYear - 3;
    const end = currentYear + 2;

    for (let year = start; year <= end; year += 1) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = `${year}년`;
        if (year === currentYear) option.selected = true;
        select.appendChild(option);
    }
}

function syncMonthSlotInput() {
    const orderSelect = document.getElementById('historyMonthOrder');
    const slotInput = document.getElementById('historyMonthSlot');
    if (!orderSelect || !slotInput) return;
    slotInput.disabled = orderSelect.value !== 'current-slot';
}

function normalizeHistorySortOrder(value) {
    return value === 'recent' ? 'recent' : 'start';
}

function updateHistorySortToggle() {
    const toggle = document.getElementById('historySortToggle');
    const recentLabel = document.getElementById('historySortLabelRecent');
    const startLabel = document.getElementById('historySortLabelStart');
    const isRecent = historySortOrder === 'recent';
    if (toggle) toggle.checked = isRecent;
    if (recentLabel) recentLabel.classList.toggle('active', isRecent);
    if (startLabel) startLabel.classList.toggle('active', !isRecent);
}

function setHistorySortOrder(order) {
    historySortOrder = normalizeHistorySortOrder(order);
    updateHistorySortToggle();
    sortHistoryDateIndex();
    renderHistoryView();
    saveHistorySettings();
    loadHistoryCalendarData();
}

function parseDateTimeToMs(value) {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    const normalized = formatDateTimeValue(value).replace(' ', 'T');
    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) return parsed;
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
}

function compareHistoryItems(a, b) {
    const direction = historySortOrder === 'recent' ? -1 : 1;
    const baseA = a?.base_date ? parseDateInput(a.base_date).getTime() : 0;
    const baseB = b?.base_date ? parseDateInput(b.base_date).getTime() : 0;
    if (baseA !== baseB) return (baseA - baseB) * direction;

    const createdA = parseDateTimeToMs(a?.created_at || a?.updated_at);
    const createdB = parseDateTimeToMs(b?.created_at || b?.updated_at);
    if (createdA !== createdB) return (createdA - createdB) * direction;

    const idA = String(a?.history_id || a?.pipeline_id || '');
    const idB = String(b?.history_id || b?.pipeline_id || '');
    return idA.localeCompare(idB);
}

function sortHistoryDateIndex() {
    Object.keys(historyDateIndex || {}).forEach(key => {
        const items = historyDateIndex[key];
        if (Array.isArray(items)) items.sort(compareHistoryItems);
    });
}

function normalizeHistoryWeekStartDay(value) {
    const day = Number(value);
    if (Number.isInteger(day) && day >= 0 && day <= 6) return day;
    return 1;
}

function isValidDateInput(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isHistoryWeekCustomRangeActive() {
    return isValidDateInput(historyWeekCustomRange.start)
        && isValidDateInput(historyWeekCustomRange.end);
}

function getHistoryWeekRange() {
    const today = new Date();
    if (isHistoryWeekCustomRangeActive()) {
        const startDate = parseDateInput(historyWeekCustomRange.start);
        const endDate = parseDateInput(historyWeekCustomRange.end);
        if (startDate <= endDate) {
            return {
                start: formatDateInput(startDate),
                end: formatDateInput(endDate),
                source: 'custom',
                days: Math.floor((endDate - startDate) / 86400000) + 1
            };
        }
    }

    const base = historyWeekAnchorDate || today;
    const startDay = normalizeHistoryWeekStartDay(historyWeekStartDay);
    const diff = (base.getDay() - startDay + 7) % 7;
    const startDate = new Date(base);
    startDate.setDate(base.getDate() - diff);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return {
        start: formatDateInput(startDate),
        end: formatDateInput(endDate),
        source: 'week',
        days: 7
    };
}

function getVisibleWeekDatesWithItems() {
    if (historyActiveView !== 'week') return [];
    const range = getHistoryWeekRange();
    if (!range) return [];
    const dates = [];
    const start = parseDateInput(range.start);
    const end = parseDateInput(range.end);
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const dateStr = formatDateInput(cursor);
        if ((historyDateIndex[dateStr] || []).length) {
            dates.push(dateStr);
        }
    }
    return dates;
}

function syncHistoryWeekControls() {
    const row = document.getElementById('historyWeekControls');
    if (!row) return;
    const isWeek = historyActiveView === 'week';
    row.style.display = isWeek ? 'flex' : 'none';

    const startSelect = document.getElementById('historyWeekStartDay');
    if (startSelect) startSelect.value = String(normalizeHistoryWeekStartDay(historyWeekStartDay));

    const fromInput = document.getElementById('historyWeekFrom');
    const toInput = document.getElementById('historyWeekTo');
    if (fromInput) fromInput.value = historyWeekCustomRange.start || '';
    if (toInput) toInput.value = historyWeekCustomRange.end || '';
}

function applyHistoryWeekCustomRange() {
    const fromInput = document.getElementById('historyWeekFrom');
    const toInput = document.getElementById('historyWeekTo');
    const start = fromInput?.value || '';
    const end = toInput?.value || '';

    if (!isValidDateInput(start) || !isValidDateInput(end)) {
        alert('시작일과 종료일을 모두 입력해 주세요.');
        return;
    }

    const startDate = parseDateInput(start);
    const endDate = parseDateInput(end);
    if (startDate > endDate) {
        alert('종료일이 시작일보다 빠를 수 없습니다.');
        return;
    }

    historyWeekCustomRange = { start, end };
    historyWeekAnchorDate = new Date(startDate);
    historyMonthAnchorDate = new Date(startDate);
    syncHistoryWeekControls();
    renderHistoryWeekList();
    loadHistoryCalendarData();
    saveHistorySettings();
}

function clearHistoryWeekCustomRange(resetAnchor = true) {
    historyWeekCustomRange = { start: '', end: '' };
    if (resetAnchor) {
        const today = new Date();
        historyWeekAnchorDate = new Date(today);
        historyMonthAnchorDate = new Date(today);
    }
    syncHistoryWeekControls();
}

function shiftHistoryRange(direction) {
    if (historyActiveView === 'year') {
        const yearSelect = document.getElementById('historyYearSelect');
        if (!yearSelect) return;
        const currentYear = Number(yearSelect.value || new Date().getFullYear());
        const nextYear = currentYear + direction;
        let option = Array.from(yearSelect.options).find(opt => Number(opt.value) === nextYear);
        if (!option) {
            option = document.createElement('option');
            option.value = String(nextYear);
            option.textContent = `${nextYear}년`;
            yearSelect.appendChild(option);
        }
        yearSelect.value = String(nextYear);
        setHistoryYearAnchor(nextYear);
        renderHistoryYearView();
        loadHistoryCalendarData();
        return;
    }

    if (historyActiveView === 'month') {
        const base = historyMonthAnchorDate || new Date();
        const target = new Date(base.getFullYear(), base.getMonth() + direction, 1);
        setHistoryMonthAnchor(target, true);
        loadHistoryCalendarData();
        return;
    }

    if (historyActiveView === 'week') {
        if (isHistoryWeekCustomRangeActive()) {
            const range = getHistoryWeekRange();
            const startDate = parseDateInput(range.start);
            const endDate = parseDateInput(range.end);
            const spanDays = Math.max(1, Math.floor((endDate - startDate) / 86400000) + 1);
            const nextStart = new Date(startDate);
            const nextEnd = new Date(endDate);
            nextStart.setDate(startDate.getDate() + (direction * spanDays));
            nextEnd.setDate(endDate.getDate() + (direction * spanDays));
            historyWeekCustomRange = {
                start: formatDateInput(nextStart),
                end: formatDateInput(nextEnd)
            };
            historyWeekAnchorDate = new Date(nextStart);
            historyMonthAnchorDate = new Date(nextStart);
            syncHistoryWeekControls();
        } else {
            const base = historyWeekAnchorDate || new Date();
            const target = new Date(base);
            target.setDate(target.getDate() + (direction * 7));
            historyWeekAnchorDate = target;
            historyMonthAnchorDate = new Date(target);
        }
        renderHistoryWeekList();
        loadHistoryCalendarData();
        return;
    }

    if (historyActiveView === 'daily') {
        shiftDailyDate(direction);
        return;
    }

    loadHistoryCalendarData();
}

function moveHistoryToToday() {
    const today = new Date();
    historyMonthAnchorDate = new Date(today);
    historyWeekAnchorDate = new Date(today);
    historyDailyDate = formatDateInput(today);

    if (historyActiveView === 'year') {
        const yearSelect = document.getElementById('historyYearSelect');
        if (yearSelect) yearSelect.value = String(today.getFullYear());
        setHistoryYearAnchor(today.getFullYear());
        renderHistoryYearView();
        focusHistoryCurrentMonth();
    }

    if (historyActiveView === 'week') {
        clearHistoryWeekCustomRange(false);
        renderHistoryWeekList();
    }

    if (historyActiveView === 'daily') {
        renderHistoryDailyView();
    }

    if (historyCalendarInstance) {
        historyCalendarInstance.gotoDate(today);
    }

    loadHistoryCalendarData();
}

function setHistoryMonthAnchor(dateObj, updateCalendar = true) {
    if (!(dateObj instanceof Date)) return;
    historyMonthAnchorDate = new Date(dateObj);
    if (historyCalendarInstance && updateCalendar) {
        historyCalendarInstance.gotoDate(historyMonthAnchorDate);
    }
}

function setHistoryTooltipEnabled(enabled) {
    historyTooltipEnabled = !!enabled;
    const toggle = document.getElementById('historyTooltipToggle');
    if (toggle) toggle.checked = historyTooltipEnabled;
    if (!historyTooltipEnabled) {
        hideHistoryTooltip();
        clearHistoryTooltipAttributes();
    } else {
        renderHistoryView();
    }
    saveHistorySettings();
}

function setHistoryYearAnchor(year) {
    const yearSelect = document.getElementById('historyYearSelect');
    if (yearSelect) {
        let option = Array.from(yearSelect.options).find(opt => Number(opt.value) === year);
        if (!option) {
            option = document.createElement('option');
            option.value = String(year);
            option.textContent = `${year}년`;
            yearSelect.appendChild(option);
        }
        yearSelect.value = String(year);
    }
}

function focusHistoryCurrentMonth() {
    const yearView = document.getElementById('historyYearView');
    if (!yearView) return;

    const now = new Date();
    const target = yearView.querySelector(`[data-month="${now.getMonth() + 1}"]`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function loadHistoryFilters(force = false) {
    if (historyFiltersLoaded && !force) {
        applyHistorySavedFilters();
        if (historyRestoringState) {
            historyRestoreStatus.filters = true;
            finalizeHistoryRestore();
        }
        return;
    }
    try {
        const response = await API.get(API_CONFIG.ENDPOINTS.PROJECT_HISTORY_FILTERS);
        fillHistorySelect('historyFilterField', response.fields || [], 'field_code', item => item.field_name || item.field_code);
        fillHistorySelect('historyFilterService', response.services || [], 'service_code', item => item.service_name || item.service_code);
        fillHistorySelect('historyFilterActivityType', response.activity_types || [], 'activity_type', item => item.activity_type_name || item.activity_type);
        fillHistorySelect('historyFilterManager', response.managers || [], 'login_id', item => item.user_name || item.login_id);
        fillHistorySelect('historyFilterOrg', response.org_units || [], 'org_id', item => item.org_name || item.org_id);
        historyActivityTypeOptions = response.activity_types || [];
        historyFiltersLoaded = true;
        applyHistorySavedFilters();
        if (historyRestoringState) {
            historyRestoreStatus.filters = true;
            finalizeHistoryRestore();
        }
    } catch (error) {
        console.error('❌ 필터 데이터 로드 실패:', error);
    }
}

function buildHistoryFilterParams(range) {
    const params = new URLSearchParams();
    params.set('date_from', range.start);
    params.set('date_to', range.end);

    const fieldList = getMultiSelectValues('historyFilterField');
    const serviceList = getMultiSelectValues('historyFilterService');
    const activityList = getMultiSelectValues('historyFilterActivityType');
    const managerList = getMultiSelectValues('historyFilterManager');
    const orgList = getMultiSelectValues('historyFilterOrg');

    if (fieldList.length) params.set('field_code', fieldList.join(','));
    if (serviceList.length) params.set('service_code', serviceList.join(','));
    if (activityList.length) params.set('activity_type', activityList.join(','));
    if (managerList.length) params.set('manager_id', managerList.join(','));
    if (orgList.length) params.set('org_id', orgList.join(','));
    if (historyProjectSelected && historyProjectSelected !== '__ALL__') {
        params.set('pipeline_id', historyProjectSelected);
    } else if (historyProjectKeyword) {
        params.set('project_keyword', historyProjectKeyword);
    }

    return params;
}

async function loadHistoryActivitySummary(range) {
    historyActivitySummary = {};
    const params = buildHistoryFilterParams(range);
    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECT_HISTORY_SUMMARY}?${params.toString()}`);
        (response.items || []).forEach(item => {
            const dateStr = item.base_date;
            if (!dateStr) return;
            if (!historyActivitySummary[dateStr]) historyActivitySummary[dateStr] = {};
            historyActivitySummary[dateStr][item.activity_type || 'UNKNOWN'] = Number(item.activity_count || 0);
        });
    } catch (error) {
        console.error('❌ 활동유형 요약 로드 실패:', error);
    }
}

async function loadHistoryProjectOptions(page = 1, resetSelection = false) {
    const searchInput = document.getElementById('historyProjectSearch');
    const select = document.getElementById('historyProjectSelect');
    const paging = document.getElementById('historyProjectPaging');
    if (!select || !paging) return;

    const keyword = (searchInput?.value || '').trim();
    historyProjectKeyword = keyword;
    historyProjectPage = page;

    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    params.set('page', String(page));
    params.set('page_size', '25');

    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECT_HISTORY_PROJECTS}?${params.toString()}`);
        const items = response.items || [];
        historyProjectTotalPages = Number(response.total_pages || 1);

        select.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = '__ALL__';
        allOption.textContent = '전체';
        select.appendChild(allOption);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = String(item.pipeline_id || '');
            const projectName = item.project_name || '-';
            const customerName = item.customer_name || '-';
            const orderingName = item.ordering_party_name || '-';
            option.textContent = `${projectName} | ${customerName} | ${orderingName} | ${item.pipeline_id || '-'}`;
            select.appendChild(option);
        });

        if (resetSelection) {
            historyProjectSelected = '__ALL__';
        } else if (historyProjectSelected && historyProjectSelected !== '__ALL__') {
            const match = items.find(item => String(item.pipeline_id) === historyProjectSelected);
            if (!match) historyProjectSelected = '__ALL__';
        }
        select.value = historyProjectSelected;

        renderHistoryProjectPaging(historyProjectTotalPages, historyProjectPage);
        if (historyRestoringState) {
            historyRestoreStatus.projects = true;
            finalizeHistoryRestore();
        }
    } catch (error) {
        console.error('❌ 프로젝트 검색 실패:', error);
    }
}

function renderHistoryProjectPaging(totalPages, currentPage) {
    const paging = document.getElementById('historyProjectPaging');
    if (!paging) return;
    if (!totalPages || totalPages <= 1) {
        paging.innerHTML = '';
        return;
    }
    const buttons = [];
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i += 1) {
            buttons.push({ type: 'page', value: i });
        }
    } else {
        [1, 2, 3, 4].forEach(i => buttons.push({ type: 'page', value: i }));
        buttons.push({ type: 'ellipsis' });
        buttons.push({ type: 'last', value: totalPages });
    }

    paging.innerHTML = buttons.map(btn => {
        if (btn.type === 'ellipsis') {
            return '<span>...</span>';
        }
        if (btn.type === 'last') {
            const active = btn.value === currentPage ? 'active' : '';
            return `<button type="button" class="${active}" data-page="${btn.value}">Last</button>`;
        }
        const active = btn.value === currentPage ? 'active' : '';
        return `<button type="button" class="${active}" data-page="${btn.value}">${btn.value}</button>`;
    }).join('');
}

function fillHistorySelect(id, items, valueKey, labelFn) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '__ALL__';
    allOption.textContent = '전체';
    allOption.selected = true;
    select.appendChild(allOption);

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = String(item[valueKey]);
        option.textContent = labelFn(item);
        select.appendChild(option);
    });
}

function normalizeAllOptionSelection(select) {
    if (!select) return;
    const selected = Array.from(select.selectedOptions).map(opt => opt.value);
    const hasAll = selected.includes('__ALL__');

    if (hasAll && selected.length > 1) {
        select.options[0].selected = false;
        return;
    }

    if (!hasAll && selected.length === 0) {
        select.options[0].selected = true;
    }
}

function getMultiSelectValues(id) {
    const select = document.getElementById(id);
    if (!select) return [];
    return Array.from(select.selectedOptions)
        .map(opt => opt.value)
        .filter(value => value && value !== '__ALL__');
}

function getVisibleRange() {
    const today = new Date();

    if (historyActiveView === 'year') {
        const yearSelect = document.getElementById('historyYearSelect');
        const year = Number(yearSelect?.value || today.getFullYear());
        const order = document.getElementById('historyMonthOrder')?.value || 'normal';
        const slot = Number(document.getElementById('historyMonthSlot')?.value || 1);
        const months = buildYearMonthItems(year, order, slot);
        if (!months.length) {
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31);
            return { start: formatDateInput(start), end: formatDateInput(end) };
        }
        const first = months[0];
        const last = months[months.length - 1];
        const start = new Date(first.year, first.month - 1, 1);
        const end = new Date(last.year, last.month, 0);
        return { start: formatDateInput(start), end: formatDateInput(end) };
    }

    if (historyActiveView === 'month') {
        const base = historyCalendarInstance?.getDate?.() || historyMonthAnchorDate || today;
        const start = new Date(base.getFullYear(), base.getMonth(), 1);
        const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        return { start: formatDateInput(start), end: formatDateInput(end) };
    }

    if (historyActiveView === 'week') {
        const range = getHistoryWeekRange();
        return range ? { start: range.start, end: range.end } : null;
    }

    if (historyActiveView === 'daily') {
        const base = historyDailyDate ? parseDateInput(historyDailyDate) : today;
        const start = new Date(base.getFullYear(), base.getMonth(), 1);
        const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
        return { start: formatDateInput(start), end: formatDateInput(end) };
    }

    return null;
}

async function loadHistoryCalendarData() {
    const range = getVisibleRange();
    if (!range) return;

    await ensureHolidayDataForRange(range);

    const params = buildHistoryFilterParams(range);

    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROJECT_HISTORY_CALENDAR}?${params.toString()}`);
        historyCalendarData = response.items || [];
        buildHistoryDateIndex();
        normalizeSelectedDates();
        renderHistoryView();
        updateHistoryPeriodLabel();
        updateHistoryLegend();
        if (historyActiveView === 'month') {
            await loadHistoryActivitySummary(range);
            applyActivityStackBarsToMonthCalendar();
        }
    } catch (error) {
        console.error('❌ 진행상황 데이터 로드 실패:', error);
    }
}

function buildHistoryDateIndex() {
    historyDateIndex = {};
    historyCalendarData.forEach(item => {
        const key = item.base_date;
        if (!key) return;
        if (!historyDateIndex[key]) historyDateIndex[key] = [];
        historyDateIndex[key].push(item);
    });
    sortHistoryDateIndex();
}

function normalizeSelectedDates() {
    const valid = new Set();
    historySelectedDates.forEach(dateStr => {
        if (historyDateIndex[dateStr]) valid.add(dateStr);
    });
    historySelectedDates = valid;
    updateHistorySelectionSummary();
}

function renderHistoryView() {
    if (historyActiveView === 'year') {
        renderHistoryYearView();
        updateHistoryNavRight();
        return;
    }
    if (historyActiveView === 'week') {
        renderHistoryWeekList();
        updateHistoryNavRight();
        return;
    }
    if (historyActiveView === 'daily') {
        renderHistoryDailyView();
        updateHistoryNavRight();
        return;
    }
    renderHistoryCalendarView();
    updateHistoryNavRight();
}

function setHistoryView(view) {
    historyActiveView = view;
    const page = document.getElementById('page-project-history-calendar');
    if (page) page.dataset.historyView = view;

    document.querySelectorAll('.ph-view-toggle .btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    const yearControls = document.querySelector('.ph-year-controls');
    if (yearControls) {
        yearControls.style.display = view === 'year' ? 'flex' : 'none';
    }

    const yearView = document.getElementById('historyYearView');
    const calendarView = document.getElementById('historyCalendar');
    const weekListView = document.getElementById('historyWeekList');
    const dailyView = document.getElementById('historyDailyView');

    if (yearView) yearView.classList.toggle('ph-active-view', view === 'year');
    if (calendarView) calendarView.classList.toggle('ph-active-view', view === 'month');
    if (weekListView) weekListView.classList.toggle('ph-active-view', view === 'week');
    if (dailyView) dailyView.classList.toggle('ph-active-view', view === 'daily');

    if (view === 'month') {
        if (historySelectedDates.size > 0) {
            const selected = Array.from(historySelectedDates).sort()[0];
            historyMonthAnchorDate = new Date(selected);
        } else if (!historyMonthAnchorDate) {
            historyMonthAnchorDate = new Date();
        }
        if (historyCalendarInstance) {
            historyCalendarInstance.gotoDate(historyMonthAnchorDate);
        }
    }
    if (view === 'week') {
        if (isHistoryWeekCustomRangeActive()) {
            historyWeekAnchorDate = parseDateInput(historyWeekCustomRange.start);
        } else if (historySelectedDates.size > 0) {
            const selected = Array.from(historySelectedDates).sort()[0];
            historyWeekAnchorDate = new Date(selected);
        } else if (!historyWeekAnchorDate) {
            historyWeekAnchorDate = new Date();
        }
        historyMonthAnchorDate = new Date(historyWeekAnchorDate);
    }
    if (view === 'daily' && !historyDailyDate) {
        historyDailyDate = formatDateInput(new Date());
    }

    syncHistoryWeekControls();
    updateHistorySelectAllToggle();
    renderHistoryView();
    updateHistoryPeriodLabel();
    if (historyRestoringState) return;
    loadHistoryCalendarData();
}

function renderHistoryCalendarView() {
    const container = document.getElementById('historyCalendar');
    if (!container) return;
    if (typeof FullCalendar === 'undefined') {
        container.innerHTML = '<div style="padding:1rem;">달력 위젯을 불러오지 못했습니다.</div>';
        return;
    }

    if (!historyCalendarInstance) {
        historyCalendarInstance = new FullCalendar.Calendar(container, {
            initialView: 'dayGridMonth',
            initialDate: historyMonthAnchorDate || new Date(),
            locale: 'ko',
            height: 'auto',
            headerToolbar: false,
            dayCellDidMount: info => {
                applyDayCellMarkers(info.el, info.dateStr);
            },
            dateClick: info => {
                handleDateSelection(info.dateStr, info.jsEvent);
            },
            eventClick: info => {
                const evt = info.jsEvent || window.event;
                if (isMultiSelectEvent(evt)) {
                    const dateStr = info.event?.startStr
                        || (info.event?.start ? formatDateInput(info.event.start) : null);
                    if (dateStr) {
                        handleDateSelection(dateStr, evt);
                        if (evt) {
                            evt.preventDefault?.();
                            evt.stopPropagation?.();
                        }
                        return;
                    }
                }
                openHistoryDetailFromEvent(info.event.extendedProps || {});
            },
            eventContent: info => buildHistoryEventContent(info),
            eventDidMount: info => {
                const data = info.event.extendedProps || {};
                const tooltipText = buildHistoryTooltipText(data);
                if (tooltipText) {
                    setHistoryTooltip(info.el, tooltipText);
                }
            }
        });
        historyCalendarInstance.render();
    }

    historyCalendarInstance.changeView('dayGridMonth');

    historyCalendarInstance.removeAllEvents();
    historyCalendarInstance.addEventSource(buildHistoryEvents());
    historyCalendarInstance.render();
    historyCalendarInstance.updateSize();
    if (historyCalendarInstance) {
        historyMonthAnchorDate = new Date(historyCalendarInstance.getDate());
    }
    updateCalendarSelectionStyles();
    applyHolidayMarkersToMonthCalendar();
    updateHistoryPeriodLabel();
}

function buildHistoryEvents() {
    return historyCalendarData.map(item => ({
        id: `history-${item.history_id}`,
        title: item.project_name || '-',
        start: item.base_date,
        allDay: true,
        extendedProps: item
    }));
}

function buildHistoryEventContent(info) {
    const item = info.event.extendedProps || {};
    const stageDot = renderStageDot(item.progress_stage);
    const comboDot = `<span class="ph-icon" style="background: ${getComboColor(item)};"></span>`;
    const name = Utils.escapeHtml(item.project_name || '-');
    const meta = (info.view.type === 'timeGridWeek')
        ? Utils.escapeHtml(Utils.truncate(item.strategy_content || '', 24))
        : '';

    return {
        html: `<div class="ph-event">${stageDot}${comboDot}<span class="ph-event-title">${name}</span>${meta ? `<span class="ph-event-meta">${meta}</span>` : ''}</div>`
    };
}

function buildHistoryInfoLine(item) {
    const project = item.project_name || '-';
    const field = item.field_name || item.field_code || '-';
    const service = item.service_name || item.service_code || '-';
    const manager = item.manager_name || item.manager_id || '-';
    const org = item.org_name || item.org_id || '-';
    return [project, field, service, manager, org].join(' | ');
}

function buildHistoryDetailLine(item) {
    const activity = item.activity_type_name || getActivityTypeName(item.activity_type) || '';
    const stage = item.stage_name || item.progress_stage || '-';
    const content = item.strategy_content || '';
    return [activity, stage, content].filter(Boolean).join(' | ');
}

function buildHistoryTooltipText(item) {
    if (!item) return '';
    return [buildHistoryInfoLine(item), buildHistoryDetailLine(item)]
        .filter(Boolean)
        .join('\n');
}

function applyDayCellMarkers(el, dateStr) {
    if (!el || !dateStr) return;
    if (historyDateIndex[dateStr]) {
        el.classList.add('ph-has-items');
    }
    const holidayLabel = getHolidayLabel(dateStr);
    if (holidayLabel) {
        el.classList.add('ph-holiday');
    }
    if (historySelectedDates.has(dateStr)) {
        el.classList.add('ph-selected');
    }
    const items = historyDateIndex[dateStr] || [];
    const tooltipText = buildDayTooltip(items, holidayLabel);
    if (tooltipText) {
        setHistoryTooltip(el, tooltipText);
    } else {
        el.removeAttribute('data-ph-tooltip');
    }
}

function applyHolidayMarkersToMonthCalendar() {
    if (!historyCalendarInstance || !historyCalendarInstance.el) return;
    const calendarEl = historyCalendarInstance.el;
    calendarEl.querySelectorAll('.fc-daygrid-day').forEach(cell => {
        const dateStr = cell.getAttribute('data-date');
        if (!dateStr) return;
        const holidayLabel = getHolidayLabel(dateStr);
        if (!holidayLabel) {
            cell.classList.remove('ph-holiday');
            if (cell.getAttribute('data-ph-tooltip')) {
                const items = historyDateIndex[dateStr] || [];
                const tooltipText = buildDayTooltip(items, '');
                if (tooltipText) {
                    setHistoryTooltip(cell, tooltipText);
                } else {
                    cell.removeAttribute('data-ph-tooltip');
                }
            }
            return;
        }
        cell.classList.add('ph-holiday');
        const items = historyDateIndex[dateStr] || [];
        const tooltipText = buildDayTooltip(items, holidayLabel);
        if (tooltipText) setHistoryTooltip(cell, tooltipText);
    });
}

function applyActivityStackBarsToMonthCalendar() {
    if (!historyCalendarInstance || !historyCalendarInstance.el) return;
    const calendarEl = historyCalendarInstance.el;
    calendarEl.querySelectorAll('.ph-activity-stack').forEach(el => el.remove());

    calendarEl.querySelectorAll('.fc-daygrid-day').forEach(cell => {
        const dateStr = cell.getAttribute('data-date');
        if (!dateStr) return;
        const summary = historyActivitySummary[dateStr];
        if (!summary) return;

        const entries = Object.entries(summary).filter(([, count]) => Number(count) > 0);
        if (!entries.length) return;
        const total = entries.reduce((acc, [, count]) => acc + Number(count || 0), 0);
        if (total <= 0) return;

        const bar = document.createElement('div');
        bar.className = 'ph-activity-stack';
        entries.forEach(([typeCode, count]) => {
            const seg = document.createElement('div');
            seg.className = 'ph-activity-seg';
            seg.style.background = getActivityTypeColor(typeCode);
            seg.style.width = `${(Number(count) / total) * 100}%`;
            bar.appendChild(seg);
        });

        const frame = cell.querySelector('.fc-daygrid-day-frame') || cell;
        frame.appendChild(bar);
    });
}

function updateCalendarSelectionStyles() {
    if (!historyCalendarInstance) return;
    const calendarEl = historyCalendarInstance.el;
    if (!calendarEl) return;

    calendarEl.querySelectorAll('.ph-selected').forEach(el => el.classList.remove('ph-selected'));

    historySelectedDates.forEach(dateStr => {
        const dayCell = calendarEl.querySelector(`.fc-daygrid-day[data-date="${dateStr}"]`);
        if (dayCell) dayCell.classList.add('ph-selected');
        const timeCell = calendarEl.querySelector(`.fc-timegrid-col[data-date="${dateStr}"]`);
        if (timeCell) timeCell.classList.add('ph-selected');
    });
}

function renderHistoryYearView() {
    const container = document.getElementById('historyYearView');
    if (!container) return;

    const year = Number(document.getElementById('historyYearSelect')?.value || new Date().getFullYear());
    const layout = document.getElementById('historyYearLayout')?.value || '3x4';
    const order = document.getElementById('historyMonthOrder')?.value || 'normal';
    const slot = Number(document.getElementById('historyMonthSlot')?.value || 1);

    const [cols, rows] = layout.split('x').map(n => Number(n) || 1);

    const months = buildYearMonthItems(year, order, slot);

    const grid = document.createElement('div');
    grid.className = 'ph-year-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${rows}, auto)`;

    months.forEach(item => {
        const monthCard = buildMonthCard(item.year, item.month, item.year !== year);
        grid.appendChild(monthCard);
    });

    container.innerHTML = '';
    container.appendChild(grid);
    updateHistoryPeriodLabel();
}

function buildYearMonthItems(baseYear, order, slot) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    if (order === 'normal') return months.map(month => ({ year: baseYear, month, offset: 0 }));

    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    let targetIndex = 0;
    if (order === 'current-last') targetIndex = 11;
    if (order === 'current-slot') targetIndex = Math.max(1, Math.min(12, slot)) - 1;

    const start = new Date(baseYear, currentMonth - 1, 1);
    start.setMonth(start.getMonth() - targetIndex);

    const items = [];
    for (let i = 0; i < 12; i += 1) {
        const d = new Date(start);
        d.setMonth(start.getMonth() + i);
        items.push({
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            offset: d.getFullYear() - baseYear
        });
    }
    return items;
}

function buildMonthCard(year, month, isAltYear = false) {
    const card = document.createElement('div');
    card.className = 'ph-month-card';
    card.dataset.month = String(month);
    card.dataset.year = String(year);

    const header = document.createElement('div');
    header.className = 'ph-month-header';
    if (isAltYear) header.classList.add('ph-month-header-alt');
    header.textContent = `${year}년 ${month}월`;
    card.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'ph-month-grid';

    const weekNames = ['일', '월', '화', '수', '목', '금', '토'];
    weekNames.forEach((name, idx) => {
        const w = document.createElement('div');
        w.className = 'ph-weekday';
        if (idx === 0) w.classList.add('ph-weekday-sun');
        if (idx === 6) w.classList.add('ph-weekday-sat');
        w.textContent = name;
        grid.appendChild(w);
    });

    const firstDay = new Date(year, month - 1, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < startDay; i += 1) {
        const empty = document.createElement('div');
        empty.className = 'ph-day disabled';
        grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateStr = formatDateInput(new Date(year, month - 1, day));
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        const cell = document.createElement('div');
        cell.className = 'ph-day';
        cell.dataset.date = dateStr;
        if (dayOfWeek === 0) cell.classList.add('ph-day-sun');
        if (dayOfWeek === 6) cell.classList.add('ph-day-sat');
        const holidayLabel = getHolidayLabel(dateStr);
        if (holidayLabel) cell.classList.add('ph-holiday');

        const number = document.createElement('div');
        number.className = 'ph-day-number';
        number.textContent = String(day);
        cell.appendChild(number);

        const items = historyDateIndex[dateStr] || [];
        if (items.length) {
            cell.classList.add('has-items');
            const tooltipText = buildDayTooltip(items, holidayLabel);
            if (tooltipText) setHistoryTooltip(cell, tooltipText);
            const iconWrap = document.createElement('div');
            iconWrap.className = 'ph-day-icons';
            items.slice(0, 3).forEach(item => {
                const icon = document.createElement('span');
                icon.className = 'ph-icon stage';
                const stageColor = getStageColor(item.progress_stage);
                const comboColor = getComboColor(item);
                icon.style.background = stageColor;
                icon.style.border = `1px solid ${comboColor}`;
                iconWrap.appendChild(icon);
            });
            if (items.length > 3) {
                const more = document.createElement('span');
                more.textContent = `+${items.length - 3}`;
                more.style.fontSize = '0.6rem';
                more.style.color = '#475569';
                iconWrap.appendChild(more);
            }
            cell.appendChild(iconWrap);
        } else if (holidayLabel) {
            setHistoryTooltip(cell, buildDayTooltip([], holidayLabel));
        }

        if (historySelectedDates.has(dateStr)) {
            cell.classList.add('selected');
        }

        cell.addEventListener('click', evt => {
            handleDateSelection(dateStr, evt);
        });

        grid.appendChild(cell);
    }

    card.appendChild(grid);
    return card;
}

function buildDayTooltip(items, holidayLabel = '') {
    const historyLines = (items || []).map(item => buildHistoryTooltipText(item)).filter(Boolean);
    const historyText = historyLines.join('\n\n');
    if (holidayLabel) {
        return historyText
            ? `${historyText}\n공휴일: ${holidayLabel}`
            : `공휴일: ${holidayLabel}`;
    }
    return historyText;
}

function renderHistoryDailyView() {
    const container = document.getElementById('historyDailyView');
    if (!container) return;

    if (!historyDailyDate) {
        historyDailyDate = historySelectedDates.size === 1
            ? Array.from(historySelectedDates)[0]
            : formatDateInput(new Date());
    }

    const items = historyDateIndex[historyDailyDate] || [];
    const displayDate = formatDateWithWeekday(historyDailyDate);

    const headerHtml = `
        <div class="ph-daily-header">
            <div class="ph-daily-date">${displayDate}</div>
        </div>
    `;

    const cardsHtml = items.length
        ? `<div class="ph-daily-cards">${items.map(item => renderDailyCard(item)).join('')}</div>`
        : `<div class="ph-daily-cards"><div class="ph-daily-card">선택된 날짜에 이력이 없습니다.</div></div>`;

    container.innerHTML = headerHtml + cardsHtml;

    bindDetailButtons(container);
    updateHistoryPeriodLabel();
    updateHistoryNavRight();
}

function renderHistoryWeekList() {
    const container = document.getElementById('historyWeekList');
    if (!container) return;

    const range = getHistoryWeekRange();
    if (!range) return;

    const startDate = parseDateInput(range.start);
    const endDate = parseDateInput(range.end);
    const totalDays = range.days || 0;
    let visibleDays = 0;
    const dayBlocks = [];

    const direction = historySortOrder === 'recent' ? -1 : 1;
    const startCursor = historySortOrder === 'recent' ? endDate : startDate;
    const endCursor = historySortOrder === 'recent' ? startDate : endDate;

    for (let cursor = new Date(startCursor);
        direction === 1 ? cursor <= endCursor : cursor >= endCursor;
        cursor.setDate(cursor.getDate() + direction)) {
        const dateStr = formatDateInput(cursor);
        const items = historyDateIndex[dateStr] || [];
        if (!items.length) {
            continue;
        }
        visibleDays += 1;
        const isSelected = historySelectedDates.has(dateStr);
        const dateLabel = formatDateWithWeekday(dateStr);
        const itemsHtml = items.map(item => renderWeekItem(item)).join('');
        dayBlocks.push(`
            <div class="ph-week-day ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                <div class="ph-week-day-header">
                    <span>${dateLabel}</span>
                    <span class="ph-week-day-count">${items.length}건</span>
                </div>
                <div class="ph-week-items">
                    ${itemsHtml}
                </div>
            </div>
        `);
    }

    const emptyMessage = dayBlocks.length
        ? ''
        : '<div class="ph-week-empty">이력 없음</div>';

    const rangeLabel = `${range.start} ~ ${range.end}`;
    const rangeHint = range.source === 'custom'
        ? '맞춤 기간'
        : `${getWeekdayName(normalizeHistoryWeekStartDay(historyWeekStartDay))} 시작`;
    let html = `
        <div class="ph-week-header">
            <div class="ph-week-title">${rangeLabel} <span class="ph-period-sub">${rangeHint}</span></div>
            <div class="ph-week-day-count">표시 ${visibleDays}일 / 총 ${totalDays}일</div>
        </div>
        <div class="ph-week-days">
            ${dayBlocks.join('')}
            ${emptyMessage}
        </div>
    `;
    container.innerHTML = html;
    bindWeekListEvents(container);
    updateHistoryPeriodLabel();
    updateHistorySelectAllToggle();
}

function renderWeekItem(item) {
    const stageName = Utils.escapeHtml(item.stage_name || item.progress_stage || '-');
    const activityName = Utils.escapeHtml(item.activity_type_name || getActivityTypeName(item.activity_type) || '-');
    const projectName = Utils.escapeHtml(item.project_name || '-');
    const managerName = Utils.escapeHtml(item.manager_name || item.manager_id || '-');
    const orgName = Utils.escapeHtml(item.org_name || item.org_id || '-');
    const fieldName = Utils.escapeHtml(item.field_name || item.field_code || '-');
    const serviceName = Utils.escapeHtml(item.service_name || item.service_code || '-');
    const content = Utils.escapeHtml(Utils.truncate(item.strategy_content || '-', 120));
    const stageColor = getStageColor(item.progress_stage);
    const comboColor = getComboColor(item);
    const activityColor = getActivityTypeColor(item.activity_type);

    return `
        <div class="ph-week-item">
            <div class="ph-week-item-title">
                <span class="ph-icon stage" style="background:${stageColor};border:1px solid ${comboColor};"></span>
                ${projectName}
            </div>
            <div class="ph-week-item-meta">
                <span class="ph-activity-chip" style="--chip-color:${activityColor};">${activityName}</span>
                ${stageName} · ${fieldName} · ${serviceName}
            </div>
            <div class="ph-week-item-meta">담당자 ${managerName} · 조직 ${orgName}</div>
            <div class="ph-week-item-content">${content}</div>
            <div class="ph-week-item-actions">
                <button class="btn btn-secondary ph-detail-btn" data-pipeline-id="${Utils.escapeHtml(item.pipeline_id || '')}">상세 보기</button>
            </div>
        </div>
    `;
}

function bindWeekListEvents(container) {
    if (!container) return;
    container.querySelectorAll('.ph-week-day').forEach(dayEl => {
        if (dayEl.dataset.bound) return;
        dayEl.dataset.bound = 'true';
        dayEl.addEventListener('click', evt => {
            const dateStr = dayEl.dataset.date;
            handleDateSelection(dateStr, evt);
            evt.stopPropagation();
        });
    });
    bindDetailButtons(container);
}

function renderDailyCard(item) {
    const stageName = item.stage_name || item.progress_stage || '-';
    const stageColor = getStageColor(item.progress_stage);
    const comboColor = getComboColor(item);
    const activityName = Utils.escapeHtml(item.activity_type_name || getActivityTypeName(item.activity_type) || '-');
    const activityColor = getActivityTypeColor(item.activity_type);
    const projectName = Utils.escapeHtml(item.project_name || '-');
    const managerName = Utils.escapeHtml(item.manager_name || item.manager_id || '-');
    const orgName = Utils.escapeHtml(item.org_name || item.org_id || '-');
    const fieldName = Utils.escapeHtml(item.field_name || item.field_code || '-');
    const serviceName = Utils.escapeHtml(item.service_name || item.service_code || '-');
    const content = Utils.escapeHtml(item.strategy_content || '-');

    return `
        <div class="ph-daily-card">
            <h4>${projectName}</h4>
            <div class="ph-daily-meta">
                <span class="ph-activity-chip" style="--chip-color:${activityColor};">${activityName}</span>
                <span style="display:inline-flex;align-items:center;gap:0.3rem;">
                    <span class="ph-icon stage" style="background:${stageColor};border:1px solid ${comboColor};"></span>
                    ${stageName}
                </span>
                · ${fieldName} · ${serviceName}
            </div>
            <div class="ph-daily-meta">담당자 ${managerName} · 조직 ${orgName}</div>
            <div class="ph-daily-content">${content}</div>
            <div class="ph-daily-actions">
                <button class="btn btn-secondary ph-detail-btn" data-pipeline-id="${Utils.escapeHtml(item.pipeline_id || '')}">상세 보기</button>
            </div>
        </div>
    `;
}

function shiftDailyDate(diff) {
    const direction = diff >= 0 ? 1 : -1;
    const current = historyDailyDate || formatDateInput(new Date());
    const dates = getHistoryDateList();
    const next = findAdjacentHistoryDate(current, direction, dates);

    if (next) {
        historyDailyDate = next;
        renderHistoryDailyView();
        return;
    }

    shiftDailyToNextHistoryMonth(direction);
}

function updateHistoryModifierState(evt) {
    if (!evt) return;
    historyModifierState = {
        ctrl: !!evt.ctrlKey,
        meta: !!evt.metaKey,
        shift: !!evt.shiftKey
    };
}

function resetHistoryModifierState() {
    historyModifierState = { ctrl: false, meta: false, shift: false };
}

function isMultiSelectEvent(evt) {
    const fallback = historyModifierState.ctrl || historyModifierState.meta || historyModifierState.shift;
    if (!evt) return fallback;
    if (evt.ctrlKey || evt.metaKey || evt.shiftKey) return true;
    if (typeof evt.getModifierState === 'function') {
        return !!(evt.getModifierState('Control')
            || evt.getModifierState('Meta')
            || evt.getModifierState('Shift'));
    }
    return fallback;
}

function handleDateSelection(dateStr, evt) {
    const isMulti = isMultiSelectEvent(evt || window.event);
    if (historyActiveView === 'week' && dateStr) {
        historyWeekAnchorDate = new Date(dateStr);
    }

    if (!isMulti) {
        historySelectedDates = new Set([dateStr]);
        historyDailyDate = dateStr;
        updateHistorySelectionSummary();
        updateCalendarSelectionStyles();
        renderHistoryYearView();
        renderHistoryWeekList();
        if ((historyActiveView === 'year' || historyActiveView === 'month')
            && !(historyDateIndex[dateStr] && historyDateIndex[dateStr].length)) {
            return;
        }
        openProjectHistoryModal();
        return;
    }

    if (historySelectedDates.has(dateStr)) {
        historySelectedDates.delete(dateStr);
    } else {
        historySelectedDates.add(dateStr);
    }

    updateHistorySelectionSummary();
    updateCalendarSelectionStyles();
    renderHistoryYearView();
    renderHistoryWeekList();
}

function updateHistorySelectAllToggle() {
    const wrap = document.getElementById('historySelectAllWrap');
    const toggle = document.getElementById('historySelectAllToggle');
    if (!wrap || !toggle) return;
    const isWeek = historyActiveView === 'week';
    wrap.style.display = isWeek ? 'flex' : 'none';
    if (!isWeek) {
        toggle.checked = false;
        toggle.disabled = true;
        return;
    }
    const dates = getVisibleWeekDatesWithItems();
    toggle.disabled = dates.length === 0;
    toggle.checked = dates.length > 0 && dates.every(dateStr => historySelectedDates.has(dateStr));
}

function updateHistorySelectionSummary() {
    const summary = document.getElementById('historySelectionSummary');
    if (summary) {
        summary.textContent = `선택된 일자: ${historySelectedDates.size}개`;
    }

    const viewBtn = document.getElementById('btnHistoryViewSelection');
    const exportBtn = document.getElementById('btnHistoryExportSelection');
    const enabled = historySelectedDates.size > 0;
    if (viewBtn) viewBtn.disabled = !enabled;
    if (exportBtn) exportBtn.disabled = !enabled;
    updateHistorySelectAllToggle();
}

function openProjectHistoryModal() {
    const modal = document.getElementById('projectHistoryModal');
    const listEl = document.getElementById('projectHistoryModalList');
    const summaryEl = document.getElementById('projectHistoryModalSummary');
    if (!modal || !listEl || !summaryEl) return;

    const items = getSelectedHistoryItems();
    const dates = Array.from(historySelectedDates).sort();
    const rangeText = dates.length ? `${dates[0]} ~ ${dates[dates.length - 1]}` : '-';

    summaryEl.textContent = `선택 기간: ${rangeText} · ${items.length}건`;

    if (!items.length) {
        listEl.innerHTML = '<div class="ph-modal-item">선택된 날짜에 이력이 없습니다.</div>';
    } else {
        listEl.innerHTML = items.map(item => renderModalItem(item)).join('');
    }

    modal.classList.add('active');
    bindDetailButtons(listEl);
}

function closeProjectHistoryModal() {
    const modal = document.getElementById('projectHistoryModal');
    if (modal) modal.classList.remove('active');
}

function renderModalItem(item) {
    const dateText = Utils.escapeHtml(item.base_date || '-');
    const projectName = Utils.escapeHtml(item.project_name || '-');
    const managerName = Utils.escapeHtml(item.manager_name || item.manager_id || '-');
    const orgName = Utils.escapeHtml(item.org_name || item.org_id || '-');
    const fieldName = Utils.escapeHtml(item.field_name || item.field_code || '-');
    const serviceName = Utils.escapeHtml(item.service_name || item.service_code || '-');
    const customerName = Utils.escapeHtml(item.customer_name || item.customer_id || '-');
    const stage = Utils.escapeHtml(item.stage_name || item.progress_stage || '-');
    const activityName = Utils.escapeHtml(item.activity_type_name || getActivityTypeName(item.activity_type) || '-');
    const activityColor = getActivityTypeColor(item.activity_type);
    const content = Utils.escapeHtml(Utils.truncate(item.strategy_content || '-', 120));

    return `
        <div class="ph-modal-item">
            <h4>${dateText} · ${projectName}</h4>
            <div class="ph-modal-meta">
                <span class="ph-activity-chip" style="--chip-color:${activityColor};">${activityName}</span>
                ${stage} · ${fieldName} · ${serviceName}
            </div>
            <div class="ph-modal-meta">고객 ${customerName} · 담당자 ${managerName} · 조직 ${orgName}</div>
            <div class="ph-modal-meta">${content}</div>
            <div class="ph-modal-actions">
                <button class="btn btn-secondary ph-detail-btn" data-pipeline-id="${Utils.escapeHtml(item.pipeline_id || '')}">상세 보기</button>
            </div>
        </div>
    `;
}

function getSelectedHistoryItems() {
    if (!historySelectedDates.size) return [];
    const items = [];
    historySelectedDates.forEach(dateStr => {
        (historyDateIndex[dateStr] || []).forEach(item => items.push(item));
    });
    return items.sort(compareHistoryItems);
}

function exportSelectedHistoryToExcel() {
    const items = getSelectedHistoryItems();
    if (!items.length) return;

    if (typeof XLSX === 'undefined') {
        alert('엑셀 다운로드를 위해 XLSX 라이브러리가 필요합니다.');
        return;
    }

    const dates = Array.from(historySelectedDates).sort();
    const startDate = dates[0] || '';
    const endDate = dates[dates.length - 1] || '';

    const header = [
        '파이프라인ID', '분야', '서비스', '프로젝트명', '고객명',
        '담당자', '조직', '기준일자', '활동유형', '전략내용',
        '생성일', '수정일', '생성자', '수정자'
    ];

    const rows = items.map(item => ([
        sanitizeExcelValue(item.pipeline_id || ''),
        sanitizeExcelValue(item.field_code || ''),
        sanitizeExcelValue(item.service_code || ''),
        sanitizeExcelValue(item.project_name || ''),
        sanitizeExcelValue(item.customer_name || ''),
        sanitizeExcelValue(item.manager_name || item.manager_id || ''),
        sanitizeExcelValue(item.org_name || item.org_id || ''),
        sanitizeExcelValue(item.base_date || ''),
        sanitizeExcelValue(item.activity_type_name || getActivityTypeName(item.activity_type) || ''),
        sanitizeExcelValue(item.strategy_content || ''),
        sanitizeExcelValue(formatDateTimeValue(item.created_at)),
        sanitizeExcelValue(formatDateTimeValue(item.updated_at)),
        sanitizeExcelValue(item.created_by || ''),
        sanitizeExcelValue(item.updated_by || '')
    ]));

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    let sheetName = `History Report(from ${startDate} to ${endDate})`;
    if (sheetName.length > 31) sheetName = sheetName.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `history_report_${startDate}_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

function openHistoryDetailFromEvent(item) {
    const pipelineId = (typeof item === 'string') ? item : item?.pipeline_id;
    if (!pipelineId) return;
    const modal = document.getElementById('projectModal');
    if (modal) {
        modal.classList.add('modal-front');
    }
    if (typeof openProjectDetail === 'function') {
        openProjectDetail(pipelineId);
        setTimeout(() => {
            if (typeof activateDetailTab === 'function') {
                activateDetailTab('history');
            }
        }, 300);
    }
}

function bindDetailButtons(container) {
    if (!container) return;
    container.querySelectorAll('.ph-detail-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', (evt) => {
            evt.stopPropagation();
            const pipelineId = btn.dataset.pipelineId || '';
            openHistoryDetailFromEvent(pipelineId);
        });
    });
}

function getStageColor(stageCode) {
    if (typeof StageIcons !== 'undefined') {
        return StageIcons.getColor(stageCode);
    }
    return '#94a3b8';
}

function renderStageDot(stageCode) {
    const color = getStageColor(stageCode);
    return `<span class="ph-icon stage" style="background: ${color};"></span>`;
}

function getActivityTypeColor(typeCode) {
    if (!typeCode) return HISTORY_ACTIVITY_TYPE_COLOR_MAP.UNKNOWN;
    return HISTORY_ACTIVITY_TYPE_COLOR_MAP[typeCode] || HISTORY_ACTIVITY_TYPE_COLOR_MAP.UNKNOWN;
}

function getActivityTypeName(typeCode) {
    if (!typeCode) return '';
    const match = historyActivityTypeOptions.find(opt => opt.activity_type === typeCode);
    return match ? match.activity_type_name : typeCode;
}

function getComboColor(item) {
    const key = [
        item.field_code || '',
        item.service_code || '',
        item.manager_id || '',
        item.org_id || ''
    ].join('|');
    return colorFromString(key || 'default');
}

function colorFromString(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % HISTORY_COLOR_SET.length;
    return HISTORY_COLOR_SET[idx];
}

function formatDateInput(dateObj) {
    if (!(dateObj instanceof Date)) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateTimeValue(value) {
    if (!value) return '';
    if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        const hh = String(value.getHours()).padStart(2, '0');
        const mm = String(value.getMinutes()).padStart(2, '0');
        const ss = String(value.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
    let s = String(value).trim();
    if (!s) return '';
    if (s.includes('T')) s = s.replace('T', ' ');
    s = s.replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/, '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return `${s}:00`;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19);
    return s;
}

function sanitizeExcelValue(value) {
    if (value === null || typeof value === 'undefined') return '';
    const text = String(value);
    return text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/[\uFFFE\uFFFF]/g, '')
        .replace(/[\uD800-\uDFFF]/g, '');
}

function parseDateInput(dateStr) {
    if (!dateStr) return new Date();
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateWithWeekday(dateStr) {
    const date = parseDateInput(dateStr);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const dayLabel = weekdays[date.getDay()] || '';
    return `${formatDateInput(date)} (${dayLabel})`;
}

function getWeekdayName(dayIndex) {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return weekdays[dayIndex] || '';
}

function updateHistoryNavRight() {
    const nav = document.getElementById('historyNavRight');
    if (!nav) return;
    if (historyActiveView !== 'daily') {
        nav.innerHTML = '';
        return;
    }
    nav.innerHTML = `<input type="date" id="historyDailyPickerTop" class="form-input" value="${historyDailyDate}">`;
    const picker = document.getElementById('historyDailyPickerTop');
    if (picker) {
        picker.addEventListener('change', () => {
            historyDailyDate = picker.value;
            loadHistoryCalendarData();
        });
    }
}

function initializeHistoryTooltip() {
    if (historyTooltipInitialized) return;
    const page = document.getElementById('page-project-history-calendar');
    const tooltip = document.getElementById('historyTooltip');
    if (!page || !tooltip) return;
    historyTooltipInitialized = true;

    page.addEventListener('mouseover', (evt) => {
        if (!historyTooltipEnabled) return;
        const target = evt.target?.closest?.('[data-ph-tooltip]');
        if (!target) return;
        if (historyTooltipTarget === target) return;
        historyTooltipTarget = target;
        showHistoryTooltip(target, evt.clientX, evt.clientY);
    });

    page.addEventListener('mousemove', (evt) => {
        if (!historyTooltipEnabled) return;
        if (!historyTooltipTarget) return;
        positionHistoryTooltip(evt.clientX, evt.clientY);
    });

    page.addEventListener('mouseout', (evt) => {
        if (!historyTooltipEnabled) return;
        const target = evt.target?.closest?.('[data-ph-tooltip]');
        if (!target || target !== historyTooltipTarget) return;
        const related = evt.relatedTarget;
        if (related && (related === tooltip || tooltip.contains(related))) return;
        if (related && related.closest && related.closest('[data-ph-tooltip]') === historyTooltipTarget) return;
        hideHistoryTooltip();
        historyTooltipTarget = null;
    });
}

function setHistoryTooltip(el, text) {
    if (!el) return;
    if (!historyTooltipEnabled) {
        el.removeAttribute('data-ph-tooltip');
        return;
    }
    if (!text) {
        el.removeAttribute('data-ph-tooltip');
        return;
    }
    el.setAttribute('data-ph-tooltip', text);
    el.removeAttribute('title');
}

function showHistoryTooltip(target, x, y) {
    if (!historyTooltipEnabled) return;
    const tooltip = document.getElementById('historyTooltip');
    if (!tooltip || !target) return;
    const text = target.getAttribute('data-ph-tooltip') || '';
    if (!text) return;
    tooltip.innerHTML = buildTooltipHtml(text);
    tooltip.classList.add('active');
    tooltip.setAttribute('aria-hidden', 'false');
    positionHistoryTooltip(x, y);
}

function hideHistoryTooltip() {
    const tooltip = document.getElementById('historyTooltip');
    if (!tooltip) return;
    tooltip.classList.remove('active');
    tooltip.setAttribute('aria-hidden', 'true');
}

function clearHistoryTooltipAttributes() {
    const page = document.getElementById('page-project-history-calendar');
    if (!page) return;
    page.querySelectorAll('[data-ph-tooltip]').forEach(el => {
        el.removeAttribute('data-ph-tooltip');
    });
}

function positionHistoryTooltip(clientX, clientY) {
    const tooltip = document.getElementById('historyTooltip');
    if (!tooltip) return;
    const offsetX = 14;
    const offsetY = 18;
    const padding = 12;

    let left = clientX + offsetX;
    let top = clientY + offsetY;

    const rect = tooltip.getBoundingClientRect();
    if (left + rect.width + padding > window.innerWidth) {
        left = clientX - rect.width - offsetX;
    }
    if (top + rect.height + padding > window.innerHeight) {
        top = clientY - rect.height - offsetY;
    }
    tooltip.style.left = Math.max(padding, left) + 'px';
    tooltip.style.top = Math.max(padding, top) + 'px';
}

function buildTooltipHtml(text) {
    const lines = String(text).split('\n');
    const parts = [];
    let firstLineApplied = false;
    lines.forEach(line => {
        if (line === '') {
            parts.push('<div class="ph-tooltip-gap"></div>');
            firstLineApplied = false;
            return;
        }
        const safe = Utils.escapeHtml(line);
        if (!firstLineApplied) {
            parts.push(`<div class="ph-tooltip-title">${safe}</div>`);
            firstLineApplied = true;
            return;
        }
        parts.push(`<div class="ph-tooltip-line">${safe}</div>`);
    });
    return parts.join('');
}

function updateHistoryLegend() {
    const stageDots = document.getElementById('legendStageDots');
    const comboDots = document.getElementById('legendComboDots');
    const activityDots = document.getElementById('legendActivityDots');
    if (!stageDots || !comboDots) return;

    const stageSet = new Set();
    const comboSet = new Set();

    historyCalendarData.forEach(item => {
        const stageColor = getStageColor(item.progress_stage);
        if (stageColor) stageSet.add(stageColor);
        const comboColor = getComboColor(item);
        if (comboColor) comboSet.add(comboColor);
    });

    const stageColors = Array.from(stageSet).slice(0, 4);
    const comboColors = Array.from(comboSet).slice(0, 4);

    if (!stageColors.length) stageColors.push('#94a3b8');
    if (!comboColors.length) comboColors.push('#94a3b8');

    stageDots.innerHTML = stageColors
        .map(color => `<span class="ph-icon stage" style="background:${color};"></span>`)
        .join('');
    comboDots.innerHTML = comboColors
        .map(color => `<span class="ph-icon" style="background:${color};"></span>`)
        .join('');

    if (activityDots) {
        const activityItems = historyActivityTypeOptions.length
            ? historyActivityTypeOptions
            : Object.keys(HISTORY_ACTIVITY_TYPE_COLOR_MAP).map(code => ({ activity_type: code, activity_type_name: code }));
        activityDots.innerHTML = activityItems.map(item => {
            const color = getActivityTypeColor(item.activity_type);
            const label = item.activity_type_name || item.activity_type;
            return `<span class="ph-legend-chip"><span class="ph-icon" style="background:${color};"></span>${Utils.escapeHtml(label)}</span>`;
        }).join('');
    }
}

function saveHistorySettings() {
    if (historyRestoringState) return;
    const state = {
        view: historyActiveView,
        year: document.getElementById('historyYearSelect')?.value || '',
        yearLayout: document.getElementById('historyYearLayout')?.value || '',
        monthOrder: document.getElementById('historyMonthOrder')?.value || '',
        monthSlot: document.getElementById('historyMonthSlot')?.value || '',
        tooltip: historyTooltipEnabled,
        filters: {
            field: getMultiSelectValues('historyFilterField'),
            service: getMultiSelectValues('historyFilterService'),
            activity: getMultiSelectValues('historyFilterActivityType'),
            manager: getMultiSelectValues('historyFilterManager'),
            org: getMultiSelectValues('historyFilterOrg')
        },
        project: {
            keyword: document.getElementById('historyProjectSearch')?.value || '',
            selected: historyProjectSelected || '__ALL__'
        },
        sortOrder: normalizeHistorySortOrder(historySortOrder),
        weekStartDay: normalizeHistoryWeekStartDay(historyWeekStartDay),
        weekRange: {
            from: historyWeekCustomRange.start || '',
            to: historyWeekCustomRange.end || ''
        },
        anchors: {
            month: historyMonthAnchorDate ? formatDateInput(historyMonthAnchorDate) : '',
            week: historyWeekAnchorDate ? formatDateInput(historyWeekAnchorDate) : '',
            daily: historyDailyDate || ''
        }
    };
    try {
        localStorage.setItem(HISTORY_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('⚠️ 진행상황 설정 저장 실패:', error);
    }
}

function loadHistorySettings() {
    try {
        const raw = localStorage.getItem(HISTORY_STATE_KEY);
        if (!raw) return false;
        const state = JSON.parse(raw);
        if (!state || typeof state !== 'object') return false;
        historySavedState = state;

        if (state.view) historyActiveView = state.view;
        if (typeof state.tooltip === 'boolean') historyTooltipEnabled = state.tooltip;
        if (state.sortOrder) historySortOrder = normalizeHistorySortOrder(state.sortOrder);
        if (typeof state.weekStartDay !== 'undefined') {
            historyWeekStartDay = normalizeHistoryWeekStartDay(state.weekStartDay);
        }
        if (state.weekRange && (state.weekRange.from || state.weekRange.to)) {
            historyWeekCustomRange = {
                start: state.weekRange.from || '',
                end: state.weekRange.to || ''
            };
        }
        if (state.year) {
            const year = Number(state.year);
            if (!Number.isNaN(year)) setHistoryYearAnchor(year);
        }
        const layoutSelect = document.getElementById('historyYearLayout');
        if (layoutSelect && state.yearLayout) layoutSelect.value = state.yearLayout;
        const orderSelect = document.getElementById('historyMonthOrder');
        if (orderSelect && state.monthOrder) orderSelect.value = state.monthOrder;
        const slotInput = document.getElementById('historyMonthSlot');
        if (slotInput && state.monthSlot) slotInput.value = state.monthSlot;
        const tooltipToggle = document.getElementById('historyTooltipToggle');
        if (tooltipToggle) tooltipToggle.checked = historyTooltipEnabled;
        if (state.anchors?.month) historyMonthAnchorDate = parseDateInput(state.anchors.month);
        if (state.anchors?.week) historyWeekAnchorDate = parseDateInput(state.anchors.week);
        if (state.anchors?.daily) historyDailyDate = state.anchors.daily;

        if (isHistoryWeekCustomRangeActive()) {
            historyWeekAnchorDate = parseDateInput(historyWeekCustomRange.start);
            historyMonthAnchorDate = new Date(historyWeekAnchorDate);
        }

        const projectSearch = document.getElementById('historyProjectSearch');
        if (projectSearch && state.project?.keyword) {
            projectSearch.value = state.project.keyword;
        }
        if (state.project?.selected) historyProjectSelected = state.project.selected;

        return true;
    } catch (error) {
        console.warn('⚠️ 진행상황 설정 불러오기 실패:', error);
        return false;
    }
}

function applyHistorySavedFilters() {
    if (!historySavedState || !historySavedState.filters) return;
    applyMultiSelectValues('historyFilterField', historySavedState.filters.field || []);
    applyMultiSelectValues('historyFilterService', historySavedState.filters.service || []);
    applyMultiSelectValues('historyFilterActivityType', historySavedState.filters.activity || []);
    applyMultiSelectValues('historyFilterManager', historySavedState.filters.manager || []);
    applyMultiSelectValues('historyFilterOrg', historySavedState.filters.org || []);
}

function applyMultiSelectValues(selectId, values) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const valueSet = new Set(values || []);
    let matched = false;
    Array.from(select.options).forEach(opt => {
        if (opt.value === '__ALL__') {
            opt.selected = valueSet.size === 0;
        } else if (valueSet.has(opt.value)) {
            opt.selected = true;
            matched = true;
        } else {
            opt.selected = false;
        }
    });
    if (valueSet.size > 0 && !matched && select.options.length) {
        select.options[0].selected = true;
    }
}

function finalizeHistoryRestore() {
    if (!historyRestoringState) return;
    if (!historyRestoreStatus.filters || !historyRestoreStatus.projects) return;
    historyRestoringState = false;
    loadHistoryCalendarData();
}

async function ensureHolidayDataForRange(range) {
    if (!range || !range.start || !range.end) return;
    const startYear = parseDateInput(range.start).getFullYear();
    const endYear = parseDateInput(range.end).getFullYear();
    for (let year = startYear; year <= endYear; year += 1) {
        await loadHolidayData(year);
    }
}

async function loadHolidayData(year) {
    if (!year || historyHolidayYears.has(year)) return;
    historyHolidayYears.add(year);
    try {
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
        if (!response.ok) throw new Error(`Holiday API ${response.status}`);
        const data = await response.json();
        data.forEach(item => {
            if (item && item.date) {
                const name = item.localName || item.name || '공휴일';
                if (!historyHolidayIndex[item.date]) {
                    historyHolidayIndex[item.date] = { names: [] };
                }
                const entry = historyHolidayIndex[item.date];
                if (entry && !entry.names.includes(name)) {
                    entry.names.push(name);
                }
            }
        });
    } catch (error) {
        console.warn('⚠️ 공휴일 정보를 불러오지 못했습니다.', error);
        historyHolidayYears.delete(year);
    }
}

function getHolidayLabel(dateStr) {
    const entry = historyHolidayIndex[dateStr];
    if (!entry || !Array.isArray(entry.names) || !entry.names.length) return '';
    return entry.names.join(', ');
}

function getHistoryDateList() {
    return Object.keys(historyDateIndex || {})
        .filter(key => (historyDateIndex[key] || []).length > 0)
        .sort();
}

function findAdjacentHistoryDate(current, direction, dateList) {
    if (!dateList || dateList.length === 0) return null;
    const cur = current || '';
    const idx = dateList.indexOf(cur);
    if (idx >= 0) {
        const nextIdx = idx + direction;
        if (nextIdx >= 0 && nextIdx < dateList.length) return dateList[nextIdx];
        return null;
    }
    if (direction > 0) {
        return dateList.find(date => date > cur) || null;
    }
    for (let i = dateList.length - 1; i >= 0; i -= 1) {
        if (dateList[i] < cur) return dateList[i];
    }
    return null;
}

async function shiftDailyToNextHistoryMonth(direction) {
    let base = historyDailyDate ? parseDateInput(historyDailyDate) : new Date();
    base = new Date(base.getFullYear(), base.getMonth() + direction, 1);

    for (let i = 0; i < 24; i += 1) {
        historyDailyDate = formatDateInput(base);
        await loadHistoryCalendarData();
        const dates = getHistoryDateList();
        if (dates.length) {
            historyDailyDate = direction > 0 ? dates[0] : dates[dates.length - 1];
            renderHistoryDailyView();
            return;
        }
        base = new Date(base.getFullYear(), base.getMonth() + direction, 1);
    }
}

function updateHistoryPeriodLabel() {
    const label = document.getElementById('historyPeriodLabel');
    if (!label) return;

    const today = new Date();

    if (historyActiveView === 'year') {
        const yearSelect = document.getElementById('historyYearSelect');
        const year = Number(yearSelect?.value || today.getFullYear());
        label.textContent = `${year}년`;
        return;
    }

    if (historyActiveView === 'month') {
        const base = historyCalendarInstance?.getDate?.() || historyMonthAnchorDate || today;
        label.textContent = `${base.getFullYear()}년 ${base.getMonth() + 1}월`;
        return;
    }

    if (historyActiveView === 'week') {
        const range = getHistoryWeekRange();
        if (range) {
            const rangeHint = range.source === 'custom'
                ? '맞춤 기간'
                : `${getWeekdayName(normalizeHistoryWeekStartDay(historyWeekStartDay))} 시작`;
            label.innerHTML = `${range.start} ~ ${range.end} <span class="ph-period-sub">${rangeHint}</span>`;
        } else {
            label.textContent = '-';
        }
        return;
    }

    if (historyActiveView === 'daily') {
        const base = historyDailyDate ? new Date(historyDailyDate) : today;
        label.textContent = formatDateInput(base);
        return;
    }

    label.textContent = '-';
}

// expose initializer for navigation.js
window.initializeProjectHistoryCalendar = initializeProjectHistoryCalendar;

function getWeekOfMonth(dateObj) {
    const first = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const offset = first.getDay(); // Sunday start
    return Math.ceil((dateObj.getDate() + offset) / 7);
}

function getWeekOfYear(dateObj) {
    const start = new Date(dateObj.getFullYear(), 0, 1);
    const diffDays = Math.floor((dateObj - start) / 86400000) + 1;
    const offset = start.getDay();
    return Math.ceil((diffDays + offset) / 7);
}

function getTotalWeeksInYear(year) {
    const last = new Date(year, 11, 31);
    return getWeekOfYear(last);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProjectHistoryCalendar);
} else {
    initializeProjectHistoryCalendar();
}

window.initializeProjectHistoryCalendar = initializeProjectHistoryCalendar;
window.closeProjectHistoryModal = closeProjectHistoryModal;
