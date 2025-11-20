"""
Data model for form submissions
"""
from typing import Dict, Any, Optional
from datetime import datetime
from bson import ObjectId


class DataModel:
    """Model for form submission data stored in MongoDB"""
    
    collection_name = "data"
    
    @staticmethod
    def create(form_id: str, data: Dict[Any, Any], 
               submitted_by: Optional[str] = None) -> Dict[Any, Any]:
        """
        Create a new data submission document
        
        Args:
            form_id: ID of the form
            data: Submitted form data
            submitted_by: Username of submitter
            
        Returns:
            Data document
        """
        return {
            'form_id': form_id,
            'data': data,
            'submitted_by': submitted_by,
            'submitted_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'state': 'new',
            'state_updated_at': datetime.utcnow(),
            'state_updated_by': None,
            'notes': ''
        }
    
    @staticmethod
    def to_dict(data_doc: Dict[Any, Any]) -> Dict[Any, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            data_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if data_doc and '_id' in data_doc:
            data_doc['id'] = str(data_doc['_id'])
            del data_doc['_id']
        
        # Convert datetime to ISO format
        if 'submitted_at' in data_doc:
            data_doc['submitted_at'] = data_doc['submitted_at'].isoformat()
        if 'updated_at' in data_doc:
            data_doc['updated_at'] = data_doc['updated_at'].isoformat()
        if 'state_updated_at' in data_doc and data_doc['state_updated_at']:
            data_doc['state_updated_at'] = data_doc['state_updated_at'].isoformat()
            
        return data_doc
