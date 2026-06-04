import os
import glob

def add_bom_to_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        with open(filepath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f"Added BOM to {filepath}")
    except Exception as e:
        print(f"Failed {filepath}: {e}")

for ext in ['*.ps1', '*.bat']:
    for filepath in glob.glob(f'utils/{ext}'):
        add_bom_to_file(filepath)
