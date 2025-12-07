"""
Campaign model for CRM
"""
from datetime import datetime
from typing import Optional, Dict, Any


class CampaignModel:
    collection_name = "campaigns"
    
    @staticmethod
    def create(
        type: str,  # 'email' for now
        title: str,
        message: str,
        segment_id: str,
        image: Optional[str] = None,
        link: Optional[str] = None,
        delivery_date: Optional[datetime] = None,
        scheduled_at: Optional[datetime] = None,
        status: str = 'draft'  # draft, sent, sending, scheduled
    ) -> Dict[str, Any]:
        """Create a new campaign document"""
        return {
            'type': type,
            'title': title,
            'message': message,
            'segment_id': segment_id,
            'image': image,
            'link': link,
            'delivery_date': delivery_date,
            'scheduled_at': scheduled_at,
            'status': status,
            'sent_count': 0,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'sent_at': None
        }
    
    @staticmethod
    def update(campaign_id: str, **kwargs) -> Dict[str, Any]:
        """Update campaign fields"""
        update_data = {k: v for k, v in kwargs.items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        return update_data
