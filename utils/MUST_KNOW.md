# MUST KNOW - Core Systems Documentation

This document explains the core reusable systems in the DataFlows application. Written for AI assistants to understand and implement these systems correctly.

---

## 1. Document Generation System

### Overview
The document generation system allows generating PDF documents from templates for any object (purchase orders, sales orders, etc.). It uses an external service (`dataflows-docu`) for actual PDF generation and tracks jobs in MongoDB.

### Architecture

```
Frontend Component (DocumentGenerator.tsx)
    ↓ (generates document)
Backend API (/api/documents/generate)
    ↓ (creates job)
MongoDB (generated_documents collection)
    ↓ (external service polls)
dataflows-docu service
    ↓ (generates PDF)
MongoDB (updates status to 'done')
    ↓ (frontend polls status)
Frontend (downloads PDF)
```

### Database Collections

#### `generated_documents`
Stores document generation jobs and metadata.

```javascript
{
  _id: ObjectId,
  job_id: "unique-job-id",           // UUID for tracking
  object_id: "order-id",              // ID of the object (order, request, etc.)
  object_type: "procurement_order",   // Type of object
  template_code: "ILY5WVAV8SQD",     // Template identifier
  template_name: "Purchase Order",    // Human-readable name
  status: "done",                     // queued | processing | done | failed
  filename: "PO-0001.pdf",           // Generated filename
  file_path: "/path/to/file.pdf",    // Server file path
  error: null,                        // Error message if failed
  created_at: ISODate,
  updated_at: ISODate
}
```

#### `config` (document_templates_cofig)
Stores template configurations per object type.

```javascript
{
  slug: "document_templates_cofig",
  items: {
    "procurement": {
      "ILY5WVAV8SQD": "Comanda"      // code: name
    },
    "requests_1": {
      "6LL5WVTR8BTY": "P-Distrib-102_F1"
    }
  }
}
```

### Backend API Routes

#### Generate Document
```python
POST /api/documents/generate
Body: {
  "object_id": "string",
  "template_code": "string",
  "template_name": "string"
}
Response: {
  "job_id": "uuid",
  "status": "queued",
  "filename": "document.pdf"
}
```

#### Check Status
```python
GET /api/documents/job/{job_id}/status
Response: {
  "status": "done|processing|queued|failed",
  "error": "string|null"
}
```

#### Download Document
```python
GET /api/documents/{job_id}/download
Response: PDF file (blob)
```

#### Delete Document
```python
DELETE /api/documents/{job_id}
Response: {"success": true}
```

#### Get Documents for Object
```python
GET /api/documents/for/{object_id}
Response: [
  {
    "job_id": "uuid",
    "template_code": "string",
    "status": "done",
    "filename": "file.pdf",
    ...
  }
]
```

#### Get Available Templates
```python
GET /api/documents/templates
Response: [
  {
    "code": "ILY5WVAV8SQD",
    "name": "Purchase Order"
  }
]
```

### Frontend Component Usage

#### Basic Implementation

```tsx
import { DocumentGenerator } from '../Common/DocumentGenerator';

// In your component
<DocumentGenerator
  objectId={orderId}
  templateCodes={['ILY5WVAV8SQD', 'TEMPLATE2']}
  templateNames={{
    'ILY5WVAV8SQD': 'Purchase Order',
    'TEMPLATE2': 'Invoice'
  }}
  onDocumentsChange={async (docs) => {
    // Save document metadata to parent object
    await api.patch(`/api/orders/${orderId}/documents`, {
      documents: docs
    });
  }}
/>
```

#### Component Props

```typescript
interface DocumentGeneratorProps {
  objectId: string;                          // ID of the object
  templateCodes: string[];                   // Array of template codes
  templateNames?: Record<string, string>;    // Optional: code -> name mapping
  onDocumentsChange?: (documents: Record<string, DocumentJob>) => void;
}
```

#### Component Features
- **Auto-polling**: Checks status every 3 seconds until done
- **Fallback names**: If template not in API, uses code as name
- **Always-visible generate buttons**: Can regenerate anytime
- **Status badges**: Visual feedback (queued/processing/done/failed)
- **Actions**: Download (when done), Delete (always), Refresh (when processing)

### Module-Specific Configuration

Each module should provide an endpoint to get its template codes:

```python
# Example: modules/depo_procurement/routes.py
@router.get("/document-templates")
async def get_document_templates(current_user: dict = Depends(verify_token)):
    db = get_db()
    config = db['config'].find_one({'slug': 'document_templates_cofig'})
    if config and 'items' in config:
        procurement_templates = config['items'].get('procurement', {})
        return {"templates": procurement_templates}
    return {"templates": {}}
```

### Adding New Templates

1. **Add to MongoDB config:**
```javascript
db.config.updateOne(
  {slug: 'document_templates_cofig'},
  {$set: {
    'items.procurement.NEW_CODE': 'Template Name'
  }}
)
```

2. **Use in frontend:**
```tsx
// Templates are loaded automatically from backend
<DocumentGenerator
  objectId={orderId}
  templateCodes={templateCodes}  // Loaded from backend
  templateNames={templateNames}   // Loaded from backend
/>
```

---

## 2. Approval Flow System

### Overview
The approval flow system manages multi-step approval processes for objects (purchase orders, requests, etc.). It uses templates to define who must sign and tracks signatures with cryptographic hashes.

### Architecture

```
approval_templates (defines who can/must sign)
    ↓ (creates flow on object creation)
approval_flows (tracks signatures for specific object)
    ↓ (user signs)
signatures array (stores each signature)
    ↓ (all required signed?)
Object status changes (e.g., Pending → Processing)
```

### Database Collections

#### `approval_templates`
Defines approval workflows for object types.

```javascript
{
  _id: ObjectId,
  object_type: "procurement_order",      // Type of object
  object_source: "depo_procurement",     // Source module
  name: "Procurement Order Approval",
  description: "Approval workflow for procurement orders",
  officers: [
    {
      type: "role",                      // "role" or "person"
      reference: "admin",                // role name or user_id
      action: "must_sign",               // "must_sign" or "can_sign"
      order: 1                           // Signing order
    },
    {
      type: "person",
      reference: "6928ab746c224c08af72178f",  // user_id
      action: "can_sign",
      order: 2
    }
  ],
  active: true,
  created_at: ISODate,
  updated_at: ISODate
}
```

**Officer Types:**
- `type: "role"` - Any user with this role can sign
- `type: "person"` - Specific user must sign

**Actions:**
- `must_sign` - Required signature (counts toward min_signatures)
- `can_sign` - Optional signature

#### `approval_flows`
Tracks approval progress for specific objects.

```javascript
{
  _id: ObjectId,
  object_type: "procurement_order",
  object_source: "depo_procurement",
  object_id: "order-id",                 // ID of the object being approved
  template_id: "template-id",            // Reference to approval_template
  template_name: "Procurement Order Approval",
  min_signatures: 1,                     // Number of required signatures
  required_officers: [                   // Officers who MUST sign
    {
      type: "role",
      reference: "admin",
      action: "must_sign",
      order: 1
    }
  ],
  optional_officers: [                   // Officers who CAN sign
    {
      type: "person",
      reference: "user-id",
      action: "can_sign",
      order: 2
    }
  ],
  signatures: [                          // Array of signatures
    {
      user_id: "user-id",
      username: "admin",
      signed_at: ISODate,
      signature_hash: "crypto-hash",     // SHA256 hash for verification
      ip_address: "192.168.1.1",
      user_agent: "Mozilla/5.0..."
    }
  ],
  status: "approved",                    // pending | in_progress | approved
  completed_at: ISODate,
  created_at: ISODate,
  updated_at: ISODate
}
```

### Backend Implementation

#### Auto-Create Approval Flow on Object Creation

```python
# In your create_object service function
async def create_new_purchase_order(order_data, current_user):
    db = get_db()
    
    # Create the order first
    result = collection.insert_one(order_doc)
    order_id = str(result.inserted_id)
    
    # Auto-create approval flow
    try:
        templates_collection = db['approval_templates']
        approval_template = templates_collection.find_one({
            'object_type': 'procurement_order',
            'active': True
        })
        
        if approval_template:
            officers = approval_template.get('officers', [])
            
            # Separate by action type
            required_officers = []
            optional_officers = []
            
            for officer in officers:
                officer_data = {
                    "type": officer.get('type'),
                    "reference": officer.get('reference'),
                    "action": officer.get('action'),
                    "order": officer.get('order', 0)
                }
                
                if officer.get('action') == 'must_sign':
                    required_officers.append(officer_data)
                elif officer.get('action') == 'can_sign':
                    optional_officers.append(officer_data)
            
            # Sort by order
            required_officers.sort(key=lambda x: x.get('order', 0))
            optional_officers.sort(key=lambda x: x.get('order', 0))
            
            flow_data = {
                "object_type": "procurement_order",
                "object_source": "depo_procurement",
                "object_id": order_id,
                "template_id": str(approval_template['_id']),
                "template_name": approval_template.get('name'),
                "min_signatures": len(required_officers),
                "required_officers": required_officers,
                "optional_officers": optional_officers,
                "signatures": [],
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            db['approval_flows'].insert_one(flow_data)
    except Exception as e:
        print(f"Warning: Failed to auto-create approval flow: {e}")
        # Don't fail object creation if approval flow fails
    
    return order_doc
```

#### Approval Flow API Routes

```python
# Get approval flow for object
@router.get("/{object_id}/approval-flow")
async def get_approval_flow(object_id: str, current_user: dict = Depends(verify_token)):
    db = get_db()
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": object_id
    })
    return {"flow": serialize_doc(flow)}

# Sign object
@router.post("/{object_id}/sign")
async def sign_object(object_id: str, current_user: dict = Depends(verify_token)):
    from src.backend.models.approval_flow_model import ApprovalFlowModel
    
    db = get_db()
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": object_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found")
    
    user_id = str(current_user["_id"])
    
    # Check if already signed
    if any(s["user_id"] == user_id for s in flow.get("signatures", [])):
        raise HTTPException(status_code=400, detail="Already signed")
    
    # Check if user can sign
    can_sign = False
    for officer in flow.get("required_officers", []) + flow.get("optional_officers", []):
        if officer["type"] == "person" and officer["reference"] == user_id:
            can_sign = True
            break
        elif officer["type"] == "role":
            # Check if user has this role (role is ObjectId in users.role field)
            user_role_id = current_user.get("role")  # ObjectId from roles collection
            if user_role_id:
                # Get role details
                role = db.roles.find_one({"_id": ObjectId(user_role_id)})
                if role and role.get("name") == officer["reference"]:
                    can_sign = True
                    break
    
    if not can_sign:
        raise HTTPException(status_code=403, detail="Not authorized to sign")
    
    # Create signature
    timestamp = datetime.utcnow()
    signature_hash = ApprovalFlowModel.generate_signature_hash(
        user_id=user_id,
        object_type="procurement_order",
        object_id=object_id,
        timestamp=timestamp
    )
    
    signature = {
        "user_id": user_id,
        "username": current_user["username"],
        "signed_at": timestamp,
        "signature_hash": signature_hash,
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent")
    }
    
    # Add signature
    db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$push": {"signatures": signature},
            "$set": {"status": "in_progress", "updated_at": timestamp}
        }
    )
    
    # Check if all required signatures collected
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    required_count = len(updated_flow.get("required_officers", []))
    
    required_signed = 0
    for officer in updated_flow.get("required_officers", []):
        if officer["type"] == "person":
            if any(s["user_id"] == officer["reference"] for s in updated_flow.get("signatures", [])):
                required_signed += 1
        elif officer["type"] == "role":
            # Check if any user with this role signed
            for sig in updated_flow.get("signatures", []):
                user = db.users.find_one({"_id": ObjectId(sig["user_id"])})
                if user and officer["reference"] in user.get("roles", []):
                    required_signed += 1
                    break
    
    # If all required signed, mark as approved and update object status
    if required_signed >= required_count:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {
                "$set": {
                    "status": "approved",
                    "completed_at": timestamp,
                    "updated_at": timestamp
                }
            }
        )
        
        # Update object status (e.g., Pending → Processing)
        processing_state = db['depo_purchase_orders_states'].find_one({'name': 'Processing'})
        if processing_state:
            db['depo_purchase_orders'].update_one(
                {'_id': ObjectId(object_id)},
                {
                    '$set': {
                        'state_id': processing_state['_id'],
                        'status': 'Processing',
                        'updated_at': timestamp,
                        'approved_at': timestamp,
                        'approved_by': current_user["username"]
                    }
                }
            )
    
    return serialize_doc(updated_flow)

# Remove signature (admin only)
@router.delete("/{object_id}/signatures/{user_id}")
async def remove_signature(
    object_id: str,
    user_id: str,
    current_user: dict = Depends(verify_token)
):
    if not current_user.get('is_staff'):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_db()
    flow = db.approval_flows.find_one({
        "object_type": "procurement_order",
        "object_id": object_id
    })
    
    if not flow:
        raise HTTPException(status_code=404, detail="No approval flow found")
    
    db.approval_flows.update_one(
        {"_id": ObjectId(flow["_id"])},
        {
            "$pull": {"signatures": {"user_id": user_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    # Reset status if no signatures left
    updated_flow = db.approval_flows.find_one({"_id": ObjectId(flow["_id"])})
    if len(updated_flow.get("signatures", [])) == 0:
        db.approval_flows.update_one(
            {"_id": ObjectId(flow["_id"])},
            {"$set": {"status": "pending"}}
        )
    
    return {"message": "Signature removed"}
```

### Frontend Integration

The frontend typically displays:
1. **Required Approvers** - Officers who must sign
2. **Optional Approvers** - Officers who can sign
3. **Signatures** - List of who signed and when
4. **Sign Button** - If user can sign and hasn't yet

### Creating Approval Templates

#### For Procurement Orders
```javascript
db.approval_templates.insertOne({
  object_type: "procurement_order",
  object_source: "depo_procurement",
  name: "Procurement Order Approval",
  description: "Approval workflow for procurement orders",
  officers: [
    {
      type: "role",
      reference: "admin",
      action: "must_sign",
      order: 1
    }
  ],
  active: true,
  created_at: new Date(),
  updated_at: new Date()
})
```

#### For Other Object Types
```javascript
db.approval_templates.insertOne({
  object_type: "sales_order",
  object_source: "sales",
  name: "Sales Order Approval",
  description: "Approval workflow for sales orders",
  officers: [
    {
      type: "person",
      reference: "user-id-1",
      action: "must_sign",
      order: 1
    },
    {
      type: "person",
      reference: "user-id-2",
      action: "can_sign",
      order: 2
    }
  ],
  active: true,
  created_at: new Date(),
  updated_at: new Date()
})
```

### Best Practices

1. **Always create approval flow on object creation** - Don't wait for manual creation
2. **Use `type: "role"` for flexibility** - Allows any user with role to sign
3. **Use `type: "person"` for specific users** - When specific person must sign
4. **Sort officers by `order`** - Defines signing sequence
5. **Don't fail object creation if approval flow fails** - Log error and continue
6. **Update object status when approved** - Change from Pending to Processing
7. **Store signature hash** - For audit trail and verification
8. **Check permissions before allowing edits** - Block edits after approval

### Permission Logic

```python
def can_edit_object(order, current_user, approval_flow):
    """Check if user can edit object based on approval status"""
    
    # Once approved (status != Pending), cannot edit
    if order.get('status', '').lower() != 'pending':
        return False
    
    # Admin can edit pending orders
    if current_user.get('is_staff'):
        return True
    
    # Creator can edit if no signatures yet
    if not approval_flow or len(approval_flow.get('signatures', [])) == 0:
        is_creator = order.get('created_by') == current_user.get('username')
        return is_creator
    
    # Has signatures = cannot edit
    return False
```

---

## Summary

### Document Generation
- **Purpose**: Generate PDFs from templates for any object
- **Key Collections**: `generated_documents`, `config.document_templates_cofig`
- **Frontend**: `DocumentGenerator.tsx` component
- **Backend**: `/api/documents/*` routes
- **External**: `dataflows-docu` service generates PDFs

### Approval Flows
- **Purpose**: Multi-step approval with signatures
- **Key Collections**: `approval_templates`, `approval_flows`
- **Auto-created**: On object creation using active template
- **Signature Types**: Role-based or person-specific
- **Status Flow**: pending → in_progress → approved
- **Object Impact**: Changes object status when approved (e.g., Pending → Processing)

Both systems are **reusable** and can be applied to any object type (orders, requests, etc.) by:
1. Creating appropriate templates/configs in MongoDB
2. Implementing the backend routes for your object type
3. Using the frontend components in your UI
