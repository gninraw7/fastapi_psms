#!/bin/bash
# view_logs.sh

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   PSMS FastAPI 로그 뷰어              ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "  1. 📱 애플리케이션 로그 (실시간)"
echo "  2. ❌ 에러 로그 (실시간)"
echo "  3. 🌐 HTTP 액세스 로그 (실시간)"
echo "  4. 🗄️  데이터베이스 로그 (실시간)"
echo "  5. 📄 Uvicorn 출력 로그 (실시간)"
echo "  6. 📋 최근 50줄 보기 (애플리케이션)"
echo "  7. 🔍 에러 검색 (애플리케이션)"
echo "  8. 📊 로그 통계"
echo "  9. 🧹 오래된 로그 정리"
echo "  0. 종료"
echo ""
echo "════════════════════════════════════════"
read -p "선택 (0-9): " choice

case $choice in
    1)
        echo "실시간 애플리케이션 로그 (Ctrl+C로 종료)"
        tail -f logs/psms_app.log
        ;;
    2)
        echo "실시간 에러 로그 (Ctrl+C로 종료)"
        tail -f logs/psms_error.log
        ;;
    3)
        echo "실시간 HTTP 액세스 로그 (Ctrl+C로 종료)"
        tail -f logs/psms_access.log
        ;;
    4)
        echo "실시간 데이터베이스 로그 (Ctrl+C로 종료)"
        tail -f logs/psms_db.log
        ;;
    5)
        echo "실시간 Uvicorn 출력 로그 (Ctrl+C로 종료)"
        tail -f logs/uvicorn_stdout.log
        ;;
    6)
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "최근 50줄 - 애플리케이션 로그"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -n 50 logs/psms_app.log
        ;;
    7)
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "에러 로그 검색 (최근 100줄)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        tail -n 100 logs/psms_app.log | grep -i "error"
        ;;
    8)
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "로그 통계"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "애플리케이션 로그:"
        if [ -f logs/psms_app.log ]; then
            wc -l logs/psms_app.log
            echo "  INFO: $(grep -c "INFO" logs/psms_app.log)"
            echo "  WARNING: $(grep -c "WARNING" logs/psms_app.log)"
            echo "  ERROR: $(grep -c "ERROR" logs/psms_app.log)"
        fi
        echo ""
        echo "에러 로그:"
        if [ -f logs/psms_error.log ]; then
            wc -l logs/psms_error.log
        fi
        ;;
    9)
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "오래된 로그 정리 (30일 이전)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        find logs/ -name "*.log.*" -mtime +30 -delete
        echo "✅ 정리 완료"
        ;;
    0)
        echo "종료합니다."
        ;;
    *)
        echo "잘못된 선택입니다."
        ;;
esac
