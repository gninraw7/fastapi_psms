#!/bin/bash

# 1단계: 폴더 구조 생성 (업무 기능 중심)
mkdir -p app/{api/v1/endpoints,core,models,schemas,services,utils}
mkdir -p app/api/v1/endpoints/{projects,common_codes,users}
mkdir -p tests
mkdir -p logs

# 빈 __init__.py 파일 생성
touch app/__init__.py
touch app/api/__init__.py
touch app/api/v1/__init__.py
touch app/api/v1/endpoints/__init__.py
touch app/core/__init__.py
touch app/models/__init__.py
touch app/schemas/__init__.py
touch app/services/__init__.py
touch app/utils/__init__.py

echo "폴더 구조 생성 완료!"
tree -I '__pycache__|*.pyc' .
