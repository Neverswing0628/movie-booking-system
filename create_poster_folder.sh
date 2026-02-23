#!/bin/bash

# 포스터 폴더 생성 스크립트 (Mac/Linux)

echo "================================"
echo "영화 포스터 폴더 생성"
echo "================================"

# 현재 위치 확인
echo ""
echo "현재 위치: $(pwd)"
echo ""

# public 폴더가 있는지 확인
if [ ! -d "public" ]; then
    echo "[오류] public 폴더를 찾을 수 없습니다."
    echo "이 스크립트는 프로젝트 루트 폴더에서 실행해야 합니다."
    exit 1
fi

# images/posters 폴더 생성
echo "폴더 생성 중..."
mkdir -p public/images/posters

echo ""
echo "[완료] 폴더가 성공적으로 생성되었습니다!"
echo ""
echo "경로: $(pwd)/public/images/posters"
echo ""
echo "================================"
echo "다음 단계:"
echo "================================"
echo "1. 영화 포스터를 다운로드하세요 (movie1.jpg ~ movie20.jpg)"
echo "2. public/images/posters 폴더에 복사하세요"
echo "   예: cp ~/Downloads/movie*.jpg public/images/posters/"
echo "3. npm start 명령으로 서버를 시작하세요"
echo ""
