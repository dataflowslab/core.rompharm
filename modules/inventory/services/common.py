"""
Common utility functions for inventory services
"""
from typing import Any, Dict, List
from bson import ObjectId
from datetime import datetime


def serialize_doc(doc: Any) -> Any:
    """
    Convert MongoDB document to JSON-serializable format
    Automatically adds 'value' field for Select components (value = _id)
    """
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id' or key.endswith('_id'):
                result[key] = str(value) if value else None
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(item) if isinstance(item, (dict, list)) else item for item in value]
            else:
                result[key] = value
        
        # Add 'value' field for Select components (value = _id)
        if '_id' in result and result['_id']:
            result['value'] = result['_id']
        
        return result
    return doc


def validate_object_id(id_str: str, field_name: str = "id") -> ObjectId:
    """Validate and convert string to ObjectId"""
    try:
        return ObjectId(id_str)
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} format")


def build_search_query(search: str, fields: List[str]) -> Dict:
    """Build MongoDB search query for multiple fields"""
    if not search:
        return {}
    return {
        '$or': [
            {field: {'$regex': search, '$options': 'i'}}
            for field in fields
        ]
    }


def paginate_results(collection, query: Dict, skip: int, limit: int, 
                     sort_by: str = '_id', sort_order: str = 'asc') -> Dict:
    """Paginate MongoDB query results"""
    sort_direction = 1 if sort_order == 'asc' else -1
    
    total = collection.count_documents(query)
    cursor = collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
    results = list(cursor)
    
    return {
        'results': serialize_doc(results),
        'total': total,
        'skip': skip,
        'limit': limit
    }
