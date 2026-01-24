// ===================================
// API Configuration
// ===================================
const API_CONFIG = {
    BASE_URL: 'http://172.30.1.16:8000',
    API_VERSION: '/api/v1',
    
    ENDPOINTS: {
        PROJECTS_LIST: '/projects/list',
        PROJECT_DETAIL: '/project-detail',
        COMBO_DATA: '/projects/combo',
        MANAGERS: '/projects/managers',
    },
    
    TIMEOUT: 30000,
    RETRY: { MAX_ATTEMPTS: 3, DELAY: 1000 }
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
                    'Accept': 'application/json',
                },
                ...options
            });
            
            console.log('📡 응답 상태:', response.status, response.statusText);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('✅ 응답 데이터:', data);
            return data;
        } catch (error) {
            console.error('❌ API 에러:', error);
            throw error;
        }
    },
    
    async get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${endpoint}?${query}` : endpoint;
        return this.request(url, { method: 'GET' });
    },
    
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// ===================================
// Utility Functions
// ===================================
const Utils = {
    formatNumber(num) {
        if (!num || num === 0) return '0';
        return parseInt(num).toLocaleString('ko-KR');
    },
    
    formatCurrency(amount) {
        if (!amount || amount === 0) return '0원';
        return `${this.formatNumber(amount)}원`;
    },
    
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR');
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
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
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
 */
async function loadStageConfig() {
    try {
        console.log('📡 STAGE 설정 로딩...');
        const response = await API.get(`${API_CONFIG.ENDPOINTS.COMBO_DATA}/STAGE`);
        
        if (response && response.items) {
            STAGE_CONFIG = {};
            response.items.forEach((stage, index) => {
                STAGE_CONFIG[stage.code] = {
                    label: stage.code_name,
                    class: STAGE_COLORS[index % STAGE_COLORS.length]
                };
            });
            console.log('✅ STAGE 설정 완료:', STAGE_CONFIG);
        }
    } catch (error) {
        console.error('❌ STAGE 설정 로딩 실패:', error);
        // 폴백: 기본 설정
        STAGE_CONFIG = {
            'S01': { label: '1 영업중', class: 'badge-stage-1' },
            'S02': { label: '2 건적제출', class: 'badge-stage-2' },
            'S03': { label: '3 제안중', class: 'badge-stage-3' },
            'S04': { label: '4 입찰중', class: 'badge-stage-4' },
            'S05': { label: '5 DROP', class: 'badge-stage-5' },
            'S06': { label: '6 실주', class: 'badge-stage-6' },
            'S07': { label: '7 수주완료', class: 'badge-stage-7' },
            'S08': { label: '8 계약완료', class: 'badge-stage-8' },
            'S09': { label: '9 유지보수', class: 'badge-stage-9' }
        };
    }
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
