"""
Module loader for DataFlows Core
Dynamically loads enabled modules from config
"""
import os
import json
import importlib
import importlib.util
import yaml
from typing import List, Dict, Any
from fastapi import FastAPI


def load_config() -> dict:
    """Load main configuration"""
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_enabled_modules() -> List[str]:
    """Get list of enabled modules from config"""
    config = load_config()
    return config.get('modules', {}).get('active', [])


def load_module_config(module_name: str) -> Dict[str, Any]:
    """Load module configuration"""
    config_path = os.path.join(os.path.dirname(__file__), module_name, 'config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}


def register_modules(app: FastAPI):
    """Register all enabled modules with the FastAPI app"""
    enabled_modules = get_enabled_modules()
    
    for module_name in enabled_modules:
        try:
            # Load module config
            module_config = load_module_config(module_name)
            print(f"Loading module: {module_config.get('display_name', module_name)} v{module_config.get('version', '0.0.0')}")
            
            # Import module dynamically
            module_path = os.path.join(os.path.dirname(__file__), module_name)
            spec = importlib.util.spec_from_file_location(
                f"modules.{module_name}",
                os.path.join(module_path, "__init__.py")
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Get router
            if hasattr(module, 'get_router'):
                router = module.get_router()
                app.include_router(router)
                print(f"  ✓ Registered API routes: {module_config.get('api_prefix', '/api')}")
            else:
                print(f"  ⚠ No router found in module {module_name}")
                
        except Exception as e:
            print(f"  ✗ Failed to load module {module_name}: {str(e)}")
            import traceback
            traceback.print_exc()


def get_module_menu_items() -> List[Dict[str, Any]]:
    """Get menu items from all enabled modules"""
    enabled_modules = get_enabled_modules()
    menu_items = []
    
    for module_name in enabled_modules:
        try:
            module_config = load_module_config(module_name)
            items = module_config.get('menu_items', [])
            for item in items:
                item['module'] = module_name
                menu_items.append(item)
        except Exception as e:
            print(f"Failed to load menu items from {module_name}: {str(e)}")
    
    # Sort by order
    menu_items.sort(key=lambda x: x.get('order', 999))
    return menu_items
