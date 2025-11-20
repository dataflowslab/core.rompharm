"""
Form state history model
"""
from datetime import datetime
from typing import Dict, Any


class FormStateModel:
    collection_name = "form_states"
    
    # State constants
    STATE_NEW = "new"
    STATE_IN_REVIEW = "in_review"
    STATE_APPROVED = "approved"
    STATE_REJECTED = "rejected"
    STATE_CANCELLED = "cancelled"
    
    VALID_STATES = [STATE_NEW, STATE_IN_REVIEW, STATE_APPROVED, STATE_REJECTED, STATE_CANCELLED]
    
    @staticmethod
    def create(
        submission_id: str,
        state: str,
        changed_by: str,
        notes: str = ""
    ) -> Dict[str, Any]:
        """Create a new state change record"""
        return {
            'submission_id': submission_id,
            'state': state,
            'changed_by': changed_by,
            'notes': notes,
            'created_at': datetime.utcnow()
        }
