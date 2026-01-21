"""Test if routes load correctly"""
try:
    from modules.inventory.routes import router
    print('✓ SUCCESS: Routes loaded')
    print(f'✓ Total routes: {len(router.routes)}')
    print(f'✓ Prefix: {router.prefix}')
    print('\n✓ First 10 routes:')
    for i, route in enumerate(list(router.routes)[:10]):
        print(f'  {i+1}. {list(route.methods)[0] if route.methods else "GET"} {route.path}')
except Exception as e:
    print(f'✗ ERROR: {e}')
    import traceback
    traceback.print_exc()
