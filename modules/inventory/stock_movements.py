"""
Stock Movements - Ledger-based Inventory System
Double-entry bookkeeping pentru gestionare stocuri
"""
from datetime import datetime
from bson import ObjectId
from typing import Optional, Dict, List, Any
from enum import Enum


class MovementType(str, Enum):
    """Tipuri de mișcări stoc"""
    RECEIPT = "RECEIPT"  # Primire marfă (+)
    CONSUMPTION = "CONSUMPTION"  # Consum (-)
    TRANSFER_OUT = "TRANSFER_OUT"  # Transfer ieșire (-)
    TRANSFER_IN = "TRANSFER_IN"  # Transfer intrare (+)
    ADJUSTMENT = "ADJUSTMENT"  # Ajustare (+/-)
    SCRAP = "SCRAP"  # Casare (-)


# Dicționar cu configurații pentru fiecare tip de mișcare
MOVEMENT_TYPES_CONFIG = {
    MovementType.RECEIPT: {
        'operator': '+',
        'description': 'Primire marfă (de la furnizor sau producție)',
        'requires_from_location': False,
        'requires_to_location': True,
        'creates_stock': True,
        'validates_positive': True
    },
    MovementType.CONSUMPTION: {
        'operator': '-',
        'description': 'Consum (producție, scrap, vânzare)',
        'requires_from_location': True,
        'requires_to_location': False,
        'creates_stock': False,
        'validates_negative': True
    },
    MovementType.TRANSFER_OUT: {
        'operator': '-',
        'description': 'Transfer ieșire din locație sursă',
        'requires_from_location': True,
        'requires_to_location': True,
        'creates_stock': False,
        'paired_with': MovementType.TRANSFER_IN,
        'requires_transfer_group': True,
        'validates_negative': True
    },
    MovementType.TRANSFER_IN: {
        'operator': '+',
        'description': 'Transfer intrare în locație destinație',
        'requires_from_location': True,
        'requires_to_location': True,
        'creates_stock': False,
        'paired_with': MovementType.TRANSFER_OUT,
        'requires_transfer_group': True,
        'validates_positive': True
    },
    MovementType.ADJUSTMENT: {
        'operator': '+/-',
        'description': 'Ajustare inventar (corectare cantitate)',
        'requires_from_location': False,
        'requires_to_location': True,
        'creates_stock': False
    },
    MovementType.SCRAP: {
        'operator': '-',
        'description': 'Casare (deteriorare, expirare)',
        'requires_from_location': True,
        'requires_to_location': False,
        'creates_stock': False,
        'validates_negative': True
    }
}


def validate_movement(
    movement_type: MovementType,
    quantity: float,
    from_location_id: Optional[ObjectId],
    to_location_id: Optional[ObjectId],
    transfer_group_id: Optional[str] = None
) -> tuple[bool, Optional[str]]:
    """
    Validează o mișcare de stoc
    
    Returns:
        (is_valid, error_message)
    """
    config = MOVEMENT_TYPES_CONFIG.get(movement_type)
    if not config:
        return False, f"Invalid movement type: {movement_type}"
    
    # Validare cantitate
    if quantity == 0:
        return False, "Quantity cannot be zero"
    
    if config.get('validates_positive') and quantity <= 0:
        return False, f"{movement_type} requires positive quantity"
    
    if config.get('validates_negative') and quantity >= 0:
        return False, f"{movement_type} requires negative quantity"
    
    # Validare locații
    if config.get('requires_from_location') and not from_location_id:
        return False, f"{movement_type} requires from_location_id"
    
    if config.get('requires_to_location') and not to_location_id:
        return False, f"{movement_type} requires to_location_id"
    
    # Validare transfer group
    if config.get('requires_transfer_group') and not transfer_group_id:
        return False, f"{movement_type} requires transfer_group_id"
    
    return True, None


def create_movement(
    db,
    stock_id: ObjectId,
    part_id: ObjectId,
    batch_code: str,
    movement_type: MovementType,
    quantity: float,
    from_location_id: Optional[ObjectId],
    to_location_id: Optional[ObjectId],
    document_type: str,
    document_id: ObjectId,
    created_by: str,
    transfer_group_id: Optional[str] = None,
    notes: Optional[str] = None
) -> ObjectId:
    """
    Creare mișcare de stoc + update balance
    
    Returns:
        movement_id
    """
    # Validare
    is_valid, error = validate_movement(
        movement_type,
        quantity,
        from_location_id,
        to_location_id,
        transfer_group_id
    )
    
    if not is_valid:
        raise ValueError(error)
    
    timestamp = datetime.utcnow()
    
    # Creare mișcare
    movement_doc = {
        'stock_id': stock_id,
        'part_id': part_id,
        'batch_code': batch_code,
        'movement_type': movement_type.value,
        'quantity': quantity,
        'from_location_id': from_location_id,
        'to_location_id': to_location_id,
        'document_type': document_type,
        'document_id': document_id,
        'transfer_group_id': transfer_group_id,
        'created_at': timestamp,
        'created_by': created_by,
        'notes': notes
    }
    
    result = db.depo_stocks_movements.insert_one(movement_doc)
    movement_id = result.inserted_id
    
    # Update balance
    # Pentru mișcări care afectează o locație
    if movement_type in [MovementType.RECEIPT, MovementType.ADJUSTMENT]:
        # Adaugă/scade în to_location
        update_balance(db, stock_id, to_location_id, quantity, timestamp)
    
    elif movement_type in [MovementType.CONSUMPTION, MovementType.SCRAP]:
        # Scade din from_location
        update_balance(db, stock_id, from_location_id, quantity, timestamp)
    
    elif movement_type == MovementType.TRANSFER_OUT:
        # Scade din from_location
        update_balance(db, stock_id, from_location_id, quantity, timestamp)
    
    elif movement_type == MovementType.TRANSFER_IN:
        # Adaugă în to_location
        update_balance(db, stock_id, to_location_id, quantity, timestamp)
    
    return movement_id


def update_balance(
    db,
    stock_id: ObjectId,
    location_id: ObjectId,
    quantity: float,
    timestamp: datetime
):
    """
    Update balance pentru un stock în locație
    """
    db.depo_stocks_balances.update_one(
        {
            'stock_id': stock_id,
            'location_id': location_id
        },
        {
            '$inc': {'quantity': quantity},
            '$set': {'updated_at': timestamp}
        },
        upsert=True
    )


def create_transfer(
    db,
    stock_id: ObjectId,
    part_id: ObjectId,
    batch_code: str,
    quantity: float,
    from_location_id: ObjectId,
    to_location_id: ObjectId,
    document_type: str,
    document_id: ObjectId,
    created_by: str,
    notes: Optional[str] = None
) -> tuple[ObjectId, ObjectId]:
    """
    Creare transfer (2 mișcări corelate)
    
    Returns:
        (movement_out_id, movement_in_id)
    """
    if quantity <= 0:
        raise ValueError("Transfer quantity must be positive")
    
    # Generate transfer group ID
    transfer_group_id = f"TRF-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    
    # TRANSFER_OUT
    movement_out_id = create_movement(
        db=db,
        stock_id=stock_id,
        part_id=part_id,
        batch_code=batch_code,
        movement_type=MovementType.TRANSFER_OUT,
        quantity=-quantity,  # Negativ
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        document_type=document_type,
        document_id=document_id,
        created_by=created_by,
        transfer_group_id=transfer_group_id,
        notes=notes
    )
    
    # TRANSFER_IN
    movement_in_id = create_movement(
        db=db,
        stock_id=stock_id,
        part_id=part_id,
        batch_code=batch_code,
        movement_type=MovementType.TRANSFER_IN,
        quantity=quantity,  # Pozitiv
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        document_type=document_type,
        document_id=document_id,
        created_by=created_by,
        transfer_group_id=transfer_group_id,
        notes=notes
    )
    
    return movement_out_id, movement_in_id


def get_stock_balance(
    db,
    stock_id: ObjectId,
    location_id: Optional[ObjectId] = None
) -> Dict[str, Any]:
    """
    Obține balance pentru un stock
    
    Args:
        stock_id: ID stock
        location_id: ID locație (optional, dacă None returnează toate locațiile)
    
    Returns:
        Dict cu balances
    """
    query = {'stock_id': stock_id}
    if location_id:
        query['location_id'] = location_id
    
    balances = list(db.depo_stocks_balances.find(query))
    
    if location_id:
        # Returnează balance pentru o locație
        if balances:
            return {
                'stock_id': str(stock_id),
                'location_id': str(location_id),
                'quantity': balances[0].get('quantity', 0),
                'updated_at': balances[0].get('updated_at')
            }
        else:
            return {
                'stock_id': str(stock_id),
                'location_id': str(location_id),
                'quantity': 0,
                'updated_at': None
            }
    else:
        # Returnează balances pentru toate locațiile
        return {
            'stock_id': str(stock_id),
            'locations': [
                {
                    'location_id': str(b['location_id']),
                    'quantity': b.get('quantity', 0),
                    'updated_at': b.get('updated_at')
                }
                for b in balances
            ],
            'total_quantity': sum(b.get('quantity', 0) for b in balances)
        }


def get_stock_movements(
    db,
    stock_id: ObjectId,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Obține istoric mișcări pentru un stock
    """
    movements = list(
        db.depo_stocks_movements
        .find({'stock_id': stock_id})
        .sort('created_at', -1)
        .limit(limit)
    )
    
    # Convert ObjectIds to strings
    for movement in movements:
        movement['_id'] = str(movement['_id'])
        movement['stock_id'] = str(movement['stock_id'])
        movement['part_id'] = str(movement['part_id'])
        if movement.get('from_location_id'):
            movement['from_location_id'] = str(movement['from_location_id'])
        if movement.get('to_location_id'):
            movement['to_location_id'] = str(movement['to_location_id'])
        movement['document_id'] = str(movement['document_id'])
        if movement.get('created_at'):
            movement['created_at'] = movement['created_at'].isoformat()
    
    return movements


def regenerate_balances(db):
    """
    Regenerează toate balances din ledger
    ATENȚIE: Operațiune costisitoare!
    """
    # Șterge toate balances
    db.depo_stocks_balances.delete_many({})
    
    # Agregare din movements
    pipeline = [
        {
            '$group': {
                '_id': {
                    'stock_id': '$stock_id',
                    'location_id': {
                        '$cond': [
                            {'$in': ['$movement_type', ['RECEIPT', 'ADJUSTMENT', 'TRANSFER_IN']]},
                            '$to_location_id',
                            '$from_location_id'
                        ]
                    }
                },
                'quantity': {'$sum': '$quantity'}
            }
        },
        {
            '$project': {
                '_id': 0,
                'stock_id': '$_id.stock_id',
                'location_id': '$_id.location_id',
                'quantity': 1,
                'updated_at': datetime.utcnow()
            }
        }
    ]
    
    results = list(db.depo_stocks_movements.aggregate(pipeline))
    
    if results:
        db.depo_stocks_balances.insert_many(results)
    
    return len(results)


def verify_transfer_integrity(db, transfer_group_id: str) -> Dict[str, Any]:
    """
    Verifică integritatea unui transfer
    
    Returns:
        Dict cu status verificare
    """
    movements = list(db.depo_stocks_movements.find({
        'transfer_group_id': transfer_group_id
    }))
    
    if len(movements) != 2:
        return {
            'valid': False,
            'error': f"Expected 2 movements, found {len(movements)}"
        }
    
    total_quantity = sum(m.get('quantity', 0) for m in movements)
    
    if total_quantity != 0:
        return {
            'valid': False,
            'error': f"Total quantity should be 0, found {total_quantity}"
        }
    
    # Verifică că sunt TRANSFER_OUT și TRANSFER_IN
    types = [m.get('movement_type') for m in movements]
    if set(types) != {'TRANSFER_OUT', 'TRANSFER_IN'}:
        return {
            'valid': False,
            'error': f"Expected TRANSFER_OUT and TRANSFER_IN, found {types}"
        }
    
    return {
        'valid': True,
        'movements': movements
    }
