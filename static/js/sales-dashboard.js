// ===================================
// static/js/sales-dashboard.js
// CEO 프로젝트 대시보드
// ===================================

let ceoDashboardInitialized = false;
let ceoDashboardLoading = false;
let ceoDashboardCharts = {};

const CEO_COLOR_SET = ['#0f766e', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#f97316', '#06b6d4', '#14b8a6'];

function formatKrwCompact(value) {
    const n = Number(value || 0);
    const abs = Math.abs(n);
    if (abs >= 1000000000000) return `${(n / 1000000000000).toFixed(1)}조원`;
    if (abs >= 100000000) return `${(n / 100000000).toFixed(1)}억원`;
    if (abs >= 10000) return `${(n / 10000).toFixed(0)}만원`;
    return `${n.toLocaleString('ko-KR')}원`;
}

function formatPercent(ratio, digits = 1) {
    if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) return '-';
    return `${(Number(ratio) * 100).toFixed(digits)}%`;
}

function escapeHtml(str) {
    const s = String(str || '');
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function destroyDashboardCharts() {
    Object.values(ceoDashboardCharts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    ceoDashboardCharts = {};
}

function upsertChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    const fixedHeight = canvasId === 'ceoMonthlyTrendChart' ? 290 : 260;
    canvas.style.height = `${fixedHeight}px`;
    canvas.style.maxHeight = `${fixedHeight}px`;

    if (ceoDashboardCharts[canvasId]) {
        ceoDashboardCharts[canvasId].destroy();
    }

    ceoDashboardCharts[canvasId] = new Chart(canvas.getContext('2d'), config);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
}

function setDashboardLoadingState(isLoading) {
    const refreshBtn = document.getElementById('btnCeoRefresh');
    if (refreshBtn) {
        refreshBtn.disabled = isLoading;
        refreshBtn.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i> 로딩중'
            : '<i class="fas fa-rotate"></i> 새로고침';
    }
}

function bindDashboardEvents() {
    const yearSelect = document.getElementById('ceoYearSelect');
    const refreshBtn = document.getElementById('btnCeoRefresh');

    if (yearSelect && yearSelect.dataset.bound !== '1') {
        yearSelect.addEventListener('change', () => {
            const year = Number(yearSelect.value) || new Date().getFullYear();
            loadCeoDashboard(year);
        });
        yearSelect.dataset.bound = '1';
    }

    if (refreshBtn && refreshBtn.dataset.bound !== '1') {
        refreshBtn.addEventListener('click', () => {
            const year = Number(yearSelect?.value) || new Date().getFullYear();
            loadCeoDashboard(year);
        });
        refreshBtn.dataset.bound = '1';
    }
}

function renderYearOptions(years, selectedYear) {
    const yearSelect = document.getElementById('ceoYearSelect');
    if (!yearSelect) return;

    yearSelect.innerHTML = '';
    (years || []).forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}년`;
        if (Number(y) === Number(selectedYear)) opt.selected = true;
        yearSelect.appendChild(opt);
    });

    if (!yearSelect.value) {
        yearSelect.value = String(selectedYear);
    }
}

function renderKpiCards(data) {
    const kpi = data?.kpi || {};

    setText('ceoKpiOrderTotal', formatKrwCompact(kpi.order_total));
    setText('ceoKpiOrderYoY', `전년 대비 ${formatPercent(kpi.order_yoy_rate)}`);

    setText('ceoKpiProfitTotal', formatKrwCompact(kpi.profit_total));

    setText('ceoKpiAchievement', formatPercent(kpi.achievement_rate));
    setText('ceoKpiPlanTotal', `계획 ${formatKrwCompact(kpi.plan_total)}`);

    setText('ceoKpiPipeline', formatKrwCompact(kpi.active_pipeline_amount));
    setText('ceoKpiExpected', `예상매출 ${formatKrwCompact(kpi.expected_amount)}`);

    setText('ceoKpiAvgProb', formatPercent((kpi.avg_win_probability || 0) / 100));
    setText('ceoKpiProjectCount', `활동 프로젝트 ${(kpi.active_projects || 0).toLocaleString('ko-KR')}건`);

    const riskCount = (kpi.overdue_projects || 0) + (kpi.stale_projects || 0) + (kpi.low_probability_projects || 0);
    setText('ceoKpiRiskCount', `${riskCount.toLocaleString('ko-KR')}건`);
    setText('ceoKpiRiskDetail', `기한 ${kpi.overdue_projects || 0} / 저확률 ${kpi.low_probability_projects || 0} / 장기미갱신 ${kpi.stale_projects || 0}`);
}

function renderMonthlyTrendChart(rows) {
    const labels = (rows || []).map(r => `${r.month}월`);
    const actual = (rows || []).map(r => Number(r.actual_order || 0));
    const previous = (rows || []).map(r => Number(r.previous_order || 0));
    const plan = (rows || []).map(r => Number(r.plan_order || 0));

    upsertChart('ceoMonthlyTrendChart', {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '실적',
                    data: actual,
                    borderColor: '#0f766e',
                    backgroundColor: 'rgba(15,118,110,0.14)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 2
                },
                {
                    label: '전년',
                    data: previous,
                    borderColor: '#64748b',
                    borderDash: [6, 5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 2
                },
                {
                    label: '계획',
                    data: plan,
                    borderColor: '#f59e0b',
                    borderDash: [3, 3],
                    tension: 0.25,
                    fill: false,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatKrwCompact(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (v) => formatKrwCompact(v)
                    }
                }
            }
        }
    });
}

function renderQuarterCompareChart(rows) {
    const labels = (rows || []).map(r => r.quarter);
    const actual = (rows || []).map(r => Number(r.actual_order || 0));
    const plan = (rows || []).map(r => Number(r.plan_order || 0));
    const rate = (rows || []).map(r => Number(r.achievement_rate || 0) * 100);

    upsertChart('ceoQuarterCompareChart', {
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: '계획',
                    data: plan,
                    backgroundColor: '#bcd5d1',
                    borderRadius: 6
                },
                {
                    type: 'bar',
                    label: '실적',
                    data: actual,
                    backgroundColor: '#0f766e',
                    borderRadius: 6
                },
                {
                    type: 'line',
                    label: '달성률(%)',
                    data: rate,
                    yAxisID: 'y1',
                    borderColor: '#f59e0b',
                    backgroundColor: '#f59e0b',
                    tension: 0.25,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ctx.dataset.yAxisID === 'y1'
                            ? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                            : `${ctx.dataset.label}: ${formatKrwCompact(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: { callback: (v) => formatKrwCompact(v) }
                },
                y1: {
                    position: 'right',
                    min: 0,
                    max: 200,
                    grid: { drawOnChartArea: false },
                    ticks: { callback: (v) => `${v}%` }
                }
            }
        }
    });
}

function renderStageFunnelChart(rows) {
    const labels = (rows || []).map(r => r.stage_name || r.stage_code || '-');
    const amounts = (rows || []).map(r => Number(r.total_amount || 0));

    upsertChart('ceoStageFunnelChart', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '파이프라인 금액',
                data: amounts,
                backgroundColor: labels.map((_, idx) => CEO_COLOR_SET[idx % CEO_COLOR_SET.length]),
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatKrwCompact(ctx.parsed.x)
                    }
                }
            },
            scales: {
                x: { ticks: { callback: (v) => formatKrwCompact(v) } }
            }
        }
    });
}

function renderProbabilityChart(rows) {
    const labels = (rows || []).map(r => r.probability_band);
    const counts = (rows || []).map(r => Number(r.project_count || 0));

    upsertChart('ceoProbabilityChart', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '프로젝트 수',
                data: counts,
                backgroundColor: '#0ea5e9',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toLocaleString('ko-KR')}건`
                    }
                }
            }
        }
    });
}

function renderManagerTopChart(rows) {
    const labels = (rows || []).map(r => r.manager_name || '-');
    const expected = (rows || []).map(r => Number(r.expected_amount || 0));

    upsertChart('ceoManagerTopChart', {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '예상매출',
                data: expected,
                backgroundColor: '#22c55e',
                borderRadius: 7
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatKrwCompact(ctx.parsed.x)
                    }
                }
            },
            scales: {
                x: { ticks: { callback: (v) => formatKrwCompact(v) } }
            }
        }
    });
}

function renderFieldMixChart(rows) {
    const labels = (rows || []).map(r => r.field_name || '-');
    const amounts = (rows || []).map(r => Number(r.total_amount || 0));

    upsertChart('ceoFieldMixChart', {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: amounts,
                backgroundColor: labels.map((_, idx) => CEO_COLOR_SET[idx % CEO_COLOR_SET.length]),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${formatKrwCompact(ctx.parsed)}`
                    }
                }
            }
        }
    });
}

function renderRiskProjects(rows) {
    const container = document.getElementById('ceoRiskProjects');
    if (!container) return;

    if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="ceo-list-empty">리스크 프로젝트가 없습니다.</div>';
        return;
    }

    container.innerHTML = rows.map(row => {
        const tags = [];
        if (row.is_overdue) tags.push('<span class="ceo-risk-tag alert">기한경과</span>');
        if (row.is_low_probability) tags.push('<span class="ceo-risk-tag warn">저확률</span>');
        if (row.is_stale) tags.push('<span class="ceo-risk-tag info">장기미갱신</span>');

        return `
            <div class="ceo-risk-item">
                <div>
                    <div class="ceo-risk-name">${escapeHtml(row.project_name)} (${escapeHtml(row.pipeline_id)})</div>
                    <div class="ceo-risk-meta">${escapeHtml(row.stage_name || '-')} · ${formatKrwCompact(row.quoted_amount)} · 수주확률 ${Number(row.win_probability || 0)}%</div>
                </div>
                <div class="ceo-risk-tags">${tags.join('')}</div>
            </div>
        `;
    }).join('');
}

function renderTopCustomers(rows) {
    const container = document.getElementById('ceoTopCustomers');
    if (!container) return;

    if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="ceo-list-empty">고객사 데이터가 없습니다.</div>';
        return;
    }

    const body = rows.map((row, idx) => `
        <tr>
            <td>${idx + 1}. ${escapeHtml(row.customer_name)}</td>
            <td>${Number(row.project_count || 0).toLocaleString('ko-KR')}건</td>
            <td>${formatKrwCompact(row.expected_amount)}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="ceo-customer-table">
            <thead>
                <tr>
                    <th>고객사</th>
                    <th>프로젝트</th>
                    <th>예상매출</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `;
}

function renderDashboard(data) {
    renderKpiCards(data);
    renderMonthlyTrendChart(data.monthly_trend || []);
    renderQuarterCompareChart(data.quarter_comparison || []);
    renderStageFunnelChart(data.stage_funnel || []);
    renderProbabilityChart(data.probability_bands || []);
    renderManagerTopChart(data.manager_top || []);
    renderFieldMixChart(data.field_mix || []);
    renderRiskProjects(data.risk_projects || []);
    renderTopCustomers(data.customer_top || []);
    setText('ceoDashboardGeneratedAt', `갱신시각: ${data.generated_at || '-'}`);
}

async function loadCeoDashboard(year) {
    if (ceoDashboardLoading) return;
    ceoDashboardLoading = true;
    setDashboardLoadingState(true);

    try {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.REPORTS}/ceo-dashboard?year=${year}`);
        renderYearOptions(response?.available_years || [year], response?.year || year);
        renderDashboard(response || {});
    } catch (error) {
        console.error('❌ CEO 대시보드 로드 실패:', error);
        destroyDashboardCharts();
        setText('ceoDashboardGeneratedAt', '갱신시각: 로드 실패');
        const risk = document.getElementById('ceoRiskProjects');
        const customer = document.getElementById('ceoTopCustomers');
        if (risk) risk.innerHTML = '<div class="ceo-list-empty">대시보드 데이터를 불러오지 못했습니다.</div>';
        if (customer) customer.innerHTML = '<div class="ceo-list-empty">대시보드 데이터를 불러오지 못했습니다.</div>';
    } finally {
        ceoDashboardLoading = false;
        setDashboardLoadingState(false);
    }
}

async function initializeSalesDashboard() {
    if (typeof Chart === 'undefined') {
        console.warn('⚠️ Chart.js 로드 필요');
        return;
    }

    if (!ceoDashboardInitialized) {
        bindDashboardEvents();
        ceoDashboardInitialized = true;
    }

    const yearSelect = document.getElementById('ceoYearSelect');
    const year = Number(yearSelect?.value) || new Date().getFullYear();
    await loadCeoDashboard(year);
}

window.initializeSalesDashboard = initializeSalesDashboard;
