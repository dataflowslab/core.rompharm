"""
Generate ROUTES.md documentation from all route files
Scans platform and module routes and creates centralized documentation
"""
import os
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple


class RouteInfo:
    def __init__(self, method: str, path: str, description: str, function_name: str):
        self.method = method.upper()
        self.path = path
        self.description = description.strip() if description else ""
        self.function_name = function_name
    
    def __repr__(self):
        return f"{self.method} {self.path} - {self.description}"


def extract_router_prefix(content: str) -> str:
    """Extract router prefix from APIRouter definition"""
    match = re.search(r'APIRouter\s*\(\s*prefix\s*=\s*["\']([^"\']+)["\']', content)
    return match.group(1) if match else ""


def extract_routes_from_file(file_path: str) -> Tuple[str, List[RouteInfo]]:
    """Extract all routes from a Python file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Get router prefix
    prefix = extract_router_prefix(content)
    
    routes = []
    
    # Pattern to match route decorators and their functions
    # Matches: @router.get("/path") or @router.post("/path/{id}")
    pattern = r'@router\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']+)["\']\s*\)'
    
    # Find all route decorators
    for match in re.finditer(pattern, content):
        method = match.group(1)
        path = match.group(2)
        
        # Find the function definition after this decorator
        func_start = match.end()
        func_match = re.search(r'async\s+def\s+(\w+)\s*\(', content[func_start:])
        
        if func_match:
            func_name = func_match.group(1)
            
            # Try to extract docstring
            docstring_start = func_start + func_match.end()
            docstring_match = re.search(r'"""([^"]+)"""', content[docstring_start:docstring_start+500])
            
            description = ""
            if docstring_match:
                # Get first line of docstring
                docstring = docstring_match.group(1).strip()
                description = docstring.split('\n')[0].strip()
            
            # Combine prefix with path
            full_path = prefix + path if prefix else path
            
            routes.append(RouteInfo(method, full_path, description, func_name))
    
    return prefix, routes


def scan_platform_routes(base_path: str) -> Dict[str, List[RouteInfo]]:
    """Scan all platform route files"""
    routes_dir = os.path.join(base_path, 'src', 'backend', 'routes')
    route_files = {}
    
    if os.path.exists(routes_dir):
        for file in os.listdir(routes_dir):
            if file.endswith('.py') and file != '__init__.py':
                file_path = os.path.join(routes_dir, file)
                prefix, routes = extract_routes_from_file(file_path)
                if routes:
                    module_name = file.replace('.py', '').replace('_', ' ').title()
                    route_files[module_name] = routes
    
    return route_files


def scan_module_routes(base_path: str) -> Dict[str, List[RouteInfo]]:
    """Scan all module route files"""
    modules_dir = os.path.join(base_path, 'modules')
    module_routes = {}
    
    if os.path.exists(modules_dir):
        for module_name in os.listdir(modules_dir):
            module_path = os.path.join(modules_dir, module_name)
            
            # Skip if not a directory or is __pycache__
            if not os.path.isdir(module_path) or module_name.startswith('__'):
                continue
            
            # Look for routes.py in module
            routes_file = os.path.join(module_path, 'routes.py')
            if os.path.exists(routes_file):
                prefix, routes = extract_routes_from_file(routes_file)
                if routes:
                    # Read module config for display name
                    config_file = os.path.join(module_path, 'config.json')
                    display_name = module_name
                    
                    if os.path.exists(config_file):
                        import json
                        try:
                            with open(config_file, 'r') as f:
                                config = json.load(f)
                                display_name = config.get('name', module_name)
                        except:
                            pass
                    
                    module_routes[display_name] = {
                        'prefix': prefix,
                        'routes': routes
                    }
    
    return module_routes


def generate_markdown(platform_routes: Dict, module_routes: Dict) -> str:
    """Generate markdown documentation"""
    md = []
    
    # Header
    md.append("# API Routes Documentation\n")
    md.append(f"**Last Updated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    md.append("**Auto-generated** - Do not edit manually. Run `python src/scripts/generate_routes_doc.py` to update.\n")
    md.append("---\n")
    
    # Platform Routes
    md.append("## 🌐 Global Platform Routes\n")
    
    for module_name, routes in sorted(platform_routes.items()):
        md.append(f"### {module_name}\n")
        
        # Group routes by base path
        grouped = {}
        for route in routes:
            # Extract base path (first segment after /api)
            parts = route.path.split('/')
            base = '/'.join(parts[:3]) if len(parts) >= 3 else route.path
            
            if base not in grouped:
                grouped[base] = []
            grouped[base].append(route)
        
        for base_path in sorted(grouped.keys()):
            for route in sorted(grouped[base_path], key=lambda r: (r.path, r.method)):
                desc = f" - {route.description}" if route.description else ""
                md.append(f"- `{route.method} {route.path}`{desc}\n")
        
        md.append("\n")
    
    # Module Routes
    if module_routes:
        md.append("---\n\n")
        md.append("## 📦 Module Routes\n")
        
        for module_name, module_data in sorted(module_routes.items()):
            prefix = module_data['prefix']
            routes = module_data['routes']
            
            md.append(f"### {module_name} (`{prefix}`)\n")
            
            # Group routes by resource
            grouped = {}
            for route in routes:
                # Extract resource name (first segment after prefix)
                path_after_prefix = route.path.replace(prefix, '').lstrip('/')
                resource = path_after_prefix.split('/')[0] if path_after_prefix else 'root'
                
                if resource not in grouped:
                    grouped[resource] = []
                grouped[resource].append(route)
            
            for resource in sorted(grouped.keys()):
                if resource != 'root':
                    md.append(f"\n**{resource.replace('-', ' ').title()}**\n")
                
                for route in sorted(grouped[resource], key=lambda r: (r.path, r.method)):
                    desc = f" - {route.description}" if route.description else ""
                    md.append(f"- `{route.method} {route.path}`{desc}\n")
            
            md.append("\n")
    
    # Footer
    md.append("---\n\n")
    md.append("## 📝 Notes\n\n")
    md.append("- All routes except `/api/auth/login` require authentication\n")
    md.append("- Admin-only routes require `is_staff` or `is_superuser` flag\n")
    md.append("- Module routes follow pattern: `/modules/{module_name}/api/{resource}`\n")
    md.append("- Global routes follow pattern: `/api/{resource}`\n\n")
    
    md.append("---\n\n")
    md.append("**To update this documentation, run:**\n")
    md.append("```bash\n")
    md.append("python src/scripts/generate_routes_doc.py\n")
    md.append("```\n")
    
    return ''.join(md)


def main():
    """Main function to generate routes documentation"""
    # Get base path (project root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_path = os.path.abspath(os.path.join(script_dir, '..', '..'))
    
    print("[*] Scanning platform routes...")
    platform_routes = scan_platform_routes(base_path)
    print(f"    Found {sum(len(routes) for routes in platform_routes.values())} platform routes")
    
    print("[*] Scanning module routes...")
    module_routes = scan_module_routes(base_path)
    print(f"    Found {sum(len(data['routes']) for data in module_routes.values())} module routes")
    
    print("[*] Generating ROUTES.md...")
    markdown = generate_markdown(platform_routes, module_routes)
    
    # Write to ROUTES.md in project root
    output_path = os.path.join(base_path, 'ROUTES.md')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(markdown)
    
    print(f"[OK] Documentation generated: {output_path}")
    print(f"     Total routes documented: {sum(len(routes) for routes in platform_routes.values()) + sum(len(data['routes']) for data in module_routes.values())}")


if __name__ == '__main__':
    main()
