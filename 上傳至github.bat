@echo off
chcp 65001 >nul
cd /d %~dp0

echo ========================================
echo   GitHub Force Sync (Debug Mode)
echo ========================================

echo [目前的 Git 狀態]
git status
echo.

echo [Step 1] Adding local changes...
git add .

echo [加入後的 Git 狀態]
git status
echo.

set datetime=%date:~0,10%_%time:~0,8%
set datetime=%datetime: =0%
set datetime=%datetime:/=-%
set datetime=%datetime::=-%

echo [Step 2] 嘗試 Committing: %datetime%
git commit -m "Auto_Update_%datetime%"

echo [Step 3] 嘗試 Force pushing to Cloud...
git push origin main --force

echo ========================================
echo   執行完畢！請看上方的訊息是否有報錯。
echo ========================================
pause