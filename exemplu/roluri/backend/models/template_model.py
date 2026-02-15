"""
Template model for OfficeClerk/DataFlows Docu templates
"""
from typing import Dict, Any, Optional, List
from datetime import datetime


class TemplateModel:
    """Model for document templates"""
    
    collection_name = "templates"
    
    @staticmethod
    def create(code: str, name: str, description: Optional[str] = None) -> Dict[Any, Any]:
        """
        Create a new template document
        
        Args:
            code: 12-character template code from OfficeClerk
            name: Human-readable template name
            description: Template description
            
        Returns:
            Template document
        """
        return {
            'code': code,
            'name': name,
            'description': description,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    
    @staticmethod
    def to_dict(template_doc: Dict[Any, Any]) -> Dict[Any, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            template_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if template_doc and '_id' in template_doc:
            template_doc['id'] = str(template_doc['_id'])
            del template_doc['_id']
        
        # Convert datetime to ISO format
        if 'created_at' in template_doc:
            template_doc['created_at'] = template_doc['created_at'].isoformat()
        if 'updated_at' in template_doc:
            template_doc['updated_at'] = template_doc['updated_at'].isoformat()
            
        return template_doc
