from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

states = list(db['depo_purchase_orders_states'].find({}, {
    '_id': 1, 
    'name': 1, 
    'value': 1, 
    'color': 1
}).sort('value', 1))

print('Purchase Order States:')
print('-' * 70)
for s in states:
    print(f"_id: {s['_id']}")
    print(f"  name: {s.get('name', 'N/A')}")
    print(f"  value: {s.get('value', 'N/A')}")
    print(f"  color: {s.get('color', 'N/A')}")
    print()
