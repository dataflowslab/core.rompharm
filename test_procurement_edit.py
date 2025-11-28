#!/usr/bin/env python3
"""
Test script for Procurement Order Edit Permissions

This script tests:
1. /api/auth/me endpoint returns correct user info
2. Admin users can edit orders
3. Creators can edit orders without signatures
4. Orders with signatures cannot be edited (except by admin)
5. Approval flow is correctly loaded
"""

import requests
import json
from typing import Optional

# Configuration
BASE_URL = "http://localhost:8051"
INVENTREE_URL = "https://rompharm.dataflows.ro"

# Test credentials (replace with actual test user)
TEST_USERNAME = "admin"  # Replace with your test username
TEST_PASSWORD = "your_password"  # Replace with your test password

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.END}")

def test_login() -> Optional[str]:
    """Test login and return token"""
    print_info("Testing login...")
    
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "username": TEST_USERNAME,
            "password": TEST_PASSWORD
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        is_staff = data.get('is_staff')
        print_success(f"Login successful - User: {data.get('username')}, Admin: {is_staff}")
        return token
    else:
        print_error(f"Login failed: {response.status_code} - {response.text}")
        return None

def test_auth_me(token: str) -> dict:
    """Test /api/auth/me endpoint"""
    print_info("Testing /api/auth/me endpoint...")
    
    headers = {"Authorization": f"Token {token}"}
    response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Auth /me works - User ID: {data.get('_id')}, Admin: {data.get('is_staff')}")
        print(f"  Full response: {json.dumps(data, indent=2)}")
        return data
    else:
        print_error(f"/api/auth/me failed: {response.status_code} - {response.text}")
        return {}

def test_get_purchase_orders(token: str) -> list:
    """Get list of purchase orders"""
    print_info("Fetching purchase orders...")
    
    headers = {"Authorization": f"Token {token}"}
    response = requests.get(f"{BASE_URL}/api/procurement/purchase-orders", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        orders = data.get('results', data) if isinstance(data, dict) else data
        print_success(f"Found {len(orders)} purchase orders")
        return orders
    else:
        print_error(f"Failed to get orders: {response.status_code} - {response.text}")
        return []

def test_get_order_details(token: str, order_id: int) -> dict:
    """Get order details"""
    print_info(f"Fetching order {order_id} details...")
    
    headers = {"Authorization": f"Token {token}"}
    response = requests.get(f"{BASE_URL}/api/procurement/purchase-orders/{order_id}", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print_success(f"Order {order_id}: {data.get('reference')} - Status: {data.get('status_text')}")
        print(f"  Supplier: {data.get('supplier_detail', {}).get('name', 'N/A')}")
        print(f"  Responsible: {data.get('responsible', 'N/A')}")
        return data
    else:
        print_error(f"Failed to get order: {response.status_code} - {response.text}")
        return {}

def test_get_approval_flow(token: str, order_id: int) -> dict:
    """Get approval flow for order"""
    print_info(f"Fetching approval flow for order {order_id}...")
    
    headers = {"Authorization": f"Token {token}"}
    response = requests.get(f"{BASE_URL}/api/procurement/purchase-orders/{order_id}/approval-flow", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        flow = data.get('flow')
        if flow:
            signatures = flow.get('signatures', [])
            print_success(f"Approval flow exists - Signatures: {len(signatures)}")
            if signatures:
                print("  Signatures:")
                for sig in signatures:
                    print(f"    - {sig.get('username')} at {sig.get('signed_at')}")
        else:
            print_warning("No approval flow exists yet")
        return data
    else:
        print_warning(f"Approval flow not found (this is OK if not set up yet): {response.status_code}")
        return {}

def test_can_edit_logic(user_data: dict, order: dict, approval_flow: dict) -> bool:
    """Test the canEdit logic"""
    print_info("Testing canEdit logic...")
    
    is_admin = user_data.get('is_staff', False)
    current_user_id = user_data.get('_id')
    order_responsible = order.get('responsible')
    
    flow = approval_flow.get('flow')
    signatures = flow.get('signatures', []) if flow else []
    
    print(f"  Admin: {is_admin}")
    print(f"  Current User ID: {current_user_id}")
    print(f"  Order Responsible: {order_responsible}")
    print(f"  Signatures: {len(signatures)}")
    
    # Logic from frontend
    if is_admin:
        print_success("User is admin - CAN EDIT")
        return True
    
    if not flow or len(signatures) == 0:
        is_creator = order_responsible and current_user_id and str(order_responsible) == str(current_user_id)
        if is_creator:
            print_success("User is creator and no signatures - CAN EDIT")
            return True
        else:
            print_warning("User is not creator - CANNOT EDIT")
            return False
    
    print_warning("Order has signatures - CANNOT EDIT")
    return False

def test_update_order(token: str, order_id: int) -> bool:
    """Test updating order"""
    print_info(f"Testing order update for order {order_id}...")
    
    headers = {"Authorization": f"Token {token}"}
    test_data = {
        "notes": f"Test update at {requests.utils.default_headers()}"
    }
    
    response = requests.patch(
        f"{BASE_URL}/api/procurement/purchase-orders/{order_id}",
        headers=headers,
        json=test_data
    )
    
    if response.status_code == 200:
        print_success("Order update successful")
        return True
    else:
        print_error(f"Order update failed: {response.status_code} - {response.text}")
        return False

def main():
    print("\n" + "="*60)
    print("PROCUREMENT ORDER EDIT PERMISSIONS TEST")
    print("="*60 + "\n")
    
    # Step 1: Login
    token = test_login()
    if not token:
        print_error("Cannot proceed without valid token")
        return
    
    print("\n" + "-"*60 + "\n")
    
    # Step 2: Test /api/auth/me
    user_data = test_auth_me(token)
    if not user_data:
        print_error("Cannot proceed without user data")
        return
    
    print("\n" + "-"*60 + "\n")
    
    # Step 3: Get purchase orders
    orders = test_get_purchase_orders(token)
    if not orders:
        print_warning("No purchase orders found")
        return
    
    print("\n" + "-"*60 + "\n")
    
    # Step 4: Test first order
    first_order = orders[0]
    order_id = first_order.get('pk')
    
    order_details = test_get_order_details(token, order_id)
    if not order_details:
        return
    
    print("\n" + "-"*60 + "\n")
    
    # Step 5: Get approval flow
    approval_flow = test_get_approval_flow(token, order_id)
    
    print("\n" + "-"*60 + "\n")
    
    # Step 6: Test canEdit logic
    can_edit = test_can_edit_logic(user_data, order_details, approval_flow)
    
    print("\n" + "-"*60 + "\n")
    
    # Step 7: Test update if can edit
    if can_edit:
        test_update_order(token, order_id)
    else:
        print_info("Skipping update test - user cannot edit")
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"User: {user_data.get('username')}")
    print(f"Admin: {user_data.get('is_staff')}")
    print(f"Order: {order_details.get('reference')}")
    print(f"Can Edit: {can_edit}")
    print("="*60 + "\n")

if __name__ == "__main__":
    # Check if credentials are set
    if TEST_PASSWORD == "your_password":
        print_error("Please set TEST_USERNAME and TEST_PASSWORD in the script")
        print_info("Edit test_procurement_edit.py and set your credentials")
        exit(1)
    
    main()
