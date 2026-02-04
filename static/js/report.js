// ===================================
// static/js/report.js
// Report Builder UI
// ===================================

let reportTable = null;
let lastReportResponse = null;

function getCurrentLoginId() {
    if (typeof AUTH !== 'undefined' && typeof AUTH.getUserInfo === 'function') {
        const info = AUTH.getUserInfo();
        return info?.login_id || info?.loginId || info?.user_id || 'system';
    }
    return 'system';
}

function getReportLayoutStorageKey() {
    return `psms.report.layout.${getCurrentLoginId()}`;
}

function loadReportLayout() {
    try {
        const raw = localStorage.getItem(getReportLayoutStorageKey());
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('⚠️ Report 레이아웃 로드 실패:', error);
        return null;
    }
}

function saveReportLayout(partial) {
    try {
        const current = loadReportLayout() || {};
        const next = { ...current, ...partial };
        localStorage.setItem(getReportLayoutStorageKey(), JSON.stringify(next));
    } catch (error) {
        console.warn('⚠️ Report 레이아웃 저장 실패:', error);
    }
}

function formatNumber(value) {
    if (typeof Utils !== 'undefined' && Utils.formatNumber) {
        return Utils.formatNumber(value || 0);
    }
    return Number(value || 0).toLocaleString('ko-KR');
}

function getPeriodMeta(period) {
    if (period === 'quarter') {
        return {
            type: 'quarter',
            keys: ['q1', 'q2', 'q3', 'q4'],
            labels: ['Q1', 'Q2', 'Q3', 'Q4']
        };
    }
    if (period === 'month') {
        const keys = [];
        const labels = [];
        for (let i = 1; i <= 12; i += 1) {
            const key = `m${String(i).padStart(2, '0')}`;
            keys.push(key);
            labels.push(`${i}월`);
        }
        return { type: 'month', keys, labels };
    }
    return null;
}

function getMetricCatalog() {
    return [
        { key: 'plan', suffix: '', label: '계획' },
        { key: 'order', suffix: '_order', label: '수주' },
        { key: 'ratio', suffix: '_ratio', label: '계획비' },
        { key: 'profit', suffix: '_profit', label: '이익' }
    ];
}

function buildPeriodGroupedMetricColumns(metricColumns, period, headerMode, includeSummary) {
    const periodMeta = getPeriodMeta(period);
    if (!periodMeta) {
        return { columns: formatReportMetricColumns(metricColumns), summaryFields: [] };
    }

    const fieldMap = new Map(metricColumns.map(col => [col.field, col]));
    const metricCatalog = getMetricCatalog();
    const periodGroups = [];

    periodMeta.keys.forEach((key, index) => {
        const label = periodMeta.labels[index] || key.toUpperCase();
        const periodCols = [];
        metricCatalog.forEach(metric => {
            const field = `${key}${metric.suffix}`;
            if (!fieldMap.has(field)) return;
            periodCols.push({
                ...fieldMap.get(field),
                title: headerMode === 'two' ? metric.label : `${label} ${metric.label}`
            });
        });
        if (!periodCols.length) return;
        periodGroups.push({
            title: label,
            columns: formatReportMetricColumns(periodCols)
        });
    });

    const summaryFields = [];
    const summaryColumns = [];
    if (includeSummary) {
        metricCatalog.forEach(metric => {
            const hasMetric = periodMeta.keys.some(key => fieldMap.has(`${key}${metric.suffix}`));
            if (!hasMetric) return;
            const sumField = `sum_${metric.key}`;
            summaryFields.push(sumField);
            summaryColumns.push({
                title: headerMode === 'two' ? metric.label : `합계 ${metric.label}`,
                field: sumField,
                hozAlign: 'right'
            });
        });
    }

    if (includeSummary && summaryColumns.length) {
        if (headerMode === 'two') {
            periodGroups.push({
                title: '합계',
                titleFormatter: () => `<span class="report-group-title report-group-total">합계</span>`,
                columns: formatReportMetricColumns(summaryColumns)
            });
        } else {
            return {
                columns: [...formatReportMetricColumns(metricColumns), ...formatReportMetricColumns(summaryColumns)],
                summaryFields
            };
        }
    }

    return { columns: periodGroups, summaryFields };
}

function applyPeriodSummary(items, metricColumns, period) {
    const periodMeta = getPeriodMeta(period);
    if (!periodMeta) return items || [];
    const fieldSet = new Set(metricColumns.map(col => col.field));
    const metricCatalog = getMetricCatalog();
    const planFields = periodMeta.keys.filter(key => fieldSet.has(key));
    const orderFields = periodMeta.keys.filter(key => fieldSet.has(`${key}_order`)).map(key => `${key}_order`);
    const profitFields = periodMeta.keys.filter(key => fieldSet.has(`${key}_profit`)).map(key => `${key}_profit`);
    const ratioExists = periodMeta.keys.some(key => fieldSet.has(`${key}_ratio`));

    return (items || []).map(row => {
        const next = { ...row };
        const sumPlan = planFields.reduce((acc, field) => acc + Number(next[field] || 0), 0);
        const sumOrder = orderFields.reduce((acc, field) => acc + Number(next[field] || 0), 0);
        const sumProfit = profitFields.reduce((acc, field) => acc + Number(next[field] || 0), 0);

        metricCatalog.forEach(metric => {
            const hasMetric = periodMeta.keys.some(key => fieldSet.has(`${key}${metric.suffix}`));
            if (!hasMetric) return;
            if (metric.key === 'plan') next.sum_plan = sumPlan;
            if (metric.key === 'order') next.sum_order = sumOrder;
            if (metric.key === 'profit') next.sum_profit = sumProfit;
            if (metric.key === 'ratio' && ratioExists) {
                next.sum_ratio = sumPlan ? (sumOrder / sumPlan) : null;
            }
        });

        return next;
    });
}

function populateReportYears() {
    const select = document.getElementById('reportYear');
    if (!select) return;
    const currentYear = new Date().getFullYear();
    const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    select.innerHTML = '';
    years.forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year;
        if (year === currentYear) opt.selected = true;
        select.appendChild(opt);
    });
}

function formatReportMetricColumns(columns) {
    return columns.map(col => {
        const isRatio = col.field.includes('ratio');
        const metricType = getReportMetricType(col.field);
        return {
            ...col,
            hozAlign: 'right',
            minWidth: col.minWidth || 120,
            titleFormatter: () => `<span class="report-header report-header-${metricType}">${col.title}</span>`,
            formatter: (cell) => {
                const val = cell.getValue();
                if (val === null || val === undefined || val === '') return '-';
                if (isRatio) return `${(Number(val) * 100).toFixed(1)}%`;
                return formatNumber(val);
            }
        };
    });
}

function getReportMetricType(field) {
    if (!field) return 'plan';
    if (field.includes('ratio')) return 'ratio';
    if (field.includes('profit')) return 'profit';
    if (field.includes('order')) return 'order';
    return 'plan';
}

function getSelectedOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    return Array.from(select.selectedOptions || []).map(option => ({
        value: option.value,
        label: option.textContent
    })).filter(item => item.value);
}

function getReportTargetFilters() {
    return {
        orgs: getSelectedOptions('reportFilterOrg'),
        managers: getSelectedOptions('reportFilterManager')
    };
}

function buildTargetNameMaps(filters) {
    const orgMap = {};
    const managerMap = {};
    (filters?.orgs || []).forEach(item => {
        orgMap[item.value] = item.label;
    });
    (filters?.managers || []).forEach(item => {
        managerMap[item.value] = item.label;
    });
    return { orgMap, managerMap };
}

function normalizeReportTargets(targets, filters) {
    const { orgMap, managerMap } = buildTargetNameMaps(filters);
    return (targets || []).map(target => {
        if (target.type === 'org' && orgMap[target.id]) {
            return { ...target, name: orgMap[target.id] };
        }
        if (target.type === 'manager' && managerMap[target.id]) {
            return { ...target, name: managerMap[target.id] };
        }
        if (target.type === 'all') {
            return { ...target, name: '전체' };
        }
        if (typeof target.name === 'string' && target.name.includes(':')) {
            const [, name] = target.name.split(':');
            const trimmed = (name || '').trim();
            if (trimmed) {
                return { ...target, name: trimmed };
            }
        }
        return target;
    });
}

function normalizeReportItems(items, filters) {
    const { orgMap, managerMap } = buildTargetNameMaps(filters);
    return (items || []).map(item => {
        if (item.target_type === 'org' && orgMap[item.target_id]) {
            return { ...item, target_name: orgMap[item.target_id] };
        }
        if (item.target_type === 'manager' && managerMap[item.target_id]) {
            return { ...item, target_name: managerMap[item.target_id] };
        }
        if (item.target_type === 'all') {
            return { ...item, target_name: '전체' };
        }
        if (typeof item.target_name === 'string' && item.target_name.includes(':')) {
            const parts = item.target_name.split(':');
            const trimmed = (parts[1] || '').trim();
            if (item.target_type === 'org' && orgMap[trimmed]) {
                return { ...item, target_name: orgMap[trimmed] };
            }
            if (item.target_type === 'manager' && managerMap[trimmed]) {
                return { ...item, target_name: managerMap[trimmed] };
            }
            if (trimmed) {
                return { ...item, target_name: trimmed };
            }
        }
        return item;
    });
}

function buildReportTargetSummary(filters) {
    const parts = [];
    if (filters.orgs.length) {
        parts.push(`조직 ${filters.orgs.map(item => item.label).join(', ')}`);
    }
    if (filters.managers.length) {
        parts.push(`담당자 ${filters.managers.map(item => item.label).join(', ')}`);
    }
    return parts.length ? parts.join(' / ') : '전체';
}

function buildReportTitle(meta) {
    const sourceLabel = {plan: '영업계획', actual: '실적', gap: '계획 대비 실적'}[meta.source] || meta.source;
    const dimensionLabel = {org: '조직', manager: '담당자', field: '분야', service: '서비스', customer: '고객사', pipeline: '프로젝트'}[meta.dimension] || meta.dimension;
    const periodLabel = {year: '연도', quarter: '분기', month: '월'}[meta.period] || meta.period;
    const metricLabel = {order: '수주', profit: '매출이익', both: '수주+이익'}[meta.metric] || meta.metric;
    return `${meta.year} ${sourceLabel} | 집계 기준: ${dimensionLabel} | 기간: ${periodLabel} | 지표: ${metricLabel} | 대상: ${meta.targetSummary}`;
}

function getReportBaseColumns() {
    return [
        {
            title: 'No',
            field: '__seq',
            hozAlign: 'center',
            headerSort: false,
            width: 60,
            frozen: true,
            formatter: (cell) => {
                const data = cell.getRow().getData();
                return data.row_type ? '' : (data.__seq || '');
            }
        },
        {
            title: '집계대상',
            field: 'target_name',
            minWidth: 200,
            frozen: true
        },
        {
            title: '구분',
            field: 'group_name',
            minWidth: 200,
            frozen: true
        }
    ];
}

function buildReportColumns(metricColumns, headerMode, headerTitle) {
    const baseColumns = getReportBaseColumns();

    const formattedMetrics = formatReportMetricColumns(metricColumns);
    if (headerMode === 'two') {
        baseColumns.push({
            title: headerTitle || '필터링 대상',
            titleFormatter: () => `<span class="report-group-title">${headerTitle || '필터링 대상'}</span>`,
            columns: formattedMetrics
        });
    } else {
        baseColumns.push(...formattedMetrics);
    }
    return baseColumns;
}

function buildRowColumns(metricColumns, meta) {
    const period = meta?.period || 'year';
    const headerMode = meta?.headerMode || 'two';
    const targetSummary = meta?.targetSummary || '전체';
    const headerTitle = headerMode === 'two' ? `필터링 대상: ${targetSummary}` : '';

    if (period !== 'year') {
        const baseColumns = getReportBaseColumns();
        const { columns: periodColumns } = buildPeriodGroupedMetricColumns(
            metricColumns,
            period,
            headerMode,
            true
        );
        if (headerMode === 'two') {
            baseColumns.push(...periodColumns);
        } else {
            baseColumns.push(...periodColumns);
        }
        return baseColumns;
    }

    return buildReportColumns(metricColumns, headerMode, headerTitle);
}

function getRatioBaseFields(field) {
    if (field === 'ratio') {
        return { plan: 'plan_total', order: 'order_total' };
    }
    if (field.endsWith('_ratio')) {
        const base = field.replace('_ratio', '');
        return { plan: base, order: `${base}_order` };
    }
    return null;
}

function buildPivotColumns(metricColumns, targets, headerMode) {
    const baseColumns = [
        {
            title: 'No',
            field: '__seq',
            hozAlign: 'center',
            headerSort: false,
            width: 60,
            frozen: true,
            formatter: (cell) => {
                const data = cell.getRow().getData();
                return data.row_type ? '' : (data.__seq || '');
            }
        },
        {
            title: '구분',
            field: 'group_name',
            minWidth: 200,
            frozen: true
        }
    ];

    const formattedMetrics = formatReportMetricColumns(metricColumns);

    const buildMetricCols = (prefix, includeTitle) => {
        return formattedMetrics.map(col => {
            if (includeTitle) {
                return {
                    ...col,
                    title: `${prefix} ${col.title}`,
                    field: `${prefix}_${col.field}`
                };
            }
            return {
                ...col,
                field: `${prefix}_${col.field}`
            };
        });
    };

    if (headerMode === 'one') {
        const totalCols = formattedMetrics.map(col => ({
            ...col,
            title: `합계 ${col.title}`,
            field: `total_${col.field}`
        }));
        baseColumns.push(...totalCols);
        (targets || []).forEach((target, index) => {
            const prefix = `t${index + 1}`;
            const titlePrefix = target.name || target.id || `대상${index + 1}`;
            baseColumns.push(...buildMetricCols(titlePrefix, true));
        });
        return baseColumns;
    }

    baseColumns.push({
        title: '합계',
        titleFormatter: () => `<span class="report-group-title report-group-total">합계</span>`,
        columns: formattedMetrics.map(col => ({
            ...col,
            field: `total_${col.field}`
        }))
    });

    (targets || []).forEach((target, index) => {
        const prefix = `t${index + 1}`;
        const title = target.name || target.id || `대상${index + 1}`;
        baseColumns.push({
            title,
            titleFormatter: () => `<span class="report-group-title report-group-target">${title}</span>`,
            columns: formattedMetrics.map(col => ({
                ...col,
                field: `${prefix}_${col.field}`
            }))
        });
    });
    return baseColumns;
}

function buildPivotReportData(items, metricFields, targets) {
    const detailRows = (items || []).filter(item => !item.row_type);
    const targetList = targets && targets.length ? targets : [{ name: '전체' }];
    const targetPrefixes = targetList.map((_, index) => `t${index + 1}`);

    const ratioFields = metricFields.filter(field => field.includes('ratio'));
    const nonRatioFields = metricFields.filter(field => !field.includes('ratio'));
    const ratioBaseMap = {};
    ratioFields.forEach(field => {
        ratioBaseMap[field] = getRatioBaseFields(field);
    });

    const rowOrder = [];
    const rowMap = new Map();

    detailRows.forEach(item => {
        const groupName = item.group_name || '-';
        if (!rowMap.has(groupName)) {
            rowMap.set(groupName, { group_name: groupName });
            rowOrder.push(groupName);
        }
        const row = rowMap.get(groupName);
        const targetIndex = targetList.findIndex(target => target.name === item.target_name || target.id === item.target_id);
        const prefix = targetPrefixes[targetIndex >= 0 ? targetIndex : 0];
        metricFields.forEach(field => {
            const fieldKey = `${prefix}_${field}`;
            if (item[field] !== undefined) {
                row[fieldKey] = item[field];
            }
        });
    });

    rowOrder.forEach(groupName => {
        const row = rowMap.get(groupName);
        nonRatioFields.forEach(field => {
            let sum = 0;
            targetPrefixes.forEach(prefix => {
                sum += Number(row[`${prefix}_${field}`] || 0);
            });
            row[`total_${field}`] = sum;
        });
        ratioFields.forEach(field => {
            const base = ratioBaseMap[field];
            if (!base) return;
            const planVal = Number(row[`total_${base.plan}`] || 0);
            const orderVal = Number(row[`total_${base.order}`] || 0);
            row[`total_${field}`] = planVal ? (orderVal / planVal) : null;
        });
        targetPrefixes.forEach(prefix => {
            ratioFields.forEach(field => {
                const base = ratioBaseMap[field];
                if (!base) return;
                const planVal = Number(row[`${prefix}_${base.plan}`] || 0);
                const orderVal = Number(row[`${prefix}_${base.order}`] || 0);
                row[`${prefix}_${field}`] = planVal ? (orderVal / planVal) : row[`${prefix}_${field}`] ?? null;
            });
        });
    });

    const data = rowOrder.map(groupName => rowMap.get(groupName));

    const grandRow = { group_name: '총합계', row_type: 'grand_total' };
    nonRatioFields.forEach(field => {
        let sum = 0;
        data.forEach(row => {
            sum += Number(row[`total_${field}`] || 0);
        });
        grandRow[`total_${field}`] = sum;
    });
    targetPrefixes.forEach(prefix => {
        nonRatioFields.forEach(field => {
            let sum = 0;
            data.forEach(row => {
                sum += Number(row[`${prefix}_${field}`] || 0);
            });
            grandRow[`${prefix}_${field}`] = sum;
        });
    });
    ratioFields.forEach(field => {
        const base = ratioBaseMap[field];
        if (!base) return;
        const planVal = Number(grandRow[`total_${base.plan}`] || 0);
        const orderVal = Number(grandRow[`total_${base.order}`] || 0);
        grandRow[`total_${field}`] = planVal ? (orderVal / planVal) : null;
        targetPrefixes.forEach(prefix => {
            const planTarget = Number(grandRow[`${prefix}_${base.plan}`] || 0);
            const orderTarget = Number(grandRow[`${prefix}_${base.order}`] || 0);
            grandRow[`${prefix}_${field}`] = planTarget ? (orderTarget / planTarget) : null;
        });
    });

    const targetSubtotals = targetList.map((target, index) => {
        const prefix = targetPrefixes[index];
        const subtotalRow = {
            group_name: `${target.name || target.id || '대상'} 합계`,
            row_type: 'target_subtotal'
        };
        nonRatioFields.forEach(field => {
            let sum = 0;
            data.forEach(row => {
                sum += Number(row[`${prefix}_${field}`] || 0);
            });
            subtotalRow[`total_${field}`] = sum;
            subtotalRow[`${prefix}_${field}`] = sum;
        });
        ratioFields.forEach(field => {
            const base = ratioBaseMap[field];
            if (!base) return;
            const planVal = Number(subtotalRow[`total_${base.plan}`] || 0);
            const orderVal = Number(subtotalRow[`total_${base.order}`] || 0);
            subtotalRow[`total_${field}`] = planVal ? (orderVal / planVal) : null;
            subtotalRow[`${prefix}_${field}`] = planVal ? (orderVal / planVal) : null;
        });
        return subtotalRow;
    });

    return [...data, ...targetSubtotals, grandRow];
}

function applyReportSeq(items) {
    let seq = 1;
    return (items || []).map(item => {
        if (item.row_type) {
            return { ...item, __seq: '' };
        }
        const next = { ...item, __seq: seq };
        seq += 1;
        return next;
    });
}

function getSampleReportResponse(metric) {
    const base = [
        {group_name: '디지털사업본부', plan_total: 210000000, order_total: 190000000, ratio: 0.9, profit_total: 52000000},
        {group_name: '공공사업본부', plan_total: 140000000, order_total: 120000000, ratio: 0.86, profit_total: 38000000},
        {group_name: '솔루션사업부', plan_total: 90000000, order_total: 75000000, ratio: 0.83, profit_total: 24000000}
    ];
    const targets = [{ name: '전체', id: null }];
    const columns = [
        {title: '구분', field: 'group_name'},
        {title: '계획', field: 'plan_total'},
        {title: '수주', field: 'order_total'},
        {title: '계획비', field: 'ratio'},
        {title: '매출이익', field: 'profit_total'}
    ];
    if (metric === 'order') {
        columns.splice(4, 1);
        columns.splice(3, 1);
    }
    if (metric === 'profit') {
        columns.splice(2, 2);
    }
    const items = base.map(row => ({ ...row, target_name: '전체' }));
    items.push({target_name: '전체', group_name: '합계', row_type: 'subtotal', plan_total: 440000000, order_total: 385000000, ratio: 0.875, profit_total: 114000000});
    items.push({target_name: '총합계', group_name: '총합계', row_type: 'grand_total', plan_total: 440000000, order_total: 385000000, ratio: 0.875, profit_total: 114000000});
    return { columns, items, targets };
}

function injectGroupTotalsRowMode(items, metricFields) {
    const sanitized = (items || []).filter(item => item.row_type !== 'group_total');
    const detailRows = sanitized.filter(item => !item.row_type);
    if (!detailRows.length) return items || [];

    const totals = new Map();
    detailRows.forEach(row => {
        const groupName = row.group_name;
        if (!groupName || groupName === '합계' || groupName === '총합계') return;
        if (!totals.has(groupName)) {
            totals.set(groupName, {});
        }
        const bucket = totals.get(groupName);
        metricFields.forEach(field => {
            if (field.includes('ratio')) return;
            bucket[field] = (bucket[field] || 0) + Number(row[field] || 0);
        });
    });

    const totalRows = [];
    totals.forEach((bucket, groupName) => {
        const row = {
            target_name: '총합계',
            group_name: groupName,
            row_type: 'group_total',
            ...bucket
        };
        metricFields.forEach(field => {
            if (!field.includes('ratio')) return;
            const base = getRatioBaseFields(field);
            if (!base) return;
            const planVal = Number(row[base.plan] || 0);
            const orderVal = Number(row[base.order] || 0);
            row[field] = planVal ? (orderVal / planVal) : null;
        });
        totalRows.push(row);
    });

    if (!totalRows.length) return items || [];

    const grandIndex = (items || []).findIndex(item => item.row_type === 'grand_total');
    if (grandIndex >= 0) {
        return [
            ...sanitized.slice(0, grandIndex),
            ...totalRows,
            ...sanitized.slice(grandIndex)
        ];
    }
    return [...sanitized, ...totalRows];
}

function hasReportFilterOptions() {
    const orgSelect = document.getElementById('reportFilterOrg');
    const managerSelect = document.getElementById('reportFilterManager');
    const orgReady = !orgSelect || (orgSelect.options.length > 0 && orgSelect.options[0].textContent !== '로딩중...');
    const mgrReady = !managerSelect || (managerSelect.options.length > 0 && managerSelect.options[0].textContent !== '로딩중...');
    return orgReady && mgrReady;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureReportFiltersLoaded() {
    const delays = [0, 800, 1600, 2400];
    for (let i = 0; i < delays.length; i += 1) {
        await loadReportFilters();
        if (hasReportFilterOptions()) return;
        if (i < delays.length - 1) {
            await sleep(delays[i + 1]);
        }
    }
}

async function loadReportFilters() {
    const orgSelect = document.getElementById('reportFilterOrg');
    const managerSelect = document.getElementById('reportFilterManager');
    if (!orgSelect && !managerSelect) return;
    if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS) {
        if (orgSelect) orgSelect.innerHTML = '<option value="">로드 실패</option>';
        if (managerSelect) managerSelect.innerHTML = '<option value="">로드 실패</option>';
        return;
    }

    try {
        if (orgSelect) {
            const response = await API.get(`${API_CONFIG.ENDPOINTS.ORG_UNITS}?is_use=Y`);
            orgSelect.innerHTML = '';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.org_id;
                opt.textContent = item.org_name || item.name || item.org_id;
                orgSelect.appendChild(opt);
            });
            if (!orgSelect.options.length) {
                orgSelect.innerHTML = '<option value="">데이터 없음</option>';
            }
        }
        if (managerSelect) {
            const response = await API.get(API_CONFIG.ENDPOINTS.MANAGERS);
            managerSelect.innerHTML = '';
            (response?.items || []).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.manager_id || item.login_id;
                opt.textContent = item.manager_name || item.user_name || item.login_id;
                managerSelect.appendChild(opt);
            });
            if (!managerSelect.options.length) {
                managerSelect.innerHTML = '<option value="">데이터 없음</option>';
            }
        }
    } catch (error) {
        console.warn('⚠️ Report 필터 로딩 실패:', error);
        if (orgSelect && !orgSelect.options.length) {
            orgSelect.innerHTML = '<option value="">로드 실패</option>';
        }
        if (managerSelect && !managerSelect.options.length) {
            managerSelect.innerHTML = '<option value="">로드 실패</option>';
        }
    }
}

function renderReportTable({ columns, items, meta }) {
    if (!reportTable) return;
    const metricColumns = (columns || []).filter(col => col.field !== 'group_name');
    const metricFields = metricColumns.map(col => col.field);
    const headerMode = meta?.headerMode || 'two';
    const viewMode = meta?.viewMode || 'row';
    const period = meta?.period || 'year';
    const freezeTargetCount = meta?.freezeTargetCount || 0;
    const filters = meta?.filters || lastReportResponse?.filters || getReportTargetFilters();
    const normalizedTargets = normalizeReportTargets(meta?.targets || [], filters);

    if (viewMode === 'pivot') {
        const pivotColumns = buildPivotColumns(metricColumns, normalizedTargets, headerMode);
        reportTable.setColumns(pivotColumns);
        const pivotData = buildPivotReportData(items || [], metricFields, normalizedTargets);
        reportTable.setData(applyReportSeq(pivotData));
        if (typeof reportTable.setColumnLayout === 'function') {
            const savedLayout = loadReportLayout()?.pivotLayout;
            if (savedLayout) {
                try {
                    reportTable.setColumnLayout(savedLayout);
                } catch (error) {
                    console.warn('⚠️ Report 레이아웃 적용 실패:', error);
                }
            }
        }
        applyReportFreeze(freezeTargetCount, viewMode);
    } else {
        reportTable.setColumns(buildRowColumns(metricColumns, meta));
        let normalizedItems = injectGroupTotalsRowMode(normalizeReportItems(items || [], filters), metricFields);
        if (period !== 'year') {
            normalizedItems = applyPeriodSummary(normalizedItems, metricColumns, period);
        }
        reportTable.setData(applyReportSeq(normalizedItems));
        applyReportFreeze(0, viewMode);
    }

    const titleEl = document.getElementById('reportTitle');
    if (titleEl && meta) {
        titleEl.textContent = buildReportTitle(meta);
    }
}

function applyReportFreeze(targetCount, viewMode) {
    if (!reportTable) return;
    if (viewMode !== 'pivot') return;
    const freezeCount = Math.max(0, Number(targetCount || 0));
    const leafColumns = reportTable.getColumns(true).filter(col => col.getField && col.getField());

    leafColumns.forEach(col => col.setFrozen(false));
    leafColumns.forEach(col => {
        const field = col.getField();
        if (field === '__seq' || field === 'group_name') {
            col.setFrozen(true);
        }
    });

    const targetPrefixes = Array.from(new Set(
        leafColumns
            .map(col => col.getField())
            .filter(field => /^t\d+_/.test(field))
            .map(field => field.split('_')[0])
    ));

    leafColumns.forEach(col => {
        const field = col.getField();
        if (field && field.startsWith('total_')) col.setFrozen(true);
    });

    if (freezeCount <= 0) {
        reportTable.redraw(true);
        return;
    }

    const freezePrefixes = targetPrefixes.slice(0, freezeCount);
    leafColumns.forEach(col => {
        const field = col.getField();
        if (!field) return;
        if (freezePrefixes.some(prefix => field.startsWith(`${prefix}_`))) {
            col.setFrozen(true);
        }
    });
    reportTable.redraw(true);
}

async function initializeReportHub() {
    const tableEl = document.getElementById('reportTable');
    if (!tableEl) return;

    populateReportYears();
    const orgSelect = document.getElementById('reportFilterOrg');
    const managerSelect = document.getElementById('reportFilterManager');
    if (orgSelect && !orgSelect.options.length) {
        orgSelect.innerHTML = '<option value="">로딩중...</option>';
    }
    if (managerSelect && !managerSelect.options.length) {
        managerSelect.innerHTML = '<option value="">로딩중...</option>';
    }
    await ensureReportFiltersLoaded();
    const layout = loadReportLayout();
    const freezeInputEl = document.getElementById('reportFreezeTargetCount');
    if (freezeInputEl && layout?.freezeTargetCount !== undefined) {
        freezeInputEl.value = layout.freezeTargetCount;
    }

    if (!reportTable) {
        reportTable = new Tabulator('#reportTable', {
            height: '520px',
            layout: 'fitData',
            placeholder: '보고서 결과가 없습니다.',
            responsiveLayout: false,
            movableColumns: true,
            columnDefaults: {
                headerSort: true
            },
            rowFormatter: (row) => {
                const data = row.getData();
                const el = row.getElement();
                if (!el) return;
                el.classList.remove('report-subtotal', 'report-targetsubtotal', 'report-grandtotal', 'report-grouptotal');
                if (data.row_type === 'subtotal') {
                    el.classList.add('report-subtotal');
                }
                if (data.row_type === 'target_subtotal') {
                    el.classList.add('report-targetsubtotal');
                }
                if (data.row_type === 'group_total') {
                    el.classList.add('report-grouptotal');
                }
                if (data.row_type === 'grand_total') {
                    el.classList.add('report-grandtotal');
                }
            }
        });
        reportTable.on("columnMoved", () => {
            const viewMode = document.getElementById('reportViewMode')?.value || 'row';
            if (viewMode !== 'pivot') return;
            if (typeof reportTable.getColumnLayout === 'function') {
                saveReportLayout({ pivotLayout: reportTable.getColumnLayout() });
            }
        });
    }

    const runBtn = document.getElementById('btnReportRun');
    if (runBtn && !runBtn.dataset.bound) {
        runBtn.dataset.bound = 'true';
        runBtn.addEventListener('click', async () => {
            const source = document.getElementById('reportSource')?.value || 'gap';
            const year = document.getElementById('reportYear')?.value || new Date().getFullYear();
            const dimension = document.getElementById('reportDimension')?.value || 'service';
            const period = document.getElementById('reportPeriod')?.value || 'year';
            const metric = document.getElementById('reportMetric')?.value || 'both';
            const headerMode = document.getElementById('reportHeaderMode')?.value || 'two';
            const viewMode = document.getElementById('reportViewMode')?.value || 'row';
            const freezeTargetCount = Number(document.getElementById('reportFreezeTargetCount')?.value || 0);
            const filters = getReportTargetFilters();
            const targetSummary = buildReportTargetSummary(filters);

            try {
                if (typeof API === 'undefined' || !API_CONFIG?.ENDPOINTS?.REPORTS) {
                    throw new Error('API unavailable');
                }
                const query = new URLSearchParams({
                    source,
                    year,
                    dimension,
                    period,
                    metric,
                    org_ids: filters.orgs.map(item => item.value).join(','),
                    manager_ids: filters.managers.map(item => item.value).join(',')
                }).toString();
                const response = await API.get(`${API_CONFIG.ENDPOINTS.REPORTS}/summary?${query}`);
                const normalizedTargets = normalizeReportTargets(response?.targets || [], filters);
                const normalizedItems = normalizeReportItems(response?.items || [], filters);
                lastReportResponse = {
                    ...response,
                    targets: normalizedTargets,
                    items: normalizedItems,
                    filters
                };
                renderReportTable({
                    columns: response?.columns || [],
                    items: normalizedItems,
                    meta: { source, year, dimension, period, metric, targetSummary, headerMode, viewMode, freezeTargetCount, targets: normalizedTargets, filters }
                });
            } catch (error) {
                console.warn('⚠️ Report 조회 실패, 샘플로 대체합니다.', error);
                const sample = getSampleReportResponse(metric);
                const normalizedTargets = normalizeReportTargets(sample.targets || [], filters);
                const normalizedItems = normalizeReportItems(sample.items || [], filters);
                lastReportResponse = { ...sample, targets: normalizedTargets, items: normalizedItems, filters };
                renderReportTable({
                    columns: sample.columns,
                    items: normalizedItems,
                    meta: { source, year, dimension, period, metric, targetSummary, headerMode, viewMode, freezeTargetCount, targets: normalizedTargets, filters }
                });
            }

            const placeholder = document.getElementById('reportPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
        });
    }

    const exportBtn = document.getElementById('btnReportExport');
    if (exportBtn && !exportBtn.dataset.bound) {
        exportBtn.dataset.bound = 'true';
        exportBtn.addEventListener('click', () => {
            if (!reportTable) return;
            reportTable.download('xlsx', 'report.xlsx', {sheetName: 'Report'});
        });
    }

    const headerSelect = document.getElementById('reportHeaderMode');
    if (headerSelect && !headerSelect.dataset.bound) {
        headerSelect.dataset.bound = 'true';
        headerSelect.addEventListener('change', () => {
            if (!lastReportResponse) return;
            const filters = lastReportResponse?.filters || getReportTargetFilters();
            const meta = {
                source: document.getElementById('reportSource')?.value || 'gap',
                year: document.getElementById('reportYear')?.value || new Date().getFullYear(),
                dimension: document.getElementById('reportDimension')?.value || 'service',
                period: document.getElementById('reportPeriod')?.value || 'year',
                metric: document.getElementById('reportMetric')?.value || 'both',
                targetSummary: buildReportTargetSummary(filters),
                headerMode: headerSelect.value || 'two',
                viewMode: document.getElementById('reportViewMode')?.value || 'row',
                freezeTargetCount: Number(document.getElementById('reportFreezeTargetCount')?.value || 0),
                targets: lastReportResponse?.targets || [],
                filters
            };
            renderReportTable({
                columns: lastReportResponse.columns || [],
                items: lastReportResponse.items || [],
                meta
            });
        });
    }

    const viewSelect = document.getElementById('reportViewMode');
    if (viewSelect && !viewSelect.dataset.bound) {
        viewSelect.dataset.bound = 'true';
        viewSelect.addEventListener('change', () => {
            if (!lastReportResponse) return;
            const filters = lastReportResponse?.filters || getReportTargetFilters();
            const meta = {
                source: document.getElementById('reportSource')?.value || 'gap',
                year: document.getElementById('reportYear')?.value || new Date().getFullYear(),
                dimension: document.getElementById('reportDimension')?.value || 'service',
                period: document.getElementById('reportPeriod')?.value || 'year',
                metric: document.getElementById('reportMetric')?.value || 'both',
                targetSummary: buildReportTargetSummary(filters),
                headerMode: document.getElementById('reportHeaderMode')?.value || 'two',
                viewMode: viewSelect.value || 'row',
                freezeTargetCount: Number(document.getElementById('reportFreezeTargetCount')?.value || 0),
                targets: lastReportResponse?.targets || [],
                filters
            };
            renderReportTable({
                columns: lastReportResponse.columns || [],
                items: lastReportResponse.items || [],
                meta
            });
        });
    }

    if (freezeInputEl && !freezeInputEl.dataset.bound) {
        freezeInputEl.dataset.bound = 'true';
        freezeInputEl.addEventListener('input', () => {
            const viewMode = document.getElementById('reportViewMode')?.value || 'row';
            const value = Number(freezeInputEl.value || 0);
            applyReportFreeze(value, viewMode);
            saveReportLayout({ freezeTargetCount: value });
        });
    }

    const resetBtn = document.getElementById('btnReportFilterReset');
    if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', () => {
            const orgSelect = document.getElementById('reportFilterOrg');
            const managerSelect = document.getElementById('reportFilterManager');
            if (orgSelect) Array.from(orgSelect.options).forEach(option => option.selected = false);
            if (managerSelect) Array.from(managerSelect.options).forEach(option => option.selected = false);
        });
    }
}

// DOMContentLoaded Hook

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('reportTable')) {
        initializeReportHub();
    }
});

// Expose to navigation
window.initializeReportHub = initializeReportHub;
