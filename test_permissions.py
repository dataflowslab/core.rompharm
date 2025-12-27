"""
Test permissions system
"""
import requests

BASE_URL = "http://localhost:8000"

# Login as admin
response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={'username': 'admin', 'password': 'admin123'}
)

if response.status_code != 200:
    print("❌ Login failed")
    exit(1)

token = response.json()['token']
headers = {'Authorization': f'Bearer {token}'}

print("="*60)
print("PERMISSIONS SYSTEM TEST")
print("="*60)

# 1. Get permission items
print("\n[1] Get available permission items:")
response = requests.get(f"{BASE_URL}/api/roles/permissions/items", headers=headers)
if response.status_code == 200:
    items = response.json()['results']
    print(f"✅ Found {len(items)} permission items:")
    for item in items:
        print(f"   - {item['slug']}")
else:
    print(f"❌ Failed: {response.status_code}")

# 2. Get roles
print("\n[2] Get roles:")
response = requests.get(f"{BASE_URL}/api/roles", headers=headers)
if response.status_code == 200:
    roles = response.json()['results']
    print(f"✅ Found {len(roles)} roles:")
    for role in roles:
        items_count = len(role.get('items', []))
        print(f"   - {role['name']} ({role['slug']}): {items_count} permissions")
        if role.get('items'):
            for item in role['items'][:3]:  # Show first 3
                print(f"      • {item}")
            if len(role['items']) > 3:
                print(f"      ... and {len(role['items']) - 3} more")
else:
    print(f"❌ Failed: {response.status_code}")

# 3. Update a role with permissions
print("\n[3] Update Admin role with permissions:")
admin_role = next((r for r in roles if r['slug'] == 'admin'), None)
if admin_role:
    # Add all permissions to admin
    all_permissions = [item['slug'] for item in items]
    
    response = requests.put(
        f"{BASE_URL}/api/roles/{admin_role['_id']}",
        headers=headers,
        json={'items': all_permissions}
    )
    
    if response.status_code == 200:
        updated_role = response.json()
        print(f"✅ Admin role updated with {len(updated_role.get('items', []))} permissions")
    else:
        print(f"❌ Failed: {response.status_code}")
        print(response.text)
else:
    print("❌ Admin role not found")

# 4. Test user permissions
print("\n[4] Test user permissions:")
response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
if response.status_code == 200:
    user = response.json()
    print(f"✅ Current user: {user['username']}")
    if user.get('role'):
        role = user['role']
        print(f"   Role: {role.get('name')} ({role.get('slug')})")
        items = role.get('items', [])
        print(f"   Permissions: {len(items)}")
        if items:
            for item in items[:5]:
                print(f"      • {item}")
            if len(items) > 5:
                print(f"      ... and {len(items) - 5} more")
else:
    print(f"❌ Failed: {response.status_code}")

print("\n✅ All tests completed!")
