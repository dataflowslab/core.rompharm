"""
Test script for procurement endpoints
Tests all endpoints and shows detailed error information
"""
import requests
import json
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8051"
ORDER_ID = 3

# You need to get a valid token first
# Login to get token or use existing one
TOKEN = None  # Will be set after login

def print_section(title: str):
    """Print a section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_response(response: requests.Response, show_full: bool = False):
    """Print response details"""
    print(f"\nStatus Code: {response.status_code}")
    print(f"URL: {response.url}")
    
    if response.status_code >= 400:
        print(f"\n❌ ERROR Response:")
        try:
            error_data = response.json()
            print(json.dumps(error_data, indent=2))
        except:
            print(response.text[:500])
    else:
        print(f"\n✅ SUCCESS")
        try:
            data = response.json()
            if show_full:
                print(json.dumps(data, indent=2))
            else:
                # Show summary
                if isinstance(data, dict):
                    if 'results' in data:
                        print(f"Results count: {len(data['results'])}")
                        if data['results']:
                            print(f"First item keys: {list(data['results'][0].keys())}")
                            if 'part_detail' in data['results'][0]:
                                print(f"Part detail keys: {list(data['results'][0]['part_detail'].keys())}")
                                print(f"Part detail sample: {data['results'][0]['part_detail']}")
                    else:
                        print(f"Response keys: {list(data.keys())}")
                elif isinstance(data, list):
                    print(f"List length: {len(data)}")
                    if data:
                        print(f"First item: {data[0]}")
        except Exception as e:
            print(f"Could not parse JSON: {e}")
            print(response.text[:200])

def test_endpoint(name: str, url: str, headers: Dict[str, str]):
    """Test a single endpoint"""
    print(f"\n{'─'*80}")
    print(f"Testing: {name}")
    print(f"{'─'*80}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print_response(response, show_full=False)
        return response
    except Exception as e:
        print(f"❌ Exception: {e}")
        return None

def main():
    """Main test function"""
    global TOKEN
    
    print_section("PROCUREMENT ENDPOINTS TEST")
    
    # Get token from user
    print("\nPlease provide authentication token:")
    print("(You can get this from browser DevTools > Application > Local Storage)")
    TOKEN = input("Token: ").strip()
    
    if not TOKEN:
        print("❌ No token provided. Exiting.")
        return
    
    headers = {
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json'
    }
    
    # Test endpoints
    endpoints = [
        ("Purchase Order Details", f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}"),
        ("Purchase Order Items (Module)", f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/items"),
        ("Purchase Order Items (Core)", f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/items"),
        ("Received Items (Module)", f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/received-items"),
        ("Received Items (Core)", f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/received-items"),
        ("Attachments (Module)", f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/attachments"),
        ("Attachments (Core)", f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/attachments"),
        ("Stock Locations", f"{BASE_URL}/modules/depo_procurement/api/stock-locations"),
        ("Stock Statuses", f"{BASE_URL}/api/procurement/stock-statuses"),
    ]
    
    results = {}
    for name, url in endpoints:
        response = test_endpoint(name, url, headers)
        results[name] = {
            'status': response.status_code if response else 'ERROR',
            'success': response.status_code < 400 if response else False
        }
    
    # Summary
    print_section("TEST SUMMARY")
    for name, result in results.items():
        status_icon = "✅" if result['success'] else "❌"
        print(f"{status_icon} {name}: {result['status']}")
    
    # Check server logs
    print_section("NEXT STEPS")
    print("""
1. Check the server console for detailed error messages
2. Look for Python tracebacks in the server output
3. Common issues:
   - Config file path incorrect
   - InvenTree API authentication issues
   - Field name mismatches (ipn vs IPN, internal_part_name vs name)
   - Missing part_detail in response
    """)

if __name__ == "__main__":
    main()
