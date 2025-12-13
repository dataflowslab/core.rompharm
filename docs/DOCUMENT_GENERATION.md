# Document Generation System

DataFlows Core includes a reusable document generation system that integrates with DataFlows Docu (OfficeClerk) for async PDF generation.

## DocumentManager Component

A generic React component for managing document generation in any module.

**Location**: `src/frontend/src/components/Common/DocumentManager.tsx`

**Features**:
- Single document per template (no version clutter)
- Automatic status checking after generation
- Auto-download when document is ready
- Manual refresh button for status verification
- Regenerate button (auto-deletes old document)
- Template-based configuration
- Job-based async generation
- Status badges: queued (gray), processing (blue), done (green), failed (red)
- Retry button for failed generations

## Usage Example

```typescript
import { DocumentManager } from '../Common/DocumentManager';

// In your component
<DocumentManager
  entityId={request._id}
  entityType="stock-request"  // or "procurement-order"
  templates={[
    {
      code: "6LL5WVTR8BTY",
      name: "P-Distrib-102_F1",
      label: t('P-Distrib-102_F1'),
      disabled: request.status !== 'Approved',
      disabledMessage: t('Document can only be generated after approval')
    }
  ]}
  onDocumentGenerated={onUpdate}
/>
```

## Component Props

```typescript
interface DocumentManagerProps {
  entityId: string | number;           // ID of the entity (order, request, etc.)
  entityType: 'procurement-order' | 'stock-request';  // Type of entity
  templates: DocumentTemplate[];       // Array of template configurations
  onDocumentGenerated?: () => void;    // Callback after generation
}

interface DocumentTemplate {
  code: string;                        // Template code from OfficeClerk
  name: string;                        // Template name
  label: string;                       // Display label (translated)
  disabled?: boolean;                  // Disable generation button
  disabledMessage?: string;            // Message when disabled
}
```

## Backend Integration

The component uses these API endpoints:

```python
# Generate document (returns job_id)
POST /api/documents/{entityType}/generate
{
  "order_id": "123",  # or "request_id" for stock-request
  "template_code": "6LL5WVTR8BTY",
  "template_name": "P-Distrib-102_F1"
}

# List documents for entity
GET /api/documents/{entityType}/{entityId}

# Check job status
GET /api/documents/{entityType}/{entityId}/job/{jobId}/status

# Download PDF
GET /api/documents/{entityType}/{entityId}/job/{jobId}/download

# Delete document
DELETE /api/documents/{entityType}/{entityId}/job/{jobId}
```

## Workflow

1. User clicks "Generate" button
2. Component sends POST request to generate endpoint
3. Backend creates job in OfficeClerk and returns job_id
4. Component automatically checks status after 1 second
5. If ready, document downloads automatically
6. If still processing, user can click refresh icon to check status
7. When done, "Download" and "Regenerate" buttons appear
8. Regenerating deletes old document and creates new one

## Implementation in New Modules

To add document generation to a new module:

### 1. Backend Routes

Create endpoints in `src/backend/routes/your_module.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from ..utils.dataflows_docu import DataFlowsDocuClient
from ..models.generated_document_model import GeneratedDocumentModel
from ..utils.db import get_db
from .auth import verify_token

router = APIRouter()

@router.post("/api/documents/your-entity/generate")
async def generate_document(
    data: dict,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Generate document for your entity"""
    entity_id = data.get("entity_id")
    template_code = data.get("template_code")
    template_name = data.get("template_name")
    
    # Get entity data
    entity = await db.your_collection.find_one({"_id": entity_id})
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    # Prepare data for template
    template_data = {
        "entity": entity,
        # Add more data as needed
    }
    
    # Generate document via OfficeClerk
    docu_client = DataFlowsDocuClient()
    job_id = await docu_client.generate_document(
        template_code=template_code,
        data=template_data
    )
    
    # Save to database
    doc = GeneratedDocumentModel(
        object_type="your_entity",
        object_id=str(entity_id),
        job_id=job_id,
        template_code=template_code,
        template_name=template_name,
        status="queued",
        filename=f"{template_name}_{entity_id}.pdf",
        version=1,
        created_by=current_user["username"]
    )
    await db.generated_documents.insert_one(doc.dict())
    
    return {"job_id": job_id, "status": "queued"}

@router.get("/api/documents/your-entity/{entity_id}")
async def list_documents(
    entity_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """List all documents for entity"""
    docs = await db.generated_documents.find({
        "object_type": "your_entity",
        "object_id": entity_id
    }).to_list(length=100)
    return docs

@router.get("/api/documents/your-entity/{entity_id}/job/{job_id}/status")
async def check_status(
    entity_id: str,
    job_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Check document generation status"""
    docu_client = DataFlowsDocuClient()
    status = await docu_client.check_job_status(job_id)
    
    # Update database
    await db.generated_documents.update_one(
        {"job_id": job_id},
        {"$set": {
            "status": status["status"],
            "has_document": status.get("has_document", False)
        }}
    )
    
    return status

@router.get("/api/documents/your-entity/{entity_id}/job/{job_id}/download")
async def download_document(
    entity_id: str,
    job_id: str,
    current_user: dict = Depends(verify_token)
):
    """Download generated PDF"""
    docu_client = DataFlowsDocuClient()
    pdf_content = await docu_client.download_document(job_id)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=document.pdf"}
    )

@router.delete("/api/documents/your-entity/{entity_id}/job/{job_id}")
async def delete_document(
    entity_id: str,
    job_id: str,
    current_user: dict = Depends(verify_token),
    db = Depends(get_db)
):
    """Delete document"""
    await db.generated_documents.delete_one({"job_id": job_id})
    
    # Optionally delete from OfficeClerk
    docu_client = DataFlowsDocuClient()
    await docu_client.delete_document(job_id)
    
    return {"message": "Document deleted"}
```

### 2. Frontend Integration

Use the component in your detail page:

```typescript
import { DocumentManager } from '../Common/DocumentManager';

// In your detail page component
const YourDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const [entity, setEntity] = useState(null);
  
  const documentTemplates = [
    {
      code: "ABC123DEF456",
      name: "Your_Document_Template",
      label: t('Your Document Template'),
      disabled: entity?.status !== 'Approved',
      disabledMessage: entity?.status !== 'Approved' 
        ? t('Document can only be generated after approval') 
        : undefined
    }
  ];
  
  return (
    <Grid>
      <Grid.Col span={3}>
        <DocumentManager
          entityId={id}
          entityType="your-entity"
          templates={documentTemplates}
          onDocumentGenerated={() => loadEntity()}
        />
      </Grid.Col>
      <Grid.Col span={9}>
        {/* Your form/details here */}
      </Grid.Col>
    </Grid>
  );
};
```

## Database Schema

Documents are stored in the `generated_documents` collection:

```javascript
{
  "_id": ObjectId("..."),
  "object_type": "procurement_order" | "stock_request" | "your_entity",
  "object_id": "123",
  "job_id": "job_id_from_officeclerk",
  "template_code": "ABC123DEF456",
  "template_name": "Document Template",
  "status": "queued" | "processing" | "done" | "failed",
  "filename": "Document_123.pdf",
  "version": 1,
  "created_at": ISODate("2024-12-XX"),
  "created_by": "username",
  "has_document": true,
  "error": null
}
```

## Configuration

Add DataFlows Docu credentials to `config.yaml`:

```yaml
dataflows_docu:
  url: "https://docu.dataflows.ro"
  token: "your-dataflows-docu-token"
```

## Current Implementations

### Procurement Module

- **Entity type**: `procurement-order`
- **Templates**: Configured in MongoDB config (slug: "procurement_order")
- **Location**: `src/frontend/src/components/Procurement/DetailsTab.tsx`
- **Usage**:
  ```typescript
  <DocumentManager
    entityId={order.pk}
    entityType="procurement-order"
    templates={documentTemplates}
    onDocumentGenerated={onUpdate}
  />
  ```

### Requests Module

- **Entity type**: `stock-request`
- **Templates**: 
  - P-Distrib-102_F1 (6LL5WVTR8BTY) - Fisa de solicitare
  - P-Distrib-102_F2 (RC45WVTRBDGT) - Nota de transfer
- **Locations**: 
  - `src/frontend/src/components/Requests/DetailsTab.tsx`
  - `src/frontend/src/components/Requests/OperationsTab.tsx`
- **Usage**:
  ```typescript
  // In DetailsTab
  const documentTemplates = [
    {
      code: "6LL5WVTR8BTY",
      name: "P-Distrib-102_F1",
      label: t('P-Distrib-102_F1'),
      disabled: request.status !== 'Approved',
      disabledMessage: t('Document can only be generated after approval')
    }
  ];
  
  <DocumentManager
    entityId={request._id}
    entityType="stock-request"
    templates={documentTemplates}
    onDocumentGenerated={onUpdate}
  />
  ```

## Benefits

- **DRY (Don't Repeat Yourself)**: Single component for all document generation
- **Consistent UX**: Same behavior across all modules
- **Easy to extend**: Add new entity types with minimal code
- **Async-ready**: Handles long-running document generation
- **User-friendly**: Auto-download, status badges, retry on failure
- **Maintainable**: Changes to document generation logic in one place

## Troubleshooting

### Document generation fails

1. Check DataFlows Docu credentials in `config.yaml`
2. Verify template code exists in OfficeClerk
3. Check backend logs for errors
4. Ensure template data structure matches template expectations

### Status stuck on "queued" or "processing"

1. Click the refresh icon to manually check status
2. Check OfficeClerk dashboard for job status
3. Verify network connectivity to docu.dataflows.ro
4. Check backend logs for API errors

### Download fails

1. Ensure document status is "done"
2. Check `has_document` field is true
3. Verify job_id is correct
4. Check backend logs for download errors
