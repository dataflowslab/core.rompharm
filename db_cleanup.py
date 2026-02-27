from src.backend.utils.db import get_db

def main():
    try:
        # get_db is a generator yields db so we must use next()
        db = next(get_db())
        
        # Drop collections
        db.depo_purchase_orders_attachments.drop()
        db.nomenclatoare.drop()
        db.depo_build_orders.drop()
        
        print("Successfully dropped unused collections: depo_purchase_orders_attachments, nomenclatoare, depo_build_orders")
    except Exception as e:
        print(f"Error dropping collections: {e}")

if __name__ == "__main__":
    main()
