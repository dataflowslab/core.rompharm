"""
Form model for MongoDB
"""
from typing import Dict, Any, Optional
from datetime import datetime
from bson import ObjectId


class FormModel:
    """Model for JSON Forms stored in MongoDB"""
    
    collection_name = "forms"
    
    @staticmethod
    def create(slug: str, title: str, json_schema: Dict[Any, Any], 
               ui_schema: Optional[Dict[Any, Any]] = None, 
               description: Optional[str] = None,
               is_public: bool = True,
               template_codes: Optional[list] = None,
               notification_emails: Optional[list] = None,
               notification_template: str = 'default') -> Dict[Any, Any]:
        """
        Create a new form document
        
        Args:
            slug: URL-friendly identifier
            title: Form title
            json_schema: JSON Schema definition
            ui_schema: UI Schema for rendering
            description: Form description
            is_public: Whether form is publicly accessible
            template_codes: List of DataFlows Depo template codes
            notification_emails: List of emails to notify on new submissions
            notification_template: Email template name (default: 'default')
            
        Returns:
            Form document
        """
        return {
            'slug': slug,
            'title': title,
            'description': description,
            'json_schema': json_schema,
            'ui_schema': ui_schema or {},
            'is_public': is_public,
            'template_codes': template_codes or [],
            'notification_emails': notification_emails or [],
            'notification_template': notification_template,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'active': True,
            'deleted': None
        }
    
    @staticmethod
    def to_dict(form_doc: Dict[Any, Any]) -> Dict[Any, Any]:
        """
        Convert MongoDB document to dictionary
        
        Args:
            form_doc: MongoDB document
            
        Returns:
            Dictionary representation
        """
        if form_doc and '_id' in form_doc:
            form_doc['id'] = str(form_doc['_id'])
            del form_doc['_id']
        
        # Convert datetime to ISO format
        if 'created_at' in form_doc:
            form_doc['created_at'] = form_doc['created_at'].isoformat()
        if 'updated_at' in form_doc:
            form_doc['updated_at'] = form_doc['updated_at'].isoformat()
        if 'deleted' in form_doc and form_doc['deleted']:
            form_doc['deleted'] = form_doc['deleted'].isoformat()
            
        return form_doc
