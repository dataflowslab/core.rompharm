# API Routes Documentation
**Last Updated:** 2025-12-23 07:46:18
**Auto-generated** - Do not edit manually. Run `python src/scripts/generate_routes_doc.py` to update.
---
## 🌐 Global Platform Routes
### Approvals
- `GET /api/approvals/flows` - List approval flows
- `POST /api/approvals/flows` - Create approval flow for an object
- `GET /api/approvals/flows/object/{object_type}/{object_id}` - Get approval flow for specific object
- `GET /api/approvals/flows/{flow_id}` - Get approval flow
- `POST /api/approvals/flows/{flow_id}/sign` - Sign approval flow
- `DELETE /api/approvals/flows/{flow_id}/signatures/{user_id}` - Remove signature from flow (admin only)
- `GET /api/approvals/templates` - List approval templates
- `POST /api/approvals/templates` - Create approval template
- `DELETE /api/approvals/templates/{template_id}` - Delete approval template
- `GET /api/approvals/templates/{template_id}` - Get approval template
- `PUT /api/approvals/templates/{template_id}` - Update approval template

### Audit
- `GET /api/audit/` - Get audit logs with pagination and filtering
- `GET /api/audit/actions` - Get list of all available action types

### Auth
- `GET /api/auth/dashboard/shortcuts` - Get dashboard shortcuts for current user based on their role
- `GET /api/auth/me` - Get current user information
- `POST /api/auth/refresh-status` - Refresh user's staff status from InvenTree
- `GET /api/auth/verify` - Verify if current token is valid and return user info

### Config
- `GET /api/config/` - Get application configuration (public endpoint)
- `POST /api/config/` - Create or update application configuration (requires authentication)

### Crm
- `GET /api/crm/campaigns` - Get all campaigns
- `POST /api/crm/campaigns` - Create a new campaign
- `DELETE /api/crm/campaigns/{campaign_id}` - Delete a campaign
- `PUT /api/crm/campaigns/{campaign_id}` - Update a campaign
- `POST /api/crm/campaigns/{campaign_id}/send` - Mark campaign as ready to send (actual sending will be done by cron)
- `GET /api/crm/segments` - Get all segments
- `POST /api/crm/segments` - Create a new segment
- `DELETE /api/crm/segments/{segment_id}` - Delete a segment
- `PUT /api/crm/segments/{segment_id}` - Update a segment
- `GET /api/crm/subscribers` - Get all subscribers
- `POST /api/crm/subscribers` - Create a new subscriber
- `POST /api/crm/subscribers/import-inventree` - Import customers from InvenTree
- `DELETE /api/crm/subscribers/{subscriber_id}` - Delete a subscriber
- `PUT /api/crm/subscribers/{subscriber_id}` - Update a subscriber

### Data
- `POST /api/data/` - Submit form data
- `GET /api/data/files/{file_hash}` - Serve a file by its hash (public endpoint)
- `DELETE /api/data/submission/{submission_id}` - Delete a submission (requires administrator access)
- `GET /api/data/submission/{submission_id}` - Get a specific submission (requires administrator access)
- `GET /api/data/submission/{submission_id}/history` - Get state change history for a submission
- `PUT /api/data/submission/{submission_id}/state` - Update submission state (requires administrator access)
- `GET /api/data/submissions/all` - Get all submissions across all forms (requires administrator access)
- `GET /api/data/submissions/stats` - Get submission statistics (requires administrator access)
- `POST /api/data/upload` - Upload a file (public endpoint for form submissions)
- `GET /api/data/{form_id}` - Get all submissions for a form (requires administrator access)

### Documents
- `GET /api/documents/for/{object_id}` - Get all documents for an object
- `POST /api/documents/generate` - Generate document - returns only job_id
- `GET /api/documents/job/{job_id}/status` - Check job status
- `GET /api/documents/templates` - Get all available templates
- `DELETE /api/documents/{job_id}` - Delete document by job_id
- `GET /api/documents/{job_id}/download` - Download document by job_id

### Forms
- `GET /api/forms/` - List all forms (requires administrator access)
- `POST /api/forms/` - Create a new form (requires administrator access)
- `GET /api/forms/mail-templates/list` - List available email notification templates
- `DELETE /api/forms/{form_id}` - Soft delete a form (requires administrator access)
- `PUT /api/forms/{form_id}` - Update an existing form (requires administrator access)
- `GET /api/forms/{slug}` - Get form definition by slug
- `GET /api/forms/{slug}/qr` - Generate QR code SVG for form URL

### Recipes
- `GET /api/recipes` - List all recipes with optional search (latest revision only)
- `POST /api/recipes` - Create new recipe
- `GET /api/recipes/parts` - Search parts from depo_parts
- `GET /api/recipes/{recipe_id}` - Get recipe details
- `POST /api/recipes/{recipe_id}/increment-version` - Increment recipe version (revision)
- `POST /api/recipes/{recipe_id}/items` - Add item to recipe
- `DELETE /api/recipes/{recipe_id}/items/{item_index}` - Remove item from recipe
- `PUT /api/recipes/{recipe_id}/items/{item_index}` - Update item in recipe
- `POST /api/recipes/{recipe_id}/items/{item_index}/alternatives` - Add alternative to group (Type 2 item)
- `DELETE /api/recipes/{recipe_id}/items/{item_index}/alternatives/{alt_index}` - Remove alternative from group
- `PUT /api/recipes/{recipe_id}/items/{item_index}/alternatives/{alt_index}` - Update alternative in group
- `GET /api/recipes/{recipe_id}/logs` - Get recipe change history
- `GET /api/recipes/{recipe_id}/revisions` - Get all revisions for a recipe's product

### Sales
- `GET /api/sales/customers` - Get list of customers from InvenTree
- `GET /api/sales/order-statuses` - Get available sales order statuses from InvenTree
- `GET /api/sales/sales-orders` - Get list of sales orders from InvenTree
- `GET /api/sales/sales-orders/{order_id}` - Get a specific sales order from InvenTree
- `GET /api/sales/sales-orders/{order_id}/attachments` - Get attachments for a sales order
- `GET /api/sales/sales-orders/{order_id}/items` - Get items for a sales order with complete part details
- `GET /api/sales/sales-orders/{order_id}/shipments` - Get shipments for a sales order
- `PATCH /api/sales/sales-orders/{order_id}/status` - Update sales order status

### System
- `GET /api/currencies` - Get list of currencies
- `GET /api/system/jobs` - List all configured jobs
- `POST /api/system/jobs` - Create a new job configuration
- `DELETE /api/system/jobs/{job_name}` - Delete a job configuration
- `PUT /api/system/jobs/{job_name}` - Update job configuration
- `POST /api/system/jobs/{job_name}/run` - Manually trigger a job to run immediately
- `GET /api/system/notifications` - Get system notifications (warnings, errors, info)
- `GET /api/system/status` - Get system status and configuration

### Templates
- `GET /api/templates/` - List all templates from DataFlows Docu
- `POST /api/templates/` - Create a new template by creating its first part (usually base)
- `DELETE /api/templates/{template_code}` - Delete entire template bundle from OfficeClerk and local database
- `GET /api/templates/{template_code}` - Get template bundle with all parts from OfficeClerk
- `PUT /api/templates/{template_code}` - Update template metadata (name, description) in local database
- `POST /api/templates/{template_code}/parts` - Add a new part (header, footer, css, code) to existing template
- `DELETE /api/templates/{template_code}/{part_type}` - Delete a specific part from template
- `GET /api/templates/{template_code}/{part_type}` - Get metadata for specific template part
- `PUT /api/templates/{template_code}/{part_type}` - Update template part content and/or name
- `GET /api/templates/{template_code}/{part_type}/raw` - Get raw content of template part for editing

### Users
- `GET /api/users/` - List all users with their last login information

---

## 📦 Module Routes
### depo_procurement (`/modules/depo_procurement/api`)

**Document Templates**
- `GET /modules/depo_procurement/api/document-templates` - Get document template codes for procurement orders

**Order Statuses**
- `GET /modules/depo_procurement/api/order-statuses` - Get available purchase order statuses/states

**Parts**
- `GET /modules/depo_procurement/api/parts` - Get list of parts from MongoDB

**Purchase Orders**
- `GET /modules/depo_procurement/api/purchase-orders` - Get list of purchase orders from MongoDB
- `POST /modules/depo_procurement/api/purchase-orders` - Create a new purchase order in MongoDB
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}` - Get a specific purchase order from MongoDB
- `PATCH /modules/depo_procurement/api/purchase-orders/{order_id}` - Update a purchase order in MongoDB
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/approval-flow` - Get approval flow for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/approval-flow` - Create approval flow for a purchase order using approval_templates
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/attachments` - Get attachments for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/attachments` - Upload an attachment to a purchase order
- `DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/attachments/{attachment_id}` - Delete an attachment from a purchase order
- `PATCH /modules/depo_procurement/api/purchase-orders/{order_id}/documents` - Update documents field in purchase order
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/items` - Get items for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/items` - Add an item to a purchase order
- `DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/items/{item_id}` - Delete an item from a purchase order by item _id
- `PUT /modules/depo_procurement/api/purchase-orders/{order_id}/items/{item_id}` - Update an item in a purchase order by item _id
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/qc-records` - Get QC records for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/receive-stock` - Receive stock items for a purchase order line
- `GET /modules/depo_procurement/api/purchase-orders/{order_id}/received-items` - Get received stock items for a purchase order
- `POST /modules/depo_procurement/api/purchase-orders/{order_id}/sign` - Sign a purchase order approval flow
- `DELETE /modules/depo_procurement/api/purchase-orders/{order_id}/signatures/{user_id}` - Remove signature from purchase order approval flow (admin only)
- `PATCH /modules/depo_procurement/api/purchase-orders/{order_id}/state` - Update purchase order state

**Stock Statuses**
- `GET /modules/depo_procurement/api/stock-statuses` - Get available stock statuses from depo_stocks_states collection

### inventory (`/modules/inventory/api`)

**Articles**
- `GET /modules/inventory/api/articles` - Get list of articles from MongoDB with search, category filter, pagination and sorting
- `POST /modules/inventory/api/articles` - Create a new article
- `DELETE /modules/inventory/api/articles/{article_id}` - Delete an article
- `GET /modules/inventory/api/articles/{article_id}` - Get a specific article by ID
- `PUT /modules/inventory/api/articles/{article_id}` - Update an existing article
- `GET /modules/inventory/api/articles/{article_id}/allocations` - Get allocations for an article from sales and purchase orders
- `GET /modules/inventory/api/articles/{article_id}/recipes` - Get all recipes that use this article
- `GET /modules/inventory/api/articles/{article_id}/stock-calculations` - Calculate stock metrics for an article
- `GET /modules/inventory/api/articles/{article_id}/suppliers` - Get all suppliers for an article
- `POST /modules/inventory/api/articles/{article_id}/suppliers` - Add a supplier to an article
- `DELETE /modules/inventory/api/articles/{article_id}/suppliers/{supplier_relation_id}` - Remove a supplier from an article
- `PUT /modules/inventory/api/articles/{article_id}/suppliers/{supplier_relation_id}` - Update supplier information for an article

**Categories**
- `GET /modules/inventory/api/categories` - Get list of categories from MongoDB with parent details populated
- `POST /modules/inventory/api/categories` - Create a new category
- `DELETE /modules/inventory/api/categories/{category_id}` - Delete a category (only if it has no children and no articles)
- `PUT /modules/inventory/api/categories/{category_id}` - Update an existing category

**Clients**
- `GET /modules/inventory/api/clients` - Get list of clients (companies with is_client=true)
- `POST /modules/inventory/api/clients` - Create a new client
- `DELETE /modules/inventory/api/clients/{client_id}` - Delete a client
- `GET /modules/inventory/api/clients/{client_id}` - Get a specific client by ID
- `PUT /modules/inventory/api/clients/{client_id}` - Update an existing client

**Companies**
- `GET /modules/inventory/api/companies` - Get list of companies from MongoDB

**Locations**
- `GET /modules/inventory/api/locations` - Get list of locations from MongoDB with parent details populated
- `POST /modules/inventory/api/locations` - Create a new location
- `DELETE /modules/inventory/api/locations/{location_id}` - Delete a location (only if it has no children and no stocks)
- `PUT /modules/inventory/api/locations/{location_id}` - Update an existing location

**Manufacturers**
- `GET /modules/inventory/api/manufacturers` - Get list of manufacturers (companies with is_manufacturer=true)
- `POST /modules/inventory/api/manufacturers` - Create a new manufacturer
- `DELETE /modules/inventory/api/manufacturers/{manufacturer_id}` - Delete a manufacturer
- `GET /modules/inventory/api/manufacturers/{manufacturer_id}` - Get a specific manufacturer by ID
- `PUT /modules/inventory/api/manufacturers/{manufacturer_id}` - Update an existing manufacturer

**Parts**
- `GET /modules/inventory/api/parts` - Get list of parts (alias for articles) from MongoDB with search, pagination and sorting

**Stocks**
- `GET /modules/inventory/api/stocks` - Get list of stocks with enriched data including supplier information
- `POST /modules/inventory/api/stocks` - Create a new stock item
- `GET /modules/inventory/api/stocks/{stock_id}` - Get a specific stock entry with enriched data
- `PUT /modules/inventory/api/stocks/{stock_id}` - Update stock QC information

**Suppliers**
- `GET /modules/inventory/api/suppliers` - Get list of suppliers (companies with is_supplier=true)
- `POST /modules/inventory/api/suppliers` - Create a new supplier
- `DELETE /modules/inventory/api/suppliers/{supplier_id}` - Delete a supplier
- `GET /modules/inventory/api/suppliers/{supplier_id}` - Get a specific supplier by ID
- `PUT /modules/inventory/api/suppliers/{supplier_id}` - Update an existing supplier
- `GET /modules/inventory/api/suppliers/{supplier_id}/parts` - Get parts associated with a supplier
- `POST /modules/inventory/api/suppliers/{supplier_id}/parts` - Add a part to supplier's parts list
- `DELETE /modules/inventory/api/suppliers/{supplier_id}/parts/{part_id}` - Remove a part from supplier's parts list
- `PUT /modules/inventory/api/suppliers/{supplier_id}/parts/{part_id}` - Update supplier-specific data for a part

**System Ums**
- `GET /modules/inventory/api/system-ums` - Get list of system units of measure from MongoDB

### requests (`/modules/requests/api`)

**Parts**
- `GET /modules/requests/api/parts` - Get list of parts from MongoDB depo_parts with search
- `GET /modules/requests/api/parts/{part_id}/batch-codes` - Get available batch codes for a part from MongoDB depo_stocks
- `GET /modules/requests/api/parts/{part_id}/bom` - Get BOM (Bill of Materials) for a part from MongoDB depo_bom
- `GET /modules/requests/api/parts/{part_id}/recipe` - Get recipe for a part (with fallback to BOM if no recipe exists)
- `GET /modules/requests/api/parts/{part_id}/stock-info` - Get stock information for a part from MongoDB depo_stocks with batches
- `GET /modules/requests/api/` - List all requests with location names from depo_locations
- `POST /modules/requests/api/` - Create a new request

**Stock Locations**
- `GET /modules/requests/api/stock-locations` - Get list of stock locations from MongoDB depo_locations

**{Request_Id}**
- `DELETE /modules/requests/api/{request_id}` - Delete a request
- `GET /modules/requests/api/{request_id}` - Get a specific request by ID with location and part details from MongoDB
- `PATCH /modules/requests/api/{request_id}` - Update a request

---

## 📝 Notes

- All routes except `/api/auth/login` require authentication
- Admin-only routes require `is_staff` or `is_superuser` flag
- Module routes follow pattern: `/modules/{module_name}/api/{resource}`
- Global routes follow pattern: `/api/{resource}`

---

**To update this documentation, run:**
```bash
python src/scripts/generate_routes_doc.py
```
