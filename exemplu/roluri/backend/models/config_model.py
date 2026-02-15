"""
Config model for application settings
"""
from typing import Dict, Any, Optional
from datetime import datetime


class ConfigModel:
    """Model for application configuration"""
    
    collection_name = "config"
    
    @staticmethod
    def create(company_name: str, company_logo: Optional[str] = None) -> Dict[Any, Any]:
        """
        Create a new config document
        
        Args:
            company_name: Company name
            company_logo: Path to company logo
            
        Returns:
            Config document
        """
        return {
            'company_name': company_name,
            'company_logo': company_logo or '/media/img/logo.svg',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(config_doc: Dict[Any, Any]) -> Dict[Any, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            config_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if config_doc and '_id' in config_doc:
            config_doc['id'] = str(config_doc['_id'])
            del config_doc['_id']
        
        # Convert datetime to ISO format
        if 'created_at' in config_doc:
            config_doc['created_at'] = config_doc['created_at'].isoformat()
        if 'updated_at' in config_doc:
            config_doc['updated_at'] = config_doc['updated_at'].isoformat()
            
        return config_doc
