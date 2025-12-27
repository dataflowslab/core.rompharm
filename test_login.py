"""
Test login pentru useri
"""
import requests

BASE_URL = "http://localhost:8000"

users = [
    ('admin', 'admin123'),
    ('eugenpopovici', 'QSPL7827'),
    ('florentiubarbu', 'HYAPL67282=='),
    ('romphadmin', 'UYHA-863-haga')
]

print("="*60)
print("LOGIN TESTS")
print("="*60)

for username, password in users:
    print(f"\n[{username}]")
    
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={'username': username, 'password': password}
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"  ✅ Login successful")
        print(f"     Token: {data['token'][:30]}...")
        print(f"     Is Staff: {data.get('is_staff')}")
        print(f"     Name: {data.get('name')}")
    else:
        print(f"  ❌ Login failed: {response.status_code}")
        print(f"     {response.text}")

print("\n✅ All tests completed!")
