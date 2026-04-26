@echo off
cd /d %~dp0

echo ========================================
echo   GitHub Force Sync (No Conflict Mode)
echo ========================================

:: 1. 先中止任何可能卡住的 Rebase (預防萬一)
git rebase --abort >nul 2>&1

:: 2. 加入變更
echo [Step 1] Adding local changes...
git add .

:: 3. 產生時間備註
set datetime=%date:~0,10%_%time:~0,8%
set datetime=%datetime: =0%
set datetime=%datetime:/=-%
set datetime=%datetime::=-%

:: 4. 提交變更
echo [Step 2] Committing: %datetime%
git commit -m "Auto_Update_%datetime%"

:: 5. 強制推送到 GitHub (關鍵點：覆蓋雲端)
echo [Step 3] Force pushing to Cloud...
git push origin main --force

echo ========================================
echo   Upload Success! (Cloud Overwritten)
echo ========================================
timeout /t 5