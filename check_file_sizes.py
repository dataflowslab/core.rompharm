import os

files = [
    'src/frontend/src/pages/LocationsPage.tsx',
    'src/frontend/src/pages/ProcurementPage.tsx',
    'src/frontend/src/components/Procurement/DetailsTab.tsx',
    'src/frontend/src/pages/ProcurementDetailPage.tsx',
    'src/frontend/src/components/Procurement/ItemsTab.tsx',
    'src/backend/routes/documents.py'
]

print('File Line Counts:')
print('-' * 70)

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            lines = len(file.readlines())
            status = '⚠️  NEEDS OPTIMIZATION' if lines > 700 else '✅ OK'
            print(f'{os.path.basename(f):45} {lines:4} lines  {status}')
