/**
 * stage-icons.js
 * 진행단계별 아이콘 매핑 및 렌더링
 * 
 * 버전: 1.0
 * 작성일: 2026-02-01
 * 
 * 적용 위치:
 * 1. 프로젝트 목록 그리드
 * 2. 프로젝트 수정 - 기본정보 탭 진행단계
 * 3. 프로젝트 수정 - 변경이력 탭 진행단계 선택
 * 4. 프로젝트 수정 - 변경이력 이력 항목 표시
 */

// ===================================
// 진행단계 아이콘 매핑
// ===================================
const StageIcons = {
    // 아이콘 매핑 (코드 → 아이콘 클래스 + 색상)
    icons: {
        'S01': { icon: 'fa-phone-volume', color: '#3498db', label: '영업중' },           // 파랑
        'S02': { icon: 'fa-file-invoice-dollar', color: '#9b59b6', label: '견적제출' },  // 보라
        'S03': { icon: 'fa-lightbulb', color: '#f39c12', label: '제안중' },              // 주황
        'S04': { icon: 'fa-gavel', color: '#e67e22', label: '입찰중' },                  // 오렌지
        'S05': { icon: 'fa-ban', color: '#e74c3c', label: 'DROP' },                     // 빨강 - 포기
        'S06': { icon: 'fa-thumbs-down', color: '#c0392b', label: '실주' },             // 진한 빨강 - 실패
        'S07': { icon: 'fa-check-circle', color: '#27ae60', label: '수주완료' },         // 초록 - 성공
        'S08': { icon: 'fa-file-signature', color: '#2ecc71', label: '계약완료' },       // 밝은 초록
        'S09': { icon: 'fa-tools', color: '#95a5a6', label: '유지보수' },                // 회색
    },
    
    // 기본 아이콘 (매핑에 없는 경우)
    default: { icon: 'fa-circle', color: '#95a5a6', label: '기타' },
    
    /**
     * 아이콘 HTML 생성
     * @param {string} stageCode - 진행단계 코드 (예: 'S01')
     * @param {string} stageName - 진행단계명 (예: '1 영업중')
     * @param {object} options - 옵션
     *   - size: 'xs', 'sm', 'md', 'lg' (기본: 'sm')
     *   - showText: true/false (기본: true)
     *   - style: 'inline', 'badge' (기본: 'inline')
     * @returns {string} HTML 문자열
     */
    render(stageCode, stageName, options = {}) {
        const config = this.icons[stageCode] || this.default;
        const size = options.size || 'sm';
        const showText = options.showText !== false;
        const style = options.style || 'inline';
        
        // 아이콘 클래스 생성
        let iconClass = `fas ${config.icon}`;
        if (size === 'xs') iconClass += ' fa-xs';
        else if (size === 'md') iconClass += ' fa-lg';
        else if (size === 'lg') iconClass += ' fa-2x';
        
        // 아이콘 HTML
        const iconHtml = `<i class="${iconClass}" style="color: ${config.color}; margin-right: 0.35rem;"></i>`;
        
        if (style === 'badge') {
            // 배지 스타일 (배경색 포함)
            return `
                <span style="
                    display: inline-flex;
                    align-items: center;
                    padding: 0.25rem 0.75rem;
                    background: ${this.hexToRgba(config.color, 0.1)};
                    border: 1px solid ${this.hexToRgba(config.color, 0.3)};
                    border-radius: 16px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    white-space: nowrap;
                ">
                    ${iconHtml}${showText ? stageName : ''}
                </span>
            `;
        } else {
            // 인라인 스타일 (기본)
            return showText ? `${iconHtml}${stageName}` : iconHtml;
        }
    },
    
    /**
     * 아이콘만 반환
     */
    getIcon(stageCode) {
        return this.render(stageCode, '', { showText: false });
    },
    
    /**
     * 색상만 반환
     */
    getColor(stageCode) {
        const config = this.icons[stageCode] || this.default;
        return config.color;
    },
    
    /**
     * 설정 정보 반환
     */
    getConfig(stageCode) {
        return this.icons[stageCode] || this.default;
    },
    
    /**
     * Hex 색상을 RGBA로 변환
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
};

// Export
window.StageIcons = StageIcons;

console.log('🎨 Stage Icons 모듈 로드 완료');
