"""
Audit logging utilities
"""
from fastapi import Request
from typing import Optional
from ..utils.db import get_db
from ..models.audit_log_model import AuditLogModel


def log_action(
    action: str,
    username: Optional[str] = None,
    request: Optional[Request] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None
):
    """
    Log an action to the audit log
    
    Args:
        action: Action performed
        username: Username who performed the action
        request: FastAPI request object (to extract IP and user agent)
        resource_type: Type of resource
        resource_id: ID of the resource
        details: Additional details
    """
    try:
        db = get_db()
        audit_collection = db[AuditLogModel.collection_name]
        
        ip_address = None
        user_agent = None
        
        if request:
            # Get IP address
            ip_address = request.client.host if request.client else None
            
            # Get user agent
            user_agent = request.headers.get('user-agent')
        
        log_entry = AuditLogModel.create(
            action=action,
            username=username,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details
        )
        
        audit_collection.insert_one(log_entry)
    except Exception as e:
        # Don't fail the main operation if audit logging fails
        print(f"Failed to log audit action: {e}")
