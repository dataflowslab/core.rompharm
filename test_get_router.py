"""Test get_router function"""
import sys
sys.path.insert(0, '.')

try:
    from modules.inventory import get_router
    router = get_router()
    print(f'✓ get_router() works!')
    print(f'✓ Router prefix: {router.prefix}')
    print(f'✓ Total routes: {len(router.routes)}')
    print('\n✓ Sample routes:')
    for i, route in enumerate(list(router.routes)[:5]):
        method = list(route.methods)[0] if route.methods else 'GET'
        print(f'  {i+1}. {method} {route.path}')
except Exception as e:
    print(f'✗ ERROR: {e}')
    import traceback
    traceback.print_exc()
