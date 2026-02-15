"""
Audit Log Model
"""
from datetime import datetime
from typing import Optional


class AuditLogModel:
    collection_name = "audit_logs"
    
    @staticmethod
    def create(
        action: str,
        username: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None
    ) -> dict:
        """
        Create a new audit log entry
        
        Args:
            action: Action performed (login, form_created, form_submitted, document_generated, etc.)
            username: Username who performed the action
            ip_address: IP address of the user
            user_agent: User agent string
            resource_type: Type of resource (form, submission, document, etc.)
            resource_id: ID of the resource
            details: Additional details about the action
            
        Returns:
            Audit log document ready for MongoDB insertion
        """
        return {
            'action': action,
            'username': username,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'details': details or {},
            'timestamp': datetime.utcnow()
        }
