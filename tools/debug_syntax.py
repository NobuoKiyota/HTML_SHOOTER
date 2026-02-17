import re
import sys

def check_file(filepath):
    print(f"Checking {filepath}...")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Simple regex for unexpected token '.'
    # 1. '..' (but not '...')
    # 2. ' . ' (maybe?)
    # 3. 'obj.' at end of line? (valid in multiline)
    # 4. '.prop' at start of line? (valid)
    
    # Exclude comments
    for i, line in enumerate(lines):
        # Remove // comments
        clean_line = re.sub(r'//.*', '', line).strip()
        # Remove strings (simplified)
        clean_line = re.sub(r'"[^"]*"', '', clean_line)
        clean_line = re.sub(r"'[^']*'", '', clean_line)
        clean_line = re.sub(r'`[^`]*`', '', clean_line)
        
        # Check for '..' but not '...'
        if '..' in clean_line and '...' not in clean_line:
            # Check if it's a number like 0..toString() (valid)
            # Regex for digit..word
            if not re.search(r'\d\.\.[a-zA-Z]', clean_line):
                 print(f"Line {i+1}: Suspicious '..' -> {line.strip()}")
        
        # Check for ' . ' (space dot space) - typically invalid
        if ' . ' in clean_line:
             print(f"Line {i+1}: Suspicious ' . ' -> {line.strip()}")
             
        # Check for start with . (dot) if previous line didn't end with operator?
        # Too complex.
        
        # Check for `obj..prop`
        if re.search(r'\w\.\.\w', clean_line):
             print(f"Line {i+1}: Suspicious '..' inside word -> {line.strip()}")

import glob
import os

if __name__ == "__main__":
    js_files = glob.glob(r"F:\MCW_HTML\shooter_game\js\*.js")
    for js_file in js_files:
        check_file(js_file)
