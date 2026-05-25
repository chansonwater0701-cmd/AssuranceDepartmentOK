#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract and display Excel file content by reading XLSX as ZIP archive
"""
import zipfile
import xml.etree.ElementTree as ET
import os

excel_file = r"C:\Users\rpa\Downloads\千山機台維修建議(20260522).xlsx"

def get_shared_strings(zip_file):
    """Extract shared strings from the Excel file"""
    strings = {}
    try:
        with zip_file.open('xl/sharedStrings.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            # Extract all strings
            for idx, si in enumerate(root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si')):
                t_elem = si.find('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                if t_elem is not None:
                    strings[idx] = t_elem.text
            return strings
    except:
        return {}

def get_workbook_info(zip_file):
    """Get list of sheets"""
    try:
        with zip_file.open('xl/workbook.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            sheets = []
            for sheet in root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
                sheets.append({
                    'name': sheet.get('name'),
                    'sheetId': sheet.get('sheetId'),
                    'rId': sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                })
            return sheets
    except Exception as e:
        print(f"Error reading workbook: {e}")
        return []

def get_sheet_data(zip_file, sheet_name):
    """Extract data from a specific sheet"""
    try:
        with zip_file.open(f'xl/worksheets/{sheet_name}.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            
            data = []
            for row in root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                row_num = row.get('r', '?')
                cells = []
                for cell in row.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    ref = cell.get('r', '?')
                    value = ''
                    
                    # Get cell value
                    v_elem = cell.find('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    if v_elem is not None and v_elem.text:
                        value = v_elem.text
                    else:
                        # Try to get text from t element
                        t_elem = cell.find('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                        if t_elem is not None and t_elem.text:
                            value = t_elem.text
                    
                    cells.append({'ref': ref, 'value': value})
                
                if cells:  # Only add non-empty rows
                    data.append({'row': row_num, 'cells': cells})
            
            return data
    except Exception as e:
        print(f"Error reading sheet: {e}")
        return []

# Main execution
if not os.path.exists(excel_file):
    print(f"ERROR: File not found: {excel_file}")
    exit(1)

try:
    with zipfile.ZipFile(excel_file, 'r') as zip_file:
        print("\n" + "="*140)
        print(f"EXCEL FILE: {excel_file}")
        print("="*140)
        
        # Get sheets info
        sheets_info = get_workbook_info(zip_file)
        print(f"\nTotal Sheets: {len(sheets_info)}")
        for s in sheets_info:
            print(f"  - {s['name']} (ID: {s['sheetId']})")
        
        # Get shared strings
        shared_strings = get_shared_strings(zip_file)
        print(f"\nShared Strings Count: {len(shared_strings)}")
        
        # Print each sheet data
        for sheet_info in sheets_info:
            sheet_name = sheet_info['name']
            print("\n" + "="*140)
            print(f"SHEET: [{sheet_name}]")
            print("="*140)
            
            # Try sheet1, sheet2, etc.
            for sheet_file in ['sheet1', 'sheet2', 'sheet3', 'sheet4', 'sheet5']:
                sheet_data = get_sheet_data(zip_file, sheet_file)
                if sheet_data:
                    print(f"Found data in '{sheet_file}.xml'")
                    for row_data in sheet_data:
                        cells_str = " | ".join([f"{c['ref']}: {c['value']}" for c in row_data['cells']])
                        print(f"Row {row_data['row']:3s} | {cells_str}")
                    break
            print("="*140)

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
