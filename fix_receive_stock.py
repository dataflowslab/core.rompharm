#!/usr/bin/env python3
"""
Fix receive_stock_item to use transferable flag instead of status
"""

with open('modules/depo_procurement/services.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the old logic
old_logic = """        # Find state_id from depo_stocks_states based on status value
        status_value = getattr(stock_data, 'status', 65)
        state = states_collection.find_one({'value': status_value})
        
        if not state:
            # Fallback: try to find Quarantine state
            state = states_collection.find_one({'name': {'$regex': 'quarantin', '$options': 'i'}})
            if not state:
                raise HTTPException(status_code=400, detail=f"Stock state with value {status_value} not found")"""

new_logic = """        # Get part details to check if regulated
        part = db['depo_parts'].find_one({'_id': ObjectId(item['part_id'])})
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Determine status based on part.regulated and transferable flag
        is_regulated = part.get('regulated', False)
        is_transferable = getattr(stock_data, 'transferable', False)
        
        if is_regulated:
            # Regulated parts go directly to OK status
            state = states_collection.find_one({'_id': ObjectId('694321db8728e4d75ae72789')})
            if not state:
                state = states_collection.find_one({'name': 'OK'})
        elif is_transferable:
            # Transferable stock goes to Quarantine (transactionable)
            state = states_collection.find_one({'_id': ObjectId('694322878728e4d75ae72790')})
            if not state:
                state = states_collection.find_one({'name': {'$regex': 'quarantine.*transactionable', '$options': 'i'}})
        else:
            # Default: Quarantined (not transferable)
            state = states_collection.find_one({'_id': ObjectId('694322758728e4d75ae7278f')})
            if not state:
                state = states_collection.find_one({'name': {'$regex': '^quarantined$', '$options': 'i'}})
        
        if not state:
            # Ultimate fallback: any quarantine state
            state = states_collection.find_one({'name': {'$regex': 'quarantin', '$options': 'i'}})
            if not state:
                raise HTTPException(status_code=400, detail="No suitable stock state found")"""

content = content.replace(old_logic, new_logic)

with open('modules/depo_procurement/services.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed receive_stock_item logic!")
