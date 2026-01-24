// ===================================
// Page Navigation System
// ===================================

/**
 * 페이지 전환
 * @param {string} pageId - 전환할 페이지 ID (예: 'projects-list', 'projects-new')
 */
function navigateTo(pageId) {
    console.log('📄 페이지 전환:', pageId);
    
    // 모든 페이지 숨기기
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    // 선택한 페이지 표시
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // 페이지별 초기화 로직
        setTimeout(() => {
            initializePage(pageId);
        }, 50);
    } else {
        console.error('❌ 페이지를 찾을 수 없습니다:', pageId);
    }
    
    // URL 업데이트 (브라우저 히스토리)
    if (history.pushState) {
        const newUrl = `${window.location.pathname}?page=${pageId}`;
        history.pushState({page: pageId}, '', newUrl);
    }
}

/**
 * 페이지별 초기화
 * @param {string} pageId - 초기화할 페이지 ID
 */
function initializePage(pageId) {
    console.log('🔧 페이지 초기화:', pageId);
    
    switch(pageId) {
        case 'projects-list':
            // 프로젝트 목록 페이지
            console.log('📋 프로젝트 목록 초기화');
            if (typeof projectTable !== 'undefined' && projectTable) {
                projectTable.setData();
            }
            break;
            
        case 'projects-new':
            // 프로젝트 신규/수정 페이지
            console.log('📝 프로젝트 폼 초기화');
            const urlParams = new URLSearchParams(window.location.search);
            const mode = urlParams.get('mode') || 'new';
            const pipelineId = urlParams.get('pipeline_id') || null;
            
            if (typeof initializeProjectForm !== 'undefined') {
                initializeProjectForm(mode, pipelineId);
            } else {
                console.warn('⚠️ initializeProjectForm 함수를 찾을 수 없습니다');
            }
            break;
            
        case 'clients':
            console.log('🏢 거래처 관리 페이지 초기화');
            // TODO: 거래처 관리 초기화 로직
            break;
            
        case 'sales-dashboard':
            console.log('📊 영업 대시보드 초기화');
            // TODO: 대시보드 초기화 로직
            break;
            
        case 'contracts-list':
            console.log('📝 계약 목록 초기화');
            // TODO: 계약 목록 초기화 로직
            break;
            
        case 'contracts-new':
            console.log('📝 계약 등록 초기화');
            // TODO: 계약 등록 초기화 로직
            break;
            
        case 'contracts-dashboard':
            console.log('📊 계약 현황 초기화');
            // TODO: 계약 현황 초기화 로직
            break;
            
        case 'revenue-list':
            console.log('💰 매출 목록 초기화');
            // TODO: 매출 목록 초기화 로직
            break;
            
        case 'revenue-new':
            console.log('💰 매출 등록 초기화');
            // TODO: 매출 등록 초기화 로직
            break;
            
        case 'revenue-dashboard':
            console.log('📊 매출 현황 초기화');
            // TODO: 매출 현황 초기화 로직
            break;
            
        case 'users':
            console.log('👥 사용자 관리 초기화');
            // TODO: 사용자 관리 초기화 로직
            break;
            
        case 'common-codes':
            console.log('🔧 공통코드 관리 초기화');
            // TODO: 공통코드 관리 초기화 로직
            break;
            
        case 'settings':
            console.log('⚙️ 시스템 설정 초기화');
            // TODO: 시스템 설정 초기화 로직
            break;
            
        default:
            console.log('📄 기본 페이지 초기화:', pageId);
    }
}

/**
 * 특정 모드로 프로젝트 폼 열기
 * @param {string} mode - 'new' 또는 'edit'
 * @param {string} pipelineId - 편집 모드일 때 프로젝트 ID
 */
function openProjectForm(mode = 'new', pipelineId = null) {
    console.log('📝 프로젝트 폼 열기:', mode, pipelineId);
    
    // URL 파라미터 설정
    let url = `${window.location.pathname}?page=projects-new&mode=${mode}`;
    if (pipelineId) {
        url += `&pipeline_id=${pipelineId}`;
    }
    
    if (history.pushState) {
        history.pushState({page: 'projects-new', mode, pipelineId}, '', url);
    }
    
    // 페이지 전환
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById('page-projects-new');
    if (targetPage) {
        targetPage.classList.add('active');
        
        // 폼 초기화
        setTimeout(() => {
            if (typeof initializeProjectForm !== 'undefined') {
                initializeProjectForm(mode, pipelineId);
            }
        }, 50);
    }
}

/**
 * 내정보 모달 열기
 */
function openMyInfo() {
    console.log('👤 내정보 열기');
    alert('내정보 기능 준비중입니다.');
    // TODO: 내정보 모달 또는 페이지 구현
    /*
    // 예시: 모달 방식
    const modal = document.getElementById('myInfoModal');
    if (modal) {
        modal.classList.add('active');
        // 사용자 정보 로드
        loadMyInfo();
    }
    */
}

/**
 * 로그아웃
 */
function logout() {
    console.log('🚪 로그아웃 요청');
    
    if (confirm('로그아웃 하시겠습니까?')) {
        console.log('✅ 로그아웃 확인');
        
        // TODO: 실제 로그아웃 API 호출
        /*
        try {
            await API.post('/auth/logout');
            window.location.href = '/login';
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
        */
        
        alert('로그아웃 기능 준비중입니다.');
        // window.location.href = '/logout';
    } else {
        console.log('❌ 로그아웃 취소');
    }
}

/**
 * 현재 활성화된 페이지 ID 가져오기
 */
function getCurrentPageId() {
    const activePage = document.querySelector('.page-content.active');
    if (activePage) {
        return activePage.id.replace('page-', '');
    }
    return null;
}

/**
 * 페이지 존재 여부 확인
 */
function pageExists(pageId) {
    return document.getElementById(`page-${pageId}`) !== null;
}

// ===================================
// Event Listeners
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Navigation 시스템 초기화');
    
    // 드롭다운 메뉴 클릭 이벤트
    document.querySelectorAll('.dropdown-menu a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            const mode = link.getAttribute('data-mode');
            
            if (pageId) {
                if (pageId === 'projects-new' && mode) {
                    // 신규 프로젝트 메뉴에서 직접 클릭한 경우
                    openProjectForm('new');
                } else {
                    navigateTo(pageId);
                }
            }
        });
    });
    
    // URL에서 페이지 파라미터 읽기
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    const pipelineIdParam = urlParams.get('pipeline_id');
    
    console.log('📄 URL 파라미터:', {page: pageParam, pipeline_id: pipelineIdParam});
    
    if (pageParam) {
        // URL에 페이지 파라미터가 있으면 해당 페이지로 이동
        if (pageExists(pageParam)) {
            navigateTo(pageParam);
        } else {
            console.warn('⚠️ 존재하지 않는 페이지:', pageParam);
            // 기본 페이지로 이동
            document.getElementById('page-projects-list').classList.add('active');
            initializePage('projects-list');
        }
    } else if (pipelineIdParam) {
        // pipeline_id만 있는 경우 (레거시 URL 지원)
        console.log('📋 Pipeline ID로 상세 정보 표시:', pipelineIdParam);
        document.getElementById('page-projects-list').classList.add('active');
        initializePage('projects-list');
        
        // 상세 정보 모달 자동 열기
        if (typeof openProjectDetail !== 'undefined') {
            setTimeout(() => {
                openProjectDetail(pipelineIdParam);
            }, 1000);
        }
    } else {
        // 기본: 프로젝트 목록 페이지
        console.log('📋 기본 페이지: 프로젝트 목록');
        document.getElementById('page-projects-list').classList.add('active');
        initializePage('projects-list');
    }
    
    // 브라우저 뒤로가기/앞으로가기 지원
    window.addEventListener('popstate', (e) => {
        console.log('◀️ 브라우저 히스토리 이동:', e.state);
        
        if (e.state && e.state.page) {
            // 모든 페이지 숨기기
            document.querySelectorAll('.page-content').forEach(page => {
                page.classList.remove('active');
            });
            
            // 히스토리 상태의 페이지 표시
            const targetPage = document.getElementById(`page-${e.state.page}`);
            if (targetPage) {
                targetPage.classList.add('active');
                
                // 프로젝트 폼인 경우 모드와 ID 전달
                if (e.state.page === 'projects-new') {
                    if (typeof initializeProjectForm !== 'undefined') {
                        initializeProjectForm(e.state.mode || 'new', e.state.pipelineId || null);
                    }
                } else {
                    initializePage(e.state.page);
                }
            }
        } else {
            // 상태 정보가 없으면 URL에서 읽기
            const urlParams = new URLSearchParams(window.location.search);
            const pageParam = urlParams.get('page') || 'projects-list';
            navigateTo(pageParam);
        }
    });
    
    console.log('✅ Navigation 시스템 초기화 완료');
});

// ===================================
// Export to window
// ===================================
window.navigateTo = navigateTo;
window.initializePage = initializePage;
window.openProjectForm = openProjectForm;
window.openMyInfo = openMyInfo;
window.logout = logout;
window.getCurrentPageId = getCurrentPageId;
window.pageExists = pageExists;

console.log('📦 Navigation 모듈 로드 완료');
