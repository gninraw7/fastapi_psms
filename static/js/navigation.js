// ===================================
// Page Navigation System - v2.0
// 기존 모든 기능 보존 + Breadcrumb 추가
// ===================================

// ⭐ 페이지 정보 매핑 (Breadcrumb용 신규 추가)
const PAGE_INFO = {
    'projects-list': {
        title: '프로젝트 목록',
        icon: 'fas fa-list',
        path: ['영업', '프로젝트 목록'],
        theme: 'breadcrumb-projects'
    },
    'projects-new': {
        title: '신규 프로젝트',
        icon: 'fas fa-plus-circle',
        path: ['영업', '신규 프로젝트'],
        theme: 'breadcrumb-projects'
    },
    'sales-dashboard': {
        title: '영업 현황',
        icon: 'fas fa-chart-line',
        path: ['영업', '영업 현황'],
        theme: 'breadcrumb-sales'
    },
    'clients-list': {
        title: '거래처 관리',
        icon: 'fas fa-building',
        path: ['거래처', '거래처 관리'],
        theme: 'breadcrumb-clients'
    },
    'clients-form': {
        title: '거래처 등록',
        icon: 'fas fa-building',
        path: ['거래처', '거래처 등록'],
        theme: 'breadcrumb-clients'
    },
    'contracts-list': {
        title: '계약 목록',
        icon: 'fas fa-file-signature',
        path: ['계약', '계약 목록'],
        theme: 'breadcrumb-contracts'
    },
    'contracts-new': {
        title: '계약 등록',
        icon: 'fas fa-plus-circle',
        path: ['계약', '계약 등록'],
        theme: 'breadcrumb-contracts'
    },
    'revenue-list': {
        title: '매출 목록',
        icon: 'fas fa-won-sign',
        path: ['매출', '매출 목록'],
        theme: 'breadcrumb-revenue'
    },
    'revenue-new': {
        title: '매출 등록',
        icon: 'fas fa-plus-circle',
        path: ['매출', '매출 등록'],
        theme: 'breadcrumb-revenue'
    },
    'users': {
        title: '사용자 관리',
        icon: 'fas fa-users',
        path: ['관리자', '사용자 관리'],
        theme: 'breadcrumb-admin'
    },
    'common-codes': {
        title: '공통코드 관리',
        icon: 'fas fa-code',
        path: ['관리자', '공통코드 관리'],
        theme: 'breadcrumb-admin'
    }
};

/**
 * ⭐ Breadcrumb 업데이트 (신규 추가)
 */
function updateBreadcrumb(pageId) {
    const info = PAGE_INFO[pageId];
    if (!info) return;
    
    // 모든 페이지에서 기존 breadcrumb 제거
    document.querySelectorAll('.page-breadcrumb').forEach(bc => bc.remove());
    
    // 현재 페이지 찾기
    const currentPage = document.getElementById(`page-${pageId}`);
    if (!currentPage) return;
    
    // 페이지 내 main 컨테이너 찾기 (fallback 추가)
    const mainContainer = currentPage.querySelector('main')
        || currentPage.querySelector('.page-container')
        || currentPage.querySelector('.form-container')
        || currentPage;
    if (!mainContainer) return;
    
    // Breadcrumb HTML 생성
    const breadcrumbHTML = `
        <div class="page-breadcrumb ${info.theme}">
            <div class="breadcrumb-content">
                <i class="breadcrumb-icon ${info.icon}"></i>
                <div class="breadcrumb-text">
                    <h1 class="breadcrumb-title">${info.title}</h1>
                    <div class="breadcrumb-path">
                        ${info.path.map((p, i) => `
                            <span>${p}</span>
                            ${i < info.path.length - 1 ? '<i class="breadcrumb-separator fas fa-chevron-right"></i>' : ''}
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 첫 번째 요소 앞에 삽입
    mainContainer.insertAdjacentHTML('afterbegin', breadcrumbHTML);
}

/**
 * 페이지 전환
 */
function navigateTo(pageId) {
    console.log('🔄 페이지 전환:', pageId);
    
    // 모든 페이지 숨김
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';  // ⭐ 강제 숨김
    });
    
    // 선택한 페이지 표시
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) {
        // ⭐ 부모 요소들도 모두 표시 (중요!)
        let parent = targetPage.parentElement;
        while (parent && parent !== document.body) {
            if (parent.style) {
                parent.style.display = 'block';
                parent.style.visibility = 'visible';
                parent.style.opacity = '1';
            }
            parent = parent.parentElement;
        }
        
        // ⭐ 페이지 강제 표시
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        targetPage.style.visibility = 'visible';
        targetPage.style.opacity = '1';
        
        // ⭐ Breadcrumb 업데이트 (신규 추가)
        updateBreadcrumb(pageId);
        
        // 페이지별 초기화 (기존 로직 완전 보존)
        if (pageId === 'sales') {
            if (typeof initializeSales === 'function') initializeSales();
        } else if (pageId === 'project-detail') {
            if (typeof initializeProjectDetail === 'function') initializeProjectDetail();
        } else if (pageId === 'mobile-projects') {
            if (typeof initializeMobileProjects === 'function') initializeMobileProjects();
        } else if (pageId === 'mobile-project-new') {
            if (typeof initializeMobileProjectForm === 'function') initializeMobileProjectForm();
        } else if (pageId === 'mobile-history-new') {
            // ⭐ 이력 등록 초기화 추가
            if (typeof initializeMobileHistory === 'function') {
                console.log('🔧 모바일 이력 초기화 호출');
                initializeMobileHistory();
            } else {
                console.error('❌ initializeMobileHistory 함수를 찾을 수 없음');
            }
        }
        
        console.log('✅ 페이지 전환 완료:', pageId);
    } else {
        console.error('❌ 페이지를 찾을 수 없음:', pageId);
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
            
        // ⭐ 거래처 관리 페이지 초기화 (기존 유지)
        case 'clients':
        case 'clients-list':
            console.log('🏢 거래처 목록 페이지 초기화');
            // clients-list.js의 테이블이 자동 초기화됨
            // 필요시 추가 로직 작성
            break;
            
        case 'clients-form':
            console.log('🏢 거래처 폼 페이지 초기화');
            // clients-form.js의 폼이 자동 초기화됨
            // URL 파라미터에 따라 신규/수정 모드 설정
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
			
        // ⭐ 모바일 페이지 (기존 유지)
        case 'mobile-projects':
            console.log('📱 모바일 프로젝트 목록 초기화');
            if (typeof initializeMobileProjects !== 'undefined') {
                initializeMobileProjects();
            }
            break;
            
        case 'mobile-project-new':
            console.log('📱 모바일 프로젝트 폼 초기화');
            if (typeof initializeMobileProjectForm !== 'undefined') {
                initializeMobileProjectForm();
            }
            break;
            
        case 'mobile-history-new':
            console.log('📱 모바일 이력 등록 초기화');
            if (typeof initializeMobileHistory !== 'undefined') {
                initializeMobileHistory();
            }
            break;			
            
        default:
            console.log('📄 기본 페이지 초기화:', pageId);
    }
}

/**
 * 특정 모드로 프로젝트 폼 열기 (기존 기능 보존 + Breadcrumb 업데이트 추가)
 * @param {string} mode - 'new' 또는 'edit'
 * @param {string} pipelineId - 편집 모드일 때 프로젝트 ID
 */
function openProjectForm(mode = 'new', pipelineId = null) {
    console.log('📝 프로젝트 폼 열기:', mode, pipelineId);
    console.log('   - initializeProjectForm 존재?', typeof initializeProjectForm !== 'undefined');
    console.log('   - window.initializeProjectForm 존재?', typeof window.initializeProjectForm !== 'undefined');
 
    
    // URL 파라미터 설정
    let url = `${window.location.pathname}?page=projects-new&mode=${mode}`;
    if (pipelineId) {
        url += `&pipeline_id=${pipelineId}`;
    }
    
    if (history.pushState) {
        history.pushState({page: 'projects-new', mode, pipelineId}, '', url);
    }
    
    // 페이지 전환 (기존 방식 유지)
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    const targetPage = document.getElementById('page-projects-new');
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        targetPage.style.visibility = 'visible';
        targetPage.style.opacity = '1';
        
        // ⭐ Breadcrumb 업데이트 (신규 추가)
        updateBreadcrumb('projects-new');
        
        // ⭐ Breadcrumb 제목 동적 변경 (신규 추가)
        setTimeout(() => {
            const breadcrumbTitle = document.querySelector('.breadcrumb-title');
            if (breadcrumbTitle) {
                breadcrumbTitle.textContent = mode === 'edit' ? '프로젝트 수정' : '신규 프로젝트';
            }
        }, 10);
        
        // ✅ setTimeout 제거하고 바로 호출 (기존 로직)
        console.log('🔧 initializeProjectForm 호출 시작:', mode, pipelineId);
        if (typeof initializeProjectForm !== 'undefined') {
            initializeProjectForm(mode, pipelineId);
        } else {
            console.error('❌ initializeProjectForm 함수를 찾을 수 없습니다!');
        }
    } else {
        console.error('❌ page-projects-new 요소를 찾을 수 없습니다!');
    }
}

/**
 * ⭐ 거래처 폼 열기 (기존 유지 + Breadcrumb 추가)
 * @param {string} mode - 'new' 또는 'edit'
 * @param {number} clientId - 편집 모드일 때 거래처 ID
 */
function openClientForm(mode = 'new', clientId = null) {
    console.log('🏢 거래처 폼 열기:', mode, clientId);
    
    // URL 파라미터 설정
    let url = `${window.location.pathname}?page=clients-form&mode=${mode}`;
    if (clientId) {
        url += `&client_id=${clientId}`;
    }
    
    if (history.pushState) {
        history.pushState({page: 'clients-form', mode, clientId}, '', url);
    }
    
    // 페이지 전환
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    const targetPage = document.getElementById('page-clients-form');
    if (targetPage) {
        let parent = targetPage.parentElement;
        while (parent && parent !== document.body) {
            if (parent.style) {
                parent.style.display = 'block';
                parent.style.visibility = 'visible';
                parent.style.opacity = '1';
            }
            parent = parent.parentElement;
        }

        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        targetPage.style.visibility = 'visible';
        targetPage.style.opacity = '1';
        
        // ⭐ Breadcrumb 업데이트 (신규 추가)
        updateBreadcrumb('clients-form');
        
        // ⭐ Breadcrumb 제목 동적 변경 (신규 추가)
        setTimeout(() => {
            const breadcrumbTitle = document.querySelector('.breadcrumb-title');
            if (breadcrumbTitle) {
                breadcrumbTitle.textContent = mode === 'edit' ? '거래처 수정' : '거래처 등록';
            }
        }, 10);
        
        if (typeof initializeClientFormPage === 'function') {
            initializeClientFormPage(mode, clientId);
        }

        console.log('✅ 거래처 폼 페이지 활성화');
    } else {
        console.error('❌ page-clients-form 요소를 찾을 수 없습니다!');
    }
}

/**
 * ⭐ 거래처 목록으로 이동 (기존 유지)
 */
function openClientsList() {
    console.log('🏢 거래처 목록으로 이동');
    
    const url = `${window.location.pathname}?page=clients-list`;
    
    if (history.pushState) {
        history.pushState({page: 'clients-list'}, '', url);
    }
    
    navigateTo('clients-list');
}

/**
 * 내정보 모달 열기 (기존 유지)
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
 * 로그아웃 (기존 유지)
 */
async function logout() {
    console.log('🚪 로그아웃 요청');
    
    if (confirm('로그아웃 하시겠습니까?')) {
        console.log('✅ 로그아웃 확인');
        
        try {
            // AUTH 모듈의 logout 함수 사용
            await AUTH.logout();
            // AUTH.logout()이 자동으로 / 로 리디렉션
        } catch (error) {
            console.error('로그아웃 중 오류:', error);
            // 에러가 발생해도 로컬 데이터는 삭제하고 로그인 페이지로 이동
            AUTH.clearAuth();
            window.location.href = '/';
        }
    } else {
        console.log('❌ 로그아웃 취소');
    }
}

/**
 * 현재 활성화된 페이지 ID 가져오기 (기존 유지)
 */
function getCurrentPageId() {
    const activePage = document.querySelector('.page-content.active');
    if (activePage) {
        return activePage.id.replace('page-', '');
    }
    return null;
}

/**
 * 페이지 존재 여부 확인 (기존 유지)
 */
function pageExists(pageId) {
    return document.getElementById(`page-${pageId}`) !== null;
}

// ===================================
// Event Listeners (기존 완전 보존)
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
                } else if (pageId === 'clients-form' && mode === 'new') {
                    // ⭐ 신규 거래처 메뉴에서 직접 클릭한 경우
                    openClientForm('new');
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
    const clientIdParam = urlParams.get('client_id');
    
    console.log('📄 URL 파라미터:', {
        page: pageParam, 
        pipeline_id: pipelineIdParam,
        client_id: clientIdParam
    });
    
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
        updateBreadcrumb('projects-list');
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
                } 
                // ⭐ 거래처 폼인 경우
                else if (e.state.page === 'clients-form') {
                    // clients-form.js에서 자동 초기화
                    console.log('✅ 거래처 폼 히스토리 복원');
                } 
                else {
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
// Export to window (기존 완전 보존 + 신규 추가)
// ===================================
window.navigateTo = navigateTo;
window.initializePage = initializePage;
window.openProjectForm = openProjectForm;
window.openClientForm = openClientForm;        // ⭐ 신규 추가
window.openClientsList = openClientsList;      // ⭐ 신규 추가
window.openMyInfo = openMyInfo;
window.logout = logout;
window.getCurrentPageId = getCurrentPageId;
window.pageExists = pageExists;
window.updateBreadcrumb = updateBreadcrumb;    // ⭐ 신규 추가

console.log('📦 Navigation 모듈 로드 완료');
