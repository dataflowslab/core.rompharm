"""
Role model for storing InvenTree roles
"""
from typing import Dict, Any, Optional
from datetime import datetime


class RoleModel:
    """Model for roles synchronized from InvenTree"""
    
    collection_name = "roles"
    
    @staticmethod
    def create(name: str, inventree_id: Optional[int] = None, 
               description: Optional[str] = None) -> Dict[Any, Any]:
        """
        Create a new role document
        
        Args:
            name: Role name
            inventree_id: InvenTree role ID
            description: Role description
            
        Returns:
            Role document
        """
        return {
            'name': name,
            'inventree_id': inventree_id,
            'description': description,
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
