#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "================================================"
echo "  🎬 영화 예매 시스템 - GitHub 자동 백업"
echo "================================================"
echo ""

# 커밋 메시지 (인자로 받거나 기본값)
if [ -z "$1" ]; then
    COMMIT_MSG="[백업] $(date '+%Y-%m-%d %H:%M:%S')"
else
    COMMIT_MSG="$1"
fi

echo -e "${BLUE}🔍 변경된 파일 확인 중...${NC}"
echo ""
git status --short
echo ""

echo -e "${YELLOW}📝 변경 사항:${NC}"
git status --short
echo ""

echo -e "${BLUE}📦 Git에 추가 중...${NC}"
git add .
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 파일 추가 실패!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 모든 파일 추가 완료${NC}"
echo ""

echo -e "${BLUE}💾 커밋 생성 중...${NC}"
git commit -m "$COMMIT_MSG"
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}ℹ️  변경사항이 없거나 커밋 실패${NC}"
    echo ""
    git status
    exit 1
fi
echo -e "${GREEN}✅ 커밋 완료: $COMMIT_MSG${NC}"
echo ""

echo -e "${BLUE}🚀 GitHub에 푸시 중...${NC}"
git push origin main
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}⚠️  푸시 실패! 다음을 확인하세요:${NC}"
    echo "   1. 인터넷 연결"
    echo "   2. GitHub Personal Access Token"
    echo "   3. git remote -v 로 원격 저장소 확인"
    echo ""
    echo -e "${YELLOW}💡 해결 방법:${NC}"
    echo "   git pull origin main --rebase"
    echo "   git push origin main"
    echo ""
    exit 1
fi
echo -e "${GREEN}✅ GitHub 백업 완료!${NC}"
echo ""

echo "================================================"
echo -e "  ${GREEN}🎉 백업 성공!${NC}"
echo "================================================"
echo ""
echo -e "${BLUE}📊 최근 커밋 내역:${NC}"
git log --oneline -5
echo ""
echo -e "${BLUE}🌐 GitHub 저장소:${NC}"
git remote get-url origin
echo ""
