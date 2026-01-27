#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Add journal endpoint to routes.py"""

journal_endpoint = '''

# ==================== JOURNAL ENDPOINT ====================

@router.get("/purchase-orders/{order_id}/journal")
async def get_order_journal(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get activity journal for purchase order"""
    from src.backend.utils.db import get_db
    from bson import ObjectId
    
    db = get_db()
    
    # Get logs for this order
    logs = list(db.logs.find({
        'collection': 'depo_purchase_orders',
        'object_id': order_id
    }).sort('timestamp', -1))
    
    # Format logs
    journal_entries = []
    for log in logs:
        entry = {
            'type': log.get('action', 'unknown'),
            'timestamp': log.get('timestamp').isoformat() if log.get('timestamp') else '',
            'user': log.get('user', 'System'),
            'description': log.get('description', ''),
            'details': log.get('details', {})
        }
        journal_entries.append(entry)
    
    return {'entries': journal_entries}
'''

# Read current file
with open('modules/depo_procurement/routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add endpoint
content += journal_endpoint

# Write back
with open('modules/depo_procurement/routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Journal endpoint added successfully!")
