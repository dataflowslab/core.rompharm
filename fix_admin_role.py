"""
Fix admin user role
Actualizează admin user cu role corect
"""
from bson import ObjectId
from src.backend.utils.db import get_db

def fix_admin_role():
    db = get_db()
    users_collection = db['users']
    roles_collection = db['roles']
    
    # Get admin role
    admin_role = roles_collection.find_one({'slug': 'admin'})
    if not admin_role:
        print("❌ Admin role not found")
        return
    
    # Update admin user
    result = users_collection.update_one(
        {'username': 'admin'},
        {'$set': {'role': admin_role['_id']}}
    )
    
    if result.modified_count > 0:
        print(f"✅ Updated admin user with role: {admin_role['name']}")
    else:
        print("⚠️  Admin user not found or already has role")
    
    # Verify
    admin_user = users_collection.find_one({'username': 'admin'})
    if admin_user:
        print(f"\nAdmin user:")
        print(f"  Username: {admin_user['username']}")
        print(f"  Role: {admin_user.get('role')}")
        print(f"  Is Staff: {admin_user.get('is_staff')}")

if __name__ == "__main__":
    fix_admin_role()
