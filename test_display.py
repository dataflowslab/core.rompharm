"""
Test to verify that part names and IPNs are displayed correctly
"""
import requests
import json

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
print("TESTING PART NAMES AND IPNs DISPLAY")
print("="*80)

# Test 1: Items endpoint
print("\n1. Testing Items Endpoint")
print("-"*80)
response = requests.get(
    f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/items",
    headers=headers,
    timeout=10
)

if response.status_code == 200:
    data = response.json()
    results = data.get('results', [])
    print(f"✅ Got {len(results)} items\n")
    
    for i, item in enumerate(results, 1):
        print(f"Item {i}:")
        print(f"  pk: {item.get('pk')}")
        print(f"  quantity: {item.get('quantity')}")
        print(f"  received: {item.get('received', 0)}")
        
        if 'part_detail' in item:
            pd = item['part_detail']
            print(f"  part_detail:")
            print(f"    - pk: {pd.get('pk')}")
            print(f"    - name: {pd.get('name', 'MISSING!')}")
            print(f"    - IPN: {pd.get('IPN', 'MISSING!')}")
            print(f"    - description: {pd.get('description', '')[:50]}")
        else:
            print(f"  ❌ NO part_detail!")
        
        # Check if there are direct fields too
        if 'ipn' in item:
            print(f"  Direct fields:")
            print(f"    - ipn: {item.get('ipn')}")
            print(f"    - internal_part_name: {item.get('internal_part_name')}")
        
        print()
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)

# Test 2: Received Items endpoint
print("\n2. Testing Received Items Endpoint")
print("-"*80)
response = requests.get(
    f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/received-items",
    headers=headers,
    timeout=10
)

if response.status_code == 200:
    data = response.json()
    results = data.get('results', [])
    
    if len(results) == 0:
        print("ℹ️  No received items yet (this is OK)")
    else:
        print(f"✅ Got {len(results)} received items\n")
        
        for i, item in enumerate(results, 1):
            print(f"Received Item {i}:")
            print(f"  pk: {item.get('pk')}")
            print(f"  quantity: {item.get('quantity')}")
            
            if 'part_detail' in item:
                pd = item['part_detail']
                print(f"  part_detail:")
                print(f"    - name: {pd.get('name', 'MISSING!')}")
                print(f"    - IPN: {pd.get('IPN', 'MISSING!')}")
            else:
                print(f"  ❌ NO part_detail!")
            
            if 'location_detail' in item:
                ld = item['location_detail']
                print(f"  location_detail:")
                print(f"    - name: {ld.get('name', 'MISSING!')}")
            else:
                print(f"  ❌ NO location_detail!")
            
            print()
else:
    print(f"❌ Error: {response.status_code}")
    print(response.text)

print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print("""
Frontend should display:
- Items tab: part_detail.name and part_detail.IPN
- Received Stock tab: part_detail.name (IPN) and location_detail.name

If you see "MISSING!" above, there's a problem with the data structure.
If you see the actual names and IPNs, everything is working correctly!
""")
