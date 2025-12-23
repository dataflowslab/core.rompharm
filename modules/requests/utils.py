"""
Utility functions for requests module
"""
from typing import Dict
from fastapi import HTTPException


def get_inventree_headers(user: dict) -> Dict[str, str]:
    """Get headers for InvenTree API requests"""
    token = user.get('token')
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated with InvenTree")
    
    return {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }


def generate_request_reference(db) -> str:
    """Generate next request reference (REQ-NNNN)"""
    requests_collection = db['depo_requests']
    
    # Find the highest reference number
    last_request = requests_collection.find_one(
        {'reference': {'$regex': '^REQ-'}},
        sort=[('reference', -1)]
    )
    
    if last_request and 'reference' in last_request:
        # Extract number from REQ-NNNN
        try:
            last_num = int(last_request['reference'].split('-')[1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"REQ-{next_num:04d}"
