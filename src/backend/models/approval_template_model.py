"""
Approval Template Model
Defines approval workflows for different object types
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from bson import ObjectId


class ApprovalOfficer(BaseModel):
    """Officer who can approve"""
    type: str  # "person" or "role"
    reference: str  # user_id or role_name
    action: str  # "can_sign" or "must_sign"
    order: int = 0  # Order in approval sequence


class ApprovalTemplateModel(BaseModel):
    """Approval template for object types"""
    id: Optional[str] = Field(None, alias="_id")
    object_type: str  # e.g., "procurement_order", "purchase_request"
    object_source: str  # e.g., "depo_procurement", "core"
    name: str
    description: Optional[str] = None
    officers: List[ApprovalOfficer] = []
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }


class ApprovalTemplateCreate(BaseModel):
    """Create approval template"""
    object_type: str
    object_source: str
    name: str
    description: Optional[str] = None
    officers: List[Dict[str, Any]] = []
    active: bool = True


class ApprovalTemplateUpdate(BaseModel):
    """Update approval template"""
    name: Optional[str] = None
    description: Optional[str] = None
    officers: Optional[List[Dict[str, Any]]] = None
    active: Optional[bool] = None
