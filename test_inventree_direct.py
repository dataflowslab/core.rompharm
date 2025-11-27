"""
Test InvenTree API directly to see what data we get
"""
import requests
import json
import yaml

# Load config
with open('config/config.yaml', 'r') as f:
    config = yaml.safe_load(f)

INVENTREE_URL = config['inventree']['url'].rstrip('/')
TOKEN = "inv-120c8c2e0ac53d3ba99e7ce9c4b4f8b59589c6db-20251127"
ORDER_ID = 3

headers = {
    'Authorization': f'Token {TOKEN}',
    'Content-Type': 'application/json'
}

print("="*80)
print("TESTING INVENTREE API DIRECTLY")
print("="*80)
print(f"InvenTree URL: {INVENTREE_URL}")
print(f"Order ID: {ORDER_ID}\n")

# Test 1: Get PO line items
print("\n" + "─"*80)
print("1. Get PO line items with part_detail")
print("─"*80)
url = f"{INVENTREE_URL}/api/order/po-line/"
params = {'order': ORDER_ID, 'part_detail': 'true'}

try:
    response = requests.get(url, headers=headers, params=params, timeout=10)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        # InvenTree might return list directly or dict with results
        if isinstance(data, list):
            results = data
        else:
            results = data.get('results', [])
        print(f"✅ Got {len(results)} items")
        
        if results:
            first = results[0]
            print(f"\nFirst item keys: {list(first.keys())}")
            
            if 'part_detail' in first:
                pd = first['part_detail']
                print(f"\npart_detail keys: {list(pd.keys())}")
                print(f"part_detail content:")
                print(json.dumps(pd, indent=2))
                
                part_id = pd.get('pk') or pd.get('id')
                print(f"\nPart ID: {part_id}")
                
                # Test 2: Get full part details
                print("\n" + "─"*80)
                print(f"2. Get full part details for part {part_id}")
                print("─"*80)
                
                part_response = requests.get(
                    f"{INVENTREE_URL}/api/part/{part_id}/",
                    headers=headers,
                    timeout=10
                )
                
                print(f"Status: {part_response.status_code}")
                
                if part_response.status_code == 200:
                    part_data = part_response.json()
                    print(f"\nPart keys: {list(part_data.keys())}")
                    
                    # Check for our fields
                    print(f"\nLooking for custom fields:")
                    print(f"  - ipn: {part_data.get('ipn', 'NOT FOUND')}")
                    print(f"  - IPN: {part_data.get('IPN', 'NOT FOUND')}")
                    print(f"  - internal_part_name: {part_data.get('internal_part_name', 'NOT FOUND')}")
                    print(f"  - name: {part_data.get('name', 'NOT FOUND')}")
                    print(f"  - description: {part_data.get('description', 'NOT FOUND')[:50]}...")
                    
                    # Show all fields that might be relevant
                    print(f"\nAll part fields:")
                    for key, value in part_data.items():
                        if isinstance(value, str) and len(value) < 100:
                            print(f"  {key}: {value}")
                else:
                    print(f"❌ Error: {part_response.text}")
                
                # Test 3: Bulk fetch with id__in
                print("\n" + "─"*80)
                print("3. Test bulk fetch with id__in")
                print("─"*80)
                
                part_ids = [str(item['part_detail'].get('pk') or item['part_detail'].get('id')) 
                           for item in results if 'part_detail' in item]
                
                print(f"Part IDs: {part_ids}")
                
                bulk_response = requests.get(
                    f"{INVENTREE_URL}/api/part/",
                    headers=headers,
                    params={'id__in': ','.join(part_ids)},
                    timeout=10
                )
                
                print(f"Status: {bulk_response.status_code}")
                
                if bulk_response.status_code == 200:
                    bulk_data = bulk_response.json()
                    bulk_results = bulk_data.get('results', [])
                    print(f"✅ Got {len(bulk_results)} parts")
                    
                    if bulk_results:
                        print(f"\nFirst part from bulk:")
                        print(f"  - ipn: {bulk_results[0].get('ipn', 'NOT FOUND')}")
                        print(f"  - internal_part_name: {bulk_results[0].get('internal_part_name', 'NOT FOUND')}")
                        print(f"  - name: {bulk_results[0].get('name', 'NOT FOUND')}")
                else:
                    print(f"❌ Error: {bulk_response.text}")
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Exception: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
