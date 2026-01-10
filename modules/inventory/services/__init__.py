"""
Inventory Services
Servicii pentru gestionare inventar
"""
import sys
import os
import importlib.util

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

# Import supplier functions from parent services.py using absolute path
services_path = os.path.join(os.path.dirname(__file__), '..', 'services.py')
spec = importlib.util.spec_from_file_location("inventory_services_legacy", services_path)
services_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(services_module)

# Export functions
get_suppliers_list = services_module.get_suppliers_list
get_manufacturers_list = services_module.get_manufacturers_list
get_clients_list = services_module.get_clients_list
get_supplier_by_id = services_module.get_supplier_by_id
create_supplier = services_module.create_supplier
update_supplier = services_module.update_supplier
delete_supplier = services_module.delete_supplier
get_supplier_parts = services_module.get_supplier_parts
add_supplier_part = services_module.add_supplier_part
update_supplier_part = services_module.update_supplier_part
remove_supplier_part = services_module.remove_supplier_part

__all__ = [
    'get_suppliers_list',
    'get_manufacturers_list',
    'get_clients_list',
    'get_supplier_by_id',
    'create_supplier',
    'update_supplier',
    'delete_supplier',
    'get_supplier_parts',
    'add_supplier_part',
    'update_supplier_part',
    'remove_supplier_part',
]
