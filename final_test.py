"""Final test with authentication"""
import requests

BASE_URL = "http://localhost:8051"
ORDER_ID = 3
USERNAME = "romphadmin"
PASSWORD = "UYHA-863-haga"

# Login
response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": USERNAME, "password": PASSWORD},
    timeout=10
)

token = response.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

print("="*80)
print("FINAL TEST - PROCUREMENT ENDPOINTS")
print("="*80)

# Test Items endpoint
print("\n1. Testing Items (Module)...")
response = requests.get(
    f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/items",
    headers=headers,
    timeout=10
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    results = data.get('results', [])
    print(f"   ✅ Got {len(results)} items")
    if results:
        first = results[0]
        if 'part_detail' in first:
            pd = first['part_detail']
            print(f"   Part: {pd.get('name', 'N/A')}")
            print(f"   IPN: {pd.get('IPN', 'N/A')}")
else:
    print(f"   ❌ Error: {response.text[:200]}")

# Test Items Core
print("\n2. Testing Items (Core)...")
response = requests.get(
    f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/items",
    headers=headers,
    timeout=10
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    results = data.get('results', [])
    print(f"   ✅ Got {len(results)} items")
else:
    print(f"   ❌ Error: {response.text[:200]}")

# Test Received Items
print("\n3. Testing Received Items (Core)...")
response = requests.get(
    f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/received-items",
    headers=headers,
    timeout=10
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    print(f"   ✅ Success")
else:
    print(f"   ❌ Error: {response.text[:200]}")

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
