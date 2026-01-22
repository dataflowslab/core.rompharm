"""
Fix ItemsTab.tsx - Add missing commas and fix destructuring syntax
"""
import re

# Read file
with open('src/frontend/src/components/Procurement/ItemsTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix destructuring - add commas between array elements
# Pattern: [variable1 variable2] => [variable1, variable2]
content = re.sub(r'\[(\w+)\s+(\w+)\]', r'[\1, \2]', content)

# Fix object properties - add commas at end of lines in objects
# This is more complex, need to be careful
lines = content.split('\n')
fixed_lines = []
in_object = False
brace_count = 0

for i, line in enumerate(lines):
    stripped = line.strip()
    
    # Track if we're inside an object
    if '{' in line:
        brace_count += line.count('{')
        in_object = True
    if '}' in line:
        brace_count -= line.count('}')
        if brace_count == 0:
            in_object = False
    
    # Add comma if line ends with a value and next line is not closing brace
    if in_object and i < len(lines) - 1:
        next_line = lines[i + 1].strip()
        # If current line has a value (ends with ' or " or number) and next line is not } or already has comma
        if (stripped and not stripped.endswith(',') and not stripped.endswith('{') 
            and not stripped.endswith('}') and not stripped.startswith('//') 
            and not stripped.startswith('/*') and not stripped.startswith('*')
            and next_line and not next_line.startswith('}') 
            and ':' in stripped):
            line = line.rstrip() + ','
    
    fixed_lines.append(line)

content = '\n'.join(fixed_lines)

# Save
with open('src/frontend/src/components/Procurement/ItemsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed ItemsTab.tsx!")
print("- Added commas to destructuring")
print("- Added commas to object properties")
print("⚠️  Please verify the file manually!")
