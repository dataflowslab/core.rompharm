"""
Initialize Local Authentication System
Crează roles și admin user pentru localhost authentication
"""
from datetime import datetime
from bson import ObjectId
from src.backend.utils.db import get_db
from src.backend.utils.local_auth import create_user


def init_roles():
    """Creare roles de bază"""
    db = get_db()
    roles_collection = db['roles']
    
    # Check if roles already exist
    existing_count = roles_collection.count_documents({})
    if existing_count > 0:
        print(f"✅ Roles already exist ({existing_count} roles found)")
        return
    
    # Create default roles
    roles = [
        {
            'name': 'Admin',
            'slug': 'admin',
            'description': 'Administrator with full access',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            'name': 'Manager',
            'slug': 'manager',
            'description': 'Manager with elevated permissions',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            'name': 'User',
            'slug': 'user',
            'description': 'Standard user',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    ]
    
    result = roles_collection.insert_many(roles)
    print(f"✅ Created {len(result.inserted_ids)} roles:")
    
    for role in roles:
        print(f"   - {role['name']} ({role['slug']})")
    
    return result.inserted_ids


def init_admin_user():
    """Creare admin user"""
    db = get_db()
    users_collection = db['users']
    roles_collection = db['roles']
    
    # Check if admin user exists
    existing_admin = users_collection.find_one({'username': 'admin'})
    if existing_admin:
        print("✅ Admin user already exists")
        return
    
    # Get admin role
    admin_role = roles_collection.find_one({'slug': 'admin'})
    if not admin_role:
        print("❌ Admin role not found. Run init_roles() first.")
        return
    
    # Create admin user
    try:
        user = create_user(
            username='admin',
            password='admin123',  # Default password - CHANGE THIS!
            firstname='System',
            lastname='Administrator',
            role_id=str(admin_role['_id']),
            email='admin@localhost',
            is_staff=True,
            is_active=True
        )
        
        print("✅ Created admin user:")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   ⚠️  IMPORTANT: Change this password after first login!")
        
        return user
    except Exception as e:
        print(f"❌ Failed to create admin user: {e}")
        return None


def init_test_users():
    """Creare test users (optional)"""
    db = get_db()
    users_collection = db['users']
    roles_collection = db['roles']
    
    # Get roles
    user_role = roles_collection.find_one({'slug': 'user'})
    manager_role = roles_collection.find_one({'slug': 'manager'})
    
    if not user_role or not manager_role:
        print("❌ Roles not found. Run init_roles() first.")
        return
    
    test_users = [
        {
            'username': 'testuser',
            'password': 'test123',
            'firstname': 'Test',
            'lastname': 'User',
            'role_id': str(user_role['_id']),
            'email': 'testuser@localhost',
            'is_staff': False
        },
        {
            'username': 'testmanager',
            'password': 'test123',
            'firstname': 'Test',
            'lastname': 'Manager',
            'role_id': str(manager_role['_id']),
            'email': 'testmanager@localhost',
            'is_staff': True
        }
    ]
    
    created = 0
    for user_data in test_users:
        # Check if exists
        existing = users_collection.find_one({'username': user_data['username']})
        if existing:
            print(f"⚠️  User {user_data['username']} already exists")
            continue
        
        try:
            create_user(**user_data)
            print(f"✅ Created test user: {user_data['username']}")
            created += 1
        except Exception as e:
            print(f"❌ Failed to create {user_data['username']}: {e}")
    
    if created > 0:
        print(f"\n✅ Created {created} test users")
        print("   Credentials: username / test123")


def verify_setup():
    """Verificare setup"""
    db = get_db()
    roles_collection = db['roles']
    users_collection = db['users']
    
    print("\n" + "="*60)
    print("VERIFICATION")
    print("="*60)
    
    # Count roles
    roles_count = roles_collection.count_documents({})
    print(f"\nRoles: {roles_count}")
    
    for role in roles_collection.find():
        print(f"  - {role['name']} ({role['slug']})")
    
    # Count users
    users_count = users_collection.count_documents({})
    print(f"\nUsers: {users_count}")
    
    for user in users_collection.find():
        if user.get('role'):
            try:
                role = roles_collection.find_one({'_id': ObjectId(user['role'])})
                role_name = role['name'] if role else 'Unknown'
            except:
                role_name = 'Unknown'
        else:
            role_name = 'No role'
        
        firstname = user.get('firstname', '')
        lastname = user.get('lastname', '')
        print(f"  - {user['username']} ({firstname} {lastname}) - {role_name}")
    
    print("\n" + "="*60)


def main():
    """Main initialization"""
    print("="*60)
    print("LOCAL AUTHENTICATION INITIALIZATION")
    print("="*60)
    
    # 1. Init roles
    print("\n[1/3] Initializing roles...")
    init_roles()
    
    # 2. Init admin user
    print("\n[2/3] Initializing admin user...")
    init_admin_user()
    
    # 3. Init test users (optional)
    print("\n[3/3] Initializing test users...")
    response = input("Create test users? (y/n): ")
    if response.lower() == 'y':
        init_test_users()
    else:
        print("⏭️  Skipping test users")
    
    # 4. Verify
    verify_setup()
    
    print("\n✅ Initialization completed!")
    print("\nNext steps:")
    print("1. Update config.yaml: identity_server: 'localhost'")
    print("2. Restart server")
    print("3. Login with: admin / admin123")
    print("4. Change admin password!")


if __name__ == "__main__":
    main()
