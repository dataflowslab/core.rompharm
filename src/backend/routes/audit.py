"""
Audit log routes
"""
from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Any, Optional
from datetime import datetime

from src.backend.utils.db import get_db
from src.backend.models.audit_log_model import AuditLogModel
from src.backend.routes.auth import verify_admin

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/")
def get_audit_logs(
    limit: int = Query(100, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    action: Optional[str] = None,
    username: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user = Depends(verify_admin)
) -> Dict[str, Any]:
    """
    Get audit logs with pagination and filtering
    Requires administrator access
    """
    db = get_db()
    audit_collection = db[AuditLogModel.collection_name]
    
    # Build filter
    filter_query = {}
    if action:
        filter_query['action'] = action
    if username:
        filter_query['username'] = username

    if date_from or date_to:
        date_query = {}
        if date_from:
            try:
                if len(date_from) == 10:
                    date_query["$gte"] = datetime.fromisoformat(f"{date_from}T00:00:00")
                else:
                    date_query["$gte"] = datetime.fromisoformat(date_from)
            except Exception:
                pass
        if date_to:
            try:
                if len(date_to) == 10:
                    date_query["$lte"] = datetime.fromisoformat(f"{date_to}T23:59:59")
                else:
                    date_query["$lte"] = datetime.fromisoformat(date_to)
            except Exception:
                pass
        if date_query:
            filter_query["timestamp"] = date_query

    if search:
        search = search.strip()
        if search:
            filter_query["$or"] = [
                {"action": {"$regex": search, "$options": "i"}},
                {"username": {"$regex": search, "$options": "i"}},
                {"ip_address": {"$regex": search, "$options": "i"}}
            ]
    
    # Get total count
    total = audit_collection.count_documents(filter_query)
    
    # Get logs
    logs = list(audit_collection.find(filter_query)
                .sort('timestamp', -1)
                .skip(skip)
                .limit(limit))
    
    # Convert ObjectId to string and format dates
    for log in logs:
        log['id'] = str(log['_id'])
        del log['_id']
        
        if 'timestamp' in log:
            log['timestamp'] = log['timestamp'].isoformat()
    
    return {
        'logs': logs,
        'total': total,
        'limit': limit,
        'skip': skip
    }


@router.get("/actions")
def get_available_actions(user = Depends(verify_admin)) -> List[str]:
    """
    Get list of all available action types
    Requires administrator access
    """
    db = get_db()
    audit_collection = db[AuditLogModel.collection_name]
    
    actions = audit_collection.distinct('action')
    return sorted(actions)
