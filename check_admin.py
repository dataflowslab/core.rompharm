"""
Check admin user
"""
from src.backend.utils.db import get_db
from src.backend.utils.local_auth import verify_password

db = get_db()
users = db['users']

admin = users.find_one({'username': 'admin'})

if admin:
    print("✅ Admin user found:")
    print(f"  Username: {admin['username']}")
    print(f"  Has password: {bool(admin.get('password'))}")
    print(f"  Has salt: {bool(admin.get('salt'))}")
    print(f"  Has role: {bool(admin.get('role'))}")
    print(f"  Is staff: {admin.get('is_staff')}")
    print(f"  Is active: {admin.get('is_active')}")
    
    # Test password
    if admin.get('salt') and admin.get('password'):
        test_pass = verify_password('admin123', admin['salt'], admin['password'])
        print(f"\n  Password 'admin123' valid: {test_pass}")
else:
    print("❌ Admin user not found!")
