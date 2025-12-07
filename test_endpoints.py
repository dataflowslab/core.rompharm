"""
Test script for procurement endpoints
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
INVENTREE_URL = "https://rompharm.dataflows.ro"
INVENTREE_TOKEN = "inv-120c8c2e0ac53d3ba99e7ce9c4b4f8b59589c6db-20251127"
ORDER_ID = 6

# Headers for InvenTree
inventree_headers = {
    'Authorization': f'Token {INVENTREE_TOKEN}',
    'Content-Type': 'application/json'
}

print("=" * 80)
print("TESTING INVENTREE ENDPOINTS DIRECTLY")
print("=" * 80)

# Test 1: Get purchase order
print("\n1. Testing GET /api/order/po/{order_id}/")
try:
    response = requests.get(
        f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/",
        headers=inventree_headers,
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Reference: {data.get('reference')}")
        print(f"   Status: {data.get('status')} - {data.get('status_text')}")
        print(f"   ✓ SUCCESS")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

# Test 2: Update order status to PLACED (20)
print("\n2. Testing PATCH /api/order/po/{order_id}/ (status=20)")
try:
    response = requests.patch(
        f"{INVENTREE_URL}/api/order/po/{ORDER_ID}/",
        headers=inventree_headers,
        json={"status": 20},
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   New Status: {data.get('status')} - {data.get('status_text')}")
        print(f"   ✓ SUCCESS")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

# Test 3: Get attachments using generic API
print("\n3. Testing GET /api/attachment/ (model_type=purchaseorder)")
try:
    response = requests.get(
        f"{INVENTREE_URL}/api/attachment/",
        headers=inventree_headers,
        params={'model_type': 'purchaseorder', 'model_id': ORDER_ID},
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        count = len(data.get('results', data)) if isinstance(data, dict) else len(data)
        print(f"   Attachments found: {count}")
        print(f"   ✓ SUCCESS")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

# Test 4: Get received items
print("\n4. Testing GET /api/stock/ (purchase_order={order_id})")
try:
    response = requests.get(
        f"{INVENTREE_URL}/api/stock/",
        headers=inventree_headers,
        params={'purchase_order': ORDER_ID, 'part_detail': 'true'},
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        count = len(data.get('results', data)) if isinstance(data, dict) else len(data)
        print(f"   Received items found: {count}")
        print(f"   ✓ SUCCESS")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

print("\n" + "=" * 80)
print("TESTING DATAFLOWS ENDPOINTS")
print("=" * 80)

# Test 5: Get purchase order through DataFlows
print("\n5. Testing GET /api/procurement/purchase-orders/{order_id}")
try:
    response = requests.get(
        f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}",
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Reference: {data.get('reference')}")
        print(f"   ✓ SUCCESS")
    elif response.status_code == 401:
        print(f"   ⚠ UNAUTHORIZED (expected - needs auth)")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

# Test 6: Get attachments through DataFlows
print("\n6. Testing GET /api/procurement/purchase-orders/{order_id}/attachments")
try:
    response = requests.get(
        f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/attachments",
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        count = len(data.get('results', []))
        print(f"   Attachments: {count}")
        print(f"   ✓ SUCCESS")
    elif response.status_code == 401:
        print(f"   ⚠ UNAUTHORIZED (expected - needs auth)")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

# Test 7: Get received items through DataFlows
print("\n7. Testing GET /api/procurement/purchase-orders/{order_id}/received-items")
try:
    response = requests.get(
        f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/received-items",
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        count = len(data.get('results', []))
        print(f"   Received items: {count}")
        print(f"   ✓ SUCCESS")
    elif response.status_code == 401:
        print(f"   ⚠ UNAUTHORIZED (expected - needs auth)")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

# Test 8: Get QC records through DataFlows
print("\n8. Testing GET /api/procurement/purchase-orders/{order_id}/qc-records")
try:
    response = requests.get(
        f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/qc-records",
        timeout=10
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        count = len(data.get('results', []))
        print(f"   QC records: {count}")
        print(f"   ✓ SUCCESS")
    elif response.status_code == 401:
        print(f"   ⚠ UNAUTHORIZED (expected - needs auth)")
    else:
        print(f"   ✗ FAILED: {response.text}")
except Exception as e:
    print(f"   ✗ ERROR: {e}")

print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print("✓ InvenTree direct API calls should work")
print("⚠ DataFlows endpoints need authentication (401 is expected)")
print("✗ Any other errors need investigation")
print("=" * 80)
