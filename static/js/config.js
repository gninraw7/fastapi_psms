// ===================================
// static/js/config.js
// API 설정 및 유틸리티 함수
// 수정: 공통코드 엔드포인트 변경 (/projects/combo → /common/codes)
// 버그 수정 (2026-01-30): window.STAGE_CONFIG 동기화
// ===================================

// ===================================
// API Configuration
// ===================================
const API_CONFIG = {
    BASE_URL: window.location.origin,
    // BASE_URL: 'http://172.30.1.16:8000',  // 개발 서버
    API_VERSION: '/api/v1',
    
    ENDPOINTS: {
        // 프로젝트 관련
        PROJECTS_LIST: '/projects/list',
        PROJECTS: '/projects',
        PROJECT_DETAIL: '/project-detail',
        PROJECT_SAVE: '/project-detail/save', 
        PROJECT_HISTORY: '/projects/history',
        
        // 거래처 관련
        CLIENTS_LIST: '/clients/list',
        CLIENTS_SEARCH: '/clients/search',
        CLIENTS_SEARCH_SIMPLE: '/clients/search/simple',

        // 사용자 관련
        USERS_LIST: '/users/list',
        USERS: '/users',
        USERS_PASSWORD_RESET: '/users/password/reset',
        USERS_CAN_CHANGE_LOGIN_ID: '/users/can-change-login-id',
        
        // 공통코드 관련 (⭐ 변경됨)
        COMBO_DATA: '/common/codes',          // 변경: /projects/combo → /common/codes
        MANAGERS: '/common/managers',          // 변경: /projects/managers → /common/managers
        CODE_GROUPS: '/common/code-groups',    // 신규
    },
    
    TIMEOUT: 30000,
    RETRY: { MAX_ATTEMPTS: 3, DELAY: 1000 }
};

// ===================================
// Tabulator Common Options
// ===================================
window.TABULATOR_COMMON_OPTIONS = {
    headerSort: true,
    headerSortTristate: false,
    headerSortStartingDir: "asc",
    headerSortClickElement: "header",
    headerSortElement: function(column, dir) {
        if (dir === "asc") return "▲";
        if (dir === "desc") return "▼";
        return "";
    },
    sortMode: "remote",
    ajaxSorting: true,
    columnDefaults: {
        headerSort: true
    }
};

// ===================================
// API Helper
// ===================================
const API = {
    async request(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.API_VERSION}${endpoint}`;
        console.log('🌐 API 요청:', url);
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ API 에러:', url, error);
            throw error;
        }
    },
    
    async get(endpoint) {
        return this.request(endpoint);
    },
    
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
};

// ===================================
// Utility Functions
// ===================================
const Utils = {
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('ko-KR');
    },
    
    formatDate(date) {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString('ko-KR');
    },
    
    truncate(text, maxLength = 50) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },
    
    debounce(func, wait = 300) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    },
    
    showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('active');
            } else {
                overlay.classList.remove('active');
            }
        }
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ===================================
// Dynamic Stage Configuration
// ===================================
let STAGE_CONFIG = {};
let STAGE_COLORS = [
    'badge-stage-1',
    'badge-stage-2', 
    'badge-stage-3',
    'badge-stage-4',
    'badge-stage-5',
    'badge-stage-6',
    'badge-stage-7',
    'badge-stage-8',
    'badge-stage-9'
];

/**
 * 진행단계 설정을 API에서 로드
 * ⭐ 버그 수정: window.STAGE_CONFIG 동기화 추가
 */
async function loadStageConfig() {
    try {
        console.log('📡 STAGE 설정 로딩...');
        const response = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/STAGE`);
        
        if (response && response.items && response.items.length > 0) {
            STAGE_CONFIG = {};
            response.items.forEach((stage, index) => {
                STAGE_CONFIG[stage.code] = {
                    label: stage.code_name,
                    class: STAGE_COLORS[index % STAGE_COLORS.length]
                };
            });
            
            // ⭐ 버그 수정: window.STAGE_CONFIG도 업데이트
            window.STAGE_CONFIG = STAGE_CONFIG;
            
            console.log('✅ STAGE 설정 완료:', Object.keys(STAGE_CONFIG).length, '개');
        } else {
            console.warn('⚠️ STAGE API 응답 비어있음, 기본값 사용');
            setDefaultStageConfig();
        }
    } catch (error) {
        console.error('❌ STAGE 설정 로딩 실패:', error);
        setDefaultStageConfig();
    }
}

/**
 * 기본 STAGE 설정 (폴백)
 */
function setDefaultStageConfig() {
    STAGE_CONFIG = {
        'S01': { label: '1 영업중', class: 'badge-stage-1' },
        'S02': { label: '2 견적제출', class: 'badge-stage-2' },
        'S03': { label: '3 제안중', class: 'badge-stage-3' },
        'S04': { label: '4 입찰중', class: 'badge-stage-4' },
        'S05': { label: '5 DROP', class: 'badge-stage-5' },
        'S06': { label: '6 실주', class: 'badge-stage-6' },
        'S07': { label: '7 수주완료', class: 'badge-stage-7' },
        'S08': { label: '8 계약완료', class: 'badge-stage-8' },
        'S09': { label: '9 유지보수', class: 'badge-stage-9' }
    };
    
    // window.STAGE_CONFIG도 업데이트
    window.STAGE_CONFIG = STAGE_CONFIG;
    console.log('✅ STAGE 기본값 설정 완료');
}

/**
 * 진행단계 배지 HTML 생성
 */
function getStageBadge(stageCode) {
    if (!stageCode) return '<span class="badge badge-stage-1">-</span>';
    
    const config = STAGE_CONFIG[stageCode];
    if (!config) {
        return `<span class="badge badge-stage-1">${stageCode}</span>`;
    }
    
    return `<span class="badge ${config.class}">${config.label}</span>`;
}

/**
 * 진행단계 라벨 가져오기 (엑셀용)
 */
function getStageLabel(stageCode) {
    if (!stageCode) return '-';
    const config = STAGE_CONFIG[stageCode];
    return config ? config.label : stageCode;
}

// ===================================
// Export to window
// ===================================
window.API = API;
window.Utils = Utils;
window.API_CONFIG = API_CONFIG;
window.STAGE_CONFIG = STAGE_CONFIG;
window.loadStageConfig = loadStageConfig;
window.getStageBadge = getStageBadge;
window.getStageLabel = getStageLabel;

console.log('📦 Config 모듈 로드 완료');
