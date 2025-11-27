"""
Quick test to verify endpoints are working
Run this while the server is running on port 8051
"""
import requests
import sys

BASE_URL = "http://localhost:8051"
ORDER_ID = 3

def test_endpoint(name, url):
    """Test endpoint without auth (just to see if it responds)"""
    try:
        response = requests.get(url, timeout=5)
        status = response.status_code
        
        if status == 401:
            print(f"✅ {name}: Server responding (401 - needs auth)")
            return True
        elif status == 200:
            print(f"✅ {name}: SUCCESS (200)")
            try:
                data = response.json()
                if isinstance(data, dict) and 'results' in data:
                    print(f"   → Results: {len(data['results'])} items")
            except:
                pass
            return True
        elif status == 500:
            print(f"❌ {name}: INTERNAL SERVER ERROR (500)")
            try:
                error = response.json()
                print(f"   → Error: {error.get('detail', 'Unknown error')}")
            except:
                print(f"   → {response.text[:200]}")
            return False
        else:
            print(f"⚠️  {name}: Status {status}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"❌ {name}: Cannot connect to server")
        return False
    except Exception as e:
        print(f"❌ {name}: {e}")
        return False

def main():
    print("="*80)
    print("TESTING PROCUREMENT ENDPOINTS")
    print("="*80)
    print(f"\nServer: {BASE_URL}")
    print(f"Order ID: {ORDER_ID}\n")
    
    # Test if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/system/notifications", timeout=2)
        print(f"✅ Server is running\n")
    except:
        print(f"❌ Server is NOT running on {BASE_URL}")
        print("Please start the server first:")
        print("  python -m uvicorn src.backend.app:app --reload --host 0.0.0.0 --port 8051")
        sys.exit(1)
    
    # Test endpoints
    endpoints = [
        ("Items (Module)", f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/items"),
        ("Items (Core)", f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/items"),
        ("Received Items (Module)", f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/received-items"),
        ("Received Items (Core)", f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/received-items"),
        ("Attachments (Module)", f"{BASE_URL}/modules/depo_procurement/api/purchase-orders/{ORDER_ID}/attachments"),
        ("Attachments (Core)", f"{BASE_URL}/api/procurement/purchase-orders/{ORDER_ID}/attachments"),
    ]
    
    results = []
    for name, url in endpoints:
        success = test_endpoint(name, url)
        results.append((name, success))
        print()
    
    # Summary
    print("="*80)
    print("SUMMARY")
    print("="*80)
    
    success_count = sum(1 for _, success in results if success)
    total_count = len(results)
    
    for name, success in results:
        icon = "✅" if success else "❌"
        print(f"{icon} {name}")
    
    print(f"\n{success_count}/{total_count} endpoints responding correctly")
    
    if success_count < total_count:
        print("\n⚠️  Some endpoints have errors. Check server console for details.")
        sys.exit(1)
    else:
        print("\n✅ All endpoints are working!")
        sys.exit(0)

if __name__ == "__main__":
    main()
