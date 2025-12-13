# Changelog

All notable changes to this project will be documented in this file.

## [1.11.0] - 2024-12-XX

### Added
- **Reusable Document Manager Component**
  - Generic `DocumentManager.tsx` component for async document generation
  - Supports both Procurement and Requests modules
  - Single document per template (no versioning clutter)
  - Automatic status checking after generation
  - Auto-download when document is ready
  - Manual refresh button for status verification
  - Regenerate button (auto-deletes old document)
  - Template-based configuration
  - Job-based async generation via docu.dataflows.ro
  - Status badges: queued (gray), processing (blue), done (green), failed (red)
  - Clean UI with Paper cards per template
  - Retry button for failed generations
  - Component location: `src/frontend/src/components/Common/DocumentManager.tsx`

- **Requests Module - Complete Implementation**
  - **Tab Items**: Editable items table with batch code management
    - Description, Quantity, Batch Code columns
    - Add/Delete/Save items functionality
    - Batch code selection from available stock (datalist)
    - Manual batch code entry supported
    - Editable only until first signature (approval flow)
    - Real-time batch code loading from InvenTree
    - Inline quantity editing with NumberInput
    - Modal for adding new items with part search
  
  - **Document Generation**: P-Distrib-102_F1 (Fisa de solicitare)
    - Template code: 6LL5WVTR8BTY
    - Generate button in Details tab
    - Enabled only after request approval
    - PDF download with filename: `Fisa_Solicitare_{REFERENCE}.pdf`
    - Integration with existing document generation system
    - Uses `/api/documents/stock-request/generate` endpoint
  
  - **Batch Code Manual Entry**: Operations tab enhancements
    - TextInput with HTML5 datalist for batch codes
    - Can select from available batch codes OR type manually
    - Batch codes loaded from source location stock
    - Format: `BATCH_CODE - EXPIRY_DATE - QUANTITY buc`
    - No more series field (removed as per requirements)
    - Validation before signing (all items must have batch code)
  
  - **Document Generation in Operations**: P-Distrib-102_F2 (Nota de transfer)
    - Template code: RC45WVTRBDGT
    - Generate button in Operations tab
    - Available before signing (while form is editable)
    - PDF download with filename: `Nota_Transfer_{REFERENCE}.pdf`
    - Integration with existing document generation system
    - Uses `/api/documents/stock-request/generate` endpoint

- **Operations and Reception Flows for Requests Module**
  - Operations tab appears when request status is "Approved"
  - Reception tab appears when request status is "Finished"
  - Complete approval workflow for both Operations and Reception phases
  - Config-based flows from MongoDB (`requests_operations_flow`)
  - Two flow types: "operations" and "receiving"
  - Status management with reason tracking for refusals

- **Operations Flow**:
  - Signature workflow with config-based approvers
  - Status change to "Finished" or "Refused" after approval
  - Refusal requires reason (stored in `operations_refusal_reason`)
  - Tracks completion timestamp and user
  - Document generation trigger for "Nota de transfer" (RC45WVTRBDGT)

- **Reception Flow**:
  - Signature workflow with config-based approvers
  - Status change to "Approved" (Completed) or "Refused" after approval
  - Refusal requires reason (stored in `reception_refusal_reason`)
  - Tracks approval timestamp and user
  - Final step in request lifecycle

- **Backend API Endpoints** (`/api/requests`):
  - `GET /api/requests/{id}/operations-flow` - Get operations flow
  - `POST /api/requests/{id}/operations-flow` - Create operations flow
  - `POST /api/requests/{id}/operations-sign` - Sign operations
  - `DELETE /api/requests/{id}/operations-signatures/{user_id}` - Remove operations signature
  - `PATCH /api/requests/{id}/operations-status` - Update status (Finished/Refused)
  - `GET /api/requests/{id}/reception-flow` - Get reception flow
  - `POST /api/requests/{id}/reception-flow` - Create reception flow
  - `POST /api/requests/{id}/reception-sign` - Sign reception
  - `DELETE /api/requests/{id}/reception-signatures/{user_id}` - Remove reception signature
  - `PATCH /api/requests/{id}/reception-status` - Update status (Approved/Refused)

- **Frontend Components**:
  - `OperationsTab.tsx` - Operations approval and status management
  - `ReceptieTab.tsx` - Reception approval and status management
  - Conditional tab rendering based on request status
  - Modal dialogs for status changes with reason input
  - Signature tables with hash display
  - Status badges with color coding

### Technical
- New backend route: `src/backend/routes/requests_operations.py`
- Integrated with main app router
- MongoDB collections:
  - `approval_flows` (object_type: "stock_request_operations" and "stock_request_reception")
  - `depo_requests_items` (extended with operations and reception fields)
- Request status workflow:
  - Pending → Approved → Finished → Completed
  - Refused states at Operations or Reception level
- SHA256 signature hashing for audit trail
- IP address and user agent tracking

### Database Schema Extensions
```javascript
// depo_requests_items (additional fields)
{
  // ... existing fields ...
  operations_refusal_reason: "Reason text",
  operations_completed_at: DateTime,
  operations_completed_by: "username",
  reception_status: "Approved" | "Refused",
  reception_refusal_reason: "Reason text",
  reception_approved_at: DateTime,
  reception_approved_by: "username",
  reception_completed_at: DateTime,
  reception_completed_by: "username"
}

// approval_flows (operations and reception)
{
  object_type: "stock_request_operations" | "stock_request_reception",
  object_source: "depo_request",
  object_id: "request_id",
  flow_type: "operations" | "reception",
  config_slug: "operations" | "receiving",
  // ... standard approval flow fields ...
}
```

### Configuration
- Operations and Reception flows config in MongoDB:
  ```javascript
  db.config.insertOne({
    slug: "requests_operations_flow",
    items: [
      {
        slug: "operations",
        enabled: true,
        min_signatures: 1,
        can_sign: [{ user_id: "...", username: "..." }],
        must_sign: []
      },
      {
        slug: "receiving",
        enabled: true,
        min_signatures: 1,
        can_sign: [{ user_id: "...", username: "..." }],
        must_sign: []
      }
    ]
  })
  ```

### Workflow
1. Request created → Status: "Pending"
2. Approval flow signed → Status: "Approved"
3. **Operations tab appears**
4. Operations flow signed → Can mark as "Finished" or "Refused"
5. If "Finished" → **Reception tab appears**
6. Reception flow signed → Can mark as "Approved" (Completed) or "Refused"
7. Final status: "Completed" or "Refused"

### Features
- ✅ Conditional tab rendering based on status
- ✅ Config-based approval flows
- ✅ Signature workflows for Operations and Reception
- ✅ Status management with reason tracking
- ✅ Modal dialogs for status changes
- ✅ Refusal reason required for "Refused" status
- ✅ Admin can remove signatures
- ✅ Automatic status updates after approval
- ✅ Complete audit trail
- ✅ Document generation ready (RC45WVTRBDGT)

### Notes
- Operations tab only visible when status = "Approved"
- Reception tab only visible when status = "Finished"
- Refusal at any stage requires reason
- Each flow has independent signature workflow
- Status automatically updates when all signatures collected
- Document "Nota de transfer" (RC45WVTRBDGT) generated after Operations finalized
- Complete lifecycle tracking from creation to completion

---

## [1.10.0] - 2024-12-XX

### Added
- **Requests Module (depo_request)** - Internal stock transfer request system
  - Complete CRUD operations for stock transfer requests
  - MongoDB storage in `depo_requests_items` collection
  - Auto-generated reference numbers (REQ-NNNN format)
  - Request fields:
    - Reference (REQ-NNNN)
    - Source location (stock location)
    - Destination location (stock location)
    - Line items (parts with quantities)
    - Status (Pending, Approved, Refused, Canceled)
    - Issue date
  - Request creation form:
    - Dynamic source location select (AJAX)
    - Dynamic destination location select (AJAX, excludes source)
    - Part search with autocomplete
    - Stock information display for selected part:
      - Total stock (only transferable: status 10 or 80)
      - Allocated to sales orders
      - Allocated to build orders
      - In procurement
      - Available quantity
    - Quantity input
    - Notes field
  - Validation: Source and destination cannot be the same
  - BOM support: Parts with components show sub-components in list
  - Approval flow integration (config-based like procurement)
  - Document generation support (template: 6LL5WVTR8BTY - "Fisa de solicitare")
  - Status workflow:
    - Pending: New request
    - Approved: All signatures collected
    - Refused: Request rejected
    - Canceled: Request canceled

- **Backend API Endpoints** (`/api/requests`):
  - `GET /api/requests/` - List all requests
  - `GET /api/requests/{id}` - Get request details
  - `POST /api/requests/` - Create new request
  - `PATCH /api/requests/{id}` - Update request
  - `DELETE /api/requests/{id}` - Delete request
  - `GET /api/requests/stock-locations` - Get stock locations from InvenTree
  - `GET /api/requests/parts` - Search parts (autocomplete)
  - `GET /api/requests/parts/{id}/stock-info` - Get stock information for part
  - `GET /api/requests/parts/{id}/bom` - Get BOM (sub-components) for part
  - `GET /api/requests/{id}/approval-flow` - Get approval flow
  - `POST /api/requests/{id}/approval-flow` - Create approval flow
  - `POST /api/requests/{id}/sign` - Sign request
  - `DELETE /api/requests/{id}/signatures/{user_id}` - Remove signature (admin)

- **Frontend Pages**:
  - `RequestsPage.tsx` - List all requests with table
    - Reference, Source, Destination, Line Items, Status, Issue Date columns
    - Create new request button
    - View and delete actions
    - Status badges with color coding
    - Click row to navigate to details
  - `RequestDetailPage.tsx` - Request details with tabs
    - Details tab: View request information and items
    - Approval tab: Signature workflow (to be fully implemented)

### Technical
- New backend route: `src/backend/routes/requests.py`
- MongoDB collection: `depo_requests_items`
- Integration with InvenTree Stock Location API
- Integration with InvenTree Part API
- Integration with InvenTree BOM API
- Stock information calculation (transferable items only: status 10 or 80)
- Approval flow configuration via MongoDB (`request_approval_flows`)
- Document generation template: 6LL5WVTR8BTY

### Database Schema
```javascript
// depo_requests_items
{
  reference: "REQ-0001",
  source: 123,  // Stock location ID
  destination: 456,  // Stock location ID
  items: [
    {
      part: 789,  // Part ID
      quantity: 10,
      notes: "Optional notes"
    }
  ],
  line_items: 1,  // Count of items
  status: "Pending" | "Approved" | "Refused" | "Canceled",
  notes: "Request notes",
  issue_date: DateTime,
  created_at: DateTime,
  updated_at: DateTime,
  created_by: "username"
}
```

### Configuration
- Approval flow config in MongoDB:
  ```javascript
  db.config.insertOne({
    slug: "request_approval_flows",
    items: [{
      slug: "stock_requests",
      enabled: true,
      min_signatures: 1,
      can_sign: [
        { user_id: "...", username: "..." }
      ],
      must_sign: [
        { user_id: "...", username: "..." }
      ]
    }]
  })
  ```

### Features
- ✅ Auto-generated reference numbers
- ✅ Dynamic location selection
- ✅ Part search with autocomplete
- ✅ Real-time stock information
- ✅ BOM support for assemblies
- ✅ Approval workflow integration
- ✅ Document generation ready
- ✅ Status management
- ✅ MongoDB storage
- ✅ InvenTree integration

### Notes
- Requests are stored in MongoDB (not InvenTree)
- Stock information shows only transferable items (status 10 or 80)
- Approval flow uses same config-based system as procurement
- Document template 6LL5WVTR8BTY generates "Fisa de solicitare"
- Source and destination validation prevents same location selection
- BOM components automatically included in part selection
- Status automatically updates to "Approved" when all signatures collected

---

## [1.9.0] - 2024-12-XX

### Added
- **Procurement Approval System - Config-Based**
  - Approval flows now use MongoDB config (`procurement_approval_flows`) instead of templates
  - Configuration structure:
    - `can_sign`: List of users who can sign (any user, minimum `min_signatures` required)
    - `must_sign`: List of users who must sign (all required)
    - `min_signatures`: Minimum number of signatures from `can_sign` list
  - Logic implementation:
    - Any user from `can_sign` can sign
    - At least `min_signatures` from `can_sign` must sign
    - All users from `must_sign` must sign
    - Order becomes "Placed" (status 20) when all conditions met
  - Backend endpoints updated:
    - `POST /api/procurement/purchase-orders/{id}/approval-flow` - Creates flow from config
    - `POST /api/procurement/purchase-orders/{id}/sign` - Signs with new logic
  - Approval flow structure:
    - `can_sign_officers`: Array of optional signers
    - `must_sign_officers`: Array of required signers
    - `min_signatures`: Minimum required from can_sign
    - `signatures`: Array of collected signatures
    - `status`: pending, in_progress, approved

- **QR Code Generation for Procurement Orders**
  - QR code generated as SVG for each purchase order
  - Format: `ORDERID#SUPPLIERID#ISSUEDATE`
  - Example: `8#5#2024-12-20`
  - Included in document generation data:
    - `data.qr_code_svg` - Full SVG string (use with `|safe` filter)
    - `data.qr_code_data` - Raw QR string for debugging
  - Display in template: `{{ data.qr_code_svg|safe }}`
  - Library: `qrcode[pil]` with SVG support

- **Procurement Permissions System**
  - Manager-based access control for procurement orders
  - Logic:
    - Users in "Managers" group (InvenTree): Full access to all orders
    - Regular users: Access only to orders they created (responsible user)
    - Backward compatibility: Orders without responsible user accessible to all
  - Helper functions:
    - `is_manager(user)` - Checks if user is in Managers group
    - `can_access_order(user, order_data)` - Validates order access
  - Applied to sensitive endpoints:
    - `GET /api/procurement/purchase-orders/{id}/received-items`
  - Returns 403 Forbidden for unauthorized access

- **Auto-Reload After Signing**
  - Page automatically reloads 1 second after signing order
  - Ensures new tabs (Receive Stock, Quality Control) appear immediately
  - Implemented in `ApprovalsTab.tsx`

- **Quality Control Tab Visibility**
  - QC tab now hidden until order is signed
  - Same logic as Receive Stock tab
  - Conditional rendering based on approval flow signatures
  - Prevents premature QC operations

### Added (Previous Features)
- **Enhanced Procurement Reception System**
  - Extended receive stock form with comprehensive fields:
    - Supplier Batch Code (on same row with Batch Code)
    - Manufacturing Date (datepicker)
    - Expected Quantity from delivery documents (on same row with received quantity)
    - Expiry Date / Reset Date with toggle checkbox
    - Containers section with incremental table:
      - Number of containers
      - Products per container
      - Unit of measurement
      - Value (weight, volume, etc.)
      - Damaged checkbox
      - Unsealed checkbox
      - Mislabeled checkbox
    - Containers Cleaned checkbox
    - Supplier BA Number and Date
    - In Accordance with Supplier BA checkbox
    - Supplier in List checkbox
    - Transport section:
      - Clean Transport checkbox
      - Temperature Control Transport checkbox
      - Temperature Conditions Met (conditional on temperature control)
  
- **Stock Extra Data Management**
  - New MongoDB collections:
    - `depo_procurement_containers` - Container information per stock item
    - `depo_procurement_stock_metadata` - Transport and delivery metadata
  - Backend endpoint `/api/procurement/stock-extra-data` for saving:
    - Container data to MongoDB
    - Transport information to MongoDB
    - Custom fields to InvenTree via DataFlowsDepoStocks plugin
  - Integration with DataFlowsDepoStocks plugin for custom fields:
    - supplier_batch_code
    - manufacturing_date
    - expiry_date / reset_date
    - containers_cleaned
    - supplier_ba_no
    - supplier_ba_date
    - accord_ba
    - is_list_supplier

- **Enhanced Quality Control System**
  - Automatic separation of LOTALLEXP products (custom field id 3):
    - Separate table for LOTALLEXP items
    - Auto-received as transactionable (OK status)
    - No quarantine required
    - Direct stock entry
  - Support for Reglementat products (custom field id 2):
    - Quarantine delivery checkbox for regulated products
    - Ability to complete certificate number and conformity date later
  - Custom fields integration from InvenTree parts
  - Improved product categorization and handling

- **Receive Stock Tab Visibility**
  - Tab now appears only after purchase order has been signed
  - Conditional rendering based on approval flow signatures
  - Prevents premature stock reception

### Changed
- **Receive Stock Modal**: Expanded to XL size with scrollable content
- **Stock Reception Workflow**: Enhanced with plugin integration
- **Quality Control Tab**: Separated LOTALLEXP items from regular QC flow

### Technical
- Enhanced `ReceivedStockTab.tsx` with comprehensive form fields
- Added container management functions (add, remove, update rows)
- Modified `receive_stock` endpoint to return `stock_item_id`
- Created `save_stock_extra_data` endpoint for MongoDB and plugin updates
- Updated `QualityControlTab.tsx` with LOTALLEXP filtering logic
- Added custom_fields support in ReceivedItem interface
- Integrated with DataFlowsDepoStocks plugin API

### Database Schema
```javascript
// depo_procurement_containers
{
  stock_item_id: number,
  order_id: string,
  num_containers: number,
  products_per_container: number,
  unit: string,
  value: number,
  is_damaged: boolean,
  is_unsealed: boolean,
  is_mislabeled: boolean,
  created_at: DateTime,
  created_by: string
}

// depo_procurement_stock_metadata
{
  stock_item_id: number,
  order_id: string,
  expected_quantity: number,
  clean_transport: boolean,
  temperature_control: boolean,
  temperature_conditions_met: boolean,
  created_at: DateTime,
  created_by: string
}
```

### Plugin Integration
- DataFlowsDepoStocks plugin endpoint: `/plugin/dataflows-depo-stocks/api/extra/stock/{stock_id}/update/`
- Fields updated via plugin:
  - supplier_batch_code (text)
  - manufacturing_date (date)
  - expiry_date (date)
  - reset_date (date)
  - containers_cleaned (boolean)
  - supplier_ba_no (text)
  - supplier_ba_date (date)
  - accord_ba (boolean)
  - is_list_supplier (boolean)

### Notes
- All container data stored in MongoDB for detailed tracking
- Transport conditions tracked separately from InvenTree
- Plugin handles InvenTree custom fields synchronization
- LOTALLEXP products bypass normal QC workflow
- Reglementat products support deferred certificate completion
- Stock reception now captures comprehensive delivery information
- System supports both InvenTree standard fields and custom plugin fields

---

## [1.8.0] - 2024-12-XX

### Added
- **Document Generation for Procurement Orders**
  - Integration with DataFlows Docu (OfficeClerk) for document generation
  - Template configuration via MongoDB config collection (slug: "procurement_order")
  - Document sidebar in procurement order Details tab (1/4 width)
  - Order details form occupies 3/4 width
  - Generate documents from available templates
  - Track document generation jobs with status
  - Download completed documents
  - Document versioning system
  - Real-time status updates (queued, processing, completed, failed)

- **Backend API Endpoints**:
  - `GET /api/documents/procurement-order/templates` - Get available templates for procurement orders
  - `POST /api/documents/procurement-order/generate` - Generate document for procurement order
  - `GET /api/documents/procurement-order/{order_id}` - Get all documents for order
  - `GET /api/documents/procurement-order/{order_id}/job/{job_id}/status` - Check job status
  - `GET /api/documents/procurement-order/{order_id}/job/{job_id}/download` - Download document

- **Frontend Components**:
  - Enhanced `DetailsTab.tsx` with document sidebar
  - Template list with generate buttons
  - Generated documents list with status badges
  - Download button for completed documents
  - Refresh button for document list
  - Visual status indicators (gray: queued, blue: processing, green: completed, red: failed)

### Technical
- Document templates configured in MongoDB config collection
- Template codes stored in `items` array of config entry with slug "procurement_order"
- Documents stored in `generated_documents` collection
- Integration with existing DataFlows Docu client
- Async job creation with status tracking
- Local file caching after download
- Document data includes order details and line items
- Filename format: `PO-{order_id}-{template_code}-v{version}.pdf`

### Database Schema
```javascript
// MongoDB config collection
{
  "slug": "procurement_order",
  "items": ["template_code_1", "template_code_2", ...]
}

// generated_documents collection
{
  "object_type": "procurement_order",
  "object_id": "123",
  "job_id": "job_id_from_officeclerk",
  "template_code": "ABC123DEF456",
  "template_name": "Purchase Order",
  "status": "completed",
  "filename": "PO-123-ABC123-v1.pdf",
  "version": 1,
  "created_at": "2024-12-XX",
  "created_by": "username",
  "local_file": "hash_of_file",
  "error": null
}
```

### Configuration
- DataFlows Docu settings already in `config_sample.yaml`:
  ```yaml
  dataflows_docu:
    url: "https://docu.dataflows.ro"
    token: "your-dataflows-docu-token"
  ```

### Setup
1. Configure DataFlows Docu credentials in `config.yaml`
2. Create MongoDB config entry:
   ```javascript
   db.config.insertOne({
     slug: "procurement_order",
     items: ["template_code_1", "template_code_2"]
   })
   ```
3. Add template codes to the `items` array
4. Templates will appear in procurement order Details tab
5. Users can generate and download documents

### Features
- ✅ Template-based document generation
- ✅ Async job processing
- ✅ Status tracking and updates
- ✅ Document versioning
- ✅ Local file caching
- ✅ Download completed documents
- ✅ Visual status indicators
- ✅ Sidebar layout (1/4 documents, 3/4 form)
- ✅ Real-time document list refresh
- ✅ Integration with InvenTree order data

### Notes
- Documents are generated asynchronously via OfficeClerk
- Template codes must be valid OfficeClerk template codes
- Document data includes full order and line items details
- Generated documents are cached locally after first download
- Version number increments for each generation of same template
- Status updates automatically when checking job status
- Sidebar provides quick access to document generation
- Form remains fully functional alongside document sidebar

---

## [1.7.0] - 2024-12-XX

### Added
- **Global Approval System**: Complete approval/signature workflow for DataFlows Core
  - Database tables: `approval_templates` and `approval_flows`
  - Approval templates define who must/can sign for each object type
  - Approval flows track signatures for specific objects
  - SHA256 signature hashing for security
  - Officers can be persons or roles
  - Required vs optional approvers
  - Admin-only signature removal
  - Automatic status updates when signed
  
- **Procurement Approval Integration**
  - Approval flow for procurement orders
  - "Approvals" tab in procurement detail page
  - Create approval flow button (admin only)
  - Sign button for authorized users
  - Visual status badges (pending, in_progress, approved)
  - Signature table with hash display
  - Admin can remove signatures
  - Order automatically moves to "Placed" status when signed
  - Template-based approval configuration

### Technical
- **Backend Routes** (`/api/approvals`):
  - `GET /api/approvals/templates` - List approval templates
  - `POST /api/approvals/templates` - Create template
  - `GET /api/approvals/templates/{id}` - Get template
  - `PUT /api/approvals/templates/{id}` - Update template
  - `DELETE /api/approvals/templates/{id}` - Delete template
  - `GET /api/approvals/flows` - List approval flows
  - `POST /api/approvals/flows` - Create flow
  - `GET /api/approvals/flows/{id}` - Get flow
  - `GET /api/approvals/flows/object/{type}/{id}` - Get flow by object
  - `POST /api/approvals/flows/{id}/sign` - Sign flow
  - `DELETE /api/approvals/flows/{id}/signatures/{user_id}` - Remove signature (admin)

- **Procurement Routes** (`/api/procurement`):
  - `GET /api/procurement/purchase-orders/{id}/approval-flow` - Get order approval flow
  - `POST /api/procurement/purchase-orders/{id}/approval-flow` - Create order approval flow
  - `POST /api/procurement/purchase-orders/{id}/sign` - Sign purchase order
  - `DELETE /api/procurement/purchase-orders/{id}/signatures/{user_id}` - Remove signature

- **Models**:
  - `ApprovalTemplateModel` - Template configuration
  - `ApprovalFlowModel` - Flow instance with signatures
  - `ApprovalOfficer` - Officer definition (person/role, must/can sign)
  - `ApprovalSignature` - Individual signature with hash

- **Frontend Component**:
  - `ApprovalsTab.tsx` - Complete approval UI
  - Shows required and optional approvers
  - Displays all signatures with timestamps
  - Sign button for authorized users
  - Remove button for admins
  - Status badges and visual feedback

### Database Schema
```javascript
// approval_templates
{
  object_type: "procurement_order",
  object_source: "depo_procurement",
  name: "Procurement Order Approval",
  description: "Approval workflow for procurement orders",
  officers: [
    {
      type: "person" | "role",
      reference: "user_id" | "role_name",
      action: "must_sign" | "can_sign",
      order: 1
    }
  ],
  active: true,
  created_at: DateTime,
  updated_at: DateTime
}

// approval_flows
{
  object_type: "procurement_order",
  object_source: "depo_procurement",
  object_id: "123",
  template_id: "template_id",
  required_officers: [...],
  optional_officers: [...],
  signatures: [
    {
      user_id: "user_id",
      username: "username",
      signed_at: DateTime,
      signature_hash: "sha256_hash",
      ip_address: "127.0.0.1",
      user_agent: "Mozilla/5.0..."
    }
  ],
  status: "pending" | "in_progress" | "approved" | "rejected",
  created_at: DateTime,
  updated_at: DateTime,
  completed_at: DateTime
}
```

### Initialization
- Run `python init_procurement_approval_template.py` to create default template
- Default template requires admin role approval
- Customize officers in database or through admin interface

### Security
- Signatures use SHA256 hashing
- Hash includes: user_id, object_type, object_id, timestamp
- Users cannot remove their own signatures
- Only admins can remove signatures
- Backend validates authorization before signing

### Workflow
1. Admin creates approval flow for purchase order
2. System loads template and creates flow instance
3. Authorized users see "Sign" button
4. User clicks sign → generates hash → stores signature
5. Order status automatically updates to "Placed"
6. When all required officers sign → flow marked as "approved"
7. Admin can remove signatures if needed

### Notes
- Approval system is global and reusable for any object type
- Template-based configuration allows flexibility
- Role-based and person-based authorization
- Signature hashes provide audit trail
- Integration with InvenTree status updates

---

## [1.7.0] - 2024-12-XX

### Added
- **Global Approval System**: Complete approval workflow system for DataFlows Core
  - Database tables: `approval_flows` and `approval_templates`
  - Template-based approval configuration per object type
  - Support for person-based and role-based approvers
  - Required approvers (must_sign) and optional approvers (can_sign)
  - Digital signature generation with SHA256 hash
  - Signature includes: user_id, object_type, object_id, timestamp, IP address, user agent
  - Approval flow status tracking: pending, in_progress, approved, rejected
  - Complete audit trail with signature history
  - Admin-only signature removal capability
  - Users cannot remove their own signatures

- **Procurement Order Approval Integration**
  - Approval flow creation for procurement orders
  - Object type: "procurement_order", source: "depo_procurement"
  - Automatic order status update to "Placed" (20) when signed
  - ApprovalsTab component with full approval UI
  - Display required and optional approvers
  - Show signature list with timestamps and hashes
  - Sign button for authorized users
  - Admin controls for signature removal
  - Real-time approval status badges
  - Integration with InvenTree order status

- **Backend API Endpoints**:
  - `GET /api/approvals/templates` - List approval templates
  - `POST /api/approvals/templates` - Create approval template
  - `GET /api/approvals/templates/{id}` - Get template details
  - `PUT /api/approvals/templates/{id}` - Update template
  - `DELETE /api/approvals/templates/{id}` - Delete template
  - `GET /api/approvals/flows` - List approval flows
  - `POST /api/approvals/flows` - Create approval flow
  - `GET /api/approvals/flows/{id}` - Get flow details
  - `GET /api/approvals/flows/object/{type}/{id}` - Get flow by object
  - `POST /api/approvals/flows/{id}/sign` - Sign approval flow
  - `DELETE /api/approvals/flows/{id}/signatures/{user_id}` - Remove signature (admin)
  - `GET /api/procurement/purchase-orders/{id}/approval-flow` - Get order approval flow
  - `POST /api/procurement/purchase-orders/{id}/approval-flow` - Create order approval flow
  - `POST /api/procurement/purchase-orders/{id}/sign` - Sign purchase order
  - `DELETE /api/procurement/purchase-orders/{id}/signatures/{user_id}` - Remove order signature

- **Frontend Components**:
  - `ApprovalsTab.tsx` - Complete approval UI for procurement orders
  - Display approval flow status with color-coded badges
  - List required and optional approvers with sign status
  - Signature table with user, timestamp, and hash
  - Sign button for authorized users
  - Admin-only remove signature buttons
  - Real-time status updates
  - Integration with order refresh

### Technical
- New models:
  - `ApprovalFlowModel` - Tracks approval status for objects
  - `ApprovalTemplateModel` - Defines approval workflows
  - `ApprovalOfficer` - Officer configuration (person/role, must/can sign)
  - `ApprovalSignature` - Individual signature with hash
- Signature hash generation: SHA256(user_id + object_type + object_id + timestamp)
- Role-based authorization checking
- Person-based authorization checking
- Automatic status progression (pending → in_progress → approved)
- Integration with existing user and role systems
- MongoDB collections: `approval_flows`, `approval_templates`

### Database Schema
```python
approval_templates = {
    "object_type": "procurement_order",
    "object_source": "depo_procurement",
    "name": "Procurement Order Approval",
    "description": "Approval workflow for procurement orders",
    "officers": [
        {
            "type": "person" | "role",
            "reference": "user_id" | "role_name",
            "action": "must_sign" | "can_sign",
            "order": 1
        }
    ],
    "active": True
}

approval_flows = {
    "object_type": "procurement_order",
    "object_source": "depo_procurement",
    "object_id": "123",
    "template_id": "template_id",
    "required_officers": [...],
    "optional_officers": [...],
    "signatures": [
        {
            "user_id": "user_id",
            "username": "username",
            "signed_at": "2024-12-XX",
            "signature_hash": "sha256_hash",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0..."
        }
    ],
    "status": "pending" | "in_progress" | "approved" | "rejected"
}
```

### Setup
1. Run initialization script to create approval template:
   ```bash
   python init_procurement_approval_template.py
   ```
2. Customize template officers in MongoDB:
   - Add person-based approvers with user IDs
   - Add role-based approvers with role names
   - Set action: "must_sign" for required, "can_sign" for optional
3. Create approval flow for procurement orders via admin UI or API
4. Users can sign orders from ApprovalsTab
5. Order automatically moves to "Placed" status when signed

### Features
- ��� Template-based approval configuration
- ✅ Person and role-based approvers
- ✅ Required and optional approvers
- ✅ Digital signature with hash
- ✅ Complete audit trail
- ✅ Admin signature removal
- ✅ User cannot remove own signature
- ✅ Automatic status updates
- ✅ Real-time UI updates
- ✅ Integration with procurement orders
- ✅ Reusable for any object type

### Notes
- Approval system is global and reusable for any object type
- Procurement orders are the first implementation
- Template must be created before approval flows can be used
- Signatures are cryptographically secure with SHA256 hashing
- IP address and user agent tracked for audit purposes
- Admin users can remove signatures for corrections
- Users cannot remove their own signatures (audit integrity)
- Order status automatically updates to "Placed" when signed
- System supports multiple approvers per order
- Approval flow status progresses automatically based on signatures

---

## [1.6.0] - 2024-12-XX

### Added
- **Module System**: Dynamic module loading architecture
  - Modules can be enabled/disabled via `config.yaml`
  - Each module has its own API prefix: `/modules/{module_name}/api`
  - Module configuration via `config.json` (version, display name, dependencies, menu items)
  - Automatic router registration on application startup
  - Module loader with error handling and logging
  - Support for module-specific menu items

- **DEPO Procurement Module** (`depo_procurement`)
  - First modular implementation of procurement system
  - Complete InvenTree integration
  - API prefix: `/modules/depo_procurement/api`
  - All procurement features moved to module
  - Module README with installation and usage instructions
  - Module version: 1.0.0

### Changed
- **Application Architecture**: Modular design
  - Core application (`src/backend/app.py`) loads modules dynamically
  - Modules stored in `src/backend/modules/` directory
  - Each module is self-contained with routes, models, and config
  - Frontend API calls centralized in `src/frontend/src/services/procurement.ts`
  - Module configuration in `src/frontend/src/config/modules.ts`

### Technical
- New directory structure:
  ```
  src/backend/modules/
  ├── __init__.py (module loader)
  └── depo_procurement/
      ├── __init__.py
      ├── routes.py
      ├── config.json
      └── README.md
  ```
- Module loader functions:
  - `register_modules(app)` - Register all enabled modules
  - `get_enabled_modules()` - Get list from config
  - `load_module_config()` - Load module configuration
  - `get_module_menu_items()` - Get menu items from modules
- Dynamic import using `importlib.util.spec_from_file_location`
- Module isolation with separate API prefixes

### Configuration
```yaml
modules:
  active:
    - depo_procurement
```

### Module Structure
Each module contains:
- `config.json` - Module metadata and configuration
- `__init__.py` - Module initialization and router export
- `routes.py` - FastAPI routes
- `README.md` - Module documentation
- Optional: `models.py`, `utils.py`, etc.

### Benefits
- ✅ Easy to add/remove features
- ✅ Clean separation of concerns
- ✅ Independent module versioning
- ✅ Simplified testing and maintenance
- ✅ Reusable across projects

### Frontend Updates
- **ProcurementPage.tsx**: Updated to use `procurementApi` service
- **ProcurementDetailPage.tsx**: All API calls migrated to modular endpoints
- **Centralized API Service**: `src/frontend/src/services/procurement.ts`
- **Module Configuration**: `src/frontend/src/config/modules.ts`

### Migration Complete
- ✅ All procurement API calls use modular endpoints
- ✅ Frontend build successful
- ✅ Backend module loading functional
- ✅ Documentation updated

### Notes
- Modules are loaded at application startup
- Failed modules don't crash the application
- Module API routes are prefixed automatically
- Frontend uses centralized API service for module calls
- Old `/api/procurement` routes can be safely removed

---

## [1.5.4] - 2024-12-XX

### Added
- **Auto-Association of Parts with Suppliers**
  - Automatic supplier-part association when adding items to purchase orders
  - If a part is not associated with the order's supplier, system creates the association automatically
  - Generates SKU in format: `SUP-{supplier_id}-{part_id}`
  - Prevents "Supplier must match purchase order" errors
  - Seamless user experience - no manual association needed

### Technical
- Enhanced `POST /api/procurement/purchase-orders/{order_id}/items` endpoint
- Checks supplier-part association via `/api/company/part/` before adding item
- Creates association via `POST /api/company/part/` if needed
- Continues with item addition even if association check fails (graceful degradation)

### Notes
- Association is created in InvenTree database
- SKU is auto-generated to satisfy InvenTree requirements
- User can add any purchaseable part to any purchase order
- System handles InvenTree constraints transparently

---

## [1.5.3] - 2024-12-XX

### Added
- **Procurement Module Enhancements**
  - Component-based architecture for better maintainability
  - New procurement components:
    - `DetailsTab` - DatePickers for dates, Select for supplier and destination
    - `ApprovalsTab` - Select with order statuses from InvenTree
    - `ReceivedStockTab` - Complete stock reception functionality
  - Stock reception system with full form:
    - Select line item from order (shows received/total)
    - Quantity input with max validation
    - Location selection (stock locations)
    - Batch code input
    - Serial numbers input (comma-separated)
    - Packaging information
    - Status selection (OK, Attention, Damaged, etc.)
    - Notes field
  - Auto-calculation of remaining quantity to receive
  - Disabled receive button when all items fully received

### Changed
- **Tab Details**: Now uses DatePickerInput for issue_date and target_date
- **Tab Details**: Supplier and Destination now use Select components
- **Tab Approvals**: Replaced static status display with editable Select
- **Tab Reception**: Renamed to "Received Stock" with full functionality
- **Code Organization**: Split large ProcurementDetailPage into manageable components

### Fixed
- **Attachments Upload**: Fixed 404 error by correcting API endpoint path
- **Backend API**: Changed attachments endpoint from `/api/order/po/{id}/attachments/` to `/api/order/po/attachment/` with `order` parameter

### Technical
- Created `src/frontend/src/components/Procurement/` directory
- New components: `DetailsTab.tsx`, `ApprovalsTab.tsx`, `ReceivedStockTab.tsx`
- Added backend endpoints:
  - `POST /api/procurement/purchase-orders/{id}/receive-stock` - Receive stock items
  - `GET /api/procurement/order-statuses` - Get available order statuses
  - `PATCH /api/procurement/purchase-orders/{id}/status` - Update order status
- InvenTree 1.0.1 compatible stock reception
- Stock status codes: 10 (OK), 50 (Attention), 55 (Damaged), 60 (Destroyed), 65 (Rejected), 70 (Lost), 75 (Returned)

### Notes
- Components are reusable and easier to maintain
- Stock reception integrates directly with InvenTree API
- Received items automatically update order line item quantities
- DatePickers provide better UX for date selection
- Status management allows workflow control from UI

---

## [1.5.2] - 2024-12-XX

### Added
- **Line Items Progress Bar**
  - New "Line Items" column in purchase orders table
  - Shows received/total items count (e.g., "0 / 3")
  - Visual progress bar with color coding:
    - Gray: No items received (0%)
    - Blue: Partially received (1-99%)
    - Green: Fully received (100%)
  - Progress bar width: 120px minimum for better visibility

### Fixed
- **Supplier Display Issue**
  - Fixed missing supplier names in purchase orders list
  - Added `supplier_detail=true` parameter to InvenTree API call
  - Now correctly displays supplier information from InvenTree 1.0.6

### Changed
- **Search Field UI Improvement**
  - Removed border/Paper wrapper from search fields for cleaner look
  - Search fields now display directly without container box
  - Applied to both main procurement list and items table

### Fixed (Additional)
- **Navigation Issue**
  - Fixed navigation from procurement list to order details
  - Corrected route paths from `/web/procurement/:id` to `/procurement/:id`
  - Back button now correctly returns to procurement list
  - Clicking on order row now properly navigates to detail page

### Technical Details
- **Frontend**: Mantine Progress component for visual feedback
- **API**: Enhanced purchase orders endpoint with supplier details
- **Calculation**: Percentage = (line_items / lines) * 100
- **UI**: Removed Paper component wrapper from search inputs

### Notes
- Line items count comes from InvenTree `line_items` and `lines` fields
- Progress bar provides quick visual overview of order completion status
- Supplier details now properly fetched from InvenTree API
- Cleaner UI without unnecessary borders around search fields

---

## [1.5.1] - 2024-12-XX

### Added
- **Real-time Search Functionality**
  - Search bar for purchase orders table (searches reference, supplier, description, status)
  - Search bar for items table (searches part name, IPN, reference, destination)
  - Instant filtering as you type
  - "No results found" message when search yields no results

- **Table Sorting**
  - Click column headers to sort
  - Toggle between ascending/descending order
  - Visual indicators (up/down arrows) for active sort
  - Sortable columns in purchase orders: Reference, Supplier, Description, Status, Issue Date, Target Date
  - Sortable columns in items: Part, Quantity, Received, Unit Price, Destination, Reference
  - Smart sorting for numeric fields (quantity, price) vs text fields

### Fixed
- **Authentication Token Issue**
  - Fixed 500 Internal Server Error in procurement routes
  - Changed `get_inventree_headers` to use `current_user` token instead of `request.session`
  - Updated all procurement endpoints to pass correct user authentication
  - Fixed file upload authentication to use user token

### Technical Details
- **Frontend**: React useMemo for optimized filtering/sorting
- **Icons**: IconSearch, IconArrowUp, IconArrowDown from Tabler
- **Performance**: Memoized computed values prevent unnecessary re-renders
- **UX**: Clickable headers with visual feedback

### Notes
- Search is case-insensitive
- Sorting handles null/undefined values gracefully
- Numeric fields sorted numerically, text fields alphabetically
- Search and sort work together (search first, then sort filtered results)

---

## [1.5.0] - 2024-12-XX

### Added
- **Procurement Module**: Complete InvenTree procurement system integration
  - Purchase order list page with supplier, status, and dates
  - Create new purchase orders with supplier selection
  - New supplier creation with custom fields (cod, reg_code)
  - Supplier form fields: Company name, Currency, Tax ID, Is supplier, Is manufacturer, Cod, Registration No., Address, Country, City
  - Purchase order form fields: Order reference, Description, Supplier reference, Currency, Start date, Target date, Destination (stock location), Notes
  - Purchase order detail page with 5 tabs: Details, Approvals, Items, Attachments, Reception
  - Full CRUD operations for purchase order items
  - Item fields: Part (searchable), Quantity, Purchase Price, Currency, Destination, Reference, Notes
  - Edit and delete items inline from table
  - File attachments with drag-and-drop upload (Dropzone)
  - Attachment list with download and delete options
  - Reception tab showing received stock items
  - Integration with InvenTree custom fields plugin (dataflows-depo-companies)
  - Automatic currency selection based on supplier or order
  - Stock location selection for order and item destinations
  - Clickable rows to navigate to order details
  - Status badges with color coding
- **Backend API Routes**: New `/api/procurement` endpoints
  - `GET /api/procurement/suppliers` - List suppliers from InvenTree
  - `POST /api/procurement/suppliers` - Create new supplier with custom fields
  - `GET /api/procurement/stock-locations` - List stock locations
  - `GET /api/procurement/purchase-orders` - List purchase orders
  - `GET /api/procurement/purchase-orders/{id}` - Get purchase order details
  - `POST /api/procurement/purchase-orders` - Create new purchase order
  - `GET /api/procurement/purchase-orders/{id}/items` - List order items
  - `POST /api/procurement/purchase-orders/{id}/items` - Add item to order
  - `PUT /api/procurement/purchase-orders/{id}/items/{item_id}` - Update item
  - `DELETE /api/procurement/purchase-orders/{id}/items/{item_id}` - Delete item
  - `GET /api/procurement/parts` - List purchaseable parts
  - `GET /api/procurement/purchase-orders/{id}/attachments` - List attachments
  - `POST /api/procurement/purchase-orders/{id}/attachments` - Upload attachment (multipart/form-data)
  - `DELETE /api/procurement/purchase-orders/{id}/attachments/{attachment_id}` - Delete attachment
  - `GET /api/procurement/purchase-orders/{id}/received-items` - List received stock items
- **Frontend Components**:
  - `ProcurementPage.tsx` - Main procurement list and order creation
  - `ProcurementDetailPage.tsx` - Order details with 5 tabs
  - New supplier modal with all required fields
  - New item modal for adding parts to orders
  - Edit item modal for updating existing items
  - Dropzone component for file uploads (1/3 width)
  - Attachment list with download links (2/3 width)
  - Reception tab with received items table
  - Date pickers for issue and target dates
  - Searchable select dropdowns for suppliers, parts, and locations
  - Action buttons for edit and delete on each item

### Technical
- New backend route: `src/backend/routes/procurement.py`
- Integration with InvenTree Purchase Order API
- Integration with InvenTree Company API
- Integration with InvenTree Stock API for received items
- Integration with InvenTree Attachment API
- Integration with dataflows-depo-companies plugin for custom fields
- Custom fields support: cod, reg_code, tax_id
- Address creation for new suppliers (primary address)
- Multipart form data handling for file uploads
- Mantine DatePickerInput for date selection
- Mantine Dropzone for file uploads
- React Router navigation to order details
- Status color coding (Pending, Placed, Complete, Received, Cancelled)
- Item destination per line item (overrides order destination)
- Currency per line item (defaults to order currency)

### Notes
- Purchase orders are stored in InvenTree database
- Custom fields managed via dataflows-depo-companies plugin
- Supplier selection includes "New supplier" option
- Currency defaults to EUR or supplier's currency
- Item currency defaults to order currency
- Attachments stored in InvenTree with authentication
- Files can be opened in new tab or downloaded
- Received items shown from InvenTree stock with batch/serial info
- Approval system placeholder (to be implemented in next phase)
- All data synced with InvenTree in real-time
- No local storage - all operations via InvenTree API

## [1.4.4] - 2024-11-20

### Added
- **External API System**: Programmatic API access using Bearer tokens
  - New `/api/ext/*` endpoints for external integrations
  - API token authentication via `api_tokens` collection
  - Token expiration validation
  - Rights-based access control per token
  - New endpoints:
    - `POST /api/ext/fgo-client-invoices` - Save FGO client invoices
    - `POST /api/ext/fgo-supplier-invoices` - Save FGO supplier invoices
- **Raw Data Storage**: New `raw_data` collection for external data dumps
  - Stores JSON payloads from external sources
  - Tracks source and timestamp for each entry
  - Supports any JSON structure
- **API Token Model**: New `ApiTokenModel` for managing API tokens
- **Raw Data Model**: New `RawDataModel` for external data storage

### Fixed
- **Dashboard Shortcuts**: Fixed empty shortcuts issue for users with roles
  - Now correctly matches role IDs (both string and ObjectId formats)
  - Properly retrieves forms from dashboard configuration
  - Returns form details (slug, title, description)

### Technical
- New route file: `src/backend/routes/external.py`
- New models: `ApiTokenModel`, `RawDataModel`
- Bearer token authentication for external API access
- Token rights validation before endpoint access
- Integrated with main FastAPI application

### Database Collections
- `api_tokens`: Store API tokens with expiration and rights
- `raw_data`: Store external data dumps with source tracking

### Notes
- API tokens use Bearer authentication (e.g., `Authorization: Bearer <token>`)
- Each token has specific rights for endpoint access
- Token expiration is checked on each request
- Raw data is stored as-is without validation
- Useful for integrating with external systems like FGO

## [1.4.3] - 2024-11-17

### Added
- **URL Parameters Support**: Forms now accept URL parameters for pre-population
  - Parameters are sanitized (HTML tags removed)
  - Type conversion based on JSON Schema (string, number, integer, boolean, array)
  - Only fields defined in schema are accepted
  - Example: `/web/forms/ABC123?name=John&age=25&agree=true`

### Fixed
- **Form Link URL**: Fixed slug button in forms table to use correct path `/web/forms/{slug}` instead of `/{slug}`

### Technical
- Added `useSearchParams` hook to FormPage
- Implemented `sanitizeValue` function for safe parameter handling
- URL params are validated against form schema before pre-population

## [1.4.2] - 2024-11-17

### Added
- **WYSIWYG Editor for Campaigns**: Rich text editor for campaign messages
  - Mantine TipTap integration with full formatting toolbar
  - Bold, italic, underline, strikethrough formatting
  - Headings (H1, H2, H3)
  - Lists (bullet and ordered)
  - Blockquotes and horizontal rules
  - Link insertion and removal
  - Undo/Redo functionality
  - HTML output for email campaigns
- **Image Upload with Dropzone**: Drag-and-drop image upload for campaigns
  - Integrated with existing secure file upload system
  - Drag and drop or click to select
  - Image preview after upload
  - Remove uploaded image option
  - 5MB file size limit
  - Automatic hash-based file storage
  - Secure file serving via `/api/data/files/{hash}`

### Changed
- Campaign modal redesigned with better UX
- Image URL field replaced with visual dropzone
- Message textarea replaced with rich text editor
- Modal size increased to XL for better editing experience

### Technical
- Added dependencies:
  - `@mantine/tiptap` - Rich text editor
  - `@mantine/dropzone` - File upload component
  - `@tiptap/react` - TipTap React integration
  - `@tiptap/starter-kit` - TipTap base extensions
  - `@tiptap/extension-link` - Link support
- New component: `CampaignModal.tsx` in `src/frontend/src/components/CRM/`
- Updated `CampaignsPage.tsx` to use new modal component
- Added CSS imports for TipTap and Dropzone in `main.tsx`
- Integrated with existing file upload endpoint `/api/data/upload`

### Notes
- Campaign messages now support rich HTML formatting
- Images are stored securely using the existing file handler system
- File uploads use SHA256 hash-based storage with date organization
- Uploaded images are served via secure hash URLs

## [1.4.1] - 2024-11-17

### Changed
- **Template Selector Enhancement**: Replaced manual template code input with MultiSelect dropdown
  - Automatically loads available templates from API
  - Shows template name and code in dropdown (e.g., "Invoice Template (ABC123DEF456)")
  - Searchable dropdown for easy template finding
  - Clearable selection
  - Loading state while fetching templates
  - Error handling if templates fail to load
  - No templates available message when list is empty

### Technical
- Updated `TemplateSelector.tsx` to use MultiSelect component
- Added API call to `/api/templates` to fetch available templates
- Improved UX with loading spinner and error messages

## [1.4.0] - 2024-11-17

### Added
- **Mantine Form Renderers**: Custom JSON Forms renderers using Mantine UI components
  - Text input with maxLength support
  - Textarea with character counter and autosize
  - Number input with min/max validation (decimal numbers)
  - Integer input with min/max validation (whole numbers only, no decimals)
  - Date picker with intelligent date selection (DD-MM-YYYY format)
  - Select dropdown with search and clear functionality
  - Multi-select with search and clear functionality
  - Single checkbox for boolean values
  - Checkbox group for multiple selections
  - Radio button group
  - Vertical layout (default stacking)
  - Horizontal layout (side-by-side fields with responsive grid)
  - Group layout (simple divider separator, no borders/shadows)
- **Form Submission Confirmation**: Modal dialog before submitting form
  - Confirmation message in Romanian
  - Summary table showing all field labels and values
  - Confirm and Cancel buttons
  - Mobile-friendly fullscreen modal
- **Post-Submission Alerts**: Success and error messages displayed after form submission
  - Success alert: "Cererea a fost înregistrată" (green, dismissible)
  - Error alert: Shows specific error message (red, dismissible)
  - Alerts appear below form title
  - Auto-scroll to top to show alerts
  - Close button on each alert
- **Enhanced Form Features**:
  - Consistent label width in horizontal layouts
  - Required field indicators (asterisk)
  - Built-in validation with error messages
  - Clearable inputs for better UX
  - Searchable select fields
  - Character counting for textareas
  - Responsive layouts for mobile/tablet/desktop
- **Slug Column Enhancement**: Slug column in forms table now displays as clickable button with external link icon that opens form in new tab
- **Dependencies**: Added `@mantine/dates` and `dayjs` for date picker functionality

### Changed
- Replaced vanilla JSON Forms renderers with custom Mantine renderers
- Forms now use Mantine UI components throughout for consistent styling
- Date fields now use intelligent date picker instead of basic HTML input
- Select fields now support search and clear functionality
- Textarea fields automatically resize and show character count

### Technical
- New components in `src/frontend/src/components/JsonForms/`:
  - `MantineTextControl.tsx` - Text and textarea inputs
  - `MantineDateControl.tsx` - Date picker with dayjs
  - `MantineNumberControl.tsx` - Number input
  - `MantineSelectControl.tsx` - Select and multi-select
  - `MantineCheckboxControl.tsx` - Checkbox and checkbox group
  - `MantineRadioControl.tsx` - Radio button group
  - `MantineGroupLayout.tsx` - Grouped fields with border
  - `MantineVerticalLayout.tsx` - Vertical stacking
  - `MantineHorizontalLayout.tsx` - Horizontal grid layout
  - `index.ts` - Exports all renderers
- Updated `FormPage.tsx` to use Mantine renderers
- Updated `FormsPage.tsx` to make slug column clickable
- Added CSS imports for `@mantine/dates` in `main.tsx`
- Updated `package.json` with new dependencies

### Documentation
- Added comprehensive Mantine Form System section to README
- Documented all supported field types with JSON Schema examples
- Documented layout options (vertical, horizontal, group)
- Added complete form example with multiple field types
- Listed all features and capabilities of the new form system

### Notes
- All forms now have modern, consistent UI with Mantine components
- Date picker provides better UX with calendar popup
- Horizontal layouts automatically adjust for mobile devices
- Character counters help users stay within field limits
- Searchable selects improve usability for long option lists

## [1.3.0] - 2024-11-16

### Added
- **Template Management System**: Complete CRUD operations for OfficeClerk/DataFlows Docu templates
  - List all templates with parts grouping
  - Create new templates with first part (base, header, footer, css, code)
  - Add parts to existing templates
  - Get template bundle details
  - Get individual part metadata and raw content
  - Update template metadata and part content
  - Delete templates and individual parts
- **Template Model**: New `TemplateModel` for storing template metadata locally
- **Template Routes**: New `/api/templates` endpoints for template management
  - `GET /api/templates` - List all templates
  - `POST /api/templates` - Create new template
  - `GET /api/templates/{code}` - Get template bundle
  - `PUT /api/templates/{code}` - Update template metadata
  - `DELETE /api/templates/{code}` - Delete template
  - `POST /api/templates/{code}/parts` - Add part to template
  - `GET /api/templates/{code}/{type}` - Get part metadata
  - `GET /api/templates/{code}/{type}/raw` - Get part raw content
  - `PUT /api/templates/{code}/{type}` - Update part
  - `DELETE /api/templates/{code}/{type}` - Delete part

### Technical
- Integrated with OfficeClerk API (DataFlows Docu)
- Template parts: base (required), header, footer, css, code (optional)
- 12-character template codes from OfficeClerk
- Local metadata storage with MongoDB
- Audit logging for all template operations
- Support for Jinja2 templating in content

### Database Collections
- `templates`: Store template metadata (code, name, description, timestamps)

### Notes
- Templates are managed via OfficeClerk API
- Local database stores metadata only
- Template codes are unique identifiers from OfficeClerk
- Base part is required for all templates
- Frontend implementation needed for UI (code editor with syntax highlighting)

## [1.2.0] - 2024-11-16

### Added
- **User Model Extensions**: Added `firstname`, `lastname`, `local_role`, and `last_login` fields to user model
- **Role Management**: New `roles` collection to store InvenTree roles synchronized from API
- **Job Scheduler System**: APScheduler-based cron-like job system for recurring tasks
  - Job configuration stored in `jobs` collection
  - Cron expression support (e.g., "*/5 * * * *" for every 5 minutes)
  - Manual job execution via invoke tasks or API
  - Automatic job execution on schedule
  - Job status tracking (last_run, last_status, last_output)
- **Role Synchronization Script**: `src/scripts/update_roles.py` syncs roles from InvenTree
- **Soft Delete for Forms**: Forms now use soft delete with `deleted` timestamp
  - Forms with `deleted: null` or future date are visible
  - Deleted forms remain in database for audit purposes
- **Campaign Delivery Date**: Added `delivery_date` field to campaigns
  - Empty delivery_date means manual send only
  - Scheduled campaigns can be sent automatically
- **Job Management API**: New endpoints in `/api/system/jobs`
  - `GET /api/system/jobs` - List all jobs
  - `POST /api/system/jobs` - Create new job
  - `PUT /api/system/jobs/{name}` - Update job
  - `DELETE /api/system/jobs/{name}` - Delete job
  - `POST /api/system/jobs/{name}/run` - Manually trigger job
- **Invoke Tasks for Jobs**:
  - `invoke job-run --name=<job_name>` - Run job manually
  - `invoke job-list` - List configured jobs
  - `invoke scheduler-start` - Start scheduler service

### Changed
- Forms deletion now sets `deleted` timestamp instead of removing from database
- Form queries filter out deleted forms (where deleted is null or in future)
- Campaign model updated to support scheduled delivery
- Backend app now starts job scheduler on startup
- Scheduler automatically loads jobs from database

### Technical
- Added `apscheduler==3.10.4` dependency
- New models: `RoleModel`, `JobModel`
- New module: `src/backend/scheduler.py` for job scheduling
- New directory: `src/scripts/` for scheduled job scripts
- Enhanced system routes with job management endpoints
- Scheduler integrates with FastAPI lifecycle (startup/shutdown)

### Database Collections
- `roles`: Store InvenTree roles (synced via update_roles job)
- `jobs`: Store job configurations (name, frequency, enabled, status)

### Notes
- Job scripts should be placed in `src/scripts/` directory
- Job names correspond to script filenames (without .py extension)
- Scheduler runs in background as part of main application
- Jobs can be managed via API or invoke tasks
- Use semicolon (;) instead of && for command chaining per project standards

## [1.1.0] - 2024-11-12

### Added
- **Auto-generated Form Slugs**: 8-character slugs (A-Z, 0-9) generated automatically
- **QR Code Generation**: SVG QR codes for each form via `/api/forms/{slug}/qr`
- **Workflow Management**: Multi-state approval system for submissions
  - States: New, In Review, Approved, Rejected, Cancelled
  - State history tracking with user and timestamp
  - Notes field for each state change
- **File Upload System**: Secure file handling for form submissions
  - SHA256 hash-based storage
  - Date-organized directory structure (YYYY/MM/DD)
  - Configurable size limits and allowed extensions
  - Secure file serving via hash URLs
- **CRM Module**: Complete subscriber and campaign management
  - Subscriber management with ANAF tax ID verification
  - Segment-based organization
  - Email campaign creation and tracking
  - Import subscribers from InvenTree
  - Marketing consent tracking (email/SMS)
- **Submissions Management**: Dedicated pages for viewing and managing all submissions
  - All submissions list page
  - Detailed submission view with state management
  - State change history display
  - File attachments display
- **Form Routes**: Changed to `/web/forms/{slug}` for better organization
- **Menu Reorganization**: New menu structure (Dashboard, Formulare, CRM, Templates, Notifications, Users, Audit Log)

### Changed
- Form creation no longer requires manual slug input
- Slug field removed from form creation UI
- Form URLs now use `/web/forms/{slug}` pattern
- Dashboard simplified to welcome message
- Forms management moved to dedicated "Formulare" page

### Technical
- Added `qrcode[pil]` library for QR code generation
- Added `email-validator` for email validation
- New models: `form_state_model`, `subscriber_model`, `segment_model`, `campaign_model`
- New utilities: `slug_generator`, `file_handler`, `anaf` (tax ID verification)
- New routes: CRM endpoints, file upload/download, state management
- Enhanced data model with state tracking fields

## [1.0.0] - 2024-11-11

### Project
- **Name**: DataFlows Core
- **Description**: Dynamic forms platform with InvenTree 1.0.1 authentication
- **InvenTree Version**: 1.0.1 (see [InvenTree 1.0.1 Documentation](https://docs.inventree.org/en/1.0.1/))

### Recent Updates (2024-11-11)
- ✅ Renamed dataflows_depo to dataflows_docu throughout the codebase
- ✅ Updated all references in config, backend, and frontend
- ✅ Changed command separator from && to ; in package.json and documentation
- ✅ Removed extra documentation files (frontend README, locales README)
- ✅ Simplified documentation to only README and CHANGELOG per project
- ✅ Fixed InvenTree authentication (HTTP Basic Auth with GET request)
- ✅ Auto-generate slug from form title (removes diacritics and special characters)
- ✅ Slug duplicate protection with real-time validation
- ✅ Form editing functionality
- ✅ Link to JSON Forms documentation in schema editor
- ✅ Improved error handling and logging
- ✅ Persistent error messages in login form
- ✅ Gettext-based translation system (.po files)
- ✅ Multi-language support (English, Romanian)
- ✅ Translation extraction and compilation scripts
- ✅ Invoke task runner for build automation (replaces .bat files)
- ✅ Administrator role verification from InvenTree
- ✅ Public and protected forms
- ✅ Username tracking for form submissions
- ✅ Full mobile responsive design
- ✅ Mobile-optimized header with drawer navigation
- ✅ Touch-friendly UI elements (44px minimum tap targets)
- ✅ Adaptive layouts for mobile, tablet, and desktop
- ✅ Mobile-specific CSS optimizations
- ✅ PWA-ready meta tags
- ✅ Cross-platform task runner with Invoke
- ✅ Simplified build and deployment workflow

### Added
- Initial project structure
- FastAPI backend with RESTful API
- MongoDB integration for data storage
- InvenTree authentication system (compatible with InvenTree 1.0.1)
- Form management endpoints (CRUD operations)
- Data submission endpoints
- Configuration management
- User authentication with token storage
- Public form access via slug
- Protected endpoints for form management and data viewing
- Health check endpoint
- CORS middleware for frontend integration
- Static file serving for media files
- Automatic database connection management

### Database Collections
- `forms`: Store form definitions with JSON Schema and UI Schema
- `data`: Store form submissions
- `users`: Store InvenTree user tokens
- `config`: Store application configuration (company name, logo)

### API Endpoints
- `POST /api/auth/login` - Authenticate with InvenTree
- `GET /api/auth/verify` - Verify token validity
- `GET /api/forms/{slug}` - Get form by slug (public)
- `GET /api/forms/` - List all forms (authenticated)
- `POST /api/forms/` - Create new form (authenticated)
- `PUT /api/forms/{form_id}` - Update form (authenticated)
- `DELETE /api/forms/{form_id}` - Delete form (authenticated)
- `POST /api/data/` - Submit form data (public)
- `GET /api/data/{form_id}` - Get form submissions (authenticated)
- `GET /api/data/submission/{submission_id}` - Get specific submission (authenticated)
- `DELETE /api/data/submission/{submission_id}` - Delete submission (authenticated)
- `GET /api/config/` - Get configuration (public)
- `POST /api/config/` - Update configuration (authenticated)
- `GET /health` - Health check endpoint

### Configuration
- YAML-based configuration file
- InvenTree URL configuration (no credentials stored)
- MongoDB connection settings
- Web application settings
- Media file paths
- Users authenticate with their own InvenTree credentials

### Security
- Token-based authentication via InvenTree
- Protected endpoints for sensitive operations
- Token verification against InvenTree API
- Secure token storage in MongoDB

### Frontend
- React 18 with TypeScript
- Mantine UI v7 component library
- Vite build tool for fast development
- React Router for navigation
- Axios for API communication
- JSON Forms integration for dynamic form rendering
- Authentication context with token management
- Protected routes for authenticated pages
- Responsive design with Mantine components

### Pages
- **LoginPage**: InvenTree authentication
- **FormPage**: Public form rendering and submission
- **DashboardPage**: Form management (create, view, delete)
- **DataListPage**: View and manage form submissions

### Components
- **Header**: Navigation with company branding and user info
- **ProtectedRoute**: Route guard for authenticated pages
- **AuthContext**: Global authentication state management

### Features
- Token-based authentication with localStorage persistence
- Automatic token refresh and validation
- Form creation with JSON Schema editor
- Real-time form rendering with JSON Forms
- Submission management and viewing
- Company branding configuration
- Notifications for user feedback
- Error handling and loading states

### Deployment
- Single service architecture: backend serves both API and frontend
- Frontend built as static files served by FastAPI
- Production-ready for Ubuntu/NGINX deployment
- Can run as systemd service
- Frontend build output in `src/frontend/dist/`
- Development mode supports hot reload via Vite dev server

### Branding
- Application name: DataFlows Core
- Logo: `/media/img/logo.svg`
- Favicons: `/media/img/favicon.png` and `/media/img/favicon_256.png`
- Symbol: `/media/img/symbol.svg`
- Default company name: DataFlows Core
- Customizable branding via config API

### Notes
- Backend and frontend fully integrated
- Compatible with InvenTree 1.0.1 API
- Supports JSON Forms specification
- Single service for production (port 8000)
- Development server with API proxy (optional)
- Production build ready
- Responsive design for mobile and desktop
- MongoDB connection via single connection string
- Custom branding support
