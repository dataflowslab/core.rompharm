"""Check if suppliers routes exist"""
from modules.inventory.routes import router

suppliers_routes = [r for r in router.routes if 'suppliers' in r.path]
print(f'Found {len(suppliers_routes)} supplier routes:')
for r in suppliers_routes:
    method = list(r.methods)[0] if r.methods else 'GET'
    print(f'  {method} {r.path}')
