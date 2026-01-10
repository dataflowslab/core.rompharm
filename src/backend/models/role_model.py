"""
Role model for user roles management
"""
from typing import Dict, Any, Optional
from datetime import datetime


class RoleModel:
    """Model for user roles"""
    
    collection_name = "roles"
    
    @staticmethod
    def create(name: str, description: Optional[str] = None, 
               permissions: Optional[list] = None) -> Dict[Any, Any]:
        """
        Create a new role document
        
        Args:
            name: Role name
            description: Role description
            permissions: List of permissions for this role
            
        Returns:
            Role document
        """
        return {
            'name': name,
            'description': description,
            'permissions': permissions or [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(role_doc: Dict[Any, Any]) -> Dict[Any, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            role_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if role_doc and '_id' in role_doc:
            role_doc['id'] = str(role_doc['_id'])
            del role_doc['_id']
        
        # Convert datetime to ISO format
        if 'created_at' in role_doc:
            role_doc['created_at'] = role_doc['created_at'].isoformat()
        if 'updated_at' in role_doc:
            role_doc['updated_at'] = role_doc['updated_at'].isoformat()
            
        return role_doc
