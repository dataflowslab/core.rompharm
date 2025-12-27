"""
Stock Models
Pydantic models pentru stocks
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class StockCreateRequest(BaseModel):
    """Request pentru creare stock"""
    part_id: str = Field(..., description="ID part")
    batch_code: str = Field(..., description="Cod batch/serie")
    initial_quantity: float = Field(..., gt=0, description="Cantitate inițială")
    location_id: str = Field(..., description="ID locație inițială")
    supplier: Optional[str] = Field(None, description="ID furnizor")
    expiry_date: Optional[str] = Field(None, description="Data expirare (ISO format)")
    purchase_price: Optional[float] = Field(None, ge=0, description="Preț achiziție")
    state_id: Optional[str] = Field(None, description="ID state (din depo_stocks_states)")
    notes: Optional[str] = Field(None, description="Note")
    
    # Document info pentru ledger
    document_type: str = Field(default="MANUAL_ENTRY", description="Tip document (PURCHASE_ORDER, PRODUCTION, etc)")
    document_id: Optional[str] = Field(None, description="ID document sursă")


class StockUpdateRequest(BaseModel):
    """Request pentru update stock (doar metadata, NU cantitate!)"""
    expiry_date: Optional[str] = None
    purchase_price: Optional[float] = Field(None, ge=0)
    state_id: Optional[str] = None
    notes: Optional[str] = None


class StockTransferRequest(BaseModel):
    """Request pentru transfer stock între locații"""
    from_location_id: str = Field(..., description="ID locație sursă")
    to_location_id: str = Field(..., description="ID locație destinație")
    quantity: float = Field(..., gt=0, description="Cantitate de transferat")
    document_type: str = Field(default="STOCK_TRANSFER", description="Tip document")
    document_id: Optional[str] = Field(None, description="ID document")
    notes: Optional[str] = Field(None, description="Note")


class StockAdjustmentRequest(BaseModel):
    """Request pentru ajustare inventar"""
    location_id: str = Field(..., description="ID locație")
    quantity: float = Field(..., description="Cantitate ajustare (+ sau -)")
    document_type: str = Field(default="INVENTORY_COUNT", description="Tip document")
    document_id: Optional[str] = Field(None, description="ID document")
    notes: Optional[str] = Field(None, description="Motiv ajustare")


class StockConsumptionRequest(BaseModel):
    """Request pentru consum stock"""
    location_id: str = Field(..., description="ID locație")
    quantity: float = Field(..., gt=0, description="Cantitate consumată")
    document_type: str = Field(..., description="Tip document (PRODUCTION_ORDER, BON_CONSUM, etc)")
    document_id: str = Field(..., description="ID document")
    notes: Optional[str] = Field(None, description="Note")
