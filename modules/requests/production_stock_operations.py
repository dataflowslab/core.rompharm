"""
Production Stock Operations
Operațiuni stock pentru producție cu ledger system
"""
from datetime import datetime
from bson import ObjectId
from typing import Dict, Any


async def execute_production_stock_operations(db, request_id: str, current_user: dict):
    """
    Execute stock operations after production approval
    
    1. Creare stock pentru produse finite (cu informații despre materiale)
    2. Consum materiale folosite (ledger system)
    """
    from modules.inventory.services.stocks_service import create_stock, consume_stock
    
    # Get request
    request = db.depo_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise Exception("Request not found")
    
    # Get production data
    production = db.depo_production.find_one({"request_id": ObjectId(request_id)})
    if not production:
        raise Exception("Production data not found")
    
    # Get product from recipe
    recipe_part_id = request.get('recipe_part_id')
    if not recipe_part_id:
        raise Exception("No recipe_part_id in request")
    
    destination_location = request.get('destination')
    if not destination_location:
        raise Exception("No destination location")
    
    username = current_user.get('username', 'system')
    series = production.get('series', [])
    
    if not series:
        raise Exception("No production series found")
    
    # A. Create stock for each produced serie with materials info
    created_stocks = []
    
    for serie in series:
        batch_code = serie.get('batch_code')
        materials = serie.get('materials', [])
        
        # Calculate produced quantity (sum of used materials or specified)
        produced_qty = serie.get('produced_qty', 0)
        
        if produced_qty <= 0:
            print(f"[PRODUCTION] Skipping serie {batch_code} - no produced quantity")
            continue
        
        # Prepare materials info for stock
        materials_used = []
        for material in materials:
            used_qty = material.get('used_qty', 0)
            if used_qty > 0:
                materials_used.append({
                    'part_id': str(material.get('part')),
                    'part_name': material.get('part_name', ''),
                    'batch': material.get('batch', ''),
                    'quantity': used_qty
                })
        
        # Create stock with production info
        try:
            stock = await create_stock(
                db=db,
                part_id=str(recipe_part_id),
                batch_code=batch_code,
                initial_quantity=produced_qty,
                location_id=str(destination_location),
                created_by=username,
                notes=f"Produced from request {request.get('reference')}",
                document_type='PRODUCTION_ORDER',
                document_id=str(request_id)
            )
            
            # Add production info to stock
            stock_id = ObjectId(stock['_id'])
            db.depo_stocks.update_one(
                {'_id': stock_id},
                {
                    '$set': {
                        'production': {
                            'request_id': str(request_id),
                            'serie_batch': batch_code,
                            'materials_used': materials_used,
                            'produced_at': datetime.utcnow()
                        }
                    }
                }
            )
            
            created_stocks.append(stock)
            print(f"[PRODUCTION] Created stock for serie {batch_code}: {produced_qty} units")
            
        except Exception as e:
            print(f"[PRODUCTION] Error creating stock for serie {batch_code}: {e}")
            raise Exception(f"Failed to create stock for serie {batch_code}: {str(e)}")
    
    # B. Consume materials using ledger system
    for serie in series:
        materials = serie.get('materials', [])
        
        for material in materials:
            part_id = material.get('part')
            used_qty = material.get('used_qty', 0)
            batch_code = material.get('batch', '')
            
            if used_qty <= 0:
                continue
            
            # Find stock by part_id and batch_code
            stock = db.depo_stocks.find_one({
                'part_id': ObjectId(part_id) if isinstance(part_id, str) else part_id,
                'batch_code': batch_code
            })
            
            if not stock:
                print(f"[PRODUCTION] Warning: Stock not found for part {part_id}, batch {batch_code}")
                continue
            
            try:
                # Use ledger system to consume stock
                await consume_stock(
                    db=db,
                    stock_id=str(stock['_id']),
                    location_id=str(destination_location),
                    quantity=used_qty,
                    created_by=username,
                    document_type='PRODUCTION_ORDER',
                    document_id=str(request_id),
                    notes=f"Consumed for production serie {serie.get('batch_code')}"
                )
                
                print(f"[PRODUCTION] Consumed {used_qty} units of part {part_id}, batch {batch_code}")
                
            except Exception as e:
                print(f"[PRODUCTION] Error consuming stock: {e}")
                # Don't fail the whole operation, just log the error
                # raise Exception(f"Failed to consume stock: {str(e)}")
    
    return {
        'created_stocks': len(created_stocks),
        'stocks': created_stocks
    }
