@echo off
chcp 65001 > nul
echo 正在讀取 Excel 檔案，請稍候...
python "C:\Users\rpa\Desktop\上傳檔案至github\222\read_excel_complete.py" > "C:\Users\rpa\Desktop\excel_output.txt" 2>&1
if errorlevel 1 (
    echo Python 執行失敗，嘗試安裝 openpyxl...
    pip install openpyxl
    python "C:\Users\rpa\Desktop\上傳檔案至github\222\read_excel_complete.py" > "C:\Users\rpa\Desktop\excel_output.txt" 2>&1
)
echo 完成！結果已儲存至 C:\Users\rpa\Desktop\excel_output.txt
echo 正在開啟結果...
notepad "C:\Users\rpa\Desktop\excel_output.txt"
pause
