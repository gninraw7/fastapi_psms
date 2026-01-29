#!/bin/bash
# stop_server.sh

echo "🛑 PSMS FastAPI 서버 종료 중..."

if [ -f logs/server.pid ]; then
    PID=$(cat logs/server.pid)
    
    if ps -p $PID > /dev/null; then
        echo "⏹️  프로세스 종료: PID $PID"
        kill $PID
        sleep 2
        
        # 강제 종료 확인
        if ps -p $PID > /dev/null; then
            echo "⚠️  강제 종료 중..."
            kill -9 $PID
        fi
        
        rm logs/server.pid
        echo "✅ 서버가 종료되었습니다."
    else
        echo "⚠️  PID $PID 프로세스가 실행 중이 아닙니다."
        rm logs/server.pid
    fi
else
    echo "⚠️  PID 파일이 없습니다. 프로세스 검색 중..."
    pkill -f "uvicorn main:app"
    echo "✅ 모든 관련 프로세스를 종료했습니다."
fi