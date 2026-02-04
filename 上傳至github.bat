@echo off
echo ========================================
echo   正在準備上傳檔案到 GitHub...
echo ========================================

:: 1. 加入所有變更
git add .

:: 2. 產生自動化備註 (使用日期時間)
set msg=Auto upload: %date% %time%
git commit -m "%msg%"

:: 3. 先拉取雲端更新以防衝突
echo 正在同步雲端資料...
git pull origin main --rebase

:: 4. 推送到 GitHub
echo 正在推送到 GitHub...
git push origin main

echo ========================================
echo   上傳完成！視窗將在 5 秒後關閉。
echo ========================================
timeout /t 5