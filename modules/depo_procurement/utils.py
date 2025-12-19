"""
Utility functions for DEPO Procurement Module
"""
from datetime import datetime
from bson import ObjectId


def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id':
                # Convert _id to string and also add as 'pk' for frontend compatibility
                result[key] = str(value) if value else None
                result['pk'] = str(value) if value else None
            elif key.endswith('_id'):
                result[key] = str(value) if value else None
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(item) if isinstance(item, dict) else item for item in value]
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result
    return doc


def is_manager(user: dict) -> bool:
    """Check if user is in Managers group"""
    groups = user.get('groups', [])
    for group in groups:
        if isinstance(group, dict):
            if group.get('name', '').lower() == 'managers':
                return True
        elif isinstance(group, str):
            if group.lower() == 'managers':
                return True
    return False
