/**
 * markdown-formatter.js
 * 전략내용 입력란의 마크다운 스타일 자동 포맷팅
 * 
 * 지원 기능:
 * - 글머리 기호: *, -, + → •
 * - 번호 목록: 1., 2., 3. → 자동 번호
 * - 체크박스: [ ], [x] → ☐, ☑
 * - 들여쓰기: Tab, Shift+Tab
 * - Enter 시 자동 계속
 */

// ===================================
// 마크다운 포맷팅 설정
// ===================================
const MarkdownFormatter = {
    enabled: false,  // 기본값: 비활성화
    indentSize: 2,   // 들여쓰기 크기 (스페이스 개수)
    
    // 포맷팅 규칙
    rules: {
        bullet: /^(\s*)([*\-+])\s(.*)$/,           // * - +
        numbered: /^(\s*)(\d+)\.\s(.*)$/,          // 1. 2. 3.
        checkbox: /^(\s*)\[([ x])\]\s(.*)$/i,      // [ ] [x]
    },
    
    // 유니코드 기호
    symbols: {
        bullet: '•',
        checkboxEmpty: '☐',
        checkboxChecked: '☑',
    }
};

// ===================================
// 포맷팅 활성화/비활성화
// ===================================
function toggleMarkdownFormatting(enabled) {
    MarkdownFormatter.enabled = enabled;
    
    // 로컬 스토리지에 저장
    localStorage.setItem('markdown_formatting_enabled', enabled ? '1' : '0');
    
    console.log('📝 마크다운 포맷팅:', enabled ? '활성화' : '비활성화');
}

// ===================================
// 초기화 (페이지 로드 시)
// ===================================
function initMarkdownFormatting() {
    // 로컬 스토리지에서 설정 불러오기
    const saved = localStorage.getItem('markdown_formatting_enabled');
    MarkdownFormatter.enabled = saved === '1';
    
    // 체크박스 상태 동기화
    const checkbox = document.getElementById('enable_markdown_formatting');
    if (checkbox) {
        checkbox.checked = MarkdownFormatter.enabled;
    }
    
    console.log('📝 마크다운 포맷팅 초기화:', MarkdownFormatter.enabled);
}

// ===================================
// 라인 분석 및 포맷팅
// ===================================
function formatLine(line) {
    if (!MarkdownFormatter.enabled) return line;
    
    // 1. 글머리 기호 변환 (* - + → •)
    const bulletMatch = line.match(MarkdownFormatter.rules.bullet);
    if (bulletMatch) {
        const [, indent, , content] = bulletMatch;
        return `${indent}${MarkdownFormatter.symbols.bullet} ${content}`;
    }
    
    // 2. 체크박스 변환 ([ ] → ☐, [x] → ☑)
    const checkboxMatch = line.match(MarkdownFormatter.rules.checkbox);
    if (checkboxMatch) {
        const [, indent, check, content] = checkboxMatch;
        const symbol = check.toLowerCase() === 'x' 
            ? MarkdownFormatter.symbols.checkboxChecked 
            : MarkdownFormatter.symbols.checkboxEmpty;
        return `${indent}${symbol} ${content}`;
    }
    
    // 3. 번호 목록은 그대로 유지
    return line;
}

// ===================================
// Enter 키 처리 (자동 계속)
// ===================================
function handleEnterKey(textarea, event) {
    if (!MarkdownFormatter.enabled) return false;
    
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    const lines = text.substring(0, cursorPos).split('\n');
    const currentLine = lines[lines.length - 1];
    
    // 현재 줄 분석
    let nextLinePrefix = '';
    
    // 1. 글머리 기호
    const bulletMatch = currentLine.match(/^(\s*)[•\*\-+]\s/);
    if (bulletMatch) {
        // 현재 줄이 비어있으면 포맷 종료
        if (currentLine.trim() === bulletMatch[0].trim()) {
            // 현재 줄의 포맷 삭제
            event.preventDefault();
            const beforeCursor = text.substring(0, cursorPos - currentLine.length);
            const afterCursor = text.substring(cursorPos);
            textarea.value = beforeCursor + '\n' + afterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeCursor.length + 1;
            return true;
        }
        nextLinePrefix = `${bulletMatch[1]}${MarkdownFormatter.symbols.bullet} `;
    }
    
    // 2. 번호 목록
    const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s/);
    if (numberedMatch) {
        if (currentLine.trim() === numberedMatch[0].trim()) {
            // 포맷 종료
            event.preventDefault();
            const beforeCursor = text.substring(0, cursorPos - currentLine.length);
            const afterCursor = text.substring(cursorPos);
            textarea.value = beforeCursor + '\n' + afterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeCursor.length + 1;
            return true;
        }
        const nextNumber = parseInt(numberedMatch[2]) + 1;
        nextLinePrefix = `${numberedMatch[1]}${nextNumber}. `;
    }
    
    // 3. 체크박스
    const checkboxMatch = currentLine.match(/^(\s*)[☐☑]\s/);
    if (checkboxMatch) {
        if (currentLine.trim() === checkboxMatch[0].trim()) {
            // 포맷 종료
            event.preventDefault();
            const beforeCursor = text.substring(0, cursorPos - currentLine.length);
            const afterCursor = text.substring(cursorPos);
            textarea.value = beforeCursor + '\n' + afterCursor;
            textarea.selectionStart = textarea.selectionEnd = beforeCursor.length + 1;
            return true;
        }
        nextLinePrefix = `${checkboxMatch[1]}${MarkdownFormatter.symbols.checkboxEmpty} `;
    }
    
    // 다음 줄에 포맷 추가
    if (nextLinePrefix) {
        event.preventDefault();
        const beforeCursor = text.substring(0, cursorPos);
        const afterCursor = text.substring(cursorPos);
        textarea.value = beforeCursor + '\n' + nextLinePrefix + afterCursor;
        textarea.selectionStart = textarea.selectionEnd = cursorPos + 1 + nextLinePrefix.length;
        return true;
    }
    
    return false;
}

// ===================================
// Tab 키 처리 (들여쓰기)
// ===================================
function handleTabKey(textarea, event, shiftKey) {
    if (!MarkdownFormatter.enabled) return false;
    
    event.preventDefault();
    
    const cursorPos = textarea.selectionStart;
    const cursorEnd = textarea.selectionEnd;
    const text = textarea.value;
    
    // 선택 영역이 있는 경우
    if (cursorPos !== cursorEnd) {
        const beforeSelection = text.substring(0, cursorPos);
        const selection = text.substring(cursorPos, cursorEnd);
        const afterSelection = text.substring(cursorEnd);
        
        const lines = selection.split('\n');
        const indent = ' '.repeat(MarkdownFormatter.indentSize);
        
        let modifiedLines;
        if (shiftKey) {
            // Shift+Tab: 내어쓰기
            modifiedLines = lines.map(line => {
                if (line.startsWith(indent)) {
                    return line.substring(indent.length);
                } else if (line.startsWith(' ')) {
                    return line.substring(1);
                }
                return line;
            });
        } else {
            // Tab: 들여쓰기
            modifiedLines = lines.map(line => indent + line);
        }
        
        const newSelection = modifiedLines.join('\n');
        textarea.value = beforeSelection + newSelection + afterSelection;
        textarea.selectionStart = cursorPos;
        textarea.selectionEnd = cursorPos + newSelection.length;
    } else {
        // 현재 줄만 처리
        const lines = text.substring(0, cursorPos).split('\n');
        const currentLineStart = cursorPos - lines[lines.length - 1].length;
        const currentLineEnd = text.indexOf('\n', cursorPos);
        const currentLine = text.substring(currentLineStart, currentLineEnd === -1 ? text.length : currentLineEnd);
        
        const indent = ' '.repeat(MarkdownFormatter.indentSize);
        let newLine;
        
        if (shiftKey) {
            // Shift+Tab: 내어쓰기
            if (currentLine.startsWith(indent)) {
                newLine = currentLine.substring(indent.length);
            } else if (currentLine.startsWith(' ')) {
                newLine = currentLine.substring(1);
            } else {
                return true;
            }
        } else {
            // Tab: 들여쓰기
            newLine = indent + currentLine;
        }
        
        const beforeLine = text.substring(0, currentLineStart);
        const afterLine = text.substring(currentLineEnd === -1 ? text.length : currentLineEnd);
        
        textarea.value = beforeLine + newLine + afterLine;
        textarea.selectionStart = textarea.selectionEnd = cursorPos + (shiftKey ? -Math.min(indent.length, currentLine.length - currentLine.trimStart().length) : indent.length);
    }
    
    return true;
}

// ===================================
// 스페이스 키 처리 (자동 변환)
// ===================================
function handleSpaceKey(textarea, event) {
    if (!MarkdownFormatter.enabled) return false;
    
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    const lines = text.substring(0, cursorPos).split('\n');
    const currentLine = lines[lines.length - 1];
    
    // 라인 시작 부분에서 스페이스를 입력한 경우만 처리
    const trimmedLine = currentLine.trimStart();
    if (trimmedLine !== currentLine) return false;  // 이미 들여쓰기가 있음
    
    // 변환 가능한 패턴인지 확인
    const patterns = [
        /^[*\-+]$/,        // * - +
        /^\d+\.$/,         // 1. 2. 3.
        /^\[([ x])\]$/i,   // [ ] [x]
    ];
    
    const shouldTransform = patterns.some(pattern => pattern.test(currentLine));
    
    if (shouldTransform) {
        // 다음 입력까지 대기 (스페이스 입력 후 변환)
        setTimeout(() => {
            const newCursorPos = textarea.selectionStart;
            const newText = textarea.value;
            const newLines = newText.substring(0, newCursorPos).split('\n');
            const newCurrentLine = newLines[newLines.length - 1];
            
            const formatted = formatLine(newCurrentLine);
            if (formatted !== newCurrentLine) {
                const lineStart = newCursorPos - newCurrentLine.length;
                const lineEnd = newText.indexOf('\n', newCursorPos);
                const beforeLine = newText.substring(0, lineStart);
                const afterLine = newText.substring(lineEnd === -1 ? newText.length : lineEnd);
                
                textarea.value = beforeLine + formatted + afterLine;
                textarea.selectionStart = textarea.selectionEnd = lineStart + formatted.length;
            }
        }, 0);
    }
    
    return false;
}

// ===================================
// Textarea 이벤트 핸들러 바인딩
// ===================================
function bindMarkdownFormatting(textarea) {
    if (!textarea) return;
    
    textarea.addEventListener('keydown', function(event) {
        // Enter 키
        if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
            if (handleEnterKey(textarea, event)) {
                return;
            }
        }
        
        // Tab 키
        if (event.key === 'Tab') {
            if (handleTabKey(textarea, event, event.shiftKey)) {
                return;
            }
        }
        
        // Space 키 (자동 변환)
        if (event.key === ' ') {
            handleSpaceKey(textarea, event);
        }
    });
    
    console.log('✅ 마크다운 포맷팅 이벤트 바인딩 완료');
}

// Export functions
window.MarkdownFormatter = MarkdownFormatter;
window.toggleMarkdownFormatting = toggleMarkdownFormatting;
window.initMarkdownFormatting = initMarkdownFormatting;
window.bindMarkdownFormatting = bindMarkdownFormatting;

console.log('📦 Markdown Formatter 모듈 로드 완료');
