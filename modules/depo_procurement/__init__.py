"""
DEPO Procurement Module
InvenTree procurement integration for DataFlows Core
"""
import os
import importlib.util

__version__ = "1.0.0"
__module_name__ = "depo_procurement"

def get_router():
    """Return the module's FastAPI router"""
    # Import routes dynamically
    routes_path = os.path.join(os.path.dirname(__file__), 'routes.py')
    spec = importlib.util.spec_from_file_location("routes", routes_path)
    routes_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(routes_module)
    return routes_module.router
