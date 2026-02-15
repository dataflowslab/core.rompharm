"""
Module Loader for DataFlows Core
Dynamically loads and registers modules
"""
import os
import json
import importlib
import importlib.util
from typing import List, Dict, Any
from fastapi import FastAPI

from ..utils.config import load_config


def get_enabled_modules() -> List[str]:
    """
    Get list of enabled modules from config
    """
    try:
        config = load_config()
        modules = config.get('modules', {}).get('active', [])
        return modules
    except FileNotFoundError:
        print("[MODULES] config.yaml not found, no modules will be loaded")
        return []
    except Exception as e:
        print(f"[MODULES] Error loading config: {e}")
        return []


def validate_module(module_name: str, project_root: str) -> bool:
    """
    Validate that a module has the required structure
    """
    module_dir = os.path.join(project_root, 'modules', module_name)
    
    # Check if module directory exists
    if not os.path.exists(module_dir):
        print(f"[MODULES] X Module directory not found: {module_dir}")
        return False
    
    # Check for module.json
    module_json_path = os.path.join(module_dir, 'module.json')
    if not os.path.exists(module_json_path):
        print(f"[MODULES] X module.json not found for '{module_name}'")
        return False
    
    # Load and validate module.json
    try:
        with open(module_json_path, 'r', encoding='utf-8') as f:
            module_info = json.load(f)
        
        # Check required fields
        required_fields = ['name', 'version', 'requires_backend']
        for field in required_fields:
            if field not in module_info:
                print(f"[MODULES] X module.json missing required field '{field}' for '{module_name}'")
                return False
        
        # Check if backend is required and exists
        if module_info.get('requires_backend', False):
            backend_dir = os.path.join(module_dir, 'backend')
            if not os.path.exists(backend_dir):
                print(f"[MODULES] X Backend directory not found for '{module_name}'")
                return False
            
            # Check for required backend files
            required_files = ['__init__.py', 'routes.py', 'config.json']
            for file in required_files:
                file_path = os.path.join(backend_dir, file)
                if not os.path.exists(file_path):
                    print(f"[MODULES] X Required file '{file}' not found in backend for '{module_name}'")
                    return False
        
        return True
        
    except Exception as e:
        print(f"[MODULES] X Error validating module '{module_name}': {e}")
        return False


def load_module_config(module_name: str) -> Dict[str, Any]:
    """
    Load config.json for a specific module from /modules/{module_name}/backend/
    """
    # Get project root (3 levels up from this file)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    module_dir = os.path.join(project_root, 'modules', module_name, 'backend')
    config_path = os.path.join(module_dir, 'config.json')
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[MODULES] Warning: config.json not found for module '{module_name}' at {config_path}")
        return {}
    except Exception as e:
        print(f"[MODULES] Error loading config for module '{module_name}': {e}")
        return {}


def register_modules(app: FastAPI):
    """
    Register all enabled modules with the FastAPI app
    Modules are loaded from /modules/{module_name}/backend/
    """
    import sys
    
    enabled_modules = get_enabled_modules()
    
    if not enabled_modules:
        print("[MODULES] No modules enabled")
        return
    
    print(f"[MODULES] Loading modules: {', '.join(enabled_modules)}")
    
    # Get project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    modules_dir = os.path.join(project_root, 'modules')
    
    for module_name in enabled_modules:
        # Validate module structure
        if not validate_module(module_name, project_root):
            print(f"[MODULES] X Module '{module_name}' validation failed, skipping")
            continue
        
        try:
            # Add module backend directory to Python path
            module_backend_dir = os.path.join(modules_dir, module_name, 'backend')
            
            if module_backend_dir not in sys.path:
                sys.path.insert(0, module_backend_dir)
            
            # Import the module's __init__.py using spec
            spec = importlib.util.spec_from_file_location(
                f"{module_name}_module",
                os.path.join(module_backend_dir, '__init__.py')
            )
            
            if not spec or not spec.loader:
                print(f"[MODULES] X Could not load spec for module '{module_name}'")
                continue
            
            module = importlib.util.module_from_spec(spec)
            sys.modules[f"{module_name}_module"] = module
            spec.loader.exec_module(module)
            
            # Get router
            if hasattr(module, 'router'):
                app.include_router(module.router)
                print(f"[MODULES] OK Loaded module: {module_name}")
            else:
                print(f"[MODULES] X Module '{module_name}' has no router attribute")
        
        except ModuleNotFoundError as e:
            print(f"[MODULES] X Module '{module_name}' not found: {e}")
        except Exception as e:
            print(f"[MODULES] X Error loading module '{module_name}': {e}")
            import traceback
            traceback.print_exc()


def get_module_menu_items() -> List[Dict[str, Any]]:
    """
    Get all menu items from enabled modules
    """
    enabled_modules = get_enabled_modules()
    menu_items = []
    
    for module_name in enabled_modules:
        config = load_module_config(module_name)
        module_menu_items = config.get('menu_items', [])
        
        for item in module_menu_items:
            menu_item = {
                'module': module_name,
                'label': item.get('label', ''),
                'path': item.get('path', ''),
                'icon': item.get('icon', 'IconBox'),
                'admin_only': item.get('admin_only', False)
            }
            
            # Handle submenu if present
            if 'submenu' in item and item['submenu']:
                menu_item['submenu'] = item['submenu']
            
            menu_items.append(menu_item)
    
    return menu_items


__all__ = ['register_modules', 'get_module_menu_items', 'get_enabled_modules', 'load_module_config']
