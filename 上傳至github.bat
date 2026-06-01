@echo off
chcp 65001 >nul
cd /d "C:\Users\rpa\Desktop\上傳檔案至github\222"
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
if %errorlevel% neq 0 (
    echo [提示] 沒有新變更需要 Commit，嘗試直接 Push...
)
echo [Step 3] 嘗試 Force pushing to Cloud...
git push origin main --force
if %errorlevel% neq 0 (
    echo [錯誤] Push 失敗！請檢查網路或 remote 設定。
) else (
    echo [成功] Push 完成，GitHub 已更新！
)
echo ========================================
echo   執行完畢！請看上方的訊息是否有報錯。
echo ========================================
pause