import zipfile
import os

excel_file = r"C:\Users\rpa\Downloads\千山機台維修建議(20260522).xlsx"
extract_dir = r"C:\Users\rpa\Desktop\上傳檔案至github\222\xlsx_temp"

if not os.path.exists(extract_dir):
    os.makedirs(extract_dir)

if os.path.exists(excel_file):
    with zipfile.ZipFile(excel_file, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
    print(f"Extracted to: {extract_dir}")
    print("Files extracted:")
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            print(f"  {os.path.join(root, file)}")
else:
    print(f"File not found: {excel_file}")
