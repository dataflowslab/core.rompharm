"""
Migration script to set title for existing files that don't have one
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.utils.db import get_db

def migrate_file_titles():
    """Set title to original_filename for files that don't have a title"""
    db = get_db()
    files_collection = db['files']
    
    # Find files without title or with empty title
    files_without_title = files_collection.find({
        '$or': [
            {'title': {'$exists': False}},
            {'title': ''},
            {'title': None}
        ]
    })
    
    updated_count = 0
    for file_doc in files_without_title:
        original_filename = file_doc.get('original_filename', 'Untitled')
        files_collection.update_one(
            {'_id': file_doc['_id']},
            {'$set': {'title': original_filename}}
        )
        updated_count += 1
        print(f"Updated file {file_doc['_id']}: title set to '{original_filename}'")
    
    print(f"\nMigration complete! Updated {updated_count} files.")

if __name__ == '__main__':
    migrate_file_titles()
