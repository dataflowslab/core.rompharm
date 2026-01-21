"""
Migration script to add pk field to existing companies in depo_companies collection
Also adds new fields: delivery_conditions, bank_account, currency_id
"""
from pymongo import MongoClient
import yaml
from datetime import datetime

def load_config():
    """Load configuration from config.yaml"""
    try:
        with open('config.yaml', 'r') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        print("Error: config.yaml not found!")
        return None

def migrate_companies():
    """Add pk field to all companies and new fields"""
    config = load_config()
    if not config:
        return
    
    # Connect to MongoDB
    connection_string = config['mongo'].get('auth_string') or config['mongo'].get('connection_string')
    
    print("Connecting to MongoDB...")
    try:
        client = MongoClient(
            connection_string, 
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000
        )
        # Test connection
        client.admin.command('ping')
        print("✓ Connected to MongoDB")
    except Exception as e:
        print(f"✗ Failed to connect to MongoDB: {e}")
        return
    
    db = client.get_default_database()
    companies_collection = db['depo_companies']
    
    print("=" * 60)
    print("MIGRATION: Add pk and new fields to depo_companies")
    print("=" * 60)
    print()
    
    # Get all companies without pk field
    companies_without_pk = list(companies_collection.find({'pk': {'$exists': False}}))
    
    if not companies_without_pk:
        print("✓ All companies already have pk field")
        print()
        return
    
    print(f"Found {len(companies_without_pk)} companies without pk field")
    print()
    
    # Start pk from 1
    current_pk = 1
    
    # Check if there are companies with pk already
    max_pk_doc = companies_collection.find_one(
        {'pk': {'$exists': True}},
        sort=[('pk', -1)]
    )
    
    if max_pk_doc and 'pk' in max_pk_doc:
        current_pk = max_pk_doc['pk'] + 1
        print(f"Starting pk from {current_pk} (max existing pk: {max_pk_doc['pk']})")
    else:
        print(f"Starting pk from {current_pk}")
    
    print()
    
    # Update each company
    updated_count = 0
    for company in companies_without_pk:
        company_id = company['_id']
        company_name = company.get('name', 'Unknown')
        
        # Prepare update document
        update_doc = {
            'pk': current_pk,
            'updated_at': datetime.utcnow()
        }
        
        # Add new fields if they don't exist
        if 'delivery_conditions' not in company:
            update_doc['delivery_conditions'] = ''
        
        if 'bank_account' not in company:
            update_doc['bank_account'] = ''
        
        if 'currency_id' not in company:
            update_doc['currency_id'] = None
        
        # Update company
        result = companies_collection.update_one(
            {'_id': company_id},
            {'$set': update_doc}
        )
        
        if result.modified_count > 0:
            print(f"✓ Updated company: {company_name} (pk={current_pk})")
            updated_count += 1
            current_pk += 1
        else:
            print(f"✗ Failed to update company: {company_name}")
    
    print()
    print("=" * 60)
    print(f"MIGRATION COMPLETE: Updated {updated_count} companies")
    print("=" * 60)
    print()
    
    # Show summary
    total_companies = companies_collection.count_documents({})
    companies_with_pk = companies_collection.count_documents({'pk': {'$exists': True}})
    
    print("Summary:")
    print(f"  Total companies: {total_companies}")
    print(f"  Companies with pk: {companies_with_pk}")
    print()
    
    client.close()


if __name__ == '__main__':
    migrate_companies()
