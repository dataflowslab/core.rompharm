"""
Migration Script: Stocks to Ledger System
Migrează stocurile existente la noul sistem ledger

ATENȚIE: Rulează doar o dată! Face backup automat.
"""
from datetime import datetime
from bson import ObjectId
from src.backend.utils.db import get_db


def backup_collection(db, collection_name: str):
    """Backup colecție înainte de migrare"""
    backup_name = f"{collection_name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Copy collection
    pipeline = [{'$match': {}}, {'$out': backup_name}]
    db[collection_name].aggregate(pipeline)
    
    count = db[backup_name].count_documents({})
    print(f"✅ Backup created: {backup_name} ({count} documents)")
    
    return backup_name


def migrate_stocks_to_ledger():
    """
    Migrare stocuri la sistem ledger
    
    Pentru fiecare stock:
    1. Rename quantity → initial_quantity
    2. Add initial_location_id
    3. Create RECEIPT movement
    4. Create balance entry
    """
    db = get_db()
    
    print("=" * 60)
    print("STOCKS TO LEDGER MIGRATION")
    print("=" * 60)
    
    # 1. Backup
    print("\n[1/5] Creating backups...")
    backup_collection(db, 'depo_stocks')
    
    # 2. Count stocks to migrate
    stocks_to_migrate = list(db.depo_stocks.find({'quantity': {'$exists': True}}))
    total_stocks = len(stocks_to_migrate)
    
    if total_stocks == 0:
        print("\n✅ No stocks to migrate (already migrated or empty)")
        return
    
    print(f"\n[2/5] Found {total_stocks} stocks to migrate")
    
    # 3. Migrate stocks
    print("\n[3/5] Migrating stocks...")
    migrated = 0
    errors = []
    
    for stock in stocks_to_migrate:
        try:
            stock_id = stock['_id']
            quantity = stock.get('quantity', 0)
            location_id = stock.get('location_id')
            
            if not location_id:
                errors.append(f"Stock {stock_id}: missing location_id")
                continue
            
            # Update stock: quantity → initial_quantity
            db.depo_stocks.update_one(
                {'_id': stock_id},
                {
                    '$rename': {'quantity': 'initial_quantity'},
                    '$set': {
                        'initial_location_id': location_id,
                        'migrated_at': datetime.utcnow()
                    }
                }
            )
            
            migrated += 1
            
            if migrated % 100 == 0:
                print(f"  Migrated {migrated}/{total_stocks} stocks...")
        
        except Exception as e:
            errors.append(f"Stock {stock.get('_id')}: {str(e)}")
    
    print(f"✅ Migrated {migrated} stocks")
    
    # 4. Create movements
    print("\n[4/5] Creating RECEIPT movements...")
    movements_created = 0
    
    for stock in stocks_to_migrate:
        try:
            stock_id = stock['_id']
            part_id = stock.get('part_id')
            quantity = stock.get('quantity', 0)
            location_id = stock.get('location_id')
            
            if quantity <= 0:
                continue
            
            # Create RECEIPT movement
            movement = {
                'stock_id': stock_id,
                'part_id': part_id,
                'batch_code': stock.get('batch', stock.get('batch_code', '')),
                'movement_type': 'RECEIPT',
                'quantity': quantity,
                'from_location_id': None,
                'to_location_id': location_id,
                'document_type': 'INITIAL_STOCK',
                'document_id': stock_id,
                'created_at': stock.get('created_at', datetime.utcnow()),
                'created_by': stock.get('created_by', 'migration_script'),
                'notes': 'Initial stock migration'
            }
            
            db.depo_stocks_movements.insert_one(movement)
            movements_created += 1
            
            if movements_created % 100 == 0:
                print(f"  Created {movements_created} movements...")
        
        except Exception as e:
            errors.append(f"Movement for stock {stock.get('_id')}: {str(e)}")
    
    print(f"✅ Created {movements_created} movements")
    
    # 5. Create balances
    print("\n[5/5] Creating balances...")
    balances_created = 0
    
    for stock in stocks_to_migrate:
        try:
            stock_id = stock['_id']
            quantity = stock.get('quantity', 0)
            location_id = stock.get('location_id')
            
            if quantity <= 0:
                continue
            
            # Create balance
            balance = {
                'stock_id': stock_id,
                'location_id': location_id,
                'quantity': quantity,
                'updated_at': datetime.utcnow()
            }
            
            db.depo_stocks_balances.insert_one(balance)
            balances_created += 1
            
            if balances_created % 100 == 0:
                print(f"  Created {balances_created} balances...")
        
        except Exception as e:
            errors.append(f"Balance for stock {stock.get('_id')}: {str(e)}")
    
    print(f"✅ Created {balances_created} balances")
    
    # Summary
    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    print(f"Total stocks:        {total_stocks}")
    print(f"Migrated:            {migrated}")
    print(f"Movements created:   {movements_created}")
    print(f"Balances created:    {balances_created}")
    print(f"Errors:              {len(errors)}")
    
    if errors:
        print("\n⚠️  ERRORS:")
        for error in errors[:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")
    
    print("\n✅ Migration completed!")
    print("\nNext steps:")
    print("1. Verify data: Check a few stocks manually")
    print("2. Create indexes: Run create_indexes.py")
    print("3. Test API: Test stocks endpoints")
    print("4. Update routes: Update production/procurement routes")


def create_indexes():
    """Creare indexuri pentru colecțiile noi"""
    db = get_db()
    
    print("\n" + "=" * 60)
    print("CREATING INDEXES")
    print("=" * 60)
    
    # depo_stocks_movements indexes
    print("\n[1/2] Creating indexes for depo_stocks_movements...")
    
    db.depo_stocks_movements.create_index([('stock_id', 1), ('created_at', -1)])
    print("  ✅ stock_id + created_at")
    
    db.depo_stocks_movements.create_index([('part_id', 1), ('batch_code', 1)])
    print("  ✅ part_id + batch_code")
    
    db.depo_stocks_movements.create_index([('transfer_group_id', 1)])
    print("  ✅ transfer_group_id")
    
    db.depo_stocks_movements.create_index([('document_type', 1), ('document_id', 1)])
    print("  ✅ document_type + document_id")
    
    # depo_stocks_balances indexes
    print("\n[2/2] Creating indexes for depo_stocks_balances...")
    
    db.depo_stocks_balances.create_index([('stock_id', 1), ('location_id', 1)], unique=True)
    print("  ✅ stock_id + location_id (unique)")
    
    db.depo_stocks_balances.create_index([('location_id', 1), ('quantity', 1)])
    print("  ✅ location_id + quantity")
    
    db.depo_stocks_balances.create_index([('stock_id', 1)])
    print("  ✅ stock_id")
    
    print("\n✅ All indexes created!")


def verify_migration():
    """Verificare migrare"""
    db = get_db()
    
    print("\n" + "=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    
    # Count documents
    stocks_count = db.depo_stocks.count_documents({})
    movements_count = db.depo_stocks_movements.count_documents({})
    balances_count = db.depo_stocks_balances.count_documents({})
    
    print(f"\nStocks:    {stocks_count}")
    print(f"Movements: {movements_count}")
    print(f"Balances:  {balances_count}")
    
    # Check for old quantity field
    old_quantity_count = db.depo_stocks.count_documents({'quantity': {'$exists': True}})
    print(f"\nStocks with old 'quantity' field: {old_quantity_count}")
    
    if old_quantity_count > 0:
        print("⚠️  Warning: Some stocks still have 'quantity' field!")
    
    # Sample verification
    print("\n" + "-" * 60)
    print("Sample Stock Verification:")
    print("-" * 60)
    
    sample_stock = db.depo_stocks.find_one({'initial_quantity': {'$exists': True}})
    
    if sample_stock:
        stock_id = sample_stock['_id']
        initial_qty = sample_stock.get('initial_quantity', 0)
        
        print(f"\nStock ID: {stock_id}")
        print(f"Initial Quantity: {initial_qty}")
        
        # Check movements
        movements = list(db.depo_stocks_movements.find({'stock_id': stock_id}))
        total_movement = sum(m.get('quantity', 0) for m in movements)
        print(f"Movements: {len(movements)}")
        print(f"Total Movement Quantity: {total_movement}")
        
        # Check balance
        balance = db.depo_stocks_balances.find_one({'stock_id': stock_id})
        if balance:
            print(f"Balance Quantity: {balance.get('quantity', 0)}")
            
            if balance.get('quantity') == total_movement:
                print("✅ Balance matches movements!")
            else:
                print("⚠️  Balance doesn't match movements!")
        else:
            print("⚠️  No balance found!")
    
    print("\n✅ Verification completed!")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "migrate":
            migrate_stocks_to_ledger()
        elif command == "indexes":
            create_indexes()
        elif command == "verify":
            verify_migration()
        elif command == "all":
            migrate_stocks_to_ledger()
            create_indexes()
            verify_migration()
        else:
            print(f"Unknown command: {command}")
            print("\nUsage:")
            print("  python migrate_stocks_to_ledger.py migrate   - Run migration")
            print("  python migrate_stocks_to_ledger.py indexes   - Create indexes")
            print("  python migrate_stocks_to_ledger.py verify    - Verify migration")
            print("  python migrate_stocks_to_ledger.py all       - Run all steps")
    else:
        print("Stocks to Ledger Migration Script")
        print("\nUsage:")
        print("  python migrate_stocks_to_ledger.py migrate   - Run migration")
        print("  python migrate_stocks_to_ledger.py indexes   - Create indexes")
        print("  python migrate_stocks_to_ledger.py verify    - Verify migration")
        print("  python migrate_stocks_to_ledger.py all       - Run all steps")
        print("\nRecommended order:")
        print("  1. python migrate_stocks_to_ledger.py migrate")
        print("  2. python migrate_stocks_to_ledger.py indexes")
        print("  3. python migrate_stocks_to_ledger.py verify")
