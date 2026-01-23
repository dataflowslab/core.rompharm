#!/usr/bin/env python3
"""
Optimize routes.py by replacing QC and Approval Flow endpoints with service calls
"""

# Read the file
with open('modules/depo_procurement/routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace QC Records section
qc_start = content.find('@router.get("/purchase-orders/{order_id}/qc-records")')
qc_end = content.find('@router.patch("/purchase-orders/{order_id}/qc-records/{qc_id}")')
# Find the end of the update_qc_record function
qc_end_func = content.find('# ==================== APPROVAL FLOW ENDPOINTS ====================', qc_end)

if qc_start != -1 and qc_end_func != -1:
    qc_replacement = '''@router.get("/purchase-orders/{order_id}/qc-records")
async def get_qc_records_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get QC records for a purchase order"""
    from modules.depo_procurement.services import get_qc_records
    return await get_qc_records(order_id)


@router.post("/purchase-orders/{order_id}/qc-records")
async def create_qc_record_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create a new QC record for a purchase order"""
    from modules.depo_procurement.services import create_qc_record
    body = await request.json()
    return await create_qc_record(order_id, body, current_user)


@router.patch("/purchase-orders/{order_id}/qc-records/{qc_id}")
async def update_qc_record_endpoint(
    request: Request,
    order_id: str,
    qc_id: str,
    current_user: dict = Depends(verify_token)
):
    """Update a QC record"""
    from modules.depo_procurement.services import update_qc_record
    body = await request.json()
    return await update_qc_record(order_id, qc_id, body, current_user)
    
'''
    content = content[:qc_start] + qc_replacement + content[qc_end_func:]

# Find and replace Approval Flow section
approval_start = content.find('# ==================== APPROVAL FLOW ENDPOINTS ====================')
approval_end = content.rfind('return {"message": "Signature removed successfully"}')
if approval_end != -1:
    approval_end = content.find('\n', approval_end) + 1

if approval_start != -1 and approval_end != -1:
    approval_replacement = '''# ==================== APPROVAL FLOW ENDPOINTS ====================

@router.get("/purchase-orders/{order_id}/approval-flow")
async def get_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow for a purchase order"""
    from modules.depo_procurement.services import get_order_approval_flow
    return await get_order_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/approval-flow")
async def create_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create approval flow for a purchase order using approval_templates"""
    from modules.depo_procurement.services import create_order_approval_flow
    return await create_order_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/sign")
async def sign_order_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Sign a purchase order approval flow"""
    from modules.depo_procurement.services import sign_purchase_order
    body = await request.json()
    action = body.get('action', 'issue')
    return await sign_purchase_order(
        order_id, action, current_user, 
        request.client.host, request.headers.get("user-agent")
    )


@router.delete("/purchase-orders/{order_id}/signatures/{user_id}")
async def remove_signature_endpoint(
    request: Request,
    order_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove signature from purchase order approval flow (admin only)"""
    from modules.depo_procurement.services import remove_order_signature
    return await remove_order_signature(order_id, user_id, current_user)
'''
    content = content[:approval_start] + approval_replacement

# Write the optimized file
with open('modules/depo_procurement/routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ routes.py optimized successfully!")
print(f"   New line count: {len(content.splitlines())}")
