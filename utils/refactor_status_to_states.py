"""
Refactor hardcoded status updates to use state system

This script analyzes approval_routes.py and creates a refactored version
that uses the centralized state system instead of hardcoded status strings.

Usage:
    python utils/refactor_status_to_states.py
"""

import re
from pathlib import Path


def refactor_approval_routes():
    """Refactor approval_routes.py to use state system"""
    
    file_path = Path('modules/requests/approval_routes.py')
    
    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        return
    
    print(f"📖 Reading {file_path}...")
    content = file_path.read_text(encoding='utf-8')
    original_content = content
    
    # Track changes
    changes = []
    
    # Pattern 1: {"$set": {"status": "Approved", ...}}
    # Replace with update_request_state()
    
    # Find all status updates in approval flow
    pattern1 = r'requests_collection\.update_one\(\s*\{"_id": req_obj_id\},\s*\{"\$set": \{"status": "Approved", "updated_at": timestamp\}\}\s*\)'
    replacement1 = 'update_request_state(db, request_id, "approved")'
    
    if re.search(pattern1, content):
        content = re.sub(pattern1, replacement1, content)
        changes.append("✓ Replaced Approved status update with state system")
    
    # Pattern 2: {"status": "Pending", ...}
    pattern2 = r'requests_collection\.update_one\(\s*\{"_id": req_obj_id\},\s*\{"\$set": \{"status": "Pending", "updated_at": datetime\.utcnow\(\)\}\}\s*\)'
    replacement2 = 'update_request_state(db, request_id, "new")'
    
    if re.search(pattern2, content):
        content = re.sub(pattern2, replacement2, content)
        changes.append("✓ Replaced Pending status update with state system")
    
    # Pattern 3: {"status": "In Progress", ...}
    pattern3 = r'requests_collection\.update_one\(\s*\{"_id": req_obj_id\},\s*\{"\$set": \{"status": "In Progress", "updated_at": datetime\.utcnow\(\)\}\}\s*\)'
    replacement3 = 'update_request_state(db, request_id, "approved")'
    
    if re.search(pattern3, content):
        content = re.sub(pattern3, replacement3, content)
        changes.append("✓ Replaced In Progress status update with state system")
    
    # Pattern 4: {"status": "In Operations", ...}
    pattern4 = r'requests_collection\.update_one\(\s*\{"_id": req_obj_id\},\s*\{"\$set": \{"status": "In Operations", "updated_at": timestamp\}\}\s*\)'
    replacement4 = 'update_request_state(db, request_id, "approved")'
    
    if re.search(pattern4, content):
        content = re.sub(pattern4, replacement4, content)
        changes.append("✓ Replaced In Operations status update with state system")
    
    # Pattern 5: Operations decision - Finished
    pattern5 = r"if decision_status == 'Finished':\s+status_update\['finished_at'\] = timestamp"
    replacement5 = """if decision_status == 'Finished':
                    # Use state system
                    update_request_state(db, request_id, 'warehouse_approved', {'finished_at': timestamp})
                    print(f"[REQUESTS] Request {request_id} status updated to Warehouse Approved")
                    # Skip the manual update below
                    status_update = None"""
    
    if re.search(pattern5, content):
        content = re.sub(pattern5, replacement5, content)
        changes.append("✓ Replaced Finished decision with warehouse_approved state")
    
    # Pattern 6: Operations decision - Refused
    pattern6 = r"elif decision_status == 'Refused':\s+status_update\['refused_at'\] = timestamp\s+status_update\['refused_by'\] = req_doc\.get\('operations_result_updated_by', 'system'\)"
    replacement6 = """elif decision_status == 'Refused':
                    # Use state system
                    update_request_state(db, request_id, 'warehouse_rejected', {
                        'refused_at': timestamp,
                        'refused_by': req_doc.get('operations_result_updated_by', 'system')
                    })
                    print(f"[REQUESTS] Request {request_id} status updated to Warehouse Rejected")
                    # Skip the manual update below
                    status_update = None"""
    
    if re.search(pattern6, content):
        content = re.sub(pattern6, replacement6, content)
        changes.append("✓ Replaced Refused decision with warehouse_rejected state")
    
    # Pattern 7: Skip manual update if status_update is None
    pattern7 = r"requests_collection\.update_one\(\s+\{'_id': req_obj_id\},\s+\{'\$set': status_update\}\s+\)"
    replacement7 = """if status_update:
                    requests_collection.update_one(
                        {'_id': req_obj_id},
                        {'$set': status_update}
                    )"""
    
    if re.search(pattern7, content):
        content = re.sub(pattern7, replacement7, content)
        changes.append("✓ Added conditional check for status_update")
    
    # Check if any changes were made
    if content == original_content:
        print("\n⚠️  No changes needed - file already uses state system or patterns not found")
        return
    
    # Create backup
    backup_path = file_path.with_suffix('.py.backup')
    print(f"\n💾 Creating backup: {backup_path}")
    backup_path.write_text(original_content, encoding='utf-8')
    
    # Write refactored content
    print(f"✍️  Writing refactored content to {file_path}")
    file_path.write_text(content, encoding='utf-8')
    
    # Print summary
    print("\n" + "="*80)
    print("✅ Refactoring completed!")
    print("="*80)
    print("\n📋 Changes made:")
    for change in changes:
        print(f"  {change}")
    
    print(f"\n📁 Backup saved to: {backup_path}")
    print(f"📁 Refactored file: {file_path}")
    
    print("\n⚠️  IMPORTANT:")
    print("  1. Review the changes carefully")
    print("  2. Test the application thoroughly")
    print("  3. If issues occur, restore from backup:")
    print(f"     copy {backup_path} {file_path}")


def main():
    """Main entry point"""
    print("="*80)
    print("🔧 Refactoring Status Updates to Use State System")
    print("="*80)
    print()
    
    try:
        refactor_approval_routes()
        print("\n✨ Refactoring process completed!")
        
    except Exception as e:
        print(f"\n❌ Error during refactoring: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
