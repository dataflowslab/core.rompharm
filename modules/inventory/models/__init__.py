"""
Inventory Models
Pydantic models pentru toate entitățile
"""
from .stock_models import (
    StockCreateRequest,
    StockUpdateRequest,
    StockTransferRequest,
    StockAdjustmentRequest,
    StockConsumptionRequest
)

__all__ = [
    'StockCreateRequest',
    'StockUpdateRequest',
    'StockTransferRequest',
    'StockAdjustmentRequest',
    'StockConsumptionRequest',
]
