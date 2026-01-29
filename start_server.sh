#!/bin/bash
# start_server.sh

set -e

# 스크립트 디렉토리로 이동
cd "$(dirname "$0")"

# 로그 디렉토리 생성
mkdir -p logs

echo "======================================"
echo "🚀 PSMS FastAPI 서버 시작"
echo "======================================"

# 기존 프로세스 종료
echo "🔍 기존 FastAPI 프로세스 확인 중..."
if pgrep -f "uvicorn main:app" > /dev/null; then
    echo "⏹️  기존 프로세스 종료 중..."
    pkill -f "uvicorn main:app"
    sleep 2
fi

# 가상환경 활성화
if [ -d "venv" ]; then
    echo "🔧 가상환경 활성화 중..."
    source venv/bin/activate
    echo "✅ 가상환경 활성화 완료"
else
    echo "❌ 가상환경(venv)을 찾을 수 없습니다!"
    exit 1
fi

# 경로 확인
echo "📍 Python: $(which python)"
echo "📍 Uvicorn: $(which uvicorn)"

# 서버 시작 (백그라운드)
echo ""
echo "🚀 서버 시작 중..."

nohup uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --log-level info \
    >> logs/uvicorn_stdout.log 2>&1 &

# PID 저장
SERVER_PID=$!
echo $SERVER_PID > logs/server.pid

sleep 3

# 상태 확인
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo ""
    echo "======================================"
    echo "✅ 서버가 성공적으로 시작되었습니다!"
    echo "======================================"
    echo ""
    echo "📍 PID: $SERVER_PID"
    echo "📍 포트: 8000"
    echo "📍 API Docs: http://172.30.1.16:8000/docs"
    echo "📍 Web App: http://172.30.1.16:8000/"
    echo ""
    echo "📝 로그 파일:"
    echo "   - logs/psms_app.log"
    echo "   - logs/psms_access.log"
    echo "   - logs/psms_error.log"
    echo "   - logs/psms_db.log"
    echo "   - logs/uvicorn_stdout.log"
    echo ""
    echo "📊 실시간 로그 확인:"
    echo "   tail -f logs/psms_app.log"
    echo "   tail -f logs/uvicorn_stdout.log"
    echo ""
    echo "🛑 서버 중지:"
    echo "   ./stop_server.sh"
    echo ""
else
    echo ""
    echo "======================================"
    echo "❌ 서버 시작 실패!"
    echo "======================================"
    echo ""
    echo "로그 확인:"
    cat logs/uvicorn_stdout.log 2>/dev/null || echo "로그 파일 없음"
    exit 1
fi