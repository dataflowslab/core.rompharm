"""
Recipe Model
Manages production recipes with ingredients and alternatives
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from bson import ObjectId


class RecipeItem(BaseModel):
    """Recipe item (ingredient or alternative group)"""
    type: int = Field(..., description="1=Single product, 2=Alternative group")
    part_id: Optional[str] = Field(None, description="Product ObjectId (for type=1)")
    id: Optional[int] = Field(None, description="Legacy product ID (for type=1)")
    q: float = Field(..., description="Quantity")
    start: datetime = Field(default_factory=datetime.utcnow, description="Validity start date")
    fin: Optional[datetime] = Field(None, description="Validity end date (optional)")
    mandatory: bool = Field(True, description="Required for production")
    rev: int = Field(0, description="Revision number")
    rev_date: datetime = Field(default_factory=datetime.utcnow, description="Revision date")
    notes: Optional[str] = Field(None, description="Optional notes")
    items: Optional[List['RecipeItem']] = Field(None, description="Alternative items (for type=2)")

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            ObjectId: lambda v: str(v)
        }


# Update forward references
RecipeItem.model_rebuild()


class RecipeModel(BaseModel):
    """Recipe model"""
    part_id: str = Field(..., description="Product ObjectId")
    id: Optional[int] = Field(None, description="Legacy product ID")
    items: List[RecipeItem] = Field(default_factory=list, description="Recipe items")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str

    class Config:
        collection_name = "depo_recipes"
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            ObjectId: lambda v: str(v)
        }

    @staticmethod
    def create(part_id: ObjectId, created_by: str, legacy_id: Optional[int] = None) -> Dict[str, Any]:
        """Create new recipe"""
        doc = {
            "part_id": part_id,
            "items": [],
            "rev": 0,
            "rev_date": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "created_by": created_by,
            "updated_at": datetime.utcnow(),
            "updated_by": created_by
        }
        if legacy_id is not None:
            doc["id"] = legacy_id
        return doc


class RecipeLogModel(BaseModel):
    """Recipe change log"""
    recipe_id: str = Field(..., description="Recipe ObjectId")
    action: str = Field(..., description="Action type: create, update, delete, add_item, remove_item, update_item")
    changes: Dict[str, Any] = Field(default_factory=dict, description="Detailed changes")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        collection_name = "depo_recipes_logs"
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    @staticmethod
    def create(recipe_id: str, action: str, changes: Dict[str, Any], user: str, 
               ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> Dict[str, Any]:
        """Create log entry"""
        return {
            "recipe_id": recipe_id,
            "action": action,
            "changes": changes,
            "timestamp": datetime.utcnow(),
            "user": user,
            "ip_address": ip_address,
            "user_agent": user_agent
        }
