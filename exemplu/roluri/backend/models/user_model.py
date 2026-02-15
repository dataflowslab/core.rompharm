"""
User model for local authentication
"""
from typing import Dict, Any, Optional
from datetime import datetime


class UserModel:
    """Model for users with local authentication data"""
    
    collection_name = "users"
    
    @staticmethod
    def create(username: str, token: str,
               firstname: Optional[str] = None, lastname: Optional[str] = None,
               local_role: Optional[str] = None) -> Dict[Any, Any]:
        """
        Create a new user document
        
        Args:
            username: Username
            token: Authentication token (optional)
            firstname: User's first name
            lastname: User's last name
            local_role: Local role assigned to user
            
        Returns:
            User document
        """
        return {
            'username': username,
            'token': token,
            'firstname': firstname,
            'lastname': lastname,
            'local_role': local_role,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'last_login': datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(user_doc: Dict[Any, Any]) -> Dict[Any, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            user_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if user_doc and '_id' in user_doc:
            user_doc['id'] = str(user_doc['_id'])
            del user_doc['_id']
        
        # Convert datetime to ISO format
        if 'created_at' in user_doc:
            user_doc['created_at'] = user_doc['created_at'].isoformat()
        if 'updated_at' in user_doc:
            user_doc['updated_at'] = user_doc['updated_at'].isoformat()
        if 'last_login' in user_doc:
            user_doc['last_login'] = user_doc['last_login'].isoformat()
            
        return user_doc
