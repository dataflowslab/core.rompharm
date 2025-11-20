"""
Test script for External API endpoints
Usage: python test_external_api.py
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
API_TOKEN = "C4EWoKB00TsiTplL5prXFv43Y3sWooQkC94KiVia5c2pqBFoGeFoijdwcGra6sFC"

# Test data
test_client_invoice = {
    "invoice_id": "INV-2024-001",
    "client_name": "ACME Corporation",
    "amount": 15000.50,
    "currency": "RON",
    "issue_date": "2024-11-20",
    "due_date": "2024-12-20",
    "items": [
        {
            "description": "Consulting Services",
            "quantity": 10,
            "unit_price": 1500.05,
            "total": 15000.50
        }
    ]
}

test_supplier_invoice = {
    "invoice_id": "SUPP-2024-001",
    "supplier_name": "Tech Supplies Ltd",
    "amount": 8500.00,
    "currency": "RON",
    "issue_date": "2024-11-20",
    "due_date": "2024-12-05",
    "items": [
        {
            "description": "Office Equipment",
            "quantity": 5,
            "unit_price": 1700.00,
            "total": 8500.00
        }
    ]
}


def test_endpoint(endpoint, data, description):
    """Test an external API endpoint"""
    print(f"\n{'='*60}")
    print(f"Testing: {description}")
    print(f"{'='*60}")
    
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    print(f"URL: {url}")
    print(f"Data: {json.dumps(data, indent=2)}")
    
    try:
        response = requests.post(url, json=data, headers=headers)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("✓ SUCCESS")
        else:
            print("✗ FAILED")
            
        return response.status_code == 200
        
    except Exception as e:
        print(f"✗ ERROR: {str(e)}")
        return False


def test_invalid_token():
    """Test with invalid token"""
    print(f"\n{'='*60}")
    print(f"Testing: Invalid Token")
    print(f"{'='*60}")
    
    url = f"{BASE_URL}/api/ext/removed"
    headers = {
        "Authorization": "Bearer INVALID_TOKEN",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=test_client_invoice, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 401:
            print("✓ Correctly rejected invalid token")
            return True
        else:
            print("✗ Should have returned 401")
            return False
            
    except Exception as e:
        print(f"✗ ERROR: {str(e)}")
        return False


def test_missing_auth():
    """Test without authorization header"""
    print(f"\n{'='*60}")
    print(f"Testing: Missing Authorization Header")
    print(f"{'='*60}")
    
    url = f"{BASE_URL}/api/ext/removed"
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, json=test_client_invoice, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 401:
            print("✓ Correctly rejected missing auth")
            return True
        else:
            print("✗ Should have returned 401")
            return False
            
    except Exception as e:
        print(f"✗ ERROR: {str(e)}")
        return False


def main():
    """Run all tests"""
    print("="*60)
    print("External API Test Suite")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Token: {API_TOKEN[:20]}...")
    
    results = []
    
    # Skip removed FGO endpoints
    
    # Test security
    results.append(test_invalid_token())
    results.append(test_missing_auth())
    
    # Summary
    print(f"\n{'='*60}")
    print("Test Summary")
    print(f"{'='*60}")
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    
    if passed == total:
        print("✓ All tests passed!")
    else:
        print(f"✗ {total - passed} test(s) failed")
    
    return passed == total


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
