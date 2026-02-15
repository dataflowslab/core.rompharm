"""
Subscriber model for CRM
"""
from datetime import datetime
from typing import Optional, Dict, Any, List


class SubscriberModel:
    collection_name = "subscribers"
    
    @staticmethod
    def create(
        name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        tax_id: Optional[str] = None,
        anaf_data: Optional[Dict[str, Any]] = None,
        email_marketing_consent: bool = False,
        sms_marketing_consent: bool = False,
        segments: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create a new subscriber document"""
        return {
            'name': name,
            'email': email,
            'phone': phone,
            'tax_id': tax_id,
            'anaf': anaf_data,
            'email_marketing_consent': email_marketing_consent,
            'sms_marketing_consent': sms_marketing_consent,
            'segments': segments or [],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    
    @staticmethod
    def update(subscriber_id: str, **kwargs) -> Dict[str, Any]:
        """Update subscriber fields"""
        update_data = {k: v for k, v in kwargs.items() if v is not None}
        update_data['updated_at'] = datetime.utcnow()
        return update_data
