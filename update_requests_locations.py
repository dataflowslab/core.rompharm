"""
Script to update all depo_requests to use ObjectIds for source and destination
from depo_locations instead of integers from InvenTree
"""
from pymongo import MongoClient
from bson import ObjectId

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['dataflows_rompharm']

# New location ObjectIds
SOURCE_OID = ObjectId('693fb21371d731f72ad6544a')
DESTINATION_OID = ObjectId('69418ede71d731f72ad65483')

# Update all requests
requests_collection = db['depo_requests']

result = requests_collection.update_many(
    {},  # Update all documents
    {
        '$set': {
            'source': str(SOURCE_OID),
            'destination': str(DESTINATION_OID)
        }
    }
)

print(f"Updated {result.modified_count} requests")
print(f"Source: {SOURCE_OID}")
print(f"Destination: {DESTINATION_OID}")

# Verify
sample = requests_collection.find_one()
if sample:
    print(f"\nSample request:")
    print(f"  _id: {sample['_id']}")
    print(f"  source: {sample.get('source')} (type: {type(sample.get('source'))})")
    print(f"  destination: {sample.get('destination')} (type: {type(sample.get('destination'))})")

client.close()
