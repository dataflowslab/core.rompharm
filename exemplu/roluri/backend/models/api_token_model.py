"""
API token model for external API access
"""
from typing import Dict, Any, List
from datetime import datetime


class ApiTokenModel:
    """Model for API tokens used for programmatic access"""
    
    collection_name = "api_tokens"
    
    @staticmethod
    def create(token: str, expires: datetime, rights: List[str]) -> Dict[str, Any]:
        """
        Create a new API token document
        
        Args:
            token: The API token string
            expires: Expiration datetime
            rights: List of rights/permissions for this token
            
        Returns:
            API token document
        """
        return {
            'token': token,
            'expires': expires,
            'rights': rights,
            'created_at': datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(token_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            token_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if token_doc and '_id' in token_doc:
            token_doc['id'] = str(token_doc['_id'])
            del token_doc['_id']
        
        # Convert datetime to ISO format
        if 'expires' in token_doc and isinstance(token_doc['expires'], datetime):
            token_doc['expires'] = token_doc['expires'].isoformat()
        if 'created_at' in token_doc and isinstance(token_doc['created_at'], datetime):
            token_doc['created_at'] = token_doc['created_at'].isoformat()
            
        return token_doc
