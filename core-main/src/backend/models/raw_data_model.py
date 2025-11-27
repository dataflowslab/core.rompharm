"""
Raw data model for storing external API data dumps
"""
from typing import Dict, Any
from datetime import datetime


class RawDataModel:
    """Model for raw data from external sources"""
    
    collection_name = "raw_data"
    
    @staticmethod
    def create(source: str, data: Any) -> Dict[str, Any]:
        """
        Create a new raw data document
        
        Args:
            source: Source identifier (e.g., 'ext/fgo-client-invoices')
            data: The raw data payload
            
        Returns:
            Raw data document
        """
        return {
            'date_added': datetime.utcnow(),
            'source': source,
            'data': data
        }
    
    @staticmethod
    def to_dict(raw_data_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            raw_data_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if raw_data_doc and '_id' in raw_data_doc:
            raw_data_doc['id'] = str(raw_data_doc['_id'])
            del raw_data_doc['_id']
        
        # Convert datetime to ISO format
        if 'date_added' in raw_data_doc and isinstance(raw_data_doc['date_added'], datetime):
            raw_data_doc['date_added'] = raw_data_doc['date_added'].isoformat()
            
        return raw_data_doc
