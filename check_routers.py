"""
Script to check syntax of all router files
"""
import os
import sys
import py_compile
import importlib.util

def check_syntax(filepath):
    """Check if a Python file has valid syntax"""
    try:
        py_compile.compile(filepath, doraise=True)
        return True, "OK"
    except py_compile.PyCompileError as e:
        return False, str(e)

def try_import(filepath, module_name):
    """Try to import a module and report errors"""
    try:
        spec = importlib.util.spec_from_file_location(module_name, filepath)
        module = importlib.util.module_from_spec(spec)
        sys.path.insert(0, os.path.dirname(os.path.dirname(filepath)))
        spec.loader.exec_module(module)
        return True, "Import OK"
    except Exception as e:
        return False, f"{type(e).__name__}: {str(e)}"

def main():
    routers_dir = "modules/inventory/routers"
    
    print("=" * 80)
    print("CHECKING ROUTER FILES")
    print("=" * 80)
    
    router_files = [
        "articles_router.py",
        "locations_router.py", 
        "categories_router.py",
        "stocks_router.py",
        "suppliers_router.py"
    ]
    
    for filename in router_files:
        filepath = os.path.join(routers_dir, filename)
        
        if not os.path.exists(filepath):
            print(f"\n❌ {filename}: FILE NOT FOUND")
            continue
        
        print(f"\n{'='*80}")
        print(f"📄 {filename}")
        print(f"{'='*80}")
        
        # Check syntax
        syntax_ok, syntax_msg = check_syntax(filepath)
        if syntax_ok:
            print(f"✅ Syntax: {syntax_msg}")
        else:
            print(f"❌ Syntax Error:")
            print(f"   {syntax_msg}")
            continue
        
        # Try import
        module_name = filename.replace('.py', '')
        import_ok, import_msg = try_import(filepath, module_name)
        if import_ok:
            print(f"✅ Import: {import_msg}")
        else:
            print(f"❌ Import Error:")
            print(f"   {import_msg}")
    
    print("\n" + "=" * 80)
    print("CHECKING MAIN ROUTES FILE")
    print("=" * 80)
    
    routes_file = "modules/inventory/routes.py"
    if os.path.exists(routes_file):
        print(f"\n📄 routes.py")
        
        # Check syntax
        syntax_ok, syntax_msg = check_syntax(routes_file)
        if syntax_ok:
            print(f"✅ Syntax: {syntax_msg}")
        else:
            print(f"❌ Syntax Error:")
            print(f"   {syntax_msg}")
            return
        
        # Try import
        import_ok, import_msg = try_import(routes_file, "routes")
        if import_ok:
            print(f"✅ Import: {import_msg}")
        else:
            print(f"❌ Import Error:")
            print(f"   {import_msg}")
    
    print("\n" + "=" * 80)
    print("CHECK COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
