"""
Helper functions for approval flows
"""
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException


def get_state_by_slug(db, slug: str):
    """Get state from depo_requests_states by slug"""
    state = db.depo_requests_states.find_one({'slug': slug})
    if not state:
        raise HTTPException(status_code=500, detail=f"State '{slug}' not found in database")
    return state


def update_request_state(db, request_id: str, state_slug: str, additional_data: dict = None):
    """Update request state using state_id system"""
    state = get_state_by_slug(db, state_slug)
    
    update_data = {
        'state_id': state['_id'],
        'workflow_level': state['workflow_level'],
        'status': state['name'],
        'updated_at': datetime.utcnow()
    }
    
    if additional_data:
        update_data.update(additional_data)
    
    db.depo_requests.update_one(
        {'_id': ObjectId(request_id)},
        {'$set': update_data}
    )
    
    return state


def check_flow_completion(flow):
    """Check if approval flow conditions are met"""
    signatures = flow.get("signatures", [])
    signature_user_ids = [s["user_id"] for s in signatures]
    
    # Check must_sign: all must have signed
    must_sign_officers = flow.get("must_sign_officers", [])
    all_must_signed = True
    for officer in must_sign_officers:
        if officer["reference"] not in signature_user_ids:
            all_must_signed = False
            break
    
    # Check can_sign: at least min_signatures have signed
    can_sign_officers = flow.get("can_sign_officers", [])
    min_signatures = flow.get("min_signatures", 1)
    can_sign_count = 0
    for officer in can_sign_officers:
        if officer["reference"] in signature_user_ids:
            can_sign_count += 1
    
    has_min_signatures = can_sign_count >= min_signatures
    
    return all_must_signed and has_min_signatures


def get_flow_config(db, config_slug: str, flow_slug: str):
    """Get flow configuration from MongoDB"""
    config = db.config.find_one({'slug': config_slug})
    
    if not config or 'items' not in config:
        return None
    
    # Find flow config
    for item in config.get('items', []):
        if item.get('slug') == flow_slug and item.get('enabled', True):
            return item
    
    return None


def build_officers_lists(flow_config):
    """Build can_sign and must_sign officers lists from config"""
    can_sign_officers = []
    for user in flow_config.get('can_sign', []):
        can_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "can_sign"
        })
    
    must_sign_officers = []
    for user in flow_config.get('must_sign', []):
        must_sign_officers.append({
            "type": "person",
            "reference": user.get('user_id'),
            "username": user.get('username'),
            "action": "must_sign"
        })
    
    return can_sign_officers, must_sign_officers


def enrich_flow_with_user_details(db, flow):
    """Add user details to flow signatures"""
    for signature in flow.get("signatures", []):
        user = db.users.find_one({"_id": ObjectId(signature["user_id"])})
        if user:
            signature["user_name"] = user.get("name") or user.get("username")
    return flow
