"""
Global serialization utilities
Converts MongoDB documents to JSON-serializable format
"""
from typing import Any
from bson import ObjectId
from datetime import datetime


def serialize_doc(doc: Any) -> Any:
    """
    Convert MongoDB document to JSON-serializable format
    
    Features:
    - Converts ObjectId to string
    - Converts datetime to ISO format
    - Recursively handles nested dicts and lists
    - Automatically adds 'value' field (value = _id) for Select components
    
    Args:
        doc: MongoDB document (dict, list, or primitive)
    
    Returns:
        JSON-serializable version of the document
    """
    if doc is None:
        return None
    
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            # Handle _id and *_id fields
            if key == '_id' or key.endswith('_id'):
                result[key] = str(value) if value else None
            # Handle ObjectId values
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            # Handle datetime values
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            # Recursively handle nested dicts
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            # Recursively handle lists
            elif isinstance(value, list):
                result[key] = [
                    serialize_doc(item) if isinstance(item, (dict, list)) else item 
                    for item in value
                ]
            # Keep other values as-is
            else:
                result[key] = value
        
        # Add 'value' field for Select components (value = _id)
        # This makes all API responses compatible with Mantine Select
        if '_id' in result and result['_id']:
            result['value'] = result['_id']
        
        return result
    
    return doc


def serialize_object_id(obj_id: ObjectId) -> str:
    """Convert ObjectId to string"""
    return str(obj_id) if obj_id else None


def serialize_datetime(dt: datetime) -> str:
    """Convert datetime to ISO format string"""
    return dt.isoformat() if dt else None
