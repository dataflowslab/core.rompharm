"""
Test different methods to issue/place a purchase order in InvenTree 1.0.1
Based on API documentation: POST /api/order/po/{id}/issue/
"""
import requests
import json

# Configuration
INVENTREE_URL = "https://rompharm.dataflows.ro"
INVENTREE_TOKEN = "inv-120c8c2e0ac53d3ba99e7ce9c4b4f8b59589c6db-20251127"
ORDER_ID = 6

# Headers for InvenTree
inventree_headers = {
    'Authorization': f'Token {INVENTREE_TOKEN}',
    'Content-Type': 'application/json'
}

print("=" * 80)
print("TESTING ORDER ISSUE/PLACE METHODS")
print("=" * 80)

# First, check current status
print("\n0. Checking current order status")
try:
    response = requests.get(
        f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/",
        headers=inventree_headers,
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   Current Status: {data.get('status')} - {data.get('status_text')}")
        print(f"   Reference: {data.get('reference')}")
except Exception as e:
    print(f"   ERROR: {e}")

# Test 1: POST to /issue/ (documented method)
print("\n1. Testing POST /api/order/po/{order_id}/issue/ (documented)")
try:
    response = requests.post(
        f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/issue/",
        headers=inventree_headers,
        json={},
        timeout=10
    )
    print(f"   Status Code: {response.status_code}")
    print(f"   Response: {response.text[:300]}")
    
    if response.status_code == 200 or response.status_code == 201:
        print(f"   ✓ POST /issue/ accepted")
    else:
        print(f"   ✗ POST /issue/ failed")
except Exception as e:
    print(f"   ERROR: {e}")

# Check status after POST
print("\n   Checking status after POST /issue/...")
try:
    response = requests.get(
        f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/",
        headers=inventree_headers,
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        status = data.get('status')
        status_text = data.get('status_text')
        print(f"   Status: {status} - {status_text}")
        if status == 20:
            print(f"   ✓✓✓ SUCCESS! Order is now PLACED")
        else:
            print(f"   ⚠ Order status unchanged")
except Exception as e:
    print(f"   ERROR: {e}")

# Test 2: PUT with full order data (for comparison)
print("\n2. Testing PUT /api/order/po/{order_id}/ with status=20")
try:
    # First get current order data
    get_response = requests.get(
        f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/",
        headers=inventree_headers,
        timeout=10
    )
    
    if get_response.status_code == 200:
        order_data = get_response.json()
        
        # Update status in the data
        order_data['status'] = 20
        
        # Remove read-only fields
        for field in ['pk', 'id', 'created_by', 'creation_date', 'updated', 'updated_by', 
                      'supplier_detail', 'destination_detail', 'responsible_detail',
                      'project_code_detail', 'contact_detail', 'updated_by_detail',
                      'created_by_detail', 'line_items', 'completed_lines', 'overdue',
                      'status_text', 'link']:
            order_data.pop(field, None)
        
        # Make PUT request
        response = requests.put(
            f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/",
            headers=inventree_headers,
            json=order_data,
            timeout=10
        )
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   New Status: {data.get('status')} - {data.get('status_text')}")
            if data.get('status') == 20:
                print(f"   ✓ PUT with status=20 worked")
            else:
                print(f"   ⚠ PUT accepted but status didn't change to 20")
        else:
            print(f"   Response: {response.text[:300]}")
except Exception as e:
    print(f"   ERROR: {e}")

# Final status check
print("\n" + "=" * 80)
print("FINAL STATUS CHECK")
print("=" * 80)
try:
    response = requests.get(
        f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/",
        headers=inventree_headers,
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        status = data.get('status')
        status_text = data.get('status_text')
        print(f"Final Status: {status} - {status_text}")
        print(f"Reference: {data.get('reference')}")
        
        if status == 20:
            print("\n✓✓✓ Order is now PLACED (status=20)")
        elif status == 10:
            print("\n⚠⚠⚠ Order is still PENDING (status=10)")
        else:
            print(f"\n? Order has unexpected status: {status}")
except Exception as e:
    print(f"ERROR: {e}")

print("=" * 80)
