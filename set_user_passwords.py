"""
Set passwords for existing users
Generează salt și hash pentru parole
"""
from src.backend.utils.db import get_db
from src.backend.utils.local_auth import generate_salt, hash_password
from datetime import datetime

# Users și parole
users_passwords = [
    ('eugenpopovici', 'QSPL7827'),
    ('florentiubarbu', 'HYAPL67282=='),
    ('romphadmin', 'UYHA-863-haga')
]

db = get_db()
users_collection = db['users']

print("="*60)
print("SET USER PASSWORDS")
print("="*60)

for username, password in users_passwords:
    print(f"\n[{username}]")
    
    # Check if user exists
    user = users_collection.find_one({'username': username})
    
    if not user:
        print(f"  ❌ User not found")
        continue
    
    # Generate salt and hash password
    salt = generate_salt()
    hashed_password = hash_password(password, salt)
    
    # Update user
    result = users_collection.update_one(
        {'username': username},
        {
            '$set': {
                'password': hashed_password,
                'salt': salt,
                'updated_at': datetime.utcnow()
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"  ✅ Password updated")
        print(f"     Salt: {salt[:16]}...")
        print(f"     Hash: {hashed_password[:32]}...")
    else:
        print(f"  ⚠️  No changes made")

print("\n" + "="*60)
print("VERIFICATION")
print("="*60)

# Verify passwords
from src.backend.utils.local_auth import verify_password

for username, password in users_passwords:
    user = users_collection.find_one({'username': username})
    
    if user and user.get('salt') and user.get('password'):
        is_valid = verify_password(password, user['salt'], user['password'])
        status = "✅" if is_valid else "❌"
        print(f"{status} {username}: password valid = {is_valid}")
    else:
        print(f"❌ {username}: missing salt or password")

print("\n✅ Done!")
