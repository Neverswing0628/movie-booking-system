@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo.
echo ================================================
echo   🎬 영화 예매 시스템 - GitHub 자동 백업
echo ================================================
echo.

REM 커밋 메시지 (인자로 받거나 기본값)
set COMMIT_MSG=%~1
if "%COMMIT_MSG%"=="" (
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set CURRENT_DATE=%%c-%%a-%%b
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do set CURRENT_TIME=%%a:%%b
    set COMMIT_MSG=[백업] !CURRENT_DATE! !CURRENT_TIME!
)

echo 🔍 변경된 파일 확인 중...
echo.
git status --short
echo.

echo 📝 변경 사항:
git status --short
echo.

echo 📦 Git에 추가 중...
git add .
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 파일 추가 실패!
    pause
    exit /b 1
)
echo ✅ 모든 파일 추가 완료
echo.

echo 💾 커밋 생성 중...
git commit -m "%COMMIT_MSG%"
if %ERRORLEVEL% NEQ 0 (
    echo ℹ️  변경사항이 없거나 커밋 실패
    echo.
    git status
    pause
    exit /b 1
)
echo ✅ 커밋 완료: %COMMIT_MSG%
echo.

echo 🚀 GitHub에 푸시 중...
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  푸시 실패! 다음을 확인하세요:
    echo    1. 인터넷 연결
    echo    2. GitHub Personal Access Token
    echo    3. git remote -v 로 원격 저장소 확인
    echo.
    echo 💡 해결 방법:
    echo    git pull origin main --rebase
    echo    git push origin main
    echo.
    pause
    exit /b 1
)
echo ✅ GitHub 백업 완료!
echo.

echo ================================================
echo   🎉 백업 성공!
echo ================================================
echo.
echo 📊 최근 커밋 내역:
git log --oneline -5
echo.
echo 🌐 GitHub 저장소:
git remote get-url origin
echo.

pause
