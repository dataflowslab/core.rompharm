
import sys
import os
from bson import ObjectId

sys.path.append(os.getcwd())
from src.backend.utils.db import get_db

def analyze_roles(username):
    db = get_db()
    
    # Get user and role
    user = db.users.find_one({"username": username})
    if not user:
        print("User not found")
        return

    user_id = str(user["_id"])
    role_id = str(user.get("role", "No Role"))
    print(f"User: {username}")
    print(f"User ID: {user_id}")
    print(f"Role ID: {role_id}")
    
    # Get all pending flows
    flows = list(db.approval_flows.find({"status": {"$in": ["pending", "in_progress"]}}))
    print(f"Total Pending Flows: {len(flows)}")
    
    match_person = 0
    match_role_id = 0
    match_admin_str = 0
    
    for flow in flows:
        officers = flow.get("required_officers", []) + flow.get("optional_officers", [])
        
        is_person_match = False
        is_role_id_match = False
        is_admin_match = False
        
        for o in officers:
            ref = str(o.get("reference"))
            otype = o.get("type")
            
            if otype == "person" and ref == user_id:
                is_person_match = True
            
            if otype == "role":
                if ref == role_id:
                    is_role_id_match = True
                if ref == "admin":
                    is_admin_match = True
        
        if is_person_match: match_person += 1
        if is_role_id_match: match_role_id += 1
        if is_admin_match: match_admin_str += 1
        
    print("-" * 30)
    print(f"Flows matching Person ID ({user_id}): {match_person}")
    print(f"Flows matching Role ID ({role_id}): {match_role_id}")
    print(f"Flows matching string 'admin': {match_admin_str}")
    print("-" * 30)

if __name__ == "__main__":
    analyze_roles("romphadmin")
