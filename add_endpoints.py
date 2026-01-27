#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Add received stock approval endpoints to routes.py"""

endpoints_code = '''

# ==================== RECEIVED STOCK APPROVAL FLOW ENDPOINTS ====================

@router.get("/purchase-orders/{order_id}/received-stock-approval-flow")
async def get_received_stock_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Get approval flow for received stock"""
    from modules.depo_procurement.services import get_received_stock_approval_flow
    return await get_received_stock_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/received-stock-approval-flow")
async def create_received_stock_approval_flow_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Create approval flow for received stock"""
    from modules.depo_procurement.services import create_received_stock_approval_flow
    return await create_received_stock_approval_flow(order_id)


@router.post("/purchase-orders/{order_id}/sign-received-stock")
async def sign_received_stock_endpoint(
    request: Request,
    order_id: str,
    current_user: dict = Depends(verify_token)
):
    """Sign received stock approval flow"""
    from modules.depo_procurement.services import sign_received_stock
    body = await request.json()
    target_state_id = body.get('target_state_id')
    return await sign_received_stock(
        order_id, target_state_id, current_user,
        request.client.host, request.headers.get("user-agent")
    )


@router.delete("/purchase-orders/{order_id}/received-stock-signatures/{user_id}")
async def remove_received_stock_signature_endpoint(
    request: Request,
    order_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    """Remove signature from received stock approval flow"""
    from modules.depo_procurement.services import remove_received_stock_signature
    return await remove_received_stock_signature(order_id, user_id, current_user)
'''

# Read current file
with open('modules/depo_procurement/routes.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove trailing # and whitespace
content = content.rstrip().rstrip('#').rstrip()

# Add endpoints
content += endpoints_code

# Write back
with open('modules/depo_procurement/routes.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Endpoints added successfully!")
