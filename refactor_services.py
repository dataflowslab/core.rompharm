#!/usr/bin/env python3
"""
Refactor services.py into modular components
"""
import re

# Read original services.py
with open('modules/depo_procurement/services.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract functions
funcs = re.findall(r'(async def \w+.*?)(?=\nasync def |\Z)', content, re.DOTALL)

# Common imports
common_imports = """from fastapi import HTTPException, UploadFile
from datetime import datetime
from bson import ObjectId
import os
import hashlib

from src.backend.utils.db import get_db
from ..utils import serialize_doc
"""

# Group 1: Purchase Orders (0-2)
purchase_orders = common_imports + "\n\n" + "\n\n".join(funcs[0:3])
with open('modules/depo_procurement/services/purchase_orders.py', 'w', encoding='utf-8') as f:
    f.write('"""\nDEPO Procurement Module - Purchase Orders Services\n"""\n' + purchase_orders)

# Group 2: Order Items (3-8)
order_items = common_imports + "\n\n" + "\n\n".join(funcs[3:9])
with open('modules/depo_procurement/services/order_items.py', 'w', encoding='utf-8') as f:
    f.write('"""\nDEPO Procurement Module - Order Items Services\n"""\n' + order_items)

# Group 3: Stock Receiving (9-10)
stock_receiving = common_imports + "\n\n" + "\n\n".join(funcs[9:11])
with open('modules/depo_procurement/services/stock_receiving.py', 'w', encoding='utf-8') as f:
    f.write('"""\nDEPO Procurement Module - Stock Receiving Services\n"""\n' + stock_receiving)

# Group 4: Attachments (11-13)
attachments = common_imports + "\n\n" + "\n\n".join(funcs[11:14])
with open('modules/depo_procurement/services/attachments.py', 'w', encoding='utf-8') as f:
    f.write('"""\nDEPO Procurement Module - Attachments Services\n"""\n' + attachments)

# Group 5: Order State (14-15)
order_state = common_imports + "\n\n" + "\n\n".join(funcs[14:16])
with open('modules/depo_procurement/services/order_state.py', 'w', encoding='utf-8') as f:
    f.write('"""\nDEPO Procurement Module - Order State Services\n"""\n' + order_state)

print("✅ Refactoring complete!")
print("Created:")
print("  - modules/depo_procurement/services/purchase_orders.py")
print("  - modules/depo_procurement/services/order_items.py")
print("  - modules/depo_procurement/services/stock_receiving.py")
print("  - modules/depo_procurement/services/attachments.py")
print("  - modules/depo_procurement/services/order_state.py")
