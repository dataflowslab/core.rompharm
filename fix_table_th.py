"""
Fix ItemsTab.tsx - Add missing > after onClick
"""

with open('src/frontend/src/components/Procurement/ItemsTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix missing > after onClick in Table.Th
content = content.replace("onClick={() => handleItemSort('quantity')}\n", "onClick={() => handleItemSort('quantity')}>\n")
content = content.replace("onClick={() => handleItemSort('received')}\n", "onClick={() => handleItemSort('received')}>\n")
content = content.replace("onClick={() => handleItemSort('purchase_price')}\n", "onClick={() => handleItemSort('purchase_price')}>\n")
content = content.replace("onClick={() => handleItemSort('destination_detail')}\n", "onClick={() => handleItemSort('destination_detail')}>\n")
content = content.replace("onClick={() => handleItemSort('reference')}\n", "onClick={() => handleItemSort('reference')}>\n")

with open('src/frontend/src/components/Procurement/ItemsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed missing > in Table.Th tags!")
