"""
Script to fix all config.yaml paths to config/config.yaml
"""
import os
import re

# Files to update
files_to_update = [
    'src/backend/utils/inventree_auth.py',
    'src/backend/utils/newsman.py',
    'src/backend/utils/file_handler.py',
    'src/backend/utils/dataflows_docu.py',
    'src/backend/routes/system.py',
    'src/backend/routes/procurement_approvals.py',
    'src/backend/routes/forms.py',
    'src/backend/routes/documents.py',
    'src/backend/routes/data.py',
    'src/backend/routes/crm.py',
    'src/backend/app.py',
]

# Pattern to find and replace
old_pattern = r"'\.\.', '\.\.', '\.\.', 'config\.yaml'"
new_pattern = "'..', '..', '..', 'config', 'config.yaml'"

for file_path in files_to_update:
    if not os.path.exists(file_path):
        print(f"⚠️  File not found: {file_path}")
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the pattern
    new_content = re.sub(old_pattern, new_pattern, content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"✅ Updated: {file_path}")
    else:
        print(f"ℹ️  No changes needed: {file_path}")

print("\n✅ Done! All config paths updated.")
