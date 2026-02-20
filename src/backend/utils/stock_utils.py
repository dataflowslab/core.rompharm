"""
Stock utilities for filtering and managing stock items across the platform
"""
from bson import ObjectId
from typing import List

# Global constant for transactionable stock states
# Only stock items in these states can be transacted (transferred, allocated, etc.)
TRANSACTIONABLE_STOCK_STATE_IDS = [
    ObjectId("694321db8728e4d75ae72789"),  # State 1
    ObjectId("694322878728e4d75ae72790"),  # State 2
    ObjectId("694322758728e4d75ae7278f")   # State 3
]


def get_transactionable_state_ids() -> List[ObjectId]:
    """
    Get list of stock state IDs that are allowed for transactions.
    
    Returns:
        List[ObjectId]: List of state ObjectIds that allow stock transactions
    
    Usage:
        allowed_states = get_transactionable_state_ids()
        query = {"state_id": {"$in": allowed_states}}
    """
    return TRANSACTIONABLE_STOCK_STATE_IDS.copy()


def filter_transactionable_stock_items(stock_items: list, state_field: str = "state_id") -> list:
    """
    Filter stock items to only include those in transactionable states.
    
    Args:
        stock_items: List of stock item documents from MongoDB
        state_field: Name of the field containing the state_id (default: "state_id")
    
    Returns:
        list: Filtered list containing only transactionable stock items
    
    Usage:
        all_stocks = db.depo_stocks.find({"part_id": part_id})
        transactionable = filter_transactionable_stock_items(list(all_stocks))
    """
    allowed_states = get_transactionable_state_ids()
    allowed_state_strs = [str(sid) for sid in allowed_states]
    
    filtered = []
    for item in stock_items:
        state_id = item.get(state_field)
        
        # Handle both ObjectId and string formats
        if isinstance(state_id, ObjectId):
            if state_id in allowed_states:
                filtered.append(item)
        elif isinstance(state_id, str):
            if state_id in allowed_state_strs:
                filtered.append(item)
    
    return filtered


def build_transactionable_stock_query(base_query: dict = None) -> dict:
    """
    Build a MongoDB query that includes transactionable state filter.
    
    Args:
        base_query: Optional base query dict to extend
    
    Returns:
        dict: MongoDB query with transactionable state filter
    
    Usage:
        query = build_transactionable_stock_query({"part_id": part_oid})
        stocks = db.depo_stocks.find(query)
    """
    if base_query is None:
        base_query = {}
    
    query = base_query.copy()
    query["state_id"] = {"$in": get_transactionable_state_ids()}
    
    return query


def is_stock_transactionable(state_id) -> bool:
    """
    Check if a stock item with given state_id is transactionable.
    
    Args:
        state_id: ObjectId or string representation of state_id
    
    Returns:
        bool: True if state allows transactions, False otherwise
    
    Usage:
        if is_stock_transactionable(stock["state_id"]):
            # Allow transaction
    """
    allowed_states = get_transactionable_state_ids()
    allowed_state_strs = [str(sid) for sid in allowed_states]
    
    if isinstance(state_id, ObjectId):
        return state_id in allowed_states
    elif isinstance(state_id, str):
        return state_id in allowed_state_strs
    
    return False
