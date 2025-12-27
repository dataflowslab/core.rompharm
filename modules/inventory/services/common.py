"""
Common Services
Funcții helper folosite în toate services
"""
from typing import Any, Dict, List, Optional
from bson import ObjectId
from datetime import datetime


def serialize_doc(doc: Any) -> Any:
    """
    Convert MongoDB document to JSON-serializable format
    Convertește ObjectId și datetime la string
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
        return result
    
    if isinstance(doc, ObjectId):
        return str(doc)
    
    if isinstance(doc, datetime):
        return doc.isoformat()
    
    return doc


def validate_object_id(id_str: str, field_name: str = "ID") -> ObjectId:
    """
    Validează și convertește string la ObjectId
    
    Raises:
        ValueError: dacă ID-ul nu este valid
    """
    try:
        return ObjectId(id_str)
    except Exception:
        raise ValueError(f"Invalid {field_name}: {id_str}")


def build_search_query(
    search: Optional[str],
    search_fields: List[str],
    base_query: Optional[Dict] = None
) -> Dict:
    """
    Construiește query MongoDB cu search
    
    Args:
        search: Text de căutat
        search_fields: Lista de câmpuri în care să caute
        base_query: Query de bază (ex: {'is_active': True})
    
    Returns:
        Query MongoDB
    """
    query = base_query.copy() if base_query else {}
    
    if search:
        query['$or'] = [
            {field: {'$regex': search, '$options': 'i'}}
            for field in search_fields
        ]
    
    return query


def paginate_results(
    collection,
    query: Dict,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = '_id',
    sort_order: str = 'asc'
) -> Dict[str, Any]:
    """
    Execută query cu paginare și sortare
    
    Returns:
        Dict cu results, total, skip, limit
    """
    # Count total
    total = collection.count_documents(query)
    
    # Sort direction
    sort_direction = 1 if sort_order == 'asc' else -1
    
    # Execute query
    cursor = collection.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
    results = list(cursor)
    
    return {
        'results': [serialize_doc(doc) for doc in results],
        'total': total,
        'skip': skip,
        'limit': limit
    }
