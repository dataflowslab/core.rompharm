"""
Approval Flow Model
Tracks approval status for specific objects
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from bson import ObjectId
import hashlib
import json


class ApprovalSignature(BaseModel):
    """Individual signature in approval flow"""
    user_id: str
    username: str
    signed_at: datetime
    signature_hash: str  # SHA256 hash of signature data
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ApprovalFlowModel(BaseModel):
    """Approval flow for a specific object"""
    id: Optional[str] = Field(None, alias="_id")
    object_type: str  # e.g., "procurement_order"
    object_source: str  # e.g., "depo_procurement"
    object_id: str  # ID of the object being approved
    template_id: str  # Reference to approval template
    
    # Officers who need to approve
    must_sign_officers: List[Dict[str, Any]] = []  # Officers who must sign
    can_sign_officers: List[Dict[str, Any]] = []  # Officers who can sign
    
    # Signatures collected
    signatures: List[ApprovalSignature] = []
    
    # Status
    status: str = "pending"  # pending, in_progress, approved, rejected
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

    @staticmethod
    def generate_signature_hash(user_id: str, object_type: str, object_id: str, timestamp: datetime) -> str:
        """Generate signature hash"""
        data = {
            "user_id": user_id,
            "object_type": object_type,
            "object_id": object_id,
            "timestamp": timestamp.isoformat()
        }
        signature_string = json.dumps(data, sort_keys=True)
        return hashlib.sha256(signature_string.encode()).hexdigest()


class ApprovalFlowCreate(BaseModel):
    """Create approval flow"""
    object_type: str
    object_source: str
    object_id: str
    template_id: str


class ApprovalSignatureCreate(BaseModel):
    """Create signature"""
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
