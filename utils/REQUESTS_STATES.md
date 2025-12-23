# Requests States System

## Overview

Centralized state management system for stock requests with workflow levels and transitions.

## States

| State | Slug | Workflow Level | Description |
|-------|------|----------------|-------------|
| **New** | `new` | 50 | Request created, pending approval |
| **Approved** | `approved` | 100 | Approved, ready for warehouse operations |
| **Warehouse Approved** | `warehouse_approved` | 250 | Operations completed, ready for transfer |
| **Warehouse Rejected** | `warehouse_rejected` | -1 | Operations rejected (insufficient stock) |
| **Stock Received** | `stock_received` | 350 | Stock received at destination |
| **Warehouse Transfer Refused** | `warehouse_transfer_refused` | -2 | Destination refused transfer |
| **Produced** | `produced` | 400 | Production completed successfully |
| **Failed** | `failed` | -3 | Production failed |
| **Canceled** | `canceled` | -4 | Request canceled |

## Workflow Levels

- **Positive levels** (50-400): Active workflow progression
- **Negative levels** (-1 to -4): Terminal/error states
- **Gaps** (50, 100, 150...): Allow future state insertions

## State Transitions

```
New (50)
  ↓
Approved (100)
  ↓
  ├─→ Warehouse Approved (250)
  │     ↓
  │     ├─→ Stock Received (350)
  │     │     ↓
  │     │     ├─→ Produced (400) [FINAL]
  │     │     └─→ Failed (-3) [FINAL]
  │     │
  │     └─→ Warehouse Transfer Refused (-2) [FINAL]
  │
  └─→ Warehouse Rejected (-1) [FINAL]
```

## Import States

```bash
# Import states into MongoDB
python utils/import_requests_states.py
```

## Usage in Code

### Backend

```python
from src.backend.utils.db import get_db
from bson import ObjectId

db = get_db()

# Get state by slug
state = db.depo_requests_states.find_one({'slug': 'warehouse_approved'})

# Update request status
db.depo_requests.update_one(
    {'_id': ObjectId(request_id)},
    {
        '$set': {
            'state_id': state['_id'],
            'status': state['name'],
            'workflow_level': state['workflow_level']
        }
    }
)

# Check allowed transitions
current_state = db.depo_requests_states.find_one({'slug': 'approved'})
can_transition = 'warehouse_approved' in current_state['allowed_transitions']
```

### Frontend

```typescript
// Get state color
const getStateColor = (stateName: string) => {
  const stateColors = {
    'New': 'gray',
    'Approved': 'green',
    'Warehouse Approved': 'blue',
    'Warehouse Rejected': 'red',
    'Stock Received': 'lime',
    'Warehouse Transfer Refused': 'red',
    'Produced': 'green',
    'Failed': 'red',
    'Canceled': 'gray'
  };
  return stateColors[stateName] || 'gray';
};
```

## Database Schema

```javascript
{
  _id: ObjectId,
  name: "Warehouse Approved",           // Display name
  slug: "warehouse_approved",           // Unique identifier
  description: "Operations completed",  // Description
  color: "#339af0",                     // Hex color for UI
  icon: "package-check",                // Icon name (Tabler Icons)
  order: 30,                            // Display order
  is_active: true,                      // Is state active?
  is_initial: false,                    // Is this the initial state?
  is_final: false,                      // Is this a final state?
  workflow_level: 250,                  // Workflow progression level
  allowed_transitions: [                // Allowed next states
    "stock_received",
    "warehouse_transfer_refused"
  ],
  created_at: ISODate,
  updated_at: ISODate
}
```

## Mapping Old Status to New States

| Old Status | New State | Workflow Level |
|------------|-----------|----------------|
| Pending | New | 50 |
| Approved | Approved | 100 |
| In Operations | Approved | 100 |
| Finished | Warehouse Approved | 250 |
| Refused | Warehouse Rejected | -1 |

## Migration Script

```python
# Migrate existing requests to use state_id
from src.backend.utils.db import get_db

db = get_db()
states = {s['slug']: s for s in db.depo_requests_states.find()}

# Map old status to new state
status_mapping = {
    'Pending': 'new',
    'Approved': 'approved',
    'In Operations': 'approved',
    'Finished': 'warehouse_approved',
    'Refused': 'warehouse_rejected'
}

for request in db.depo_requests.find():
    old_status = request.get('status', 'Pending')
    state_slug = status_mapping.get(old_status, 'new')
    state = states[state_slug]
    
    db.depo_requests.update_one(
        {'_id': request['_id']},
        {
            '$set': {
                'state_id': state['_id'],
                'workflow_level': state['workflow_level']
            }
        }
    )
```
