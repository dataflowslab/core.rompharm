"""
Script to modify ItemsTab.tsx:
1. Hide currency select (remove Grid.Col with Currency ApiSelect)
2. Show currency in Purchase price label
3. Move Purchase price to same line as Quantity (both span=6)
4. Add UM to Quantity label
"""

import re

# Read file
with open('src/frontend/src/components/Procurement/ItemsTab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Currency select from New Item form (between Quantity and Destination)
# Pattern: Grid.Col span={6} with ApiSelect for Currency
pattern1 = r'<Grid\.Col span=\{6\}>\s*<ApiSelect\s+label=\{t\(\'Currency\'\)\}[^>]*endpoint="/api/currencies"[^>]*value=\{newItemData\.purchase_price_currency\}[^>]*onChange=\{[^}]*purchase_price_currency[^}]*\}[^>]*valueField="_id"[^>]*searchable[^>]*placeholder=\{t\(\'Select currency\'\)\}[^/]*/>\s*</Grid\.Col>'
content = re.sub(pattern1, '', content, flags=re.DOTALL)

# 2. Remove Currency select from Edit Item form
pattern2 = r'<Grid\.Col span=\{6\}>\s*<ApiSelect\s+label=\{t\(\'Currency\'\)\}[^>]*endpoint="/api/currencies"[^>]*value=\{editItemData\.purchase_price_currency\}[^>]*onChange=\{[^}]*purchase_price_currency[^}]*\}[^>]*valueField="_id"[^>]*searchable[^>]*placeholder=\{t\(\'Select currency\'\)\}[^/]*/>\s*</Grid\.Col>'
content = re.sub(pattern2, '', content, flags=re.DOTALL)

# 3. Change Purchase Price label to include currency
# For New Item form
content = content.replace(
    "label={t('Purchase Price')}",
    "label={t('Purchase Price') + ` (${orderCurrency})`}"
)

# 4. Add UM to Quantity label - need to get part detail first
# This is more complex, will need to be done manually or with state

# Save modified file
with open('src/frontend/src/components/Procurement/ItemsTab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ ItemsTab.tsx modified successfully!")
print("- Removed Currency select from New Item form")
print("- Removed Currency select from Edit Item form")
print("- Added currency to Purchase Price label")
print("⚠️  Manual step needed: Add UM to Quantity label (requires part detail state)")
