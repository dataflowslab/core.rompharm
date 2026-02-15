
import sys
import os
from bson import ObjectId
import json

# Add src to path
sys.path.append(os.getcwd())

from src.backend.utils.db import get_db

def debug_approvals(username):
    db = get_db()
    
    # 1. Get User
    user = db.users.find_one({"username": username})
    if not user:
        print(f"❌ User '{username}' not found!")
        return
        
    user_id = str(user["_id"])
    user_role = str(user.get("role")) if user.get("role") else None
    
    print(f"✅ User: {username}")
    print(f"   ID: {user_id}")
    print(f"   Role: {user_role}")
    print(f"   Is Staff: {user.get('is_staff')}")
    
    # 2. Get Active Flows
    active_flows = list(db.approval_flows.find({
        "status": {"$in": ["pending", "in_progress"]}
    }))
    print(f"\n🔍 Found {len(active_flows)} active flows in DB.")
    
    match_count = 0
    mismatch_details = []
    
    for flow in active_flows:
        flow_id = str(flow["_id"])
        
        # Check if already signed
        signed = any(str(s["user_id"]) == user_id for s in flow.get("signatures", []))
        if signed:
            continue

        can_sign = False
        match_reason = []
        
        officers = flow.get("required_officers", []) + flow.get("optional_officers", [])
        
        for officer in officers:
            o_type = officer["type"] # person or role
            o_ref = str(officer["reference"])
            
            if o_type == "person":
                if o_ref == user_id:
                    can_sign = True
                    match_reason.append(f"Person Match ({o_ref})")
            elif o_type == "role":
                # Check direct ID match
                if user_role and o_ref == user_role:
                    can_sign = True
                    match_reason.append(f"Role ID Match ({o_ref})")
                
                # Check "admin" string alias
                if o_ref == "admin" and user.get("is_staff"):
                    # This is what we might mean by 'admin' role in legacy/mixed data
                    match_reason.append(f"Admin Alias Match (is_staff=True)")
                    
        if can_sign:
            match_count += 1
            # print(f"  ✅ Flow {flow_id} matches: {', '.join(match_reason)}")
        else:
            # Collect details on why it failed
            officer_summaries = []
            for o in officers:
                officer_summaries.append(f"{o['type']}:{o['reference']}")
            mismatch_details.append(f"Flow {flow_id}: Officers [{', '.join(officer_summaries)}]")

    print(f"\n✅ Total Matches (simulated): {match_count}")
    
    if mismatch_details:
        print(f"\n❌ Mismatches ({len(mismatch_details)}):")
        for d in mismatch_details[:10]: # Print first 10
            print(f"  - {d}")
        if len(mismatch_details) > 10:
            print(f"  ... and {len(mismatch_details) - 10} more.")

if __name__ == "__main__":
    debug_approvals("romphadmin")
