"""
Quick migration script - runs directly without needing backend server
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.backend.utils.db import get_db
from datetime import datetime

def migrate_companies():
    """Add pk field to all companies and new fields"""
    print("=" * 60)
    print("MIGRATION: Add pk and new fields to depo_companies")
    print("=" * 60)
    print()
    
    try:
        db = get_db()
        companies_collection = db['depo_companies']
        
        # Get all companies without pk field
        companies_without_pk = list(companies_collection.find({'pk': {'$exists': False}}))
        
        if not companies_without_pk:
            print("✓ All companies already have pk field")
            print()
            total_companies = companies_collection.count_documents({})
            companies_with_pk = companies_collection.count_documents({'pk': {'$exists': True}})
            print("Summary:")
            print(f"  Total companies: {total_companies}")
            print(f"  Companies with pk: {companies_with_pk}")
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
        
    except Exception as e:
        print(f"✗ Error during migration: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    migrate_companies()
