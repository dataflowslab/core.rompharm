"""
Segment model for CRM
"""
from datetime import datetime
from typing import Optional, Dict, Any


class SegmentModel:
    collection_name = "segments"
    
    @staticmethod
    def create(
        name: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new segment document"""
        return {
            'name': name,
            'description': description,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    
    @staticmethod
    def update(segment_id: str, **kwargs) -> Dict[str, Any]:
        """Update segment fields"""
        update_data = {k: v for k, v in kwargs.items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        return update_data
