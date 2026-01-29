# app/core/logger.py
# -*- coding: utf-8 -*-
"""
로깅 설정 모듈
"""
import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
import os
from datetime import datetime

# 로그 디렉토리 생성
LOG_DIR = "logs"
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# 로그 파일 경로
APP_LOG_FILE = os.path.join(LOG_DIR, "psms_app.log")
ERROR_LOG_FILE = os.path.join(LOG_DIR, "psms_error.log")
ACCESS_LOG_FILE = os.path.join(LOG_DIR, "psms_access.log")
DB_LOG_FILE = os.path.join(LOG_DIR, "psms_db.log")

# 로그 포맷 설정
DETAILED_FORMAT = "%(asctime)s | %(name)s | %(levelname)-8s | %(message)s"
SIMPLE_FORMAT = "%(asctime)s | %(levelname)-8s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logger(name: str = "psms", level: int = logging.INFO):
    """
    애플리케이션 로거 설정
    
    Args:
        name: 로거 이름
        level: 로그 레벨
    
    Returns:
        설정된 로거
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # 기존 핸들러 제거 (중복 방지)
    logger.handlers.clear()
    
    # 포맷터 생성
    detailed_formatter = logging.Formatter(DETAILED_FORMAT, DATE_FORMAT)
    simple_formatter = logging.Formatter(SIMPLE_FORMAT, DATE_FORMAT)
    
    # 1. 콘솔 핸들러 (터미널 출력)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    logger.addHandler(console_handler)
    
    # 2. 애플리케이션 로그 파일 (크기 기반 로테이션)
    app_file_handler = RotatingFileHandler(
        APP_LOG_FILE,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=10,
        encoding='utf-8'
    )
    app_file_handler.setLevel(logging.INFO)
    app_file_handler.setFormatter(detailed_formatter)
    logger.addHandler(app_file_handler)
    
    # 3. 에러 로그 파일 (에러만 별도 저장)
    error_file_handler = RotatingFileHandler(
        ERROR_LOG_FILE,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(detailed_formatter)
    logger.addHandler(error_file_handler)
    
    return logger


def setup_access_logger():
    """액세스 로그 전용 로거 설정"""
    access_logger = logging.getLogger("psms.access")
    access_logger.setLevel(logging.INFO)
    access_logger.handlers.clear()
    
    # 액세스 로그 파일 핸들러 (일별 로테이션)
    access_handler = TimedRotatingFileHandler(
        ACCESS_LOG_FILE,
        when="midnight",
        interval=1,
        backupCount=30,  # 30일 보관
        encoding='utf-8'
    )
    access_formatter = logging.Formatter(
        "%(asctime)s | %(message)s",
        DATE_FORMAT
    )
    access_handler.setFormatter(access_formatter)
    access_logger.addHandler(access_handler)
    
    return access_logger


def setup_db_logger():
    """데이터베이스 로그 전용 로거 설정"""
    db_logger = logging.getLogger("psms.database")
    db_logger.setLevel(logging.INFO)
    db_logger.handlers.clear()
    
    # DB 로그 파일 핸들러
    db_handler = RotatingFileHandler(
        DB_LOG_FILE,
        maxBytes=5*1024*1024,  # 5MB
        backupCount=5,
        encoding='utf-8'
    )
    db_formatter = logging.Formatter(DETAILED_FORMAT, DATE_FORMAT)
    db_handler.setFormatter(db_formatter)
    db_logger.addHandler(db_handler)
    
    # 콘솔 출력도 추가
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)  # 콘솔엔 경고 이상만
    console_handler.setFormatter(logging.Formatter(SIMPLE_FORMAT, DATE_FORMAT))
    db_logger.addHandler(console_handler)
    
    return db_logger


# 로거 인스턴스 생성
app_logger = setup_logger("psms")
access_logger = setup_access_logger()
db_logger = setup_db_logger()


def log_startup_info():
    """시작 정보 로깅"""
    app_logger.info("=" * 70)
    app_logger.info("🚀 PSMS FastAPI Server Starting...")
    app_logger.info("=" * 70)


def log_shutdown_info():
    """종료 정보 로깅"""
    app_logger.info("=" * 70)
    app_logger.info("🛑 PSMS FastAPI Server Shutting Down...")
    app_logger.info(f"⏰ Shutdown Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    app_logger.info("=" * 70)